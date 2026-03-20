import { useState, useEffect } from "react";
import { getCatalogMedia, listenCatalogMedia, getCatalogData, listenCatalogData } from "./firebase.js";

const WA = "77075771234";

const PRODUCTS = [
  { id:"bio", name:"Биоклиматические перголы", subtitle:"Greenawn · Villa 2.0 · IGS Premium", price:250000, priceMax:280000, color:"#2d7a4f", emoji:"🌿", tag:"Эксклюзив РК", badge:"ХИТ",
    desc:"Флагманское решение IGS Outdoor. Поворотные алюминиевые ламели регулируются от 0° до 135° — от полной тени до максимального проветривания. Встроенный водосток в колоннах отводит дождевую воду незаметно. Автоматизация Somfy позволяет управлять с пульта или смартфона. Работает круглый год в любую погоду.",
    features:["Поворот ламелей 0–135°","Автоматизация Somfy RTS","Водосток внутри колонн","Алюминий 6063-T6","Сертификат CE","Макс. ширина 12м"],
    options:["LED подсветка в ламелях","Инфракрасный обогреватель","Zip-шторы по периметру","Утеплённые ламели"],
    ids:["greenawn","igs_premium"] },
  { id:"toscana", name:"Тентовая пергола Toscana", subtitle:"Pergotek · Европейский дизайн", price:130000, color:"#7d6608", emoji:"⛺", tag:"Итальянский дизайн",
    desc:"Выдвижная ПВХ-крыша итальянского производства Pergotek. Проекция до 13.5 метров — одна из самых больших в классе. Алюминиевый каркас с порошковым покрытием. Идеальное решение для ресторанов, кафе и открытых террас.",
    features:["Выдвижная ПВХ-крыша","Проекция до 13.5м","Алюминиевый каркас","Ручное или моторизированное"],
    options:["LED подсветка","Моторизация Somfy"],
    ids:["toscana"] },
  { id:"sliding", name:"Слайдинг", subtitle:"Панорамное остекление", price:100000, color:"#1a6b8a", emoji:"🪟", tag:"Панорамное",
    desc:"Раздвижное панорамное остекление для террас и балконов. Стеклянные панели плавно складываются в сторону, полностью открывая пространство летом. Бесшумный роликовый механизм.",
    features:["2–4 стеклянные панели","Одинарное или двойное стекло","Алюминиевый профиль","Бесшумный механизм","Закалённое стекло"],
    options:["Двойное остекление","Тонировка стекла"],
    ids:["sliding"] },
  { id:"guillotine", name:"Гильотина", subtitle:"Автоматизированная", price:200000, color:"#6c3483", emoji:"🔳", tag:"Автоматизация",
    desc:"Стеклянные секции поднимаются вертикально вверх с помощью цепного привода. Ламинированное стекло 8мм. Полная автоматизация с пультом или смартфона. Герметичное закрытие без щелей.",
    features:["2–3 стеклянные секции","Цепной привод","Ламинированное стекло 8мм","Управление с пульта/смартфона","Герметичное закрытие"],
    options:["Автоматизация","Подсветка периметра"],
    ids:["guillotine"] },
  { id:"zip", name:"Zip-шторы", subtitle:"Ветрозащита", price:75000, color:"#784212", emoji:"🌬️", tag:"Ветрозащита до 180 км/ч",
    desc:"Ткань Dickson (Франция) опускается по боковым zip-направляющим — не выдует при порывах до 180 км/ч. Одновременно защищает от солнца, ветра и насекомых. Прозрачные и непрозрачные варианты.",
    features:["Ветрозащита до 180 км/ч","Ткань Dickson (Франция)","Zip-направляющие","Защита от насекомых","Прозрачный / непрозрачный"],
    options:["Моторизация","Москитная сетка","Датчик ветра"],
    ids:["zip"] },
  { id:"marquise", name:"Маркизы", subtitle:"Мобильное затенение", price:100000, color:"#1e8449", emoji:"☂️", tag:"Мобильное",
    desc:"Мобильное решение для затенения балконов и террас. Складной навес компактно убирается к стене. Маркизы от 6м рекомендуем делить на секции по 3–4м — дешевле и надёжнее.",
    features:["Мобильная установка","Рычажный механизм","Широкий выбор тканей","Компактное хранение","Выбор цветов RAL"],
    options:["Моторизация Somfy","Датчик ветра / солнца"],
    ids:["marquise"] },
];

const fmt = n => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
const isVideo = url => url && (url.includes(".mp4") || url.includes(".mov") || url.includes(".webm"));

export default function App() {
  const [selected, setSelected] = useState(null);
  const [media, setMedia] = useState({});
  const [extraData, setExtraData] = useState({});
  const product = PRODUCTS.find(p => p.id === selected);

  useEffect(() => {
    getCatalogMedia().then(d => { if (d) setMedia(d); });
    listenCatalogMedia(d => { if (d) setMedia(d); });
    getCatalogData().then(d => { if (d) setExtraData(d); });
    listenCatalogData(d => { if (d) setExtraData(d); });
  }, []);

  function getProductMedia(p) {
    const urls = [];
    for (const id of p.ids) {
      if (media[id]?.urls) urls.push(...media[id].urls);
    }
    return urls;
  }

  function getProductDesc(p) {
    for (const id of p.ids) {
      if (extraData[id]?.description) return extraData[id].description;
    }
    return p.desc;
  }

  return (
    <div style={{minHeight:"100vh",background:"#09090b",color:"#f4f4f5",fontFamily:"'Inter',system-ui,sans-serif"}}>
      {/* Шапка */}
      <header style={{background:"rgba(9,9,11,0.97)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(184,150,90,0.12)",padding:"0 20px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:60}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:"#b8965a"}}>IGS Outdoor</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:-1}}>Алматы · Перголы и остекление</div>
          </div>
          <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer"
            style={{display:"flex",alignItems:"center",gap:7,background:"rgba(37,211,102,0.1)",color:"#25d166",border:"1px solid rgba(37,211,102,0.2)",borderRadius:10,padding:"8px 16px",textDecoration:"none",fontSize:13,fontWeight:600}}>
            <span>💬</span><span className="wa-text">WhatsApp</span>
          </a>
        </div>
      </header>

      {/* Герой */}
      <div style={{background:"linear-gradient(160deg,#0f1a0f,#090f09)",padding:"52px 20px 44px",textAlign:"center",borderBottom:"1px solid rgba(184,150,90,0.08)"}}>
        <div style={{maxWidth:620,margin:"0 auto"}}>
          <div style={{fontSize:12,color:"#b8965a",fontWeight:700,letterSpacing:3,marginBottom:14,textTransform:"uppercase"}}>Каталог конструкций</div>
          <h1 style={{fontSize:"clamp(28px,5vw,44px)",fontWeight:800,margin:"0 0 16px",lineHeight:1.15}}>Перголы, остекление<br/>и защита от солнца</h1>
          <p style={{fontSize:15,color:"rgba(255,255,255,0.45)",margin:"0 0 28px",lineHeight:1.75}}>Проектируем и устанавливаем под ключ.<br/>Замер бесплатно. Работаем по всему Казахстану.</p>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Здравствуйте! Хочу бесплатный замер.")}`} target="_blank" rel="noreferrer"
              style={{background:"#b8965a",color:"#09090b",borderRadius:12,padding:"13px 26px",fontWeight:700,fontSize:14,textDecoration:"none"}}>
              Бесплатный замер
            </a>
            <a href="https://www.instagram.com/igs_outdoor" target="_blank" rel="noreferrer"
              style={{background:"rgba(255,255,255,0.06)",color:"#f4f4f5",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"13px 26px",fontWeight:600,fontSize:14,textDecoration:"none"}}>
              Instagram →
            </a>
          </div>
        </div>
      </div>

      {/* Дисклеймер */}
      <div style={{background:"rgba(184,150,90,0.04)",borderBottom:"1px solid rgba(184,150,90,0.08)",padding:"10px 20px",textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.3)"}}>
        ⚠️ Все цены за м² — ориентировочные. Итог зависит от площади, комплектации и монтажа. Точный расчёт — после бесплатного замера.
      </div>

      {/* Каталог */}
      <main style={{maxWidth:1100,margin:"0 auto",padding:"36px 16px 60px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
          {PRODUCTS.map(p => {
            const imgs = getProductMedia(p);
            const firstImg = imgs.find(u => !isVideo(u));
            return (
              <div key={p.id} onClick={()=>setSelected(p.id)}
                style={{background:"#111",border:"1px solid rgba(255,255,255,0.07)",borderTop:`3px solid ${p.color}`,borderRadius:14,overflow:"hidden",cursor:"pointer",transition:"all 0.25s",position:"relative"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 12px 40px ${p.color}18`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                {p.badge&&<div style={{position:"absolute",top:12,left:12,background:"#b8965a",color:"#09090b",borderRadius:6,padding:"3px 9px",fontSize:10,fontWeight:800,zIndex:2}}>{p.badge}</div>}
                {firstImg ? (
                  <div style={{height:200,overflow:"hidden"}}>
                    <img src={firstImg} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover",transition:"transform 0.4s"}}
                      onMouseEnter={e=>e.target.style.transform="scale(1.05)"} onMouseLeave={e=>e.target.style.transform="none"}
                      onError={e=>{e.target.parentElement.style.display="none";}}/>
                    {imgs.length>1&&<div style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,0.6)",color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>+{imgs.length-1} фото</div>}
                  </div>
                ) : (
                  <div style={{height:110,background:`linear-gradient(135deg,${p.color}18,${p.color}06)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:46}}>{p.emoji}</div>
                )}
                <div style={{padding:"16px 18px 18px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:8}}>
                    <div style={{fontSize:16,fontWeight:700,lineHeight:1.3}}>{p.name}</div>
                    <span style={{background:`${p.color}20`,color:p.color,borderRadius:6,padding:"3px 9px",fontSize:10,fontWeight:700,flexShrink:0}}>{p.tag}</span>
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:10}}>{p.subtitle}</div>
                  <p style={{fontSize:13,color:"rgba(255,255,255,0.45)",lineHeight:1.6,margin:"0 0 14px",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                    {getProductDesc(p)}
                  </p>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginBottom:2}}>от</div>
                      <div style={{fontSize:20,fontWeight:800,color:p.color,fontFamily:"monospace"}}>{fmt(p.price)}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.2)"}}>за м²</div>
                    </div>
                    <div style={{background:`${p.color}15`,color:p.color,border:`1px solid ${p.color}30`,borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:600}}>Подробнее →</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Футер */}
      <footer style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"28px 20px",textAlign:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:"#b8965a",marginBottom:8}}>IGS Outdoor</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:4}}>📍 Шоурум: ул. Сагдат Нурмагамбетова 140/10, Алматы</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:16}}>🕐 Ежедневно 9:00–22:00 · Воскресенье — выходной</div>
        <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(37,211,102,0.1)",color:"#25d166",border:"1px solid rgba(37,211,102,0.2)",borderRadius:10,padding:"10px 20px",textDecoration:"none",fontSize:14,fontWeight:600}}>
          💬 +7 707 577-12-34
        </a>
      </footer>

      {/* Детальная карточка */}
      {product&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:999,overflowY:"auto"}} onClick={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
          <div style={{minHeight:"100%",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px"}}>
            <div style={{background:"#111",borderRadius:18,width:"100%",maxWidth:600,border:"1px solid rgba(255,255,255,0.08)",marginTop:16,marginBottom:40}}>
              <div style={{padding:"18px 22px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:19,fontWeight:700}}>{product.emoji} {product.name}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:3}}>{product.subtitle}</div>
                </div>
                <button onClick={()=>setSelected(null)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,width:36,height:36,cursor:"pointer",fontSize:17,color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
              </div>
              <div style={{padding:"22px"}}>
                {(()=>{
                  const imgs=getProductMedia(product);
                  if(!imgs.length) return null;
                  return(
                    <div style={{marginBottom:20}}>
                      <div style={{borderRadius:12,overflow:"hidden",marginBottom:8,background:"#1a1a1a"}}>
                        {isVideo(imgs[0])?<video src={imgs[0]} controls style={{width:"100%",maxHeight:320,objectFit:"cover"}}/>:<img src={imgs[0]} alt="" style={{width:"100%",maxHeight:320,objectFit:"cover"}} onError={e=>e.target.parentElement.style.display="none"}/>}
                      </div>
                      {imgs.length>1&&(
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                          {imgs.slice(1,5).map((url,i)=>(
                            <div key={i} style={{borderRadius:8,overflow:"hidden",aspectRatio:"1",background:"#1a1a1a"}}>
                              {isVideo(url)?<video src={url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.parentElement.style.display="none"}/>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div style={{background:`${product.color}12`,border:`1px solid ${product.color}25`,borderRadius:12,padding:"16px 18px",marginBottom:18}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4}}>Цена от</div>
                  <div style={{fontSize:32,fontWeight:800,color:product.color,fontFamily:"monospace"}}>{fmt(product.price)}{product.priceMax?` — ${fmt(product.priceMax)}`:""}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:5}}>за м² · ориентировочная цена</div>
                </div>
                <p style={{fontSize:14,color:"rgba(255,255,255,0.6)",lineHeight:1.8,margin:"0 0 20px"}}>{getProductDesc(product)}</p>
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",letterSpacing:1.5,marginBottom:12,textTransform:"uppercase"}}>Что включено</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px"}}>
                    {product.features.map(f=>(
                      <div key={f} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                        <span style={{color:product.color,flexShrink:0,marginTop:2}}>✓</span>
                        <span style={{fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.4}}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {product.options?.length>0&&(
                  <div style={{marginBottom:22}}>
                    <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",letterSpacing:1.5,marginBottom:10,textTransform:"uppercase"}}>Дополнительные опции</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                      {product.options.map(o=><span key={o} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"6px 12px",fontSize:12,color:"rgba(255,255,255,0.5)"}}>+ {o}</span>)}
                    </div>
                  </div>
                )}
                <a href={`https://wa.me/${WA}?text=${encodeURIComponent(`Здравствуйте! Интересует ${product.name}. Хочу узнать стоимость и записаться на замер.`)}`}
                  target="_blank" rel="noreferrer"
                  style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25d166",color:"#09090b",borderRadius:12,padding:"16px",fontWeight:700,fontSize:15,textDecoration:"none"}}>
                  💬 Узнать стоимость в WhatsApp
                </a>
                <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:10}}>Замер бесплатно · Воскресенье — выходной</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
