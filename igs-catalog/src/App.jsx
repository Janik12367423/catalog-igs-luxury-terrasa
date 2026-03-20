import { useState, useEffect } from "react";
import { getCatalogMedia, listenCatalogMedia } from "./firebase.js";

const WA = "77075771234";

const PRODUCTS = [
  {
    id: "bio",
    name: "Биоклиматические перголы",
    subtitle: "Greenawn · Villa 2.0 · IGS Premium",
    price: 250000,
    priceMax: 280000,
    color: "#2d7a4f",
    emoji: "🌿",
    tag: "Эксклюзив РК",
    desc: "Поворотные алюминиевые ламели 0–135°. Работают в дождь, жару и ветер. Автоматизация Somfy, водосток в колоннах. Всепогодное решение для террас.",
    features: ["Поворот ламелей 0–135°", "Автоматизация Somfy", "Водосток в колоннах", "Алюминий 6063-T6", "Сертификат CE", "Макс. ширина 12м"],
    options: ["LED подсветка", "Инфракрасный обогреватель", "Zip-шторы по периметру", "Утеплённые ламели"],
    ids: ["greenawn", "igs_premium"],
  },
  {
    id: "toscana",
    name: "Тентовая пергола Toscana",
    subtitle: "Pergotek · Европейский дизайн",
    price: 130000,
    color: "#7d6608",
    emoji: "⛺",
    tag: "Итальянский дизайн",
    desc: "Выдвижная ПВХ-крыша итальянского производства Pergotek. Проекция до 13.5 м. Элегантный дизайн для открытых террас и ресторанов.",
    features: ["Выдвижная ПВХ-крыша", "Проекция до 13.5м", "Алюминиевый каркас", "Европейский дизайн", "Ручное / моторизированное"],
    options: ["LED подсветка", "Моторизация"],
    ids: ["toscana"],
  },
  {
    id: "sliding",
    name: "Слайдинг",
    subtitle: "Панорамное остекление",
    price: 100000,
    color: "#1a6b8a",
    emoji: "🪟",
    tag: "Панорамное",
    desc: "Раздвижное панорамное остекление. Стеклянные панели складываются в сторону, полностью открывая пространство. Идеально для веранд и балконов.",
    features: ["2–4 секции", "Одинарное / двойное стекло", "Алюминиевый профиль", "Бесшумное движение", "Безопасное закалённое стекло"],
    options: ["Двойное остекление", "Тонировка"],
    ids: ["sliding"],
  },
  {
    id: "guillotine",
    name: "Гильотина",
    subtitle: "Автоматизированная",
    price: 200000,
    color: "#6c3483",
    emoji: "🔳",
    tag: "Автоматизация",
    desc: "Стеклянные секции поднимаются вертикально вверх. Цепной привод, ламинированное стекло, полная автоматизация с пультом или смартфоном.",
    features: ["2–3 секции", "Цепной привод", "Ламинированное стекло", "Пульт / смартфон", "Герметичное закрытие"],
    options: ["Автоматизация с пультом", "Подсветка"],
    ids: ["guillotine"],
  },
  {
    id: "zip",
    name: "Zip-шторы",
    subtitle: "Ветрозащита",
    price: 75000,
    color: "#784212",
    emoji: "🌬️",
    tag: "Ветрозащита до 180 км/ч",
    desc: "Защита от ветра до 180 км/ч. Ткань Dickson опускается по боковым zip-направляющим. Защищает от солнца, ветра и насекомых одновременно.",
    features: ["Ветрозащита до 180 км/ч", "Защита от насекомых", "Ткань Dickson", "Кассетная система", "Прозрачный / непрозрачный"],
    options: ["Моторизация", "Москитная сетка"],
    ids: ["zip"],
  },
  {
    id: "marquise",
    name: "Маркизы",
    subtitle: "Мобильное затенение",
    price: 100000,
    color: "#1e8449",
    emoji: "☂️",
    tag: "Мобильное",
    desc: "Мобильное решение для затенения террас и балконов. Компактно складывается к стене. Большие маркизы от 6м выгоднее делить на секции по 3–4м.",
    features: ["Мобильная установка", "Различные ткани", "Ручное / моторизированное", "Компактное хранение", "Большой выбор цветов"],
    options: ["Моторизация", "Датчик ветра / солнца"],
    ids: ["marquise"],
  },
];

const fmt = n => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
const isVideo = url => url && (url.includes(".mp4") || url.includes(".mov") || url.includes(".webm"));

export default function App() {
  const [selected, setSelected] = useState(null);
  const [media, setMedia] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const product = PRODUCTS.find(p => p.id === selected);

  useEffect(() => {
    getCatalogMedia().then(data => { if (data) setMedia(data); });
    listenCatalogMedia(data => { if (data) setMedia(data); });
  }, []);

  // Получаем медиа для продукта (объединяем по всем ids)
  function getProductMedia(product) {
    const urls = [];
    for (const id of product.ids) {
      if (media[id]?.urls) urls.push(...media[id].urls);
    }
    return urls;
  }

  const waMsg = product
    ? `Здравствуйте! Интересует ${product.name}. Хотел бы узнать подробнее и получить расчёт.`
    : `Здравствуйте! Хотел бы узнать подробнее о ваших конструкциях.`;

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#f4f4f5", fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Шапка */}
      <header style={{ background: "rgba(9,9,11,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(184,150,90,0.12)", padding: "0 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#b8965a", letterSpacing: -0.5 }}>IGS Outdoor</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: -1 }}>Алматы · Перголы и остекление</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(37,211,102,0.1)", color: "#25d166", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 10, padding: "8px 14px", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              <span>💬</span><span className="wa-text">WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      {/* Герой */}
      <div style={{ background: "linear-gradient(160deg,#0f1a0f,#090f09)", padding: "48px 20px 40px", textAlign: "center", borderBottom: "1px solid rgba(184,150,90,0.08)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 13, color: "#b8965a", fontWeight: 600, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Каталог конструкций</div>
          <h1 style={{ fontSize: "clamp(26px,5vw,42px)", fontWeight: 800, margin: "0 0 14px", lineHeight: 1.2 }}>
            Перголы, остекление<br/>и защита от солнца
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", margin: "0 0 24px", lineHeight: 1.7 }}>
            Проектируем и устанавливаем под ключ в Алматы и Казахстане.<br/>
            Замер бесплатно. Гарантия на монтаж.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Здравствуйте! Хочу бесплатный замер.")}`}
              target="_blank" rel="noreferrer"
              style={{ background: "#b8965a", color: "#09090b", borderRadius: 12, padding: "12px 24px", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              Бесплатный замер
            </a>
            <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer"
              style={{ background: "rgba(255,255,255,0.06)", color: "#f4f4f5", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 24px", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
              Написать нам
            </a>
          </div>
        </div>
      </div>

      {/* Дисклеймер */}
      <div style={{ background: "rgba(184,150,90,0.05)", borderBottom: "1px solid rgba(184,150,90,0.1)", padding: "10px 20px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
        ⚠️ Все цены за м² — ориентировочные. Итог зависит от площади, комплектации и монтажа. Точный расчёт после замера.
      </div>

      {/* Каталог */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {PRODUCTS.map(p => {
            const imgs = getProductMedia(p);
            const firstImg = imgs.find(u => !isVideo(u));
            return (
              <div key={p.id} onClick={() => setSelected(p.id)}
                style={{ background: "#111", border: `1px solid rgba(255,255,255,0.07)`, borderTop: `3px solid ${p.color}`, borderRadius: 14, overflow: "hidden", cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 32px ${p.color}20`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>

                {/* Фото */}
                {firstImg ? (
                  <div style={{ height: 200, overflow: "hidden" }}>
                    <img src={firstImg} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s" }}
                      onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
                      onMouseLeave={e => e.target.style.transform = "none"}
                      onError={e => { e.target.parentElement.style.display = "none"; }} />
                  </div>
                ) : (
                  <div style={{ height: 120, background: `linear-gradient(135deg,${p.color}15,${p.color}05)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
                    {p.emoji}
                  </div>
                )}

                <div style={{ padding: "16px 18px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 3 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{p.subtitle}</div>
                    </div>
                    <span style={{ background: `${p.color}20`, color: p.color, borderRadius: 6, padding: "3px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{p.tag}</span>
                  </div>

                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: "0 0 14px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {p.desc}
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>от</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: p.color, fontFamily: "monospace" }}>{fmt(p.price)}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>за м²</div>
                    </div>
                    <div style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30`, borderRadius: 9, padding: "7px 14px", fontSize: 12, fontWeight: 600 }}>
                      Подробнее →
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Футер */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#b8965a", marginBottom: 6 }}>IGS Outdoor</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>📍 Шоурум: ул. Сагдат Нурмагамбетова 140/10, Алматы</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>🕐 Ежедневно 9:00–22:00</div>
        <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,211,102,0.1)", color: "#25d166", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 10, padding: "9px 18px", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          💬 +7 707 577-12-34
        </a>
      </footer>

      {/* Детальная карточка */}
      {product && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 999, overflowY: "auto" }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div style={{ minHeight: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px" }}>
            <div style={{ background: "#111", borderRadius: 18, width: "100%", maxWidth: 580, border: `1px solid rgba(255,255,255,0.08)`, marginTop: 20 }}>

              {/* Header */}
              <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{product.emoji} {product.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{product.subtitle}</div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 16, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✕
                </button>
              </div>

              <div style={{ padding: "20px" }}>
                {/* Галерея */}
                {(() => {
                  const imgs = getProductMedia(product);
                  if (!imgs.length) return null;
                  return (
                    <div style={{ marginBottom: 20 }}>
                      {/* Главное фото */}
                      {imgs[0] && (
                        <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 8, aspectRatio: "16/9" }}>
                          {isVideo(imgs[0]) ? (
                            <video src={imgs[0]} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <img src={imgs[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.parentElement.style.display = "none"} />
                          )}
                        </div>
                      )}
                      {/* Остальные миниатюры */}
                      {imgs.length > 1 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                          {imgs.slice(1, 5).map((url, i) => (
                            <div key={i} style={{ borderRadius: 8, overflow: "hidden", aspectRatio: "1" }}>
                              {isVideo(url) ? (
                                <video src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.parentElement.style.display = "none"} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Цена */}
                <div style={{ background: `${product.color}12`, border: `1px solid ${product.color}25`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Цена от</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: product.color, fontFamily: "monospace" }}>
                    {fmt(product.price)}{product.priceMax ? ` — ${fmt(product.priceMax)}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>за м² · цена ориентировочная, зависит от площади и комплектации</div>
                </div>

                {/* Описание */}
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: "0 0 16px" }}>{product.desc}</p>

                {/* Преимущества */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>Включено</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {product.features.map(f => (
                      <div key={f} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                        <span style={{ color: product.color, flexShrink: 0, fontSize: 12, marginTop: 2 }}>✓</span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Опции */}
                {product.options?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>Дополнительно</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {product.options.map(o => (
                        <span key={o} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "5px 11px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                          + {o}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <a href={`https://wa.me/${WA}?text=${encodeURIComponent(`Здравствуйте! Интересует ${product.name}. Хочу узнать стоимость и записаться на замер.`)}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#25d166", color: "#09090b", borderRadius: 12, padding: "15px", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                  💬 Узнать стоимость в WhatsApp
                </a>
                <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
                  Замер бесплатно · Воскресенье — выходной
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
