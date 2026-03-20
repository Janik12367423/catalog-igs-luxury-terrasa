// api/bot-lead.js — Vercel Serverless Function
// Принимает webhook от nextbot.kz, сохраняет в Firebase, шлёт WhatsApp уведомление
//
// НАСТРОЙКА (Vercel → Settings → Environment Variables):
//   FIREBASE_DB_URL   = https://igs-crm-59901-default-rtdb.europe-west1.firebasedatabase.app
//   FIREBASE_SECRET   = <Database Secret из Firebase Console → Project Settings → Service Accounts>
//   CALLMEBOT_PHONE   = 77771234567  (твой номер WhatsApp без +)
//   CALLMEBOT_APIKEY  = <получить на https://www.callmebot.com/blog/free-api-whatsapp-messages/>
//   WEBHOOK_SECRET    = любой_случайный_ключ (указать тот же в nextbot.kz)

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-webhook-secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Проверка секрета (опционально — если nextbot.kz поддерживает заголовки)
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = req.body || {};

    // ── Парсим данные от nextbot.kz ───────────────────────────────────────
    // nextbot.kz отправляет данные диалога при вызове [save_user_data]
    // Структура может отличаться — адаптируй поля под свой формат
    const lead = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      source: "bot",

      // Основные данные клиента
      name:    body.name    || body.client_name  || body.contact_name || "Неизвестно",
      phone:   body.phone   || body.whatsapp     || body.contact_phone || "",
      address: body.address || body.location     || body.city         || "",

      // Данные о запросе
      productType: body.product_type || body.solution || body.product || "",
      dimensions:  body.dimensions   || body.size     || "",
      objectType:  body.object_type  || body.object   || "",
      hasMedia:    body.has_media     || body.media    || false,
      notes:       body.notes        || body.summary  || body.message || "",

      // Квалификация
      isWarm:    body.is_warm    ?? body.warm    ?? true,
      wantsMeasure: body.wants_measure ?? body.measure ?? false,

      // Полный текст диалога (если nextbot передаёт)
      conversation: body.conversation || body.dialog || "",

      // Статус в CRM
      status: "new", // new | contacted | converted | lost
    };

    // ── Сохраняем в Firebase ──────────────────────────────────────────────
    const dbUrl = process.env.FIREBASE_DB_URL;
    const dbSecret = process.env.FIREBASE_SECRET;

    if (dbUrl && dbSecret) {
      const firebaseRes = await fetch(
        `${dbUrl}/bot_leads/${lead.id}.json?auth=${dbSecret}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead),
        }
      );

      if (!firebaseRes.ok) {
        console.error("Firebase error:", await firebaseRes.text());
      }
    }

    // ── Отправляем уведомление в Telegram ────────────────────────────────
    const tgToken  = "8688553798:AAG9OzcKxzAvQCwq37Wv-UBoPziRzh7HyHY";
    const tgChatId = "-4996071438"; // Группа IGS

    if (tgToken && tgChatId) {
      const msg = buildTelegramMessage(lead);
      try {
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: msg,
            parse_mode: "HTML",
          }),
        });
      } catch (e) {
        console.error("Telegram send error:", e);
      }
    }

    return res.status(200).json({ ok: true, id: lead.id });

  } catch (err) {
    console.error("bot-lead error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function buildTelegramMessage(lead) {
  const lines = [
    "🤖 <b>НОВЫЙ ЛИД ОТ БОТА</b>",
    "━━━━━━━━━━━━━━━━",
  ];

  if (lead.name && lead.name !== "Неизвестно") lines.push(`👤 <b>${lead.name}</b>`);
  if (lead.phone)        lines.push(`📞 <code>${lead.phone}</code>`);
  if (lead.productType)  lines.push(`🌿 ${lead.productType}`);
  if (lead.dimensions)   lines.push(`📐 ${lead.dimensions}`);
  if (lead.objectType)   lines.push(`🏠 ${lead.objectType}`);
  if (lead.address)      lines.push(`📍 ${lead.address}`);
  if (lead.hasMedia)     lines.push(`📸 Прислал фото`);
  if (lead.wantsMeasure) lines.push(`📅 Хочет замер`);
  if (lead.notes)        lines.push(`
📝 ${lead.notes}`);

  lines.push("━━━━━━━━━━━━━━━━");
  lines.push(`🔗 <a href="https://igs-luxurry-terrasa.vercel.app">Открыть CRM</a>`);

  return lines.join("\n");
}
