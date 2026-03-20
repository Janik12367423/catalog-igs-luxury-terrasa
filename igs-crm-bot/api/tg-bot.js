// api/tg-bot.js — Telegram бот с командами для управления лидами
// Подключить webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://igs-luxurry-terrasa.vercel.app/api/tg-bot

const TOKEN = "8688553798:AAG9OzcKxzAvQCwq37Wv-UBoPziRzh7HyHY";
const CHAT_ID = "-4996071438"; // Группа "Отчеты по боту ватсап igs"
const ALLOWED_CHATS = ["-4996071438", "7587676711", "1382101739"];
const DB_URL = process.env.FIREBASE_DB_URL;
const DB_SECRET = process.env.FIREBASE_SECRET;

// ── Firebase helpers ──────────────────────────────────────────────────────────
async function fbGet(path) {
  const res = await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`);
  return res.json();
}
async function fbSet(path, data) {
  await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ── Telegram helpers ──────────────────────────────────────────────────────────
async function sendMessage(chatId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
}

async function answerCallback(callbackQueryId, text = "") {
  await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ── Категории лидов ───────────────────────────────────────────────────────────
function categorizeLead(lead) {
  // 1) Если nextbot уже определил категорию через параметр Stage/notes
  const stage = (lead.notes || lead.stage || "").toLowerCase();
  if (stage.includes("горяч")) return "hot";
  if (stage.includes("тёпл") || stage.includes("tepл") || stage.includes("тепл")) return "warm";
  if (stage.includes("холодн")) return "cold";

  // 2) Если статус уже выставлен вручную на сайте
  const status = lead.status || "new";
  if (status === "converted") return "hot";
  if (status === "contacted") return "warm";

  // 3) Автоопределение по данным
  if (lead.wants_measure && lead.wants_measure !== "Не назначено" && lead.wants_measure !== "") return "hot";
  if (lead.dimensions && lead.dimensions !== "Не указано" && lead.dimensions !== "") return "warm";
  if ((lead.product_type || lead.productType) && (lead.product_type || lead.productType) !== "Не указано") return "warm";

  return "cold";
}

const CATEGORIES = {
  hot:  { label: "🔥 Горячие",  emoji: "🔥", desc: "Хотят замер / готовы к покупке" },
  warm: { label: "🟡 Тёплые",   emoji: "🟡", desc: "Есть размеры / тип конструкции" },
  cold: { label: "❄️ Холодные", emoji: "❄️", desc: "Просто интересуются" },
};

// ── Форматирование лида ───────────────────────────────────────────────────────
function formatLead(lead, index) {
  const lines = [`<b>${index + 1}. ${lead.name || "Неизвестно"}</b>`];
  if (lead.phone)                              lines.push(`📞 ${lead.phone}`);
  if (lead.product_type || lead.productType)   lines.push(`🌿 ${lead.product_type || lead.productType}`);
  if (lead.dimensions && lead.dimensions !== "Не указано") lines.push(`📐 ${lead.dimensions}`);
  if (lead.address)                            lines.push(`📍 ${lead.address}`);
  if (lead.wants_measure && lead.wants_measure !== "Не назначено") lines.push(`📅 ${lead.wants_measure}`);
  if (lead.notes && lead.notes !== "Не указано") lines.push(`📝 ${lead.notes}`);
  const date = lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ru-RU", {day:"numeric",month:"short"}) : "";
  if (date) lines.push(`🕐 ${date}`);
  return lines.join("\n");
}

// ── Главный обработчик ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(200).end();

  try {
    const body = req.body || {};
    const chatId = body.message?.chat?.id || body.callback_query?.message?.chat?.id;

    // Только отвечаем разрешённым chat_id
    if (!ALLOWED_CHATS.includes(String(chatId))) return res.status(200).end();

    // ── Обработка callback кнопок ─────────────────────────────────────────────
    if (body.callback_query) {
      const data = body.callback_query.data;
      await answerCallback(body.callback_query.id);

      // Выбор категории: cat_hot / cat_warm / cat_cold
      if (data.startsWith("cat_")) {
        const catKey = data.replace("cat_", "");
        const cat = CATEGORIES[catKey];
        if (!cat) return res.status(200).end();

        // Загружаем лиды из Firebase
        const fbLeads = await fbGet("bot_leads");
        if (!fbLeads || typeof fbLeads !== "object") {
          await sendMessage(chatId, "📭 Лидов пока нет.");
          return res.status(200).end();
        }

        const all = Object.values(fbLeads).filter(l => !l.deleted);
        const filtered = all.filter(l => categorizeLead(l) === catKey);

        if (filtered.length === 0) {
          await sendMessage(chatId, `${cat.emoji} <b>${cat.label}</b>\n\nЛидов в этой категории нет.`);
          return res.status(200).end();
        }

        // Разбиваем на части по 5 лидов (лимит Telegram)
        const chunks = [];
        for (let i = 0; i < filtered.length; i += 5) {
          chunks.push(filtered.slice(i, i + 5));
        }

        for (let ci = 0; ci < chunks.length; ci++) {
          const chunk = chunks[ci];
          const header = ci === 0 ? `${cat.emoji} <b>${cat.label}</b> — ${filtered.length} лидов\n━━━━━━━━━━━━━━━━\n\n` : "";
          const text = header + chunk.map((l, i) => formatLead(l, ci * 5 + i)).join("\n\n━━━━━━━━━━━━━━━━\n\n");
          await sendMessage(chatId, text);
        }

        return res.status(200).end();
      }

      // Поиск по имени/телефону
      if (data.startsWith("search_")) {
        await sendMessage(chatId, "🔍 Введите имя или номер телефона клиента:");
        await fbSet(`tg_state/${chatId}`, { action: "search", ts: Date.now() });
        return res.status(200).end();
      }
    }

    // ── Обработка сообщений ────────────────────────────────────────────────────
    if (body.message) {
      const text = (body.message.text || "").trim();

      // Проверяем состояние (ждём поиска?)
      const state = await fbGet(`tg_state/${chatId}`);
      if (state && state.action === "search" && Date.now() - state.ts < 120000) {
        // Ищем по имени или телефону
        await fbSet(`tg_state/${chatId}`, null);
        const query = text.toLowerCase();
        const fbLeads = await fbGet("bot_leads");
        if (!fbLeads) {
          await sendMessage(chatId, "📭 Лидов нет.");
          return res.status(200).end();
        }
        const results = Object.values(fbLeads).filter(l =>
          !l.deleted && (
            (l.name || "").toLowerCase().includes(query) ||
            (l.phone || "").replace(/\D/g,"").includes(query.replace(/\D/g,""))
          )
        );
        if (results.length === 0) {
          await sendMessage(chatId, `🔍 По запросу <b>"${text}"</b> ничего не найдено.`);
        } else {
          const cat = (l) => CATEGORIES[categorizeLead(l)]?.emoji || "❓";
          const msg = `🔍 Найдено: <b>${results.length}</b>\n\n` +
            results.map((l, i) => `${cat(l)} ` + formatLead(l, i)).join("\n\n━━━━━━━━━━━━━━━━\n\n");
          await sendMessage(chatId, msg);
        }
        return res.status(200).end();
      }

      // ── Команды — убираем @botname из команд в группах ──────────────────────
      const cmd = text.split("@")[0]; // /clients@igs_luxury_terrasa → /clients

      if (cmd === "/start" || cmd === "/help") {
        await sendMessage(chatId,
          "👋 <b>IGS Outdoor CRM Bot</b>\n\n" +
          "Доступные команды:\n\n" +
          "/clients — Лиды по категориям\n" +
          "/search — Поиск по имени/телефону\n" +
          "/stats — Статистика лидов\n" +
          "/new — Новые лиды (сегодня)\n" +
          "/hot — Только горячие лиды"
        );
        return res.status(200).end();
      }

      if (cmd === "/clients") {
        // Считаем количество в каждой категории
        const fbLeads = await fbGet("bot_leads");
        const all = fbLeads ? Object.values(fbLeads).filter(l => !l.deleted) : [];
        const counts = { hot: 0, warm: 0, cold: 0 };
        all.forEach(l => { const c = categorizeLead(l); if (counts[c] !== undefined) counts[c]++; });

        await sendMessage(chatId,
          "📊 <b>Выберите категорию лидов:</b>",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: `🔥 Горячие (${counts.hot})`,  callback_data: "cat_hot"  }],
                [{ text: `🟡 Тёплые (${counts.warm})`,  callback_data: "cat_warm" }],
                [{ text: `❄️ Холодные (${counts.cold})`, callback_data: "cat_cold" }],
                [{ text: `🔍 Поиск по имени/телефону`,   callback_data: "search_" }],
              ]
            }
          }
        );
        return res.status(200).end();
      }

      if (cmd === "/search") {
        await sendMessage(chatId, "🔍 Введите имя или номер телефона:");
        await fbSet(`tg_state/${chatId}`, { action: "search", ts: Date.now() });
        return res.status(200).end();
      }

      if (cmd === "/hot") {
        const fbLeads = await fbGet("bot_leads");
        const all = fbLeads ? Object.values(fbLeads).filter(l => !l.deleted) : [];
        const hot = all.filter(l => categorizeLead(l) === "hot");
        if (!hot.length) {
          await sendMessage(chatId, "🔥 Горячих лидов пока нет.");
        } else {
          const msg = `🔥 <b>Горячие лиды — ${hot.length}</b>\n━━━━━━━━━━━━━━━━\n\n` +
            hot.map((l, i) => formatLead(l, i)).join("\n\n━━━━━━━━━━━━━━━━\n\n");
          await sendMessage(chatId, msg);
        }
        return res.status(200).end();
      }

      if (cmd === "/new") {
        const fbLeads = await fbGet("bot_leads");
        const all = fbLeads ? Object.values(fbLeads).filter(l => !l.deleted) : [];
        const today = new Date().toDateString();
        const newToday = all.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === today);
        if (!newToday.length) {
          await sendMessage(chatId, "📭 Сегодня новых лидов нет.");
        } else {
          const msg = `📅 <b>Новые сегодня — ${newToday.length}</b>\n━━━━━━━━━━━━━━━━\n\n` +
            newToday.map((l, i) => `${CATEGORIES[categorizeLead(l)]?.emoji} ` + formatLead(l, i)).join("\n\n━━━━━━━━━━━━━━━━\n\n");
          await sendMessage(chatId, msg);
        }
        return res.status(200).end();
      }

      if (cmd === "/stats") {
        const fbLeads = await fbGet("bot_leads");
        const all = fbLeads ? Object.values(fbLeads).filter(l => !l.deleted) : [];
        const counts = { hot: 0, warm: 0, cold: 0 };
        all.forEach(l => { const c = categorizeLead(l); if (counts[c] !== undefined) counts[c]++; });
        const today = new Date().toDateString();
        const todayCount = all.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === today).length;

        await sendMessage(chatId,
          `📊 <b>Статистика лидов</b>\n━━━━━━━━━━━━━━━━\n\n` +
          `Всего лидов: <b>${all.length}</b>\n` +
          `Сегодня: <b>${todayCount}</b>\n\n` +
          `🔥 Горячих: <b>${counts.hot}</b>\n` +
          `🟡 Тёплых: <b>${counts.warm}</b>\n` +
          `❄️ Холодных: <b>${counts.cold}</b>`
        );
        return res.status(200).end();
      }
    }

    return res.status(200).end();
  } catch (err) {
    console.error("tg-bot error:", err);
    return res.status(200).end(); // всегда 200 для Telegram
  }
}
