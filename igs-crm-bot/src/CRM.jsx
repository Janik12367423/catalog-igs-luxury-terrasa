import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { dbSet, dbGet, dbListen, isOnline, uploadCatalogFile } from "./firebase.js";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "igs_crm_clients_v3";
const PRICES_KEY  = "igs_crm_prices_v1";
const CUSTOM_PRODUCTS_KEY = "igs_crm_custom_products";
const CATALOG_MEDIA_KEY = "igs_catalog_media_v1";

function loadCatalogMedia(){try{const r=JSON.parse(localStorage.getItem(CATALOG_MEDIA_KEY)||"null");if(r&&typeof r==="object")return r;}catch(_){}return{};}
function saveCatalogMedia(data){
  try{localStorage.setItem(CATALOG_MEDIA_KEY,JSON.stringify(data));}catch(_){}
  dbSet("catalog_media", data);
}

const DEFAULT_PRODUCTS = [
  { id:"greenawn",   name:"Биоклиматическая пергола Greenawn",   shortName:"Greenawn",    tag:"Villa 2.0 • Эксклюзив РК",      price:250000, color:"#2d7a4f", emoji:"🌿", desc:"Поворотные ламели 0–135°, автоматизация Somfy, водосток в колоннах",     features:["Поворот ламелей 0–135°","Автоматизация Somfy RTS","Водосток в колоннах","Сертификат CE","Алюминий 6063-T6"], options:[{id:"led",label:"LED подсветка",price:12000},{id:"heater",label:"Инфракрасный обогреватель",price:45000,flat:true},{id:"screen",label:"Zip-шторы (периметр)",price:65000}] },
  { id:"igs_premium",name:"Биоклиматическая пергола IGS Premium",shortName:"IGS Premium", tag:"Поворотно-сдвижная",             price:280000, color:"#1a5276", emoji:"⭐", desc:"Поворотно-сдвижная система, утеплённые ламели, герметичная конструкция", features:["Поворотно-сдвижная система","Утеплённые пенные ламели","Герметичная конструкция","Премиум профиль","Макс. ширина 12м"], options:[{id:"insulated",label:"Утеплённые ламели",price:28000},{id:"led",label:"LED подсветка",price:12000},{id:"heater",label:"Инфракрасный обогреватель",price:45000,flat:true}] },
  { id:"toscana",    name:"Тентовая пергола Toscana",            shortName:"Toscana",     tag:"Pergotek • Европейский дизайн", price:130000, color:"#7d6608", emoji:"⛺", desc:"Выдвижная ПВХ-крыша, итальянский дизайн, до 13.5м проекция",           features:["Выдвижная ПВХ-крыша","Проекция до 13.5м","Алюминиевый каркас","Европейский дизайн"], options:[{id:"led",label:"LED подсветка",price:10000},{id:"motor",label:"Моторизация",price:18000,flat:true}] },
  { id:"sliding",    name:"Остекление Слайдинг",                 shortName:"Слайдинг",    tag:"Панорамное",                    price:100000, color:"#1a6b8a", emoji:"🪟", desc:"Панорамное раздвижное остекление, 2–4 секции",                          features:["2–4 секции","Одинарное/двойное стекло","Алюминиевый профиль","Бесшумное движение"], options:[{id:"double",label:"Двойное остекление",price:15000}] },
  { id:"guillotine", name:"Остекление Гильотина",                shortName:"Гильотина",   tag:"Автоматизированная",            price:200000, color:"#6c3483", emoji:"🔳", desc:"Автоматизированный стеклянный барьер, цепной привод",                   features:["2–3 секции","Цепной привод","Ламинированное стекло","Автоматизация"], options:[{id:"auto",label:"Автоматизация",price:30000,flat:true}] },
  { id:"zip",        name:"Zip-шторы",                           shortName:"Zip-шторы",   tag:"Ветрозащита",                   price:75000,  color:"#784212", emoji:"🌬️", desc:"Ветрозащита до 180 км/ч, ткань Dickson, кассетная система",             features:["Ветрозащита до 180 км/ч","Защита от насекомых","Ткань Dickson","Кассетная система"], options:[{id:"motor",label:"Моторизация",price:15000,flat:true},{id:"mesh",label:"Москитная сетка",price:5000}] },
  { id:"marquise",   name:"Маркизы",                             shortName:"Маркизы",     tag:"Мобильное затенение",           price:100000, color:"#1e8449", emoji:"☂️", desc:"Мобильное решение для затенения, различные ткани",                      features:["Мобильная установка","Различные ткани","Ручное/моторизированное","Компактное хранение"], options:[{id:"motor",label:"Моторизация",price:12000,flat:true}] },
];

let PRODUCTS = [...DEFAULT_PRODUCTS];

function loadCustomProducts(){try{const r=JSON.parse(localStorage.getItem(CUSTOM_PRODUCTS_KEY)||"null");if(Array.isArray(r))return r;}catch(_){}return[];}
function saveCustomProducts(arr){
  try{localStorage.setItem(CUSTOM_PRODUCTS_KEY,JSON.stringify(arr));}catch(_){}
  dbSet("custom_products",arr);
}
function mergeProducts(custom){PRODUCTS=[...DEFAULT_PRODUCTS,...(custom||[])];}

const STATUSES = [
  {id:"lead",        label:"Лид",          color:"#6b7280", light:"rgba(107,114,128,0.12)"},
  {id:"negotiation", label:"Переговоры",   color:"#d97706", light:"rgba(217,119,6,0.12)"},
  {id:"kp_sent",     label:"КП отправлен", color:"#2563eb", light:"rgba(37,99,235,0.12)"},
  {id:"measure",     label:"Замер",        color:"#7c3aed", light:"rgba(124,58,237,0.12)"},
  {id:"install",     label:"Монтаж",       color:"#0891b2", light:"rgba(8,145,178,0.12)"},
  {id:"closed",      label:"Закрыт ✓",    color:"#16a34a", light:"rgba(22,163,74,0.12)"},
  {id:"lost",        label:"Потерян",      color:"#dc2626", light:"rgba(220,38,38,0.12)"},
];
const SOURCES = ["Instagram","WhatsApp","Рекомендация","Сайт","Выставка","Другое"];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function loadPrices(){try{const r=JSON.parse(localStorage.getItem(PRICES_KEY)||"null");if(r)return r;}catch(_){}return null;}
function savePrices(p){
  try{localStorage.setItem(PRICES_KEY,JSON.stringify(p));}catch(_){}
  dbSet("prices", p);
}
function applyPrices(prices){if(!prices)return;PRODUCTS=PRODUCTS.map(p=>{const s=prices[p.id];if(!s)return p;return{...p,price:s.price??p.price,options:p.options.map(o=>({...o,price:s.options?.[o.id]??o.price}))};});}
function loadClients(){
  try{const r=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(Array.isArray(r)&&r.length>0)return r;}catch(_){}
  // Защита: если localStorage пуст — пробуем sessionStorage
  try{const s=JSON.parse(sessionStorage.getItem(STORAGE_KEY+"_session")||"null");if(Array.isArray(s)&&s.length>0){console.warn("⚠️ Восстановление из sessionStorage");return s;}}catch(_){}
  return[];
}
function saveClients(data){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){return false;}
  // Пишем каждого клиента отдельно — Firebase делает merge сам
  if(Array.isArray(data)) {
    data.forEach(c => { if(c && c.id) dbSet(`clients/${c.id}`, c); });
  }
  // Защитный протокол: дополнительная копия в sessionStorage
  try{sessionStorage.setItem(STORAGE_KEY+"_session", JSON.stringify(data));}catch(_){}
  return true;
}

// Объединяет два массива клиентов по id.
// Если клиент есть в обоих — берётся версия с более новым updatedAt.
// Новые клиенты из любого источника добавляются.
function mergeClients(a, b) {
  const map = new Map();
  // Сначала все из a
  (a||[]).forEach(c => { if(c && c.id) map.set(c.id, c); });
  // Потом из b — побеждает более новый updatedAt
  (b||[]).forEach(c => {
    if(!c || !c.id) return;
    const existing = map.get(c.id);
    if(!existing) {
      map.set(c.id, c); // новый — добавляем
    } else {
      const tA = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const tB = new Date(c.updatedAt || c.createdAt || 0).getTime();
      if(tB > tA) map.set(c.id, c); // b новее — берём b
    }
  });
  return Array.from(map.values());
}


function can(session,perm){if(!session)return false;if(session.role==="admin")return true;return!!(session.perms?.[perm]);}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt=n=>new Intl.NumberFormat("ru-KZ").format(Math.round(n))+" ₸";
const fmtK=n=>{if(n>=1000000)return(n/1000000).toFixed(1)+"М ₸";if(n>=1000)return Math.round(n/1000)+"К ₸";return n+" ₸";};
const fmtDate=iso=>{if(!iso)return"—";return new Date(iso).toLocaleDateString("ru-KZ",{day:"numeric",month:"short"});};
const fmtDateFull=iso=>{if(!iso)return"—";return new Date(iso).toLocaleDateString("ru-KZ",{day:"numeric",month:"short",year:"numeric"});};

function calcItem(item){const p=PRODUCTS.find(p=>p.id===item.productId);if(!p)return 0;const area=(item.width||0)*(item.depth||0);let t=area*p.price;(item.selectedOptions||[]).forEach(oid=>{const o=p.options.find(o=>o.id===oid);if(o)t+=o.flat?o.price:o.price*area;});return t;}
function generateKPText(client,items,discount=0){const sub=items.reduce((s,i)=>s+calcItem(i),0);const total=Math.round(sub*(1-discount/100));const prepay=Math.round(total*0.5);const date=new Date().toLocaleDateString("ru-KZ",{day:"numeric",month:"long",year:"numeric"});let t=`🌿 *КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ*\n━━━━━━━━━━━━━━━━━━━━\n🏢 *IGS Outdoor*\n📅 ${date}\n👤 *${client.name}*\n`;if(client.address)t+=`📍 ${client.address}\n`;t+="\n";items.forEach((item,i)=>{const p=PRODUCTS.find(p=>p.id===item.productId);const area=(item.width*item.depth).toFixed(1);t+=`*${i+1}. ${p.name}*\n   📐 ${item.width} × ${item.depth} м = ${area} м²\n   💰 ${fmt(p.price)}/м²\n`;const opts=(item.selectedOptions||[]).map(oid=>p.options.find(o=>o.id===oid)?.label).filter(Boolean);if(opts.length)t+=`   ⚙️ ${opts.join(", ")}\n`;t+=`   💵 *${fmt(calcItem(item))}*\n\n`;});t+=`━━━━━━━━━━━━━━━━━━━━\n`;if(discount>0)t+=`🏷️ Скидка: *${discount}%*\n`;t+=`💳 *ИТОГО: ${fmt(total)}*\n\n✅ Предоплата 50%: *${fmt(prepay)}*\n✅ Остаток: *${fmt(total-prepay)}*\n\n📞 IGS Outdoor\n_Комфорт под открытым небом_ 🌿`;return t;}

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#09090b",
  surface: "#111113",
  card: "#151517",
  elevated: "#1a1a1d",
  glass: "rgba(255,255,255,0.02)",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(184,150,90,0.35)",
  gold: "#b8965a",
  goldDim: "rgba(184,150,90,0.25)",
  goldBg: "rgba(184,150,90,0.06)",
  green: "#5a9a6a",
  greenBg: "rgba(90,154,106,0.08)",
  text: "#eae6e1",
  textSec: "rgba(255,255,255,0.45)",
  textDim: "rgba(255,255,255,0.2)",
  danger: "#c45454",
  dangerBg: "rgba(196,84,84,0.08)",
  font: "'General Sans',system-ui,-apple-system,sans-serif",
  mono: "'IBM Plex Mono',monospace",
  serif: "'Instrument Serif',Georgia,serif",
};

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useIsMobile(){const[m,setM]=useState(()=>window.innerWidth<768);useEffect(()=>{const fn=()=>setM(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);return m;}

// ─── WEB PUSH УВЕДОМЛЕНИЯ ─────────────────────────────────────────────────────
function useNotifications() {
  const [permission, setPermission] = useState(()=>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Регистрируем Service Worker при загрузке
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW:', e));
    }
  }, []);

  async function requestPermission() {
    if (typeof Notification === 'undefined') return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }

  function notify(title, body, url='/') {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    // Через Service Worker для лучшей совместимости
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'igs-lead-' + Date.now(),
          requireInteraction: true,
          data: { url },
        });
      });
    } else {
      // Fallback — обычное уведомление
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  }

  return { permission, requestPermission, notify };
}


// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
function GlobalStyles(){return(<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  @import url('https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body,#root{height:100%;}
  body{background:${T.bg};color:${T.text};font-family:${T.font};-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px;}
  ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.15);}
  input,textarea,select,button{font-family:${T.font};}
  a{text-decoration:none;}
  ::selection{background:rgba(184,150,90,0.25);color:#fff;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
  .fade-in{animation:fadeIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards;}
  .stagger-1{animation-delay:0.06s;opacity:0;}
  .stagger-2{animation-delay:0.12s;opacity:0;}
  .stagger-3{animation-delay:0.18s;opacity:0;}
  .stagger-4{animation-delay:0.24s;opacity:0;}
  .hover-lift{transition:transform 0.25s cubic-bezier(0.22,1,0.36,1),box-shadow 0.25s,border-color 0.25s;}
  .hover-lift:hover{transform:translateY(-1px);box-shadow:0 12px 40px rgba(0,0,0,0.4);}
  select option{background:#1a1a1d;color:#eae6e1;}
`}</style>);}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Tag=({color,children,style={}})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,color,letterSpacing:0.3,...style}}>
    <span style={{width:6,height:6,borderRadius:3,background:color,flexShrink:0}}/>
    {children}
  </span>
);

const Btn=({variant="primary",onClick,disabled,children,style={},href,...rest})=>{
  const base={display:"inline-flex",alignItems:"center",gap:7,borderRadius:10,padding:"10px 20px",fontWeight:600,fontSize:13,cursor:disabled?"not-allowed":"pointer",border:"none",fontFamily:T.font,transition:"all 0.25s cubic-bezier(0.22,1,0.36,1)",opacity:disabled?0.35:1,letterSpacing:0.2,...style};
  const vs={
    primary:{background:T.gold,color:"#0a0a0b"},
    green:{background:T.green,color:"#0a0a0b"},
    ghost:{background:"transparent",color:T.text,border:`1px solid ${T.border}`},
    danger:{background:T.dangerBg,color:T.danger,border:`1px solid rgba(196,84,84,0.15)`},
    elevated:{background:T.elevated,color:T.text,border:`1px solid ${T.border}`}
  };
  if(href)return<a href={href} style={{...base,...vs[variant]}} {...rest}>{children}</a>;
  return<button onClick={disabled?undefined:onClick} style={{...base,...vs[variant]}} {...rest}>{children}</button>;
};

const Inp=({style={},...props})=>(
  <input style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"11px 14px",color:T.text,fontSize:14,width:"100%",outline:"none",transition:"all 0.2s ease",fontFamily:T.font,...style}} onFocus={e=>{e.target.style.borderColor="rgba(184,150,90,0.4)";e.target.style.boxShadow="0 0 0 2px rgba(184,150,90,0.08)";}} onBlur={e=>{e.target.style.borderColor=T.border;e.target.style.boxShadow="none";}} {...props}/>
);

const Card=({children,style={},className="",...rest})=>(
  <div className={`hover-lift ${className}`} style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,transition:"all 0.25s",...style}} {...rest}>{children}</div>
);

const GlassCard=({children,style={},...rest})=>(
  <div style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,boxShadow:"0 2px 16px rgba(0,0,0,0.2)",...style}} {...rest}>{children}</div>
);

// ─── BAR CHART ────────────────────────────────────────────────────────────────
function BarChart({data,color=T.gold}){
  const max=Math.max(...data.map(d=>d.value),1);
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:64}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{width:"100%",background:`${color}08`,borderRadius:"6px 6px 0 0",height:50,display:"flex",alignItems:"flex-end",overflow:"hidden"}}>
            <div style={{width:"100%",height:`${(d.value/max)*100}%`,background:`linear-gradient(180deg,${color},${color}66)`,borderRadius:"6px 6px 0 0",transition:"height 0.8s cubic-bezier(0.16,1,0.3,1)",minHeight:d.value?4:0}}/>
          </div>
          <div style={{fontSize:9,color:T.textDim,fontFamily:T.mono,letterSpacing:-0.3}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── DONUT CHART ──────────────────────────────────────────────────────────────
function Donut({segs,size=120}){
  const total=segs.reduce((s,g)=>s+g.value,0)||1;
  const r=42,cx=60,cy=60,sw=11,C2=2*Math.PI*r;
  let cum=0;
  return(
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw}/>
      {segs.filter(s=>s.value>0).map((s,i)=>{
        const pct=s.value/total,dash=C2*pct,off=C2*(1-cum);
        const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${dash} ${C2-dash}`} strokeDashoffset={off} strokeLinecap="round" style={{transform:"rotate(-90deg)",transformOrigin:`${cx}px ${cy}px`,transition:"stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)"}}/>;
        cum+=pct;return el;
      })}
      <text x={cx} y={cy-2} textAnchor="middle" fill={T.gold} fontSize="22" fontWeight="800" fontFamily={T.mono}>{total}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fill={T.textSec} fontSize="9" fontFamily={T.font}>клиентов</text>
    </svg>
  );
}

// ─── DRAWER ───────────────────────────────────────────────────────────────────
function Drawer({open,onClose,title,children,width=440}){
  if(!open)return null;
  return createPortal(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:8000,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)"}}/>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:Math.min(width,window.innerWidth-16),background:"#111113",borderLeft:`1px solid ${T.border}`,zIndex:8001,display:"flex",flexDirection:"column",boxShadow:"-12px 0 48px rgba(0,0,0,0.5)",animation:"slideIn 0.3s cubic-bezier(0.16,1,0.3,1)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 22px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{fontSize:16,fontWeight:700}}>{title}</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:T.textSec,transition:"all 0.2s"}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 22px"}}>{children}</div>
      </div>
    </>,
    document.body
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({page,setPage,currentUser,onLogout,onShowUserManager}){
  const allTabs=[
    {id:"dashboard",label:"Главная",perm:"view_dashboard"},
    {id:"clients",label:"Клиенты",perm:"view_clients"},
    {id:"bot_leads",label:"Лиды 🤖",perm:"view_dashboard"},
    {id:"meetings",label:"Встречи 📅",perm:"view_dashboard"},
    {id:"glass",label:"Стекло 🪟",perm:"view_calculator"},
    {id:"calculator",label:"Расчёт КП",perm:"view_calculator"},
    {id:"catalog",label:"Каталог",perm:"view_catalog"},
    {id:"prices",label:"Цены",perm:"edit_prices"},
  ];
  const tabs=allTabs.filter(t=>can(currentUser,t.perm));
  return(
    <div style={{width:220,minHeight:"100vh",background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,zIndex:40}}>
      <div style={{padding:"28px 24px 24px"}}>
        <div style={{fontSize:16,fontWeight:600,color:T.gold,fontFamily:T.serif,letterSpacing:0.3}}>IGS Outdoor</div>
        <div style={{fontSize:9,color:T.textDim,letterSpacing:3,fontWeight:600,marginTop:4,textTransform:"uppercase"}}>CRM</div>
      </div>

      <div style={{margin:"0 20px",height:1,background:T.border}}/>

      <nav style={{flex:1,padding:"16px 12px",display:"flex",flexDirection:"column",gap:2}}>
        {tabs.map(t=>{
          const active=page===t.id;
          return(
            <button key={t.id} onClick={()=>setPage(t.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,background:active?T.goldBg:"transparent",border:"none",cursor:"pointer",textAlign:"left",transition:"all 0.2s",width:"100%"}}>
              {active&&<div style={{width:3,height:16,borderRadius:2,background:T.gold,flexShrink:0}}/>}
              <span style={{fontSize:13,fontWeight:active?600:400,color:active?T.text:T.textSec,transition:"color 0.2s"}}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{padding:"16px 20px 24px",borderTop:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{width:32,height:32,borderRadius:8,background:T.elevated,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:T.textSec,fontWeight:700,fontFamily:T.mono}}>
            {currentUser?.login?.[0]?.toUpperCase()||"?"}
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>{currentUser?.login}</div>
            <div style={{fontSize:10,color:T.textDim,marginTop:1}}>{currentUser?.role==="admin"?"Администратор":"Пользователь"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {onShowUserManager&&<button onClick={onShowUserManager} style={{flex:1,background:T.elevated,border:`1px solid ${T.border}`,borderRadius:7,padding:"6px",color:T.textSec,fontSize:11,cursor:"pointer",fontFamily:T.font,fontWeight:500}}>Юзеры</button>}
          <button onClick={onLogout} style={{flex:1,background:T.dangerBg,border:`1px solid rgba(196,84,84,0.12)`,borderRadius:7,padding:"6px",color:T.danger,fontSize:11,cursor:"pointer",fontFamily:T.font,fontWeight:500}}>Выйти</button>
        </div>
      </div>
    </div>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({page,setPage,currentUser}){
  const allTabs=[{id:"dashboard",label:"Главная",perm:"view_dashboard"},{id:"clients",label:"Клиенты",perm:"view_clients"},{id:"bot_leads",label:"Лиды 🤖",perm:"view_dashboard"},{id:"meetings",label:"Встречи",perm:"view_dashboard"},{id:"glass",label:"Стекло",perm:"view_calculator"},{id:"calculator",label:"Расчёт",perm:"view_calculator"},{id:"catalog",label:"Каталог",perm:"view_catalog"},{id:"prices",label:"Цены",perm:"edit_prices"}];
  const tabs=allTabs.filter(t=>can(currentUser,t.perm));
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",zIndex:50,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setPage(t.id)} style={{flex:1,background:"none",border:"none",padding:"12px 0 14px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <span style={{fontSize:12,color:page===t.id?T.gold:T.textDim,fontWeight:page===t.id?700:400,fontFamily:T.font,letterSpacing:0.3}}>{t.label}</span>
          {page===t.id&&<div style={{width:20,height:2,borderRadius:1,background:T.gold}}/>}
        </button>
      ))}
    </div>
  );
}

// ─── STORAGE BADGE ────────────────────────────────────────────────────────────
function StorageBadge({status}){
  const online=isOnline();
  const cfg={
    saving:{color:"rgba(255,255,255,0.4)",text:online?"Синхронизация…":"Сохранение…"},
    saved:{color:T.green,text:online?"Синхронизировано":"Сохранено"},
    error:{color:T.danger,text:"Ошибка сохранения"}
  }[status];
  if(!cfg)return null;
  return<div style={{position:"fixed",top:16,right:16,zIndex:999,background:T.surface,color:cfg.color,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:500,border:`1px solid ${T.border}`,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>{cfg.text}</div>;
}

// ─── ADDRESS INPUT WITH AUTOCOMPLETE ──────────────────────────────────────────
const CITY_STREETS = {
  "Алматы": ["Абая","Абылай хана","Аль-Фараби","Ауэзова","Байтурсынова","Богенбай батыра","Гагарина","Гоголя","Достык","Жандосова","Жарокова","Желтоксан","Жибек жолы","Кабанбай батыра","Калдаякова","Карасай батыра","Курмангазы","Макатаева","Манаса","Мауленова","Муканова","Мустафина","Назарбаева","Навои","Наурызбай батыра","Розыбакиева","Сатпаева","Сейфуллина","Тимирязева","Толе би","Тулебаева","Утепова","Фурманова","Хаджи Мукана","Шевченко"],
  "Астана": ["Абая","Бейбітшілік","Иманбаева","Кабанбай батыра","Кенесары","Кошкарбаева","Кунаева","Мангилик Ел","Республика","Сарыарка","Сауран","Сыганак","Туран","Улы Дала","Ханов Керея и Жанибека"],
  "Шымкент": ["Абая","Байтурсынова","Жибек жолы","Казыбек би","Момышулы","Республика","Тауке хана","Темирлановское шоссе","Толе би","Туркестанская"],
  "Караганда": ["Бухар жырау","Ерубаева","Казахстан","Кривогуза","Ленина","Мичурина","Мустафина","Назарбаева","Нуркена Абдирова","Сатпаева"],
  "Актобе": ["Абая","Алтынсарина","Братьев Жубановых","Есет батыра","Маресьева","Молдагуловой","Некрасова","Санкибай батыра","Тургенева"],
  "Тараз": ["Абая","Байзак батыра","Желтоксан","Казыбек би","Сулейменова","Толе би","Тулебаева"],
  "Павлодар": ["1 Мая","Академика Бектурова","Ак. Сатпаева","Естая","Кутузова","Ломова","Назарбаева","Торайгырова"],
  "Усть-Каменогорск": ["Абая","Бажова","Казахстан","Кабанбай батыра","Назарбаева","Протозанова","Тохтарова"],
  "Семей": ["Абая","Аймаутова","Ауэзова","Гагарина","Достоевского","Найманбаева","Шакарима"],
  "Костанай": ["Абая","Алтынсарина","Байтурсынова","Баймагамбетова","Гоголя","Дулатова","Тарана"],
  "Петропавловск": ["Абая","Букетова","Жамбыла","Интернациональная","Назарбаева","Сутюшева"],
  "Кызылорда": ["Абая","Ауэзова","Желтоксан","Назарбаева","Сулейменова","Тасбогетова"],
  "Атырау": ["Абая","Азаттык","Алиева","Баймуханова","Курмангазы","Махамбета","Сатпаева"],
  "Актау": ["1 мкр","2 мкр","3 мкр","4 мкр","5 мкр","6 мкр","7 мкр","8 мкр","9 мкр","10 мкр","11 мкр","12 мкр","14 мкр","15 мкр"],
  "Туркестан": ["Абая","Жибек жолы","Назарбаева","Тауке хана"],
  "Талдыкорган": ["Абая","Жансугурова","Кабанбай батыра","Назарбаева","Тауелсиздик"],
  "Кокшетау": ["Абая","Ауэзова","Горького","Назарбаева","Уалиханова"],
  "Экибастуз": ["Абая","Ауэзова","Мәшһүр Жүсіп","Назарбаева"],
  "Конаев": ["Назарбаева","Республика","Тауелсиздик"],
};
const CITIES = Object.keys(CITY_STREETS);

function AddressAuto({value,onChange}){
  const [focused,setFocused]=useState(false);
  const [suggestions,setSuggestions]=useState([]);
  const [selectedIdx,setSelectedIdx]=useState(-1);
  const wrapRef=useRef(null);

  useEffect(()=>{
    function handleClick(e){if(wrapRef.current&&!wrapRef.current.contains(e.target))setFocused(false);}
    document.addEventListener("mousedown",handleClick);
    return()=>document.removeEventListener("mousedown",handleClick);
  },[]);

  useEffect(()=>{
    if(!value||!focused){setSuggestions([]);return;}
    const v=value.trim();const parts=v.split(",").map(s=>s.trim());
    let results=[];

    if(parts.length<=1){
      // Suggest cities
      const q=parts[0].toLowerCase();
      results=CITIES.filter(c=>c.toLowerCase().startsWith(q)).slice(0,6).map(c=>({text:c+", ",display:"🏙️ "+c,type:"city"}));
      // Also check if city matches exactly, then suggest streets
      const exactCity=CITIES.find(c=>c.toLowerCase()===q);
      if(exactCity){
        results=CITY_STREETS[exactCity].slice(0,8).map(s=>({text:exactCity+", ул. "+s+" ",display:"📍 ул. "+s,type:"street"}));
      }
    } else {
      // City is parts[0], street search in parts[1]
      const cityQ=parts[0].toLowerCase();
      const city=CITIES.find(c=>c.toLowerCase()===cityQ)||CITIES.find(c=>c.toLowerCase().startsWith(cityQ));
      if(city){
        let streetPart=parts[1].replace(/^ул\.?\s*/i,"").trim().toLowerCase();
        const streets=CITY_STREETS[city]||[];
        if(!streetPart){
          results=streets.slice(0,8).map(s=>({text:city+", ул. "+s+" ",display:"📍 ул. "+s,type:"street"}));
        } else {
          results=streets.filter(s=>s.toLowerCase().startsWith(streetPart)).slice(0,6).map(s=>({text:city+", ул. "+s+" ",display:"📍 ул. "+s,type:"street"}));
          // Also show partial matches
          if(results.length<4){
            const more=streets.filter(s=>s.toLowerCase().includes(streetPart)&&!s.toLowerCase().startsWith(streetPart)).slice(0,4-results.length).map(s=>({text:city+", ул. "+s+" ",display:"📍 ул. "+s,type:"street"}));
            results=[...results,...more];
          }
        }
      }
    }
    setSuggestions(results);
    setSelectedIdx(-1);
  },[value,focused]);

  function handleKeyDown(e){
    if(!suggestions.length)return;
    if(e.key==="ArrowDown"){e.preventDefault();setSelectedIdx(i=>Math.min(i+1,suggestions.length-1));}
    else if(e.key==="ArrowUp"){e.preventDefault();setSelectedIdx(i=>Math.max(i-1,0));}
    else if(e.key==="Enter"&&selectedIdx>=0){e.preventDefault();pick(suggestions[selectedIdx]);}
    else if(e.key==="Escape"){setFocused(false);}
  }
  function pick(s){onChange(s.text);setSuggestions([]);setSelectedIdx(-1);}

  return(
    <div ref={wrapRef} style={{position:"relative"}}>
      <Inp value={value} onChange={e=>onChange(e.target.value)} onFocus={()=>setFocused(true)} onKeyDown={handleKeyDown} placeholder="Начните вводить город…"/>
      {focused&&suggestions.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:"#111113",border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",zIndex:100,boxShadow:"0 12px 36px rgba(0,0,0,0.5)",maxHeight:240,overflowY:"auto"}}>
          {suggestions.map((s,i)=>(
            <button key={i} onClick={()=>pick(s)} onMouseEnter={()=>setSelectedIdx(i)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"10px 14px",background:i===selectedIdx?"rgba(201,168,76,0.08)":"transparent",border:"none",borderBottom:i<suggestions.length-1?`1px solid ${T.border}`:"none",cursor:"pointer",textAlign:"left",color:i===selectedIdx?T.gold:T.text,fontSize:13,fontFamily:T.font,transition:"background 0.1s"}}>
              <span style={{fontSize:13,opacity:0.7}}>{s.type==="city"?"🏙️":"📍"}</span>
              <span style={{fontWeight:s.type==="city"?600:400}}>{s.display.replace(/^[🏙️📍]\s*/,"")}</span>
            </button>
          ))}
          <div style={{padding:"6px 14px",fontSize:10,color:T.textDim,borderTop:`1px solid ${T.border}`}}>↑↓ навигация · Enter выбрать</div>
        </div>
      )}
    </div>
  );
}

// ─── ADD CLIENT MODAL ─────────────────────────────────────────────────────────
function AddClientModal({open,onClose,onAdd}){
  const[name,setName]=useState("");const[phone,setPhone]=useState("");const[address,setAddress]=useState("");const[source,setSource]=useState("");const[notes,setNotes]=useState("");
  function handleAdd(){if(!name.trim())return;onAdd({name:name.trim(),phone:phone.trim(),address:address.trim(),source,notes:notes.trim()});setName("");setPhone("");setAddress("");setSource("");setNotes("");}
  if(!open)return null;
  return createPortal(
    <div style={{position:"fixed",inset:0,zIndex:8000,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#111113",borderRadius:22,width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto",border:`1px solid ${T.border}`,boxShadow:"0 24px 64px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.03)",animation:"fadeIn 0.25s cubic-bezier(0.16,1,0.3,1)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:17,fontWeight:700}}>✨ Новый клиент</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:T.textSec}}>✕</button>
        </div>
        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:15}}>
          <div><div style={{fontSize:11,color:T.textSec,marginBottom:6,fontWeight:700,letterSpacing:1}}>ИМЯ *</div><Inp value={name} onChange={e=>setName(e.target.value)} placeholder="Иванов Иван" autoFocus/></div>
          <div><div style={{fontSize:11,color:T.textSec,marginBottom:6,fontWeight:700,letterSpacing:1}}>ТЕЛЕФОН</div><Inp value={phone} onChange={e=>setPhone(e.target.value.replace(/[^\d+\-()\ s]/g,""))} placeholder="+7 (777) 000-00-00" type="tel" inputMode="tel"/></div>
          <div><div style={{fontSize:11,color:T.textSec,marginBottom:6,fontWeight:700,letterSpacing:1}}>АДРЕС / ОБЪЕКТ</div><AddressAuto value={address} onChange={setAddress}/></div>
          <div>
            <div style={{fontSize:11,color:T.textSec,marginBottom:7,fontWeight:700,letterSpacing:1}}>ИСТОЧНИК</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {SOURCES.map(s=><button key={s} onClick={()=>setSource(s===source?"":s)} style={{background:s===source?T.goldBg:"rgba(255,255,255,0.03)",color:s===source?T.gold:T.textSec,border:`1px solid ${s===source?"rgba(201,168,76,0.2)":T.border}`,borderRadius:10,padding:"7px 13px",fontSize:12,cursor:"pointer",fontFamily:T.font,fontWeight:600,transition:"all 0.2s"}}>{s}</button>)}
            </div>
          </div>
          <div><div style={{fontSize:11,color:T.textSec,marginBottom:6,fontWeight:700,letterSpacing:1}}>ЗАМЕТКИ</div><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Дополнительная информация…" style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 15px",color:T.text,fontSize:14,width:"100%",outline:"none",minHeight:90,resize:"vertical",fontFamily:T.font}} onFocus={e=>{e.target.style.borderColor="rgba(201,168,76,0.4)";}} onBlur={e=>{e.target.style.borderColor=T.border;}}/></div>
          <Btn variant="primary" disabled={!name.trim()} onClick={handleAdd} style={{justifyContent:"center",width:"100%",padding:"14px",fontSize:15}}>Добавить клиента</Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({clients,onGoToClient,onStartKP,onGoToPage,isMobile,currentUser,onLogout,onShowUserManager}){
  const active=clients.filter(c=>!["closed","lost"].includes(c.status));
  const totalKPs=clients.reduce((s,c)=>s+(c.kps?.length||0),0);
  const pipeline=clients.filter(c=>c.kps?.length>0&&!["closed","lost"].includes(c.status)).reduce((s,c)=>s+(c.kps?.[0]?.total||0),0);
  const recent=[...clients].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)).slice(0,isMobile?5:10);
  const monthlyData=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-5+i);const m=d.getMonth(),y=d.getFullYear();return{label:d.toLocaleDateString("ru-KZ",{month:"short"}),value:clients.filter(c=>{const cd=new Date(c.createdAt);return cd.getMonth()===m&&cd.getFullYear()===y;}).length};});
  const donutSegs=STATUSES.map(st=>({color:st.color,value:clients.filter(c=>c.status===st.id).length,label:st.label})).filter(s=>s.value>0);

  const Stat=({icon,label,value,color=T.gold,delay=0})=>(
    <GlassCard className={`fade-in stagger-${delay}`} style={{padding:"18px 20px",display:"flex",alignItems:"center",gap:14}}>
      <div style={{width:46,height:46,borderRadius:13,background:`${color}12`,border:`1px solid ${color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{icon}</div>
      <div><div style={{fontSize:isMobile?22:24,fontWeight:800,color,fontFamily:T.mono,lineHeight:1}}>{value}</div><div style={{fontSize:11,color:T.textSec,marginTop:3,fontWeight:500}}>{label}</div></div>
    </GlassCard>
  );

  return(
    <div className="fade-in">
      {isMobile&&(
        <div style={{padding:"20px 16px 14px",background:"linear-gradient(180deg,rgba(17,17,19,0.98),transparent)",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:10,color:T.textDim,letterSpacing:2.5,marginBottom:3,fontWeight:600}}>IGS OUTDOOR</div>
              <div style={{fontSize:24,fontWeight:800,fontFamily:T.serif}}><span style={{color:T.gold}}>Добрый день</span> 👋</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
              <div style={{fontSize:11,color:T.textSec,fontWeight:500}}>👤 {currentUser?.login}</div>
              {onShowUserManager&&<button onClick={onShowUserManager} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:8,padding:"3px 9px",color:T.textSec,fontSize:10,cursor:"pointer",fontWeight:600}}>👥</button>}
              <button onClick={onLogout} style={{background:T.dangerBg,border:"1px solid rgba(224,82,82,0.12)",borderRadius:8,padding:"3px 9px",color:T.danger,fontSize:10,cursor:"pointer",fontWeight:600}}>Выйти</button>
            </div>
          </div>
        </div>
      )}
      {!isMobile&&(
        <div style={{marginBottom:30}}>
          <div style={{fontSize:10,color:T.textDim,letterSpacing:3,marginBottom:6,fontWeight:600}}>ОБЗОР</div>
          <div style={{fontSize:30,fontWeight:800,fontFamily:T.serif}}>Добрый день, <span style={{color:T.gold}}>{currentUser?.login}</span> 👋</div>
          <div style={{fontSize:13,color:T.textSec,marginTop:4}}>{new Date().toLocaleDateString("ru-KZ",{weekday:"long",day:"numeric",month:"long"})}</div>
        </div>
      )}

      <div style={{padding:isMobile?"12px 12px 110px":0}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:18}}>
          <Stat icon="👥" label="Клиентов" value={clients.length} delay={1}/>
          <Stat icon="🔥" label="Активных" value={active.length} color={T.green} delay={2}/>
          <Stat icon="📄" label="КП создано" value={totalKPs} color="#60a5fa" delay={3}/>
          <Stat icon="💰" label="Воронка" value={fmtK(pipeline)} color={T.gold} delay={4}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2.2fr 1fr 1.1fr",gap:12,marginBottom:16}}>
          <GlassCard style={{padding:20}}>
            <div style={{fontSize:11,color:T.textSec,fontWeight:700,marginBottom:12,letterSpacing:1.5}}>НОВЫЕ КЛИЕНТЫ · 6 МЕС.</div>
            <BarChart data={monthlyData} color={T.gold}/>
          </GlassCard>
          <GlassCard style={{padding:20,display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{fontSize:11,color:T.textSec,fontWeight:700,marginBottom:10,letterSpacing:1.5,alignSelf:"flex-start"}}>ПО СТАТУСАМ</div>
            <Donut segs={donutSegs} size={isMobile?100:120}/>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10,justifyContent:"center"}}>
              {donutSegs.slice(0,4).map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:T.textSec}}>
                  <div style={{width:7,height:7,borderRadius:4,background:s.color,flexShrink:0}}/>
                  {s.label}({s.value})
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard style={{padding:20}}>
            <div style={{fontSize:11,color:T.textSec,fontWeight:700,marginBottom:12,letterSpacing:1.5}}>ВОРОНКА</div>
            {STATUSES.filter(st=>st.id!=="lost").map(st=>{const count=clients.filter(c=>c.status===st.id).length;return(
              <div key={st.id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:10,color:st.color,fontWeight:600}}>{st.label}</span>
                  <span style={{fontSize:10,color:T.textSec,fontFamily:T.mono}}>{count}</span>
                </div>
                <div style={{height:4,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:clients.length?`${(count/clients.length)*100}%`:"0%",height:"100%",background:`linear-gradient(90deg,${st.color},${st.color}88)`,borderRadius:3,transition:"width 0.8s cubic-bezier(0.16,1,0.3,1)"}}/>
                </div>
              </div>
            );})}
          </GlassCard>
        </div>

        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <Btn variant="primary" onClick={onStartKP} style={{padding:"12px 22px"}}>🧮 Новый расчёт КП</Btn>
          <Btn variant="ghost" onClick={()=>onGoToPage("clients")} style={{padding:"12px 22px"}}>➕ Добавить клиента</Btn>
        </div>

        {recent.length>0&&(
          <GlassCard style={{overflow:"hidden"}}>
            <div style={{padding:"14px 20px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,color:T.textSec,fontWeight:700,letterSpacing:1.5}}>ПОСЛЕДНИЕ КЛИЕНТЫ</div>
              <button onClick={()=>onGoToPage("clients")} style={{background:"none",border:"none",fontSize:12,color:T.gold,cursor:"pointer",fontFamily:T.font,fontWeight:600}}>Все →</button>
            </div>
            {isMobile?(
              <div style={{display:"flex",flexDirection:"column"}}>
                {recent.map((c,i)=>{const st=STATUSES.find(s=>s.id===c.status);const lkp=c.kps?.[0];return(
                  <button key={c.id} onClick={()=>onGoToClient(c.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"none",border:"none",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",textAlign:"left",width:"100%",transition:"background 0.15s"}}>
                    <div style={{width:38,height:38,borderRadius:11,background:st?.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:st?.color,flexShrink:0,border:`1px solid ${st?.color}20`}}>{c.name?.[0]?.toUpperCase()}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.text}}>{c.name}</div>
                      <div style={{fontSize:12,color:T.textSec}}>{c.phone||"—"}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                      <Tag color={st?.color} light={st?.light}>{st?.label}</Tag>
                      {lkp&&<div style={{fontSize:10,color:T.gold,fontFamily:T.mono}}>{fmtK(lkp.total)}</div>}
                    </div>
                  </button>
                );})}
              </div>
            ):(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{borderTop:`1px solid ${T.border}`}}>
                    {["Клиент","Телефон","Источник","Статус","Последнее КП","Дата"].map(h=>(
                      <th key={h} style={{padding:"10px 20px",fontSize:10,color:T.textDim,fontWeight:700,textAlign:"left",letterSpacing:1}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c,i)=>{const st=STATUSES.find(s=>s.id===c.status);const lkp=c.kps?.[0];return(
                    <tr key={c.id} onClick={()=>onGoToClient(c.id)} style={{borderTop:`1px solid ${T.border}`,cursor:"pointer",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"12px 20px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:32,height:32,borderRadius:9,background:st?.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:st?.color,border:`1px solid ${st?.color}20`}}>{c.name?.[0]?.toUpperCase()}</div>
                          <span style={{fontSize:14,fontWeight:600}}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{padding:"12px 20px",fontSize:12,color:T.textSec,fontFamily:T.mono}}>{c.phone||"—"}</td>
                      <td style={{padding:"12px 20px",fontSize:13,color:T.textSec}}>{c.source||"—"}</td>
                      <td style={{padding:"12px 20px"}}><Tag color={st?.color} light={st?.light}>{st?.label}</Tag></td>
                      <td style={{padding:"12px 20px",fontSize:13,color:lkp?T.gold:T.textDim,fontFamily:T.mono,fontWeight:lkp?600:400}}>{lkp?fmtK(lkp.total):"—"}</td>
                      <td style={{padding:"12px 20px",fontSize:12,color:T.textDim}}>{fmtDate(c.updatedAt||c.createdAt)}</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            )}
          </GlassCard>
        )}

        {clients.length===0&&(
          <GlassCard style={{textAlign:"center",padding:"56px 24px"}}>
            <div style={{fontSize:52,marginBottom:16}}>🌿</div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:8,fontFamily:T.serif}}>Начните работу</div>
            <div style={{fontSize:14,color:T.textSec,marginBottom:24}}>Добавьте первого клиента или создайте расчёт КП</div>
            <Btn variant="primary" onClick={onStartKP}>Новый расчёт</Btn>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

// ─── CLIENT LIST ──────────────────────────────────────────────────────────────
function ClientList({clients,onGoToClient,onAddClient,onDeleteClient,isMobile,currentUser}){
  const[search,setSearch]=useState("");const[filterStatus,setFilterStatus]=useState("all");const[showAdd,setShowAdd]=useState(false);const[sortBy,setSortBy]=useState("date");
  const filtered=clients.filter(c=>{const q=search.toLowerCase();return(!search||c.name?.toLowerCase().includes(q)||c.phone?.includes(q))&&(filterStatus==="all"||c.status===filterStatus);}).sort((a,b)=>sortBy==="name"?a.name?.localeCompare(b.name,"ru")||0:sortBy==="kp"?(b.kps?.[0]?.total||0)-(a.kps?.[0]?.total||0):new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));

  return(
    <div className="fade-in">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <div>
          {!isMobile&&<div style={{fontSize:10,color:T.textDim,letterSpacing:3,marginBottom:3,fontWeight:600}}>БАЗА</div>}
          <div style={{fontSize:isMobile?22:28,fontWeight:800,fontFamily:T.serif}}>Клиенты <span style={{fontSize:14,color:T.textSec,fontWeight:400,fontFamily:T.font}}>({clients.length})</span></div>
        </div>
        {can(currentUser,"add_clients")&&<Btn variant="primary" onClick={()=>setShowAdd(true)}>➕ Добавить</Btn>}
      </div>

      <div style={{display:"flex",gap:9,marginBottom:12,flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:1,minWidth:180}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:T.textSec}}>🔍</span>
          <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск…" style={{paddingLeft:36}}/>
        </div>
        {!isMobile&&(
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"0 16px",color:T.text,fontSize:13,cursor:"pointer",fontFamily:T.font,outline:"none"}}>
            <option value="date">По дате</option><option value="name">По имени</option><option value="kp">По сумме КП</option>
          </select>
        )}
      </div>

      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14}}>
        <button onClick={()=>setFilterStatus("all")} style={{background:filterStatus==="all"?T.goldBg:"rgba(255,255,255,0.03)",color:filterStatus==="all"?T.gold:T.textSec,border:`1px solid ${filterStatus==="all"?"rgba(201,168,76,0.2)":T.border}`,borderRadius:10,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:T.font,transition:"all 0.2s"}}>Все ({clients.length})</button>
        {STATUSES.map(s=>{const count=clients.filter(c=>c.status===s.id).length;if(!count)return null;return(
          <button key={s.id} onClick={()=>setFilterStatus(s.id===filterStatus?"all":s.id)} style={{background:filterStatus===s.id?s.light:"rgba(255,255,255,0.03)",color:filterStatus===s.id?s.color:T.textSec,border:`1px solid ${filterStatus===s.id?`${s.color}30`:T.border}`,borderRadius:10,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:T.font,transition:"all 0.2s"}}>{s.label} ({count})</button>
        );})}
      </div>

      {filtered.length===0?(
        <div style={{textAlign:"center",padding:56,color:T.textSec,fontSize:14}}>{search?"Ничего не найдено":"Нет клиентов"}</div>
      ):isMobile?(
        <div style={{display:"flex",flexDirection:"column",gap:8,paddingBottom:110}}>
          {filtered.map(c=>{const st=STATUSES.find(s=>s.id===c.status);const lkp=c.kps?.[0];return(
            <Card key={c.id} style={{padding:"14px 15px",display:"flex",alignItems:"center",gap:12}}>
              <div onClick={()=>onGoToClient(c.id)} style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0,cursor:"pointer"}}>
                <div style={{width:42,height:42,borderRadius:12,background:st?.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:st?.color,flexShrink:0,border:`1px solid ${st?.color}20`}}>{c.name?.[0]?.toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                  <div style={{fontSize:12,color:T.textSec,marginTop:2}}>{c.phone||"—"}</div>
                  {lkp&&<div style={{fontSize:11,color:T.gold,marginTop:2,fontFamily:T.mono}}>💰 {fmt(lkp.total)}</div>}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                <Tag color={st?.color} light={st?.light}>{st?.label}</Tag>
                <div style={{fontSize:10,color:T.textDim}}>{fmtDate(c.updatedAt||c.createdAt)}</div>
                {can(currentUser,"delete_clients")&&<button onClick={e=>{e.stopPropagation();if(window.confirm("Удалить «"+c.name+"»?"))onDeleteClient(c.id);}} style={{background:"rgba(224,82,82,0.06)",border:"1px solid rgba(224,82,82,0.12)",borderRadius:7,padding:"3px 8px",fontSize:11,color:T.danger,cursor:"pointer",fontFamily:T.font,marginTop:2}}>🗑️</button>}
              </div>
            </Card>
          );})}
        </div>
      ):(
        <GlassCard style={{overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${T.border}`}}>
                {["Клиент","Телефон","Адрес","Источник","Статус","Сумма КП","КП","Обновлён",can(currentUser,"delete_clients")?"":""].filter(Boolean).map(h=>(
                  <th key={h} style={{padding:"11px 16px",fontSize:10,color:T.textDim,fontWeight:700,textAlign:"left",letterSpacing:1}}>{h}</th>
                ))}
                {can(currentUser,"delete_clients")&&<th style={{padding:"11px 10px",width:44}}/>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c,i)=>{const st=STATUSES.find(s=>s.id===c.status);const lkp=c.kps?.[0];return(
                <tr key={c.id} onClick={()=>onGoToClient(c.id)} style={{borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"12px 16px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:9,background:st?.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:st?.color,border:`1px solid ${st?.color}20`}}>{c.name?.[0]?.toUpperCase()}</div><span style={{fontSize:14,fontWeight:600}}>{c.name}</span></div></td>
                  <td style={{padding:"12px 16px",fontSize:12,color:T.textSec,fontFamily:T.mono}}>{c.phone||"—"}</td>
                  <td style={{padding:"12px 16px",fontSize:12,color:T.textSec,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.address||"—"}</td>
                  <td style={{padding:"12px 16px",fontSize:12,color:T.textSec}}>{c.source||"—"}</td>
                  <td style={{padding:"12px 16px"}}><Tag color={st?.color} light={st?.light}>{st?.label}</Tag></td>
                  <td style={{padding:"12px 16px",fontSize:12,color:lkp?T.gold:T.textDim,fontFamily:T.mono,fontWeight:lkp?600:400}}>{lkp?fmt(lkp.total):"—"}</td>
                  <td style={{padding:"12px 16px",fontSize:12,color:T.textSec,textAlign:"center"}}>{c.kps?.length||0}</td>
                  <td style={{padding:"12px 16px",fontSize:11,color:T.textDim}}>{fmtDate(c.updatedAt||c.createdAt)}</td>
                  {can(currentUser,"delete_clients")&&<td style={{padding:"8px 10px"}}><button onClick={e=>{e.stopPropagation();if(window.confirm("Удалить «"+c.name+"»?"))onDeleteClient(c.id);}} style={{background:"rgba(224,82,82,0.06)",border:"1px solid rgba(224,82,82,0.12)",borderRadius:8,padding:"5px 8px",fontSize:13,color:T.danger,cursor:"pointer",opacity:0.6,transition:"opacity 0.2s"}} onMouseEnter={e=>e.target.style.opacity="1"} onMouseLeave={e=>e.target.style.opacity="0.6"}>🗑️</button></td>}
                </tr>
              );})}
            </tbody>
          </table>
        </GlassCard>
      )}

      {isMobile&&can(currentUser,"add_clients")&&<button onClick={()=>setShowAdd(true)} style={{position:"fixed",bottom:82,right:16,width:54,height:54,borderRadius:16,background:"linear-gradient(135deg,#c9a84c,#a8893a)",border:"none",fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 24px rgba(201,168,76,0.35)",zIndex:10}}>➕</button>}
      {can(currentUser,"add_clients")&&<AddClientModal open={showAdd} onClose={()=>setShowAdd(false)} onAdd={data=>{onAddClient(data);setShowAdd(false);}}/>}
    </div>
  );
}

// ─── CLIENT DETAIL ────────────────────────────────────────────────────────────
function ClientDetail({client,onBack,onUpdate,onDelete,onStartKP,isMobile,currentUser}){
  const[tab,setTab]=useState("info");const[editing,setEditing]=useState(false);
  const[editData,setEditData]=useState({name:client.name,phone:client.phone,address:client.address,source:client.source,notes:client.notes});
  const[showSP,setShowSP]=useState(false);const[newTask,setNewTask]=useState("");const[copied,setCopied]=useState(null);
  const st=STATUSES.find(s=>s.id===client.status)||STATUSES[0];

  function saveEdit(){onUpdate(editData);setEditing(false);}
  function addTask(){if(!newTask.trim())return;onUpdate({tasks:[...(client.tasks||[]),{id:Date.now().toString(),text:newTask.trim(),done:false,createdAt:new Date().toISOString()}]});setNewTask("");}
  function toggleTask(id){onUpdate({tasks:(client.tasks||[]).map(t=>t.id===id?{...t,done:!t.done}:t)});}
  function deleteTask(id){onUpdate({tasks:(client.tasks||[]).filter(t=>t.id!==id)});}
  function deleteKP(kpId){onUpdate({kps:(client.kps||[]).filter(k=>k.id!==kpId)});}
  function copyKP(kp){const text=generateKPText(client,kp.items,kp.discount||0);navigator.clipboard?.writeText(text).catch(()=>{});setCopied(kp.id);setTimeout(()=>setCopied(null),2000);}

  return(
    <div className="fade-in" style={{minHeight:"100vh",background:T.bg,paddingBottom:isMobile?80:0}}>
      <div style={{background:"linear-gradient(180deg,rgba(17,17,19,0.98),transparent)",borderBottom:`1px solid ${T.border}`,padding:"16px 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,cursor:"pointer",color:T.textSec}}>←</button>
          <div style={{flex:1}}>
            {editing?<Inp value={editData.name} onChange={e=>setEditData({...editData,name:e.target.value})} style={{fontSize:17,fontWeight:700}}/>:<div style={{fontSize:19,fontWeight:800,fontFamily:T.serif}}>{client.name}</div>}
          </div>
          {!editing&&can(currentUser,"edit_clients")&&<button onClick={()=>setEditing(true)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,cursor:"pointer",color:T.textSec}}>✏️</button>}
          {!editing&&can(currentUser,"delete_clients")&&<button onClick={()=>{if(window.confirm("Удалить клиента «"+client.name+"»? Это действие нельзя отменить."))onDelete();}} style={{background:"rgba(224,82,82,0.06)",border:"1px solid rgba(224,82,82,0.15)",borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,cursor:"pointer",color:T.danger}}>🗑️</button>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",marginBottom:12}}>
          <button onClick={()=>setShowSP(!showSP)} style={{background:st.light,color:st.color,border:`1px solid ${st.color}25`,borderRadius:9,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>{st.label} ▾</button>
          {client.phone&&<a href={`tel:${client.phone}`} style={{color:T.green,fontSize:13,fontWeight:500}}>📞 {client.phone}</a>}
        </div>
        {showSP&&(<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>{STATUSES.map(s=><button key={s.id} onClick={()=>{onUpdate({status:s.id});setShowSP(false);}} style={{background:s.light,color:s.color,border:s.id===client.status?`2px solid ${s.color}`:`1px solid ${s.color}25`,borderRadius:9,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.font,transition:"all 0.2s"}}>{s.label}</button>)}</div>)}
        <div style={{display:"flex",gap:9}}>
          <Btn variant="primary" onClick={onStartKP} style={{flex:1,justifyContent:"center",padding:"10px"}}>🧮 Новое КП</Btn>
          {client.phone&&<a href={`https://wa.me/${client.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{flex:1,background:"#25D366",color:"#fff",border:"none",borderRadius:13,padding:"10px 16px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:T.font,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>💬 WhatsApp</a>}
        </div>
      </div>

      <div style={{display:"flex",background:"rgba(17,17,19,0.8)",borderBottom:`1px solid ${T.border}`}}>
        {[["info","ℹ️ Инфо"],["kps",`📄 КП (${client.kps?.length||0})`],["tasks",`✅ Задачи (${(client.tasks||[]).filter(t=>!t.done).length})`]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,background:"none",border:"none",borderBottom:`2px solid ${tab===id?T.gold:"transparent"}`,padding:"12px 0",color:tab===id?T.gold:T.textSec,fontWeight:tab===id?700:400,fontSize:13,cursor:"pointer",fontFamily:T.font,transition:"all 0.2s"}}>{label}</button>
        ))}
      </div>

      <div style={{padding:"16px 20px"}}>
        {tab==="info"&&(
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            {editing?(
              <>
                {[["Телефон","phone","tel"],["Заметки","notes","text"]].map(([label,key,type])=>(
                  <div key={key}>
                    <div style={{fontSize:11,color:T.textSec,marginBottom:5,fontWeight:700,letterSpacing:1}}>{label.toUpperCase()}</div>
                    {key==="notes"?<textarea value={editData[key]||""} onChange={e=>setEditData({...editData,[key]:e.target.value})} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 15px",color:T.text,fontSize:14,width:"100%",outline:"none",minHeight:80,resize:"vertical",fontFamily:T.font}}/>:<Inp type={type} value={editData[key]||""} onChange={e=>setEditData({...editData,[key]:key==="phone"?e.target.value.replace(/[^\d+\-()\s]/g,""):e.target.value})}/>}
                  </div>
                ))}
                <div><div style={{fontSize:11,color:T.textSec,marginBottom:5,fontWeight:700,letterSpacing:1}}>АДРЕС</div><AddressAuto value={editData.address||""} onChange={v=>setEditData({...editData,address:v})}/></div>
                <div>
                  <div style={{fontSize:11,color:T.textSec,marginBottom:6,fontWeight:700,letterSpacing:1}}>ИСТОЧНИК</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{SOURCES.map(s=><button key={s} onClick={()=>setEditData({...editData,source:s===editData.source?"":s})} style={{background:s===editData.source?T.goldBg:"rgba(255,255,255,0.03)",color:s===editData.source?T.gold:T.textSec,border:`1px solid ${s===editData.source?"rgba(201,168,76,0.2)":T.border}`,borderRadius:9,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:T.font,fontWeight:600}}>{s}</button>)}</div>
                </div>
                <div style={{display:"flex",gap:9}}>
                  <Btn variant="primary" onClick={saveEdit} style={{flex:1,justifyContent:"center"}}>Сохранить</Btn>
                  <Btn variant="ghost" onClick={()=>setEditing(false)} style={{flex:1,justifyContent:"center"}}>Отмена</Btn>
                </div>
              </>
            ):(
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
                {[["📞 Телефон",client.phone],["📍 Адрес",client.address],["📣 Источник",client.source],["📅 Добавлен",fmtDateFull(client.createdAt)]].map(([label,val])=>val?(
                  <GlassCard key={label} style={{padding:"14px 16px"}}><div style={{fontSize:10,color:T.textSec,marginBottom:3,fontWeight:600}}>{label}</div><div style={{fontSize:14,fontWeight:500}}>{val}</div></GlassCard>
                ):null)}
                {client.notes&&<GlassCard style={{padding:"14px 16px",gridColumn:isMobile?"auto":"1/-1"}}><div style={{fontSize:10,color:T.textSec,marginBottom:3,fontWeight:600}}>📝 Заметки</div><div style={{fontSize:14,whiteSpace:"pre-wrap"}}>{client.notes}</div></GlassCard>}
              </div>
            )}
          </div>
        )}
        {tab==="kps"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {(client.kps||[]).length===0&&<div style={{textAlign:"center",padding:40,color:T.textSec,fontSize:14}}>Нет КП. Создайте первый расчёт!</div>}
            {(client.kps||[]).map(kp=>(
              <GlassCard key={kp.id} style={{padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontSize:12,color:T.textSec}}>{fmtDateFull(kp.createdAt)}</div>
                  <div style={{fontSize:18,fontWeight:800,color:T.gold,fontFamily:T.mono}}>{fmt(kp.total)}</div>
                </div>
                {kp.items?.map((item,i)=>{const p=PRODUCTS.find(pr=>pr.id===item.productId);return<div key={i} style={{fontSize:13,color:T.textSec,marginBottom:4}}>{p?.emoji} {p?.shortName} — {item.width}×{item.depth}м ({fmt(calcItem(item))})</div>;})}
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <Btn variant={copied===kp.id?"green":"ghost"} onClick={()=>copyKP(kp)} style={{flex:1,fontSize:12,padding:"7px 14px",justifyContent:"center"}}>{copied===kp.id?"✓ Скопировано!":"📋 Копировать КП"}</Btn>
                  <button onClick={()=>{if(window.confirm("Удалить это КП на "+fmt(kp.total)+"?"))deleteKP(kp.id);}} style={{background:"rgba(224,82,82,0.06)",border:"1px solid rgba(224,82,82,0.15)",borderRadius:13,padding:"7px 12px",fontSize:13,color:T.danger,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>🗑️</button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
        {tab==="tasks"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8}}><Inp value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Новая задача…" style={{flex:1}}/><Btn variant="primary" onClick={addTask} style={{padding:"11px 16px"}}>+</Btn></div>
            {(client.tasks||[]).length===0&&<div style={{textAlign:"center",padding:40,color:T.textSec,fontSize:14}}>Нет задач</div>}
            {(client.tasks||[]).map(task=>(
              <Card key={task.id} style={{padding:"12px 15px",display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>toggleTask(task.id)} style={{width:22,height:22,borderRadius:11,border:`2px solid ${task.done?T.green:T.border}`,background:task.done?"linear-gradient(135deg,#3db96a,#2d9a54)":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>{task.done&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}</button>
                <div style={{flex:1,fontSize:14,color:task.done?T.textDim:T.text,textDecoration:task.done?"line-through":"none",transition:"all 0.2s"}}>{task.text}</div>
                <button onClick={()=>deleteTask(task.id)} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:T.textDim,transition:"color 0.2s"}}>✕</button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CALCULATOR ───────────────────────────────────────────────────────────────
function Calculator({clients,kpClientId,setKpClientId,kpItems,setKpItems,kpStep,setKpStep,kpDiscount,setKpDiscount,onSaveKP,onAddClient,isMobile}){
  const[cs,setCs]=useState("");const[showAC,setShowAC]=useState(false);const[showPP,setShowPP]=useState(false);const[editIdx,setEditIdx]=useState(null);
  const[cur,setCur]=useState({productId:null,width:"",depth:"",selectedOptions:[]});const[copied,setCopied]=useState(false);const[saved,setSaved]=useState(false);
  const client=clients.find(c=>c.id===kpClientId);const total=kpItems.reduce((s,i)=>s+calcItem(i),0)*(1-kpDiscount/100);

  function startNew(){setKpClientId(null);setKpItems([]);setKpStep(1);setKpDiscount(0);setCopied(false);setSaved(false);}
  function addItem(){if(!cur.productId||!cur.width||!cur.depth)return;const item={...cur,width:parseFloat(cur.width),depth:parseFloat(cur.depth)};if(editIdx!==null){const u=[...kpItems];u[editIdx]=item;setKpItems(u);setEditIdx(null);}else setKpItems([...kpItems,item]);setCur({productId:null,width:"",depth:"",selectedOptions:[]});setShowPP(false);}
  function copyKP(){if(!client)return;navigator.clipboard?.writeText(generateKPText(client,kpItems,kpDiscount)).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),3000);}
  function saveKP(){if(!client||kpItems.length===0)return;onSaveKP(kpClientId,kpItems,kpDiscount);setSaved(true);setTimeout(()=>setSaved(false),2000);}
  const fc=clients.filter(c=>{const q=cs.toLowerCase();return!cs||c.name?.toLowerCase().includes(q)||c.phone?.includes(q);});

  const Steps=()=>(
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      {["Клиент","Позиции","КП"].map((label,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:22,height:22,borderRadius:11,background:kpStep>i+1?"linear-gradient(135deg,#3db96a,#2d9a54)":kpStep===i+1?"linear-gradient(135deg,#c9a84c,#a8893a)":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:kpStep>=i+1?"#fff":T.textDim,transition:"all 0.3s"}}>{kpStep>i+1?"✓":i+1}</div>
          <span style={{fontSize:11,color:kpStep===i+1?T.gold:T.textDim,fontWeight:kpStep===i+1?700:400}}>{label}</span>
          {i<2&&<span style={{color:T.textDim,fontSize:10}}>›</span>}
        </div>
      ))}
    </div>
  );

  return(
    <div className="fade-in">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          {!isMobile&&<div style={{fontSize:10,color:T.textDim,letterSpacing:3,marginBottom:3,fontWeight:600}}>РАСЧЁТ</div>}
          <div style={{fontSize:isMobile?22:28,fontWeight:800,fontFamily:T.serif}}>🧮 Расчёт КП</div>
        </div>
        <div style={{display:"flex",gap:9,alignItems:"center"}}>
          <Steps/>
          {(kpClientId||kpItems.length>0)&&<Btn variant="ghost" onClick={startNew} style={{fontSize:11,padding:"7px 13px"}}>Сбросить</Btn>}
        </div>
      </div>
      <div style={{paddingBottom:isMobile?110:0}}>
        {kpStep===1&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp value={cs} onChange={e=>setCs(e.target.value)} placeholder="Поиск клиента…"/>
            <Btn variant="ghost" onClick={()=>setShowAC(true)} style={{justifyContent:"center"}}>➕ Новый клиент</Btn>
            {fc.map(c=>{const st=STATUSES.find(s=>s.id===c.status);return(
              <Card key={c.id} onClick={()=>{setKpClientId(c.id);setKpStep(2);}} style={{padding:"13px 15px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{c.name}</div><div style={{fontSize:12,color:T.textSec}}>{c.phone}</div></div>
                <Tag color={st?.color} light={st?.light}>{st?.label}</Tag>
              </Card>
            );})}
          </div>
        )}
        {kpStep===2&&(
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            <GlassCard style={{padding:"13px 16px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:20}}>👤</div>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{client?.name}</div><div style={{fontSize:12,color:T.textSec}}>{client?.phone}</div></div>
              <button onClick={()=>setKpStep(1)} style={{background:"none",border:"none",color:T.textSec,cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600}}>Сменить</button>
            </GlassCard>

            {kpItems.map((item,idx)=>{const p=PRODUCTS.find(pr=>pr.id===item.productId);return(
              <GlassCard key={idx} style={{padding:"14px 16px",borderLeft:`3px solid ${p?.color||T.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{fontSize:14,fontWeight:700}}>{p?.emoji} {p?.shortName}</div>
                  <div style={{fontSize:16,fontWeight:800,color:T.gold,fontFamily:T.mono}}>{fmt(calcItem(item))}</div>
                </div>
                <div style={{fontSize:12,color:T.textSec}}>📐 {item.width}×{item.depth}м = {(item.width*item.depth).toFixed(2)}м²</div>
                {item.selectedOptions?.length>0&&<div style={{fontSize:11,color:T.textSec,marginTop:3}}>⚙️ {item.selectedOptions.map(oid=>p?.options.find(o=>o.id===oid)?.label).join(", ")}</div>}
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  <button onClick={()=>{setCur({productId:item.productId,width:String(item.width),depth:String(item.depth),selectedOptions:item.selectedOptions||[]});setEditIdx(idx);setShowPP(true);}} style={{fontSize:12,background:"none",border:"none",color:T.textSec,cursor:"pointer",fontWeight:600}}>✏️ Изменить</button>
                  <button onClick={()=>setKpItems(kpItems.filter((_,i)=>i!==idx))} style={{fontSize:12,background:"none",border:"none",color:T.danger,cursor:"pointer",fontWeight:600}}>🗑️ Удалить</button>
                </div>
              </GlassCard>
            );})}

            {!showPP&&<Btn variant="ghost" onClick={()=>{setCur({productId:null,width:"",depth:"",selectedOptions:[]});setEditIdx(null);setShowPP(true);}} style={{justifyContent:"center"}}>➕ Добавить позицию</Btn>}

            {showPP&&(
              <GlassCard style={{padding:18,borderTop:`2px solid ${T.gold}`}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:T.gold}}>{editIdx!==null?"Редактировать":"Новая позиция"}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                  {PRODUCTS.map(p=>(
                    <button key={p.id} onClick={()=>setCur({...cur,productId:p.id,selectedOptions:[]})} style={{background:cur.productId===p.id?`${p.color}15`:"rgba(255,255,255,0.02)",border:`1px solid ${cur.productId===p.id?`${p.color}40`:T.border}`,borderRadius:12,padding:"10px 13px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}>
                      <span style={{fontSize:18}}>{p.emoji}</span>
                      <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>{p.name}</div><div style={{fontSize:11,color:T.textSec}}>{fmt(p.price)}/м²</div></div>
                      {cur.productId===p.id&&<span style={{color:p.color,fontWeight:700}}>✓</span>}
                    </button>
                  ))}
                </div>
                {cur.productId&&(
                  <>
                    <div style={{display:"flex",gap:10,marginBottom:12}}>
                      {[["ШИРИНА (м)","width","4.5"],["ГЛУБИНА (м)","depth","3.0"]].map(([label,key,ph])=>(
                        <div key={key} style={{flex:1}}><div style={{fontSize:9,color:T.textDim,marginBottom:4,fontWeight:700,letterSpacing:1}}>{label}</div><Inp type="number" value={cur[key]} onChange={e=>setCur({...cur,[key]:e.target.value})} placeholder={ph} step="0.1" min="0"/></div>
                      ))}
                    </div>
                    {cur.width&&cur.depth&&(
                      <div style={{background:T.goldBg,border:`1px solid rgba(201,168,76,0.15)`,borderRadius:12,padding:12,marginBottom:12}}>
                        <div style={{fontSize:11,color:T.textSec}}>Площадь: {(parseFloat(cur.width)*parseFloat(cur.depth)).toFixed(2)} м²</div>
                        <div style={{fontSize:18,fontWeight:800,color:T.gold,fontFamily:T.mono,marginTop:3}}>≈ {fmt(calcItem({...cur,width:parseFloat(cur.width),depth:parseFloat(cur.depth)}))}</div>
                      </div>
                    )}
                    {PRODUCTS.find(p=>p.id===cur.productId)?.options?.length>0&&(
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:10,color:T.textSec,marginBottom:7,fontWeight:700,letterSpacing:1}}>ОПЦИИ</div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {PRODUCTS.find(p=>p.id===cur.productId).options.map(opt=>{
                            const sel=cur.selectedOptions.includes(opt.id);const area=parseFloat(cur.width||0)*parseFloat(cur.depth||0);
                            return(
                              <button key={opt.id} onClick={()=>setCur({...cur,selectedOptions:sel?cur.selectedOptions.filter(o=>o!==opt.id):[...cur.selectedOptions,opt.id]})} style={{display:"flex",alignItems:"center",gap:9,background:sel?T.goldBg:"rgba(255,255,255,0.02)",border:`1px solid ${sel?"rgba(201,168,76,0.2)":T.border}`,borderRadius:10,padding:"9px 12px",cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}>
                                <div style={{width:18,height:18,borderRadius:9,border:`2px solid ${sel?T.gold:T.border}`,background:sel?T.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>{sel&&<span style={{color:"#060b07",fontSize:10,fontWeight:700}}>✓</span>}</div>
                                <div style={{flex:1}}><div style={{fontSize:13,color:T.text}}>{opt.label}</div><div style={{fontSize:11,color:T.textSec}}>+{fmt(opt.flat?opt.price:opt.price*area)} {opt.flat?"(фикс)":"/м²"}</div></div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8}}>
                      <Btn variant="primary" disabled={!cur.width||!cur.depth} onClick={addItem} style={{flex:1,justifyContent:"center"}}>{editIdx!==null?"Сохранить":"Добавить"}</Btn>
                      <Btn variant="ghost" onClick={()=>{setShowPP(false);setEditIdx(null);}} style={{padding:"10px 15px"}}>✕</Btn>
                    </div>
                  </>
                )}
              </GlassCard>
            )}

            {kpItems.length>0&&(
              <GlassCard style={{padding:14}}>
                <div style={{fontSize:10,color:T.textSec,marginBottom:8,fontWeight:700,letterSpacing:1}}>СКИДКА (%)</div>
                <div style={{display:"flex",gap:6}}>{[0,3,5,7,10,15].map(d=><button key={d} onClick={()=>setKpDiscount(d)} style={{flex:1,background:kpDiscount===d?"linear-gradient(135deg,#c9a84c,#a8893a)":"rgba(255,255,255,0.03)",color:kpDiscount===d?"#060b07":T.text,border:`1px solid ${kpDiscount===d?"transparent":T.border}`,borderRadius:9,padding:"8px 0",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font,transition:"all 0.2s"}}>{d}%</button>)}</div>
              </GlassCard>
            )}

            {kpItems.length>0&&(
              <>
                <div style={{background:"linear-gradient(135deg,rgba(201,168,76,0.1),rgba(201,168,76,0.04))",border:"1px solid rgba(201,168,76,0.15)",borderRadius:16,padding:18}}>
                  <div style={{fontSize:12,color:T.textSec,fontWeight:600}}>ИТОГО{kpDiscount>0?` (скидка ${kpDiscount}%)`:""}</div>
                  <div style={{fontSize:30,fontWeight:800,color:T.gold,fontFamily:T.mono,marginTop:2}}>{fmt(total)}</div>
                  <div style={{fontSize:12,color:T.textSec,marginTop:4}}>Предоплата 50%: {fmt(total/2)}</div>
                </div>
                <Btn variant="primary" onClick={()=>setKpStep(3)} style={{justifyContent:"center",width:"100%",padding:"13px",fontSize:15}}>Сформировать КП →</Btn>
              </>
            )}
          </div>
        )}
        {kpStep===3&&client&&(
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            <Btn variant="ghost" onClick={()=>setKpStep(2)} style={{alignSelf:"flex-start",fontSize:12,padding:"7px 13px"}}>← Назад</Btn>
            <GlassCard style={{padding:18,borderTop:`2px solid ${T.gold}`}}>
              <div style={{fontSize:11,color:T.gold,fontWeight:700,marginBottom:12,letterSpacing:2}}>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</div>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4,fontFamily:T.serif}}>🏢 IGS Outdoor</div>
              <div style={{fontSize:13,marginBottom:12,color:T.textSec}}>👤 {client.name}{client.address?` · ${client.address}`:""}</div>
              {kpItems.map((item,i)=>{const p=PRODUCTS.find(pr=>pr.id===item.productId);return(
                <div key={i} style={{borderTop:`1px solid ${T.border}`,paddingTop:11,marginTop:11}}>
                  <div style={{fontSize:14,fontWeight:700}}>{p?.emoji} {p?.name}</div>
                  <div style={{fontSize:12,color:T.textSec,marginTop:2}}>📐 {item.width}×{item.depth}м = {(item.width*item.depth).toFixed(2)}м²</div>
                  {item.selectedOptions?.length>0&&<div style={{fontSize:11,color:T.textSec}}>⚙️ {item.selectedOptions.map(oid=>p?.options.find(o=>o.id===oid)?.label).join(", ")}</div>}
                  <div style={{fontSize:16,fontWeight:800,color:T.gold,fontFamily:T.mono,marginTop:4}}>{fmt(calcItem(item))}</div>
                </div>
              );})}
              <div style={{borderTop:`1px solid ${T.border}`,marginTop:12,paddingTop:12}}>
                {kpDiscount>0&&<div style={{fontSize:12,color:T.textSec,marginBottom:4}}>🏷️ Скидка: {kpDiscount}%</div>}
                <div style={{fontSize:22,fontWeight:800,color:T.gold,fontFamily:T.mono}}>💳 {fmt(total)}</div>
                <div style={{fontSize:13,color:T.textSec,marginTop:4}}>✅ Предоплата: {fmt(total/2)} · Остаток: {fmt(total/2)}</div>
              </div>
            </GlassCard>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <Btn variant={copied?"green":"primary"} onClick={copyKP} style={{justifyContent:"center",padding:"13px"}}>{copied?"✓ Скопировано!":"📋 Копировать для WhatsApp"}</Btn>
              <Btn variant={saved?"green":"ghost"} onClick={saveKP} style={{justifyContent:"center",padding:"13px"}}>{saved?"✓ Сохранено!":"💾 Сохранить в карточку"}</Btn>
              {client.phone&&<a href={`https://wa.me/${client.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"transparent",color:"#25D366",border:`1px solid ${T.border}`,borderRadius:13,padding:"13px 20px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:T.font}}>💬 Открыть WhatsApp</a>}
            </div>
          </div>
        )}
      </div>
      <AddClientModal open={showAC} onClose={()=>setShowAC(false)} onAdd={data=>{const c=onAddClient(data);if(c){setKpClientId(c.id);setKpStep(2);}setShowAC(false);}}/>
    </div>
  );
}

// ─── PRODUCT VISUALIZATIONS ───────────────────────────────────────────────────
function Arrow({x1,y1,x2,y2,label,align="start",col="0.4"}){
  return<g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={`rgba(255,255,255,${col})`} strokeWidth={0.7} strokeDasharray="3,2"/>
    <circle cx={x1} cy={y1} r={1.5} fill={`rgba(255,255,255,${col})`}/>
    <text x={x2+(align==="end"?-4:4)} y={y2+3} textAnchor={align} fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="'Satoshi',sans-serif" fontWeight="500">{label}</text>
  </g>;
}

function ProductViz({productId,color}){
  const[pct,setPct]=useState(0);
  const[playing,setPlaying]=useState(false);
  const[opts,setOpts]=useState({});
  const[mode,setMode]=useState("day");
  const animRef=useRef(null);

  function animate(reverse){
    setPlaying(true);
    let start=null;const dur=2500;const from=pct;const to=reverse?0:100;
    function step(ts){
      if(!start)start=ts;const p=Math.min((ts-start)/dur,1);
      const ease=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
      setPct(Math.round((from+(to-from)*ease)*10)/10);
      if(p<1)animRef.current=requestAnimationFrame(step);else setPlaying(false);
    }
    animRef.current=requestAnimationFrame(step);
  }
  useEffect(()=>()=>cancelAnimationFrame(animRef.current),[]);
  const tog=(k)=>setOpts(p=>({...p,[k]:!p[k]}));

  const W=400,H=300,floorY=250;
  const cc=(o)=>`rgba(255,255,255,${o})`;
  const isNight=mode==="night",isRain=mode==="rain";

  const Controls=({label,revLabel})=>(
    <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap",alignItems:"center"}}>
      <button onClick={()=>animate(pct>=50)} disabled={playing} style={{background:playing?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,padding:"7px 16px",fontSize:12,color:playing?"rgba(255,255,255,0.3)":"#fff",cursor:playing?"not-allowed":"pointer",fontFamily:T.font,fontWeight:600}}>{pct<50?`▶ ${label}`:`◀ ${revLabel||"Назад"}`}</button>
      <input type="range" min={0} max={100} value={pct} onChange={e=>{if(!playing)setPct(+e.target.value);}} style={{flex:1,minWidth:80,accentColor:color}}/>
      <span style={{fontSize:11,color:cc("0.5"),fontFamily:T.mono,minWidth:35}}>{Math.round(pct)}%</span>
    </div>
  );
  const OptToggles=({options})=>(
    <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
      {options.map(([key,label,icon])=><button key={key} onClick={()=>tog(key)} style={{background:opts[key]?"rgba(201,168,76,0.12)":"rgba(255,255,255,0.03)",border:`1px solid ${opts[key]?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:8,padding:"5px 10px",fontSize:11,color:opts[key]?"#c9a84c":"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:T.font,fontWeight:600}}>{icon} {label}</button>)}
    </div>
  );
  const WeatherBtns=()=>(
    <div style={{display:"flex",gap:4,marginTop:8}}>
      {[["day","☀️ День"],["night","🌙 Ночь"],["rain","🌧️ Дождь"]].map(([m,l])=><button key={m} onClick={()=>setMode(m)} style={{background:mode===m?"rgba(255,255,255,0.1)":"transparent",border:`1px solid ${mode===m?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.06)"}`,borderRadius:8,padding:"4px 10px",fontSize:11,color:mode===m?"#fff":"rgba(255,255,255,0.4)",cursor:"pointer",fontFamily:T.font}}>{l}</button>)}
    </div>
  );
  const StatusBar=({text})=>(<><rect x={W/2-75} y={H-18} width={150} height={16} fill={cc("0.04")} rx={6}/><text x={W/2} y={H-8} textAnchor="middle" fill={cc("0.5")} fontSize="9" fontFamily="'Satoshi',sans-serif" fontWeight="600">{text}</text></>);
  const FloorLine=()=>(<><rect x={20} y={floorY} width={W-40} height={1} fill={cc("0.12")}/><rect x={20} y={floorY+1} width={W-40} height={12} fill={cc("0.02")} rx={2}/></>);
  const DimH=({x,y1:a,y2:b,label})=>(<g><line x1={x} y1={a} x2={x} y2={b} stroke={cc("0.15")} strokeWidth={0.5}/><line x1={x-3} y1={a} x2={x+3} y2={a} stroke={cc("0.15")} strokeWidth={0.5}/><line x1={x-3} y1={b} x2={x+3} y2={b} stroke={cc("0.15")} strokeWidth={0.5}/><text x={x-3} y={(a+b)/2+3} textAnchor="end" fill={cc("0.25")} fontSize="7" fontFamily="'JetBrains Mono',monospace">{label}</text></g>);
  const DimW=({y,x1:a,x2:b,label})=>(<g><line x1={a} y1={y} x2={b} y2={y} stroke={cc("0.15")} strokeWidth={0.5}/><line x1={a} y1={y-3} x2={a} y2={y+3} stroke={cc("0.15")} strokeWidth={0.5}/><line x1={b} y1={y-3} x2={b} y2={y+3} stroke={cc("0.15")} strokeWidth={0.5}/><text x={(a+b)/2} y={y+12} textAnchor="middle" fill={cc("0.25")} fontSize="7" fontFamily="'JetBrains Mono',monospace">{label}</text></g>);

  // ═══ GREENAWN ═══
  if(productId==="greenawn"){
    const angle=pct/100*135,rad=angle*Math.PI/180;
    const numL=9,lW=26,lGap=4,topY=75;
    const lH=Math.max(Math.abs(Math.cos(rad))*16,2);
    const sideH=Math.sin(rad)*8;
    return(<div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{background:isNight?"rgba(0,0,20,0.5)":"rgba(0,0,0,0.3)",borderRadius:14}}>
        <rect x={40} y={topY-14} width={W-80} height={8} fill={cc("0.12")} rx={2}/>
        <rect x={40} y={topY-6} width={W-80} height={4} fill={cc("0.06")}/>
        <Arrow x1={W/2} y1={topY-14} x2={W/2} y2={topY-28} label="Алюминиевая рама 6063-T6"/>
        {[48,W/3+10,W*2/3-10,W-55].map((cx,i)=><g key={`c${i}`}>
          <rect x={cx} y={topY-2} width={9} height={floorY-topY+2} fill={cc("0.1")} rx={1}/>
          <rect x={cx+1} y={topY-2} width={3} height={floorY-topY+2} fill={cc("0.04")}/>
          <rect x={cx-3} y={floorY-5} width={15} height={6} fill={cc("0.08")} rx={1}/>
          {isRain&&<><line x1={cx+4.5} y1={topY+30} x2={cx+4.5} y2={floorY-8} stroke="rgba(100,180,255,0.25)" strokeWidth={1.5} strokeDasharray="4,3"/><circle cx={cx+4.5} cy={floorY-8} r={2} fill="rgba(100,180,255,0.15)"/></>}
        </g>)}
        <Arrow x1={48+4} y1={floorY/2+20} x2={25} y2={floorY/2+20} label="Колонна" align="end"/>
        {isRain&&<Arrow x1={W-51+4} y1={floorY/2+40} x2={W-20} y2={floorY/2+40} label="Водосток ↓"/>}
        {Array.from({length:numL}).map((_,i)=>{const x=65+i*(lW+lGap);return<g key={`l${i}`}>
          {angle>15&&<rect x={x+Math.sin(rad)*20} y={floorY-3} width={lW*0.7} height={2} fill={cc("0.04")} rx={1}/>}
          <rect x={x} y={topY+2-lH/2} width={lW} height={lH} fill={cc(angle<30?"0.75":"0.45")} rx={1}/>
          {angle>10&&<rect x={x} y={topY+2+lH/2} width={lW} height={sideH} fill={cc("0.15")} rx={0.5}/>}
        </g>;})}
        <Arrow x1={65+4*(lW+lGap)+lW/2} y1={topY+2} x2={65+4*(lW+lGap)+lW/2} y2={topY-28} label={`Ламели: ${Math.round(angle)}°`}/>
        {mode==="day"&&<text x={W/2} y={16} textAnchor="middle" fill="rgba(255,220,100,0.3)" fontSize="14">☀</text>}
        {mode==="day"&&angle<60&&Array.from({length:5}).map((_,i)=><line key={i} x1={100+i*55} y1={10} x2={110+i*55} y2={topY-16} stroke="rgba(255,220,100,0.1)" strokeWidth={1}/>)}
        {mode==="day"&&angle>=60&&<>{Array.from({length:5}).map((_,i)=>{const x=85+i*55;return<g key={i}><line x1={x} y1={10} x2={x+10} y2={topY-16} stroke="rgba(255,220,100,0.1)" strokeWidth={1}/><line x1={x+12} y1={topY+sideH+10} x2={x+20} y2={floorY-10} stroke="rgba(255,220,100,0.06)" strokeWidth={1.5}/></g>})}<Arrow x1={200} y1={topY+sideH+18} x2={260} y2={topY+sideH+18} label="Свет между ламелями"/></>}
        {isRain&&<>{Array.from({length:20}).map((_,i)=><line key={i} x1={50+i*16+Math.sin(i*3)*5} y1={10+Math.sin(i*7)*8} x2={47+i*16+Math.sin(i*3)*5} y2={topY-16} stroke="rgba(100,180,255,0.15)" strokeWidth={0.7}/>)}<text x={W/2} y={16} textAnchor="middle" fill="rgba(100,180,255,0.3)" fontSize="14">🌧</text></>}
        {isRain&&angle<40&&<Arrow x1={W/2} y1={topY+10} x2={W/2+70} y2={topY+10} label="Дождь → водосток в колоннах"/>}
        {opts.led&&<>{Array.from({length:numL}).map((_,i)=>{const x=65+i*(lW+lGap)+lW/2;return<g key={i}><circle cx={x} cy={topY+22} r={isNight?18:10} fill={`rgba(255,220,100,${isNight?"0.08":"0.03"})`}/><rect x={x-1} y={topY+4+lH/2+sideH} width={2} height={2} fill="rgba(255,220,100,0.6)" rx={1}/></g>})}<Arrow x1={65+lW/2} y1={topY+25} x2={30} y2={topY+38} label="LED лента" align="end"/></>}
        {opts.heater&&<><rect x={W/2-25} y={topY+5} width={50} height={6} fill="rgba(255,80,50,0.15)" rx={2}/>{Array.from({length:7}).map((_,i)=><line key={i} x1={W/2-18+i*7} y1={topY+12} x2={W/2-18+i*7} y2={topY+30+Math.sin(i)*5} stroke="rgba(255,80,50,0.08)" strokeWidth={1.5}/>)}<Arrow x1={W/2+25} y1={topY+8} x2={W/2+75} y2={topY-5} label="ИК обогреватель"/></>}
        {opts.screen&&<><rect x={46} y={topY} width={3} height={floorY-topY-5} fill={cc("0.07")} stroke={cc("0.1")} strokeWidth={0.5}/><rect x={W-55} y={topY} width={3} height={floorY-topY-5} fill={cc("0.07")} stroke={cc("0.1")} strokeWidth={0.5}/><Arrow x1={46} y1={topY+60} x2={20} y2={topY+60} label="Zip-штора" align="end"/></>}
        <FloorLine/>
        <DimW y={floorY+10} x1={40} x2={W-40} label="4 500 мм"/>
        <DimH x={28} y1={topY-2} y2={floorY} label="3 000"/>
        <rect x={W-80} y={topY+20} width={36} height={14} fill={cc("0.05")} rx={4} stroke={cc("0.1")} strokeWidth={0.5}/>
        <text x={W-62} y={topY+29} textAnchor="middle" fill={cc("0.35")} fontSize="7" fontWeight="600">SOMFY</text>
        <Arrow x1={W-62} y1={topY+34} x2={W-62} y2={topY+48} label="Мотор RTS"/>
        <rect x={W-80} y={floorY-22} width={22} height={14} fill={cc("0.04")} rx={2} stroke={cc("0.08")} strokeWidth={0.5}/>
        <text x={W-69} y={floorY-13} textAnchor="middle" fill={cc("0.3")} fontSize="8" fontWeight="700">CE</text>
        <StatusBar text={angle===0?"● Закрыто — полная тень":angle<70?`◐ ${Math.round(angle)}° — частичная тень`:"○ Открыто — свет и воздух"}/>
      </svg>
      <Controls label="Открыть ламели" revLabel="Закрыть"/>
      <OptToggles options={[["led","LED подсветка","💡"],["heater","ИК обогрев","🔥"],["screen","Zip-шторы","🪟"]]}/>
      <WeatherBtns/>
    </div>);
  }

  // ═══ IGS PREMIUM ═══
  if(productId==="igs_premium"){
    const ph1=Math.min(pct*2,100)/100,ph2=Math.max(0,pct*2-100)/100;
    const angle=ph1*135,rad=angle*Math.PI/180;
    const numL=9,lW=24,topY=75;
    const lH=Math.max(Math.abs(Math.cos(rad))*16,2),sideH=Math.sin(rad)*7;
    const slideOff=ph2*180;
    return(<div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{background:isNight?"rgba(0,0,20,0.5)":"rgba(0,0,0,0.3)",borderRadius:14}}>
        <rect x={40} y={topY-14} width={W-80} height={8} fill={cc("0.12")} rx={2}/>
        <Arrow x1={W/2} y1={topY-14} x2={W/2} y2={topY-30} label="Премиум профиль — макс. 12 м"/>
        <line x1={45} y1={topY-3} x2={W-45} y2={topY-3} stroke={cc("0.12")} strokeWidth={2.5}/>
        <line x1={45} y1={topY+20} x2={W-45} y2={topY+20} stroke={cc("0.12")} strokeWidth={2.5}/>
        {ph2>0&&<Arrow x1={W-60} y1={topY-3} x2={W-30} y2={topY-15} label="Рельс для сдвига"/>}
        {[48,W-55].map((cx,i)=><g key={i}><rect x={cx} y={topY-2} width={9} height={floorY-topY+2} fill={cc("0.1")} rx={1}/><rect x={cx+1} y={topY-2} width={3} height={floorY-topY+2} fill={cc("0.04")}/><rect x={cx-3} y={floorY-5} width={15} height={6} fill={cc("0.08")} rx={1}/></g>)}
        {Array.from({length:numL}).map((_,i)=>{const bx=65+i*(lW+3),x=bx+slideOff*(0.3+i*0.08);if(x>W-50)return null;return<g key={i}>
          <rect x={x} y={topY+4-lH/2} width={lW} height={lH} fill={cc(angle<30?"0.75":"0.45")} rx={1}/>
          {angle>10&&<rect x={x} y={topY+4+lH/2} width={lW} height={sideH} fill={cc("0.15")}/>}
          {opts.insulated&&lH>5&&<rect x={x+2} y={topY+4-lH/2+2} width={lW-4} height={lH-4} fill="rgba(255,180,50,0.08)" rx={0.5}/>}
        </g>;})}
        {opts.insulated&&<Arrow x1={65+2*(lW+3)+lW/2} y1={topY+4} x2={65+2*(lW+3)+lW/2-40} y2={topY+30} label="Утеплённые ламели" align="end"/>}
        {ph2>0.2&&<><rect x={60} y={topY-2} width={Math.min(slideOff*1.2,W-130)} height={22} fill="rgba(100,180,255,0.03)" rx={3}/><text x={60+Math.min(slideOff*0.6,100)} y={topY+12} textAnchor="middle" fill="rgba(100,180,255,0.3)" fontSize="9">☁ Открытое небо</text></>}
        {angle<20&&<><Arrow x1={65+4*(lW+3)} y1={topY+lH+8} x2={65+4*(lW+3)} y2={topY+lH+28} label="Герметичная конструкция"/></>}
        {opts.led&&Array.from({length:numL}).map((_,i)=>{const x=65+i*(lW+3)+slideOff*(0.3+i*0.08);if(x>W-50)return null;return<circle key={i} cx={x+lW/2} cy={topY+25} r={isNight?15:8} fill={`rgba(255,220,100,${isNight?"0.06":"0.02"})`}/>;}).filter(Boolean)}
        {opts.heater&&<><rect x={W/2-30} y={topY+6} width={60} height={5} fill="rgba(255,80,50,0.12)" rx={2}/>{Array.from({length:9}).map((_,i)=><line key={i} x1={W/2-25+i*7} y1={topY+12} x2={W/2-25+i*7} y2={topY+28+Math.sin(i*2)*4} stroke="rgba(255,80,50,0.07)" strokeWidth={1.5}/>)}<Arrow x1={W/2+30} y1={topY+9} x2={W/2+80} y2={topY-3} label="ИК обогрев"/></>}
        <FloorLine/>
        <DimW y={floorY+10} x1={40} x2={W-40} label="до 12 000 мм"/>
        <StatusBar text={pct===0?"● Закрыто и герметично":pct<50?`◐ Поворот: ${Math.round(angle)}°`:pct<75?`↔ Сдвиг: ${Math.round(ph2*100)}%`:"○ Полностью открыто"}/>
      </svg>
      <Controls label="Поворот → Сдвиг" revLabel="Закрыть"/>
      <OptToggles options={[["insulated","Утепление","🧱"],["led","LED","💡"],["heater","ИК обогрев","🔥"]]}/>
      <WeatherBtns/>
    </div>);
  }

  // ═══ TOSCANA ═══
  if(productId==="toscana"){
    const ext=pct/100,topY=65,endX=55+ext*(W-130);
    return(<div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{background:"rgba(0,0,0,0.3)",borderRadius:14}}>
        <rect x={40} y={topY-8} width={W-80} height={5} fill={cc("0.12")} rx={1}/>
        <Arrow x1={W/2} y1={topY-8} x2={W/2} y2={topY-25} label="Алюминиевый каркас"/>
        {[46,W-52].map((cx,i)=><g key={i}><rect x={cx} y={topY} width={8} height={floorY-topY} fill={cc("0.1")} rx={1}/><rect x={cx-2} y={floorY-4} width={12} height={5} fill={cc("0.07")} rx={1}/></g>)}
        <line x1={50} y1={topY+4} x2={W-50} y2={topY+4} stroke={cc("0.1")} strokeWidth={2}/>
        <line x1={50} y1={topY+24} x2={W-50} y2={topY+24} stroke={cc("0.1")} strokeWidth={2}/>
        <Arrow x1={W-55} y1={topY+4} x2={W-25} y2={topY-8} label="Направляющая"/>
        <rect x={42} y={topY-1} width={14} height={28} fill={cc("0.13")} rx={3}/>
        <Arrow x1={49} y1={topY+27} x2={25} y2={topY+42} label="Кассета" align="end"/>
        {ext>0.01&&<><rect x={55} y={topY+5} width={endX-55} height={18} fill={cc("0.08")} stroke={cc("0.12")} strokeWidth={0.5} rx={1}/>{Array.from({length:Math.floor(ext*12)}).map((_,i)=>{const fx=58+i*((endX-58)/Math.max(Math.floor(ext*12),1));return<line key={i} x1={fx} y1={topY+5} x2={fx} y2={topY+23} stroke={cc("0.04")} strokeWidth={0.5}/>})}<rect x={endX-4} y={topY+3} width={5} height={22} fill={cc("0.2")} rx={1}/><Arrow x1={(55+endX)/2} y1={topY+14} x2={(55+endX)/2+60} y2={topY+40} label="ПВХ-крыша"/></>}
        {ext>0.15&&<rect x={55} y={floorY-3} width={(endX-55)*0.85} height={4} fill={cc("0.03")} rx={2}/>}
        {opts.led&&ext>0.1&&<><rect x={56} y={topY+23} width={endX-58} height={1} fill="rgba(255,220,100,0.2)"/><Arrow x1={endX-20} y1={topY+23} x2={endX+15} y2={topY+35} label="LED"/></>}
        <FloorLine/>
        {ext>0.05&&<DimW y={floorY+10} x1={55} x2={endX} label={`${(ext*13.5).toFixed(1)} м`}/>}
        <StatusBar text={`Проекция: ${(ext*13.5).toFixed(1)} м из 13.5 м`}/>
      </svg>
      <Controls label="Выдвинуть" revLabel="Сложить"/>
      <OptToggles options={[["led","LED подсветка","💡"],["motor","Моторизация","⚡"]]}/>
    </div>);
  }

  // ═══ СЛАЙДИНГ ═══
  if(productId==="sliding"){
    const panels=4,fL=55,fR=W-55,tw=fR-fL,pW=tw/panels,topY=45,botY=floorY-5,slide=pct/100,isDbl=opts.double;
    return(<div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{background:"rgba(0,0,0,0.3)",borderRadius:14}}>
        <rect x={fL-5} y={topY-5} width={tw+10} height={botY-topY+10} fill="none" stroke={cc("0.2")} strokeWidth={3} rx={3}/>
        <Arrow x1={fL-5} y1={topY+30} x2={fL-30} y2={topY+30} label="Алюм. профиль" align="end"/>
        <rect x={fL} y={topY-2} width={tw} height={3} fill={cc("0.08")}/>
        <rect x={fL} y={botY} width={tw} height={4} fill={cc("0.08")} rx={1}/>
        {Array.from({length:panels}).map((_,i)=>{let x=fL+i*pW;if(i>=2)x+=slide*pW*(panels-i)*0.9;const pw=pW-4;return<g key={i}>
          <rect x={x+2} y={topY+2} width={pw} height={botY-topY-4} fill={cc("0.04")} stroke={cc("0.15")} strokeWidth={1.2} rx={1}/>
          {isDbl&&<rect x={x+5} y={topY+5} width={pw-6} height={botY-topY-10} fill="none" stroke={cc("0.06")} strokeWidth={0.5} rx={1}/>}
          <line x1={x+10} y1={topY+8} x2={x+10} y2={botY-8} stroke={cc("0.06")} strokeWidth={1.5}/>
          <rect x={x+pw-7} y={(topY+botY)/2-14} width={3} height={28} fill={cc("0.2")} rx={1}/>
          <circle cx={x+14} cy={botY+1} r={2.5} fill={cc("0.12")}/>
          <circle cx={x+pw-10} cy={botY+1} r={2.5} fill={cc("0.12")}/>
          <text x={x+pw/2+1} y={botY-10} textAnchor="middle" fill={cc("0.12")} fontSize="9" fontFamily="'JetBrains Mono',monospace">{i+1}</text>
        </g>})}
        {isDbl&&<Arrow x1={fL+pW/2} y1={topY+20} x2={fL-25} y2={topY+15} label="2× стекло" align="end"/>}
        <Arrow x1={fL+pW*3.5} y1={botY+1} x2={fL+pW*3.5} y2={botY+18} label="Бесшумные ролики"/>
        {slide>0.3&&<Arrow x1={fL+pW*1.8} y1={(topY+botY)/2} x2={fL+pW*1.2} y2={(topY+botY)/2-25} label="Открытый проём" align="end"/>}
        <StatusBar text={`${panels} секции · ${slide>0?`Открыто ${Math.round(slide*100)}%`:"Закрыто"}`}/>
      </svg>
      <Controls label="Раздвинуть" revLabel="Закрыть"/>
      <OptToggles options={[["double","Двойное стекло","🪟"]]}/>
    </div>);
  }

  // ═══ ГИЛЬОТИНА ═══
  if(productId==="guillotine"){
    const topY=40,railH=55,fullH=floorY-topY,glassH=fullH-railH;
    const glassTop=topY+(pct/100)*(fullH-railH),isRail=pct>70,isAuto=opts.auto;
    return(<div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{background:"rgba(0,0,0,0.3)",borderRadius:14}}>
        <rect x={50} y={topY-6} width={W-100} height={7} fill={cc("0.15")} rx={2}/>
        <Arrow x1={W/2} y1={topY-6} x2={W/2} y2={topY-22} label="Верхняя рама"/>
        <rect x={53} y={topY} width={5} height={fullH} fill={cc("0.1")} rx={1}/>
        <rect x={W-58} y={topY} width={5} height={fullH} fill={cc("0.1")} rx={1}/>
        {Array.from({length:10}).map((_,i)=><g key={i}><rect x={54} y={topY+8+i*18} width={3} height={6} fill={cc("0.05")} rx={0.5}/><rect x={W-57} y={topY+8+i*18} width={3} height={6} fill={cc("0.05")} rx={0.5}/></g>)}
        <Arrow x1={53} y1={topY+fullH/2} x2={30} y2={topY+fullH/2} label="Пазы" align="end"/>
        {[0,1].map(i=>{const pw=(W-135)/2,px=64+i*(pw+10);return<g key={i}>
          <rect x={px} y={glassTop} width={pw} height={glassH} fill={cc("0.04")} stroke={cc("0.18")} strokeWidth={1.5} rx={2}/>
          <rect x={px+3} y={glassTop+3} width={pw-6} height={glassH-6} fill="none" stroke={cc("0.05")} strokeWidth={0.5} rx={1} strokeDasharray="4,4"/>
          <line x1={px+10} y1={glassTop+6} x2={px+10} y2={glassTop+glassH-6} stroke={cc("0.07")} strokeWidth={2}/>
          <rect x={px} y={glassTop} width={pw} height={4} fill={cc("0.12")} rx={1}/>
          <rect x={px} y={glassTop+glassH-4} width={pw} height={4} fill={cc("0.12")} rx={1}/>
          <text x={px+pw/2} y={glassTop+glassH/2+3} textAnchor="middle" fill={cc("0.08")} fontSize="7">ЛАМИНИРОВАННОЕ</text>
        </g>})}
        <Arrow x1={64+(W-135)/4} y1={glassTop+glassH/2} x2={35} y2={glassTop+glassH/2-15} label="Стекло ↓" align="end"/>
        {isRail&&<><rect x={60} y={glassTop-4} width={W-120} height={6} fill={cc("0.3")} rx={3}/><Arrow x1={W/2} y1={glassTop-4} x2={W/2} y2={glassTop-22} label="Поручень (перила)"/>{Array.from({length:6}).map((_,i)=>{const sx=75+i*((W-150)/5);return<rect key={i} x={sx} y={glassTop+2} width={2.5} height={floorY-glassTop-2} fill={cc("0.07")} rx={0.5}/>})}</>}
        <rect x={W-48} y={topY+2} width={12} height={16} fill={cc("0.1")} rx={3}/>
        <circle cx={W-42} cy={topY+10} r={4} fill="none" stroke={cc("0.2")} strokeWidth={1}/>
        <line x1={W-42} y1={topY+16} x2={W-42} y2={topY+16+pct*0.4} stroke={cc("0.1")} strokeWidth={1} strokeDasharray="2,2"/>
        <Arrow x1={W-42} y1={topY+2} x2={W-20} y2={topY-8} label={isAuto?"Авто-привод":"Цепной привод"}/>
        {isAuto&&<><rect x={W-50} y={topY+20} width={16} height={8} fill="rgba(100,150,255,0.1)" rx={2}/><text x={W-42} y={topY+26} textAnchor="middle" fill="rgba(100,150,255,0.4)" fontSize="5">AUTO</text></>}
        <FloorLine/>
        <DimH x={35} y1={topY} y2={floorY} label="3 000"/>
        <StatusBar text={isRail?"✓ Режим перил — открытый вид":"Стеклянный барьер — защита от ветра"}/>
      </svg>
      <Controls label="Опустить → Перила" revLabel="Поднять → Барьер"/>
      <OptToggles options={[["auto","Автоматизация","⚡"]]}/>
    </div>);
  }

  // ═══ ZIP-ШТОРЫ ═══
  if(productId==="zip"){
    const topY=48,dropH=pct/100*(floorY-topY-15);
    return(<div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{background:"rgba(0,0,0,0.3)",borderRadius:14}}>
        <rect x={55} y={topY-10} width={W-110} height={20} fill={cc("0.15")} rx={6}/>
        <rect x={60} y={topY-7} width={W-120} height={14} fill={cc("0.08")} rx={4}/>
        <Arrow x1={W/2} y1={topY-10} x2={W/2} y2={topY-28} label="Кассетная система"/>
        <rect x={55} y={topY+10} width={6} height={floorY-topY-10} fill={cc("0.1")} rx={1}/>
        <rect x={W-61} y={topY+10} width={6} height={floorY-topY-10} fill={cc("0.1")} rx={1}/>
        {Array.from({length:6}).map((_,i)=><g key={i}><rect x={56} y={topY+15+i*28} width={4} height={12} fill={cc("0.06")} rx={1}/><rect x={W-60} y={topY+15+i*28} width={4} height={12} fill={cc("0.06")} rx={1}/></g>)}
        <Arrow x1={55} y1={topY+60} x2={28} y2={topY+60} label="ZIP-замок" align="end"/>
        <Arrow x1={W-61} y1={topY+90} x2={W-25} y2={topY+90} label="Направляющая"/>
        {dropH>3&&<><rect x={62} y={topY+10} width={W-124} height={dropH} fill={cc("0.07")} stroke={cc("0.1")} strokeWidth={0.5}/>{Array.from({length:Math.floor(dropH/12)}).map((_,i)=><line key={i} x1={62} y1={topY+16+i*12} x2={W-62} y2={topY+16+i*12} stroke={cc("0.03")} strokeWidth={0.5}/>)}<rect x={62} y={topY+10+dropH-6} width={W-124} height={6} fill={cc("0.18")} rx={2}/><Arrow x1={W/2} y1={topY+10+dropH/2} x2={W/2+85} y2={topY+10+dropH/2} label="Ткань Dickson"/></>}
        {pct>30&&<>{Array.from({length:5}).map((_,i)=><g key={i}><path d={`M${W-20},${60+i*35} Q${W-10},${62+i*35} ${W-2},${58+i*35}`} fill="none" stroke={cc("0.15")} strokeWidth={1}/><polygon points={`${W-2},${58+i*35} ${W+2},${56+i*35} ${W},${60+i*35}`} fill={cc("0.15")}/></g>)}<text x={W-12} y={50} textAnchor="middle" fill={cc("0.3")} fontSize="9">💨</text><Arrow x1={W-15} y1={55} x2={W-15} y2={42} label="до 180 км/ч"/></>}
        {pct>50&&<><text x={W-18} y={floorY-30} textAnchor="middle" fill={cc("0.25")} fontSize="10">🦟</text><line x1={W-24} y1={floorY-38} x2={W-12} y2={floorY-24} stroke="rgba(255,80,80,0.3)" strokeWidth={1.5}/><line x1={W-12} y1={floorY-38} x2={W-24} y2={floorY-24} stroke="rgba(255,80,80,0.3)" strokeWidth={1.5}/></>}
        {opts.motor&&<><rect x={W/2-15} y={topY-7} width={30} height={10} fill="rgba(100,150,255,0.1)" rx={3} stroke="rgba(100,150,255,0.2)" strokeWidth={0.5}/><text x={W/2} y={topY} textAnchor="middle" fill="rgba(100,150,255,0.4)" fontSize="6">МОТОР</text></>}
        <FloorLine/>
        <StatusBar text={pct===0?"Штора поднята":pct<50?`Опущено ${Math.round(pct)}%`:"Полная защита — ветер, солнце, насекомые"}/>
      </svg>
      <Controls label="Опустить штору" revLabel="Поднять"/>
      <OptToggles options={[["motor","Моторизация","⚡"],["mesh","Москитная сетка","🦟"]]}/>
    </div>);
  }

  // ═══ МАРКИЗЫ ═══
  if(productId==="marquise"){
    const ext=pct/100,wallX=35,topY=55,extX=ext*(W-120),drop=ext*0.28;
    return(<div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{background:"rgba(0,0,0,0.3)",borderRadius:14}}>
        <rect x={wallX-10} y={20} width={16} height={floorY-20} fill={cc("0.08")} rx={1}/>
        {Array.from({length:12}).map((_,i)=><line key={i} x1={wallX-9} y1={28+i*18} x2={wallX+5} y2={28+i*18} stroke={cc("0.03")} strokeWidth={0.5}/>)}
        <Arrow x1={wallX-2} y1={38} x2={wallX-25} y2={38} label="Стена" align="end"/>
        <rect x={wallX+3} y={topY-12} width={22} height={24} fill={cc("0.15")} rx={5}/>
        <circle cx={wallX+14} cy={topY} r={6} fill={cc("0.08")} stroke={cc("0.12")} strokeWidth={1}/>
        <Arrow x1={wallX+25} y1={topY} x2={wallX+55} y2={topY-15} label="Кассета"/>
        {ext>0.02&&<><path d={`M${wallX+22},${topY-6} L${wallX+22+extX},${topY-6+extX*drop} L${wallX+22+extX},${topY+10+extX*drop} L${wallX+22},${topY+10} Z`} fill={cc("0.08")} stroke={cc("0.15")} strokeWidth={1}/>{Array.from({length:Math.floor(ext*12)}).map((_,i)=>{const fx=wallX+28+i*(extX/Math.max(Math.floor(ext*12),1));if(fx>wallX+22+extX-5)return null;const fy1=topY-6+(fx-wallX-22)*drop;const fy2=topY+10+(fx-wallX-22)*drop;return<line key={i} x1={fx} y1={fy1} x2={fx} y2={fy2} stroke={cc("0.04")} strokeWidth={0.5}/>}).filter(Boolean)}{ext>0.3&&<path d={`M${wallX+22+extX},${topY+10+extX*drop} ${Array.from({length:8}).map((_,i)=>{const vx=wallX+22+extX-i*(extX/8);const vy=topY+10+(vx-wallX-22)*drop;return`Q${vx+extX/16},${vy+10} ${vx-extX/16},${vy}`}).join(" ")}`} fill="none" stroke={cc("0.1")} strokeWidth={0.5}/>}<Arrow x1={wallX+22+extX/2} y1={topY+2+extX/2*drop} x2={wallX+22+extX/2+40} y2={topY+35+extX/2*drop} label="Ткань"/></>}
        {ext>0.05&&<><line x1={wallX+22} y1={topY+8} x2={wallX+22+extX*0.45} y2={topY+8+extX*0.22} stroke={cc("0.18")} strokeWidth={2}/><line x1={wallX+22+extX*0.45} y1={topY+8+extX*0.22} x2={wallX+22+extX} y2={topY+6+extX*drop} stroke={cc("0.18")} strokeWidth={2}/><circle cx={wallX+22+extX*0.45} cy={topY+8+extX*0.22} r={4} fill={cc("0.1")} stroke={cc("0.2")} strokeWidth={1}/><circle cx={wallX+22} cy={topY+8} r={2.5} fill={cc("0.15")}/><Arrow x1={wallX+22+extX*0.45} y1={topY+8+extX*0.22+5} x2={wallX+22+extX*0.45+35} y2={topY+8+extX*0.22+25} label="Шарнир"/></>}
        {opts.motor&&<><rect x={wallX+5} y={topY+14} width={14} height={8} fill="rgba(100,150,255,0.1)" rx={2}/><text x={wallX+12} y={topY+20} textAnchor="middle" fill="rgba(100,150,255,0.4)" fontSize="5">⚡</text></>}
        {ext>0.2&&<ellipse cx={wallX+22+extX*0.45} cy={floorY-2} rx={extX*0.4} ry={6} fill={cc("0.03")}/>}
        <g transform={`translate(${W-60},${floorY-80})`}><circle cx={0} cy={0} r={6} fill="none" stroke={cc("0.12")} strokeWidth={1}/><line x1={0} y1={6} x2={0} y2={36} stroke={cc("0.12")} strokeWidth={1}/><line x1={0} y1={14} x2={-10} y2={26} stroke={cc("0.12")} strokeWidth={1}/><line x1={0} y1={14} x2={10} y2={26} stroke={cc("0.12")} strokeWidth={1}/><line x1={0} y1={36} x2={-7} y2={52} stroke={cc("0.12")} strokeWidth={1}/><line x1={0} y1={36} x2={7} y2={52} stroke={cc("0.12")} strokeWidth={1}/></g>
        <text x={W-60} y={floorY+12} textAnchor="middle" fill={cc("0.2")} fontSize="7">~180 см</text>
        <FloorLine/>
        {ext>0.1&&<DimW y={floorY+10} x1={wallX+22} x2={wallX+22+extX} label={`${(ext*4).toFixed(1)} м`}/>}
        <StatusBar text={ext<0.05?"Компактно сложено у стены":`Навес: ${(ext*4).toFixed(1)} м`}/>
      </svg>
      <Controls label="Выдвинуть" revLabel="Сложить"/>
      <OptToggles options={[["motor","Моторизация","⚡"]]}/>
    </div>);
  }

  return null;
}

// ─── ADD PRODUCT MODAL ────────────────────────────────────────────────────────
function AddProductModal({open,onClose,onAdd}){
  const[name,setName]=useState("");
  const[shortName,setShortName]=useState("");
  const[tag,setTag]=useState("");
  const[price,setPrice]=useState("");
  const[color,setColor]=useState("#2d7a4f");
  const[emoji,setEmoji]=useState("📦");
  const[desc,setDesc]=useState("");
  const[featuresText,setFeaturesText]=useState("");
  const[options,setOptions]=useState([]);
  const[optLabel,setOptLabel]=useState("");
  const[optPrice,setOptPrice]=useState("");
  const[optFlat,setOptFlat]=useState(false);

  function addOption(){
    if(!optLabel.trim()||!optPrice)return;
    setOptions(prev=>[...prev,{id:Date.now().toString(),label:optLabel.trim(),price:parseInt(optPrice)||0,flat:optFlat}]);
    setOptLabel("");setOptPrice("");setOptFlat(false);
  }
  function removeOption(id){setOptions(prev=>prev.filter(o=>o.id!==id));}

  function handleAdd(){
    if(!name.trim()||!shortName.trim()||!price)return;
    const product={
      id:"custom_"+Date.now(),
      name:name.trim(),
      shortName:shortName.trim(),
      tag:tag.trim()||"Пользовательский продукт",
      price:parseInt(price)||0,
      color,
      emoji:emoji||"📦",
      desc:desc.trim(),
      features:featuresText.split("\n").map(f=>f.trim()).filter(Boolean),
      options:[...options],
      isCustom:true,
    };
    onAdd(product);
    setName("");setShortName("");setTag("");setPrice("");setColor("#2d7a4f");setEmoji("📦");setDesc("");setFeaturesText("");setOptions([]);
  }

  if(!open)return null;
  const COLORS=["#2d7a4f","#1a5276","#7d6608","#1a6b8a","#6c3483","#784212","#1e8449","#b8965a","#c45454","#2563eb"];
  const EMOJIS=["📦","🏗️","🪟","☂️","⛺","🌿","⭐","🔳","🌬️","🏠","💎","🛠️","🪵","🧱","🔩"];

  return createPortal(
    <div style={{position:"fixed",inset:0,zIndex:8000,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.surface,borderRadius:12,width:"100%",maxWidth:520,maxHeight:"92vh",overflowY:"auto",border:`1px solid ${T.border}`,boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px",borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.surface,zIndex:1}}>
          <div style={{fontSize:16,fontWeight:600}}>Новый продукт</div>
          <button onClick={onClose} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:T.textSec}}>✕</button>
        </div>
        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>
          {/* Основное */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:T.textSec,marginBottom:5,fontWeight:600,letterSpacing:1}}>НАЗВАНИЕ *</div><Inp value={name} onChange={e=>setName(e.target.value)} placeholder="Биоклиматическая пергола XYZ" autoFocus/></div>
            <div><div style={{fontSize:10,color:T.textSec,marginBottom:5,fontWeight:600,letterSpacing:1}}>КОРОТКОЕ ИМЯ *</div><Inp value={shortName} onChange={e=>setShortName(e.target.value)} placeholder="XYZ"/></div>
            <div><div style={{fontSize:10,color:T.textSec,marginBottom:5,fontWeight:600,letterSpacing:1}}>ТЕГ</div><Inp value={tag} onChange={e=>setTag(e.target.value)} placeholder="Премиум серия"/></div>
            <div><div style={{fontSize:10,color:T.textSec,marginBottom:5,fontWeight:600,letterSpacing:1}}>ЦЕНА ЗА М² (₸) *</div><Inp type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="250000" inputMode="numeric"/></div>
            <div><div style={{fontSize:10,color:T.textSec,marginBottom:5,fontWeight:600,letterSpacing:1}}>ОПИСАНИЕ</div><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Краткое описание продукта…" style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:13,width:"100%",outline:"none",minHeight:60,resize:"vertical",fontFamily:T.font,gridColumn:"1/-1"}}/></div>
          </div>

          {/* Эмодзи */}
          <div>
            <div style={{fontSize:10,color:T.textSec,marginBottom:6,fontWeight:600,letterSpacing:1}}>ИКОНКА</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{width:34,height:34,borderRadius:8,background:emoji===e?T.goldBg:T.elevated,border:`1px solid ${emoji===e?T.goldDim:T.border}`,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{e}</button>)}
            </div>
          </div>

          {/* Цвет */}
          <div>
            <div style={{fontSize:10,color:T.textSec,marginBottom:6,fontWeight:600,letterSpacing:1}}>ЦВЕТ АКЦЕНТА</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
              {COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:28,height:28,borderRadius:7,background:c,border:color===c?"2px solid #fff":`2px solid transparent`,cursor:"pointer",transition:"all 0.15s"}}/>)}
              <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:28,height:28,borderRadius:7,border:"none",cursor:"pointer",padding:0}}/>
            </div>
          </div>

          {/* Преимущества */}
          <div>
            <div style={{fontSize:10,color:T.textSec,marginBottom:5,fontWeight:600,letterSpacing:1}}>ПРЕИМУЩЕСТВА (по одному на строку)</div>
            <textarea value={featuresText} onChange={e=>setFeaturesText(e.target.value)} placeholder={"Преимущество 1\nПреимущество 2\nПреимущество 3"} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:13,width:"100%",outline:"none",minHeight:70,resize:"vertical",fontFamily:T.font}}/>
          </div>

          {/* Доп. опции */}
          <div>
            <div style={{fontSize:10,color:T.textSec,marginBottom:6,fontWeight:600,letterSpacing:1}}>ДОП. ОПЦИИ</div>
            {options.length>0&&<div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10}}>
              {options.map(o=>(
                <div key={o.id} style={{display:"flex",alignItems:"center",gap:8,background:T.elevated,borderRadius:8,padding:"8px 12px",border:`1px solid ${T.border}`}}>
                  <div style={{flex:1,fontSize:13}}>{o.label}</div>
                  <div style={{fontSize:12,color:T.gold,fontFamily:T.mono}}>{fmt(o.price)}{o.flat?"":" /м²"}</div>
                  <button onClick={()=>removeOption(o.id)} style={{background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:13,padding:"0 2px"}}>✕</button>
                </div>
              ))}
            </div>}
            <div style={{display:"flex",gap:6,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div style={{flex:2,minWidth:120}}><div style={{fontSize:9,color:T.textDim,marginBottom:3}}>Название</div><Inp value={optLabel} onChange={e=>setOptLabel(e.target.value)} placeholder="LED подсветка" style={{padding:"8px 10px",fontSize:12}}/></div>
              <div style={{flex:1,minWidth:80}}><div style={{fontSize:9,color:T.textDim,marginBottom:3}}>Цена ₸</div><Inp type="number" value={optPrice} onChange={e=>setOptPrice(e.target.value)} placeholder="12000" style={{padding:"8px 10px",fontSize:12}} inputMode="numeric"/></div>
              <button onClick={()=>setOptFlat(!optFlat)} style={{background:optFlat?T.goldBg:T.elevated,border:`1px solid ${optFlat?T.goldDim:T.border}`,borderRadius:7,padding:"8px 10px",fontSize:10,color:optFlat?T.gold:T.textSec,cursor:"pointer",fontFamily:T.font,whiteSpace:"nowrap"}}>{optFlat?"Фикс":"За м²"}</button>
              <button onClick={addOption} style={{background:T.gold,color:T.bg,border:"none",borderRadius:7,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>+</button>
            </div>
          </div>

          {/* Превью */}
          {name&&<div style={{background:T.bg,borderRadius:10,padding:16,border:`1px solid ${T.border}`,borderLeft:`3px solid ${color}`}}>
            <div style={{fontSize:10,color:T.textDim,marginBottom:8,letterSpacing:1}}>ПРЕВЬЮ КАРТОЧКИ</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:24}}>{emoji}</span>
              <div><div style={{fontSize:14,fontWeight:600}}>{shortName||name}</div><div style={{fontSize:10,color:T.textSec}}>{tag||"—"}</div></div>
              <div style={{marginLeft:"auto",fontSize:16,fontWeight:700,color,fontFamily:T.mono}}>{price?fmt(parseInt(price)):""}</div>
            </div>
          </div>}

          <Btn variant="primary" disabled={!name.trim()||!shortName.trim()||!price} onClick={handleAdd} style={{justifyContent:"center",width:"100%",padding:"12px"}}>Добавить продукт в каталог</Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── CATALOG ─────────────────────────────────────────────────────────────────
function Catalog({isMobile,currentUser,onAddProduct,onDeleteProduct}){
  const[selected,setSelected]=useState(null);
  const product=PRODUCTS.find(p=>p.id===selected);
  const[showAdd,setShowAdd]=useState(false);
  const[media,setMedia]=useState(()=>loadCatalogMedia());
  const[editMedia,setEditMedia]=useState(null); // product id being edited
  const[mediaForm,setMediaForm]=useState({urls:"",description:""});

  // Sync media with Firebase
  useEffect(()=>{
    dbGet("catalog_media").then(data=>{
      if(data&&typeof data==="object"){
        setMedia(data);
        localStorage.setItem(CATALOG_MEDIA_KEY,JSON.stringify(data));
      }
    });
    const unsub = dbListen("catalog_media",(data)=>{
      if(data&&typeof data==="object"){
        setMedia(data);
        localStorage.setItem(CATALOG_MEDIA_KEY,JSON.stringify(data));
      }
    });
    return unsub;
  },[]);

  function saveProductMedia(productId, urls, description, uploadedUrls=[]){
    const current = media[productId]||{urls:[],description:""};
    const newUrls = urls.split("\n").map(u=>u.trim()).filter(u=>u.length>0);
    const allNew = [...uploadedUrls, ...newUrls];
    const updated = {...media, [productId]:{
      urls:[...(current.urls||[]),...allNew],
      description: description||current.description,
      updatedAt: new Date().toISOString()
    }};
    setMedia(updated);
    saveCatalogMedia(updated);
    setEditMedia(null);
    setMediaForm({urls:"",description:""});
  }

  function deleteMediaItem(productId, index){
    const current = media[productId]||{urls:[]};
    const newUrls = current.urls.filter((_,i)=>i!==index);
    const updated = {...media, [productId]:{...current, urls:newUrls, updatedAt:new Date().toISOString()}};
    setMedia(updated);
    saveCatalogMedia(updated);
  }

  function isVideo(url){return url&&(url.includes(".mp4")||url.includes(".mov")||url.includes(".webm")||url.includes("video"));}

  // BIO category products
  const bioProducts = PRODUCTS.filter(p=>p.id==="greenawn"||p.id==="igs_premium");
  const otherProducts = PRODUCTS.filter(p=>p.id!=="greenawn"&&p.id!=="igs_premium");

  const ProductCard = ({p}) => {
    const productMedia = media[p.id]||{urls:[],description:""};
    const hasMedia = productMedia.urls&&productMedia.urls.length>0;
    return(
      <GlassCard key={p.id} style={{padding:0,cursor:"pointer",borderLeft:`3px solid ${p.color}`,transition:"all 0.25s",position:"relative",overflow:"hidden"}} className="hover-lift">
        {/* Фото превью */}
        {hasMedia && productMedia.urls[0] && !isVideo(productMedia.urls[0]) && (
          <div style={{height:140,overflow:"hidden",position:"relative"}} onClick={()=>setSelected(p.id)}>
            <img src={productMedia.urls[0]} alt={p.shortName} style={{width:"100%",height:"100%",objectFit:"cover"}}
              onError={e=>{e.target.style.display="none";}}/>
            {productMedia.urls.length>1&&(
              <div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.6)",color:"#fff",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>
                +{productMedia.urls.length-1} фото
              </div>
            )}
          </div>
        )}
        <div style={{padding:14}} onClick={()=>setSelected(p.id)}>
          <div style={{fontSize:24,marginBottom:6}}>{p.emoji}</div>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:2,lineHeight:1.3}}>{p.shortName}</div>
          <div style={{fontSize:10,color:T.textSec,marginBottom:8}}>{p.tag}</div>
          <div style={{fontSize:16,fontWeight:800,color:p.color,fontFamily:T.mono}}>{fmt(p.price)}</div>
          <div style={{fontSize:9,color:T.textDim,marginTop:1}}>за м² · цены индивидуальны</div>
        </div>
        {/* Кнопка добавить медиа */}
        {can(currentUser,"edit_prices")&&(
          <button onClick={e=>{e.stopPropagation();setEditMedia(p.id);setMediaForm({urls:"",description:media[p.id]?.description||""});}}
            style={{position:"absolute",top:8,right:p.isCustom?36:8,background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:12,color:"#fff"}}>
            📷
          </button>
        )}
        {p.isCustom&&can(currentUser,"edit_prices")&&(
          <button onClick={e=>{e.stopPropagation();if(window.confirm(`Удалить «${p.shortName}»?`))onDeleteProduct(p.id);}}
            style={{position:"absolute",top:8,right:8,background:T.dangerBg,border:`1px solid rgba(196,84,84,0.15)`,borderRadius:6,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11,color:T.danger}}>
            ✕
          </button>
        )}
      </GlassCard>
    );
  };

  return(
    <div className="fade-in">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:16,padding:isMobile?"16px 14px 0":0}}>
        <div>
          {!isMobile&&<div style={{fontSize:10,color:T.textDim,letterSpacing:3,marginBottom:3,fontWeight:600}}>ПРОДУКТЫ</div>}
          <div style={{fontSize:isMobile?22:28,fontWeight:800,fontFamily:T.serif}}>Каталог <span style={{fontSize:14,color:T.textSec,fontWeight:400,fontFamily:T.font}}>({PRODUCTS.length})</span></div>
        </div>
        {can(currentUser,"edit_prices")&&<Btn variant="primary" onClick={()=>setShowAdd(true)} style={{padding:"9px 18px",fontSize:13}}>+ Добавить</Btn>}
      </div>

      {/* Биоклиматические перголы — отдельная секция */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,color:T.textSec,fontWeight:700,letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>🌿 Биоклиматические перголы</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fill,minmax(210px,1fr))",gap:10}}>
          {bioProducts.map(p=><ProductCard key={p.id} p={p}/>)}
        </div>
      </div>

      {/* Остальные позиции */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,color:T.textSec,fontWeight:700,letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>🏗️ Остальные конструкции</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fill,minmax(210px,1fr))",gap:10,paddingBottom:isMobile?110:0}}>
          {otherProducts.map(p=><ProductCard key={p.id} p={p}/>)}
        </div>
      </div>

      {/* Drawer детали продукта */}
      <Drawer open={!!product} onClose={()=>setSelected(null)} title={product?`${product.emoji} ${product.name}`:""} width={520}>
        {product&&(
          <>
            {/* Медиагалерея */}
            {(media[product.id]?.urls?.length>0)&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:10,fontWeight:700,color:T.textSec,marginBottom:10,letterSpacing:1.5,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  ФОТО / ВИДЕО
                  {can(currentUser,"edit_prices")&&(
                    <button onClick={()=>{setEditMedia(product.id);setMediaForm({urls:"",description:media[product.id]?.description||""});}}
                      style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:6,padding:"3px 10px",fontSize:11,color:T.gold,cursor:"pointer",fontFamily:T.font}}>
                      + Добавить
                    </button>
                  )}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  {media[product.id].urls.map((url,i)=>(
                    <div key={i} style={{position:"relative",borderRadius:10,overflow:"hidden",background:T.card,border:`1px solid ${T.border}`}}>
                      {isVideo(url) ? (
                        <video src={url} controls style={{width:"100%",height:120,objectFit:"cover"}}/>
                      ) : (
                        <img src={url} alt="" style={{width:"100%",height:120,objectFit:"cover"}}
                          onError={e=>{e.target.parentElement.style.display="none";}}/>
                      )}
                      {can(currentUser,"edit_prices")&&(
                        <button onClick={()=>deleteMediaItem(product.id,i)}
                          style={{position:"absolute",top:4,right:4,background:"rgba(196,84,84,0.8)",border:"none",borderRadius:5,width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:10,color:"#fff"}}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {media[product.id]?.description&&(
                  <div style={{background:T.card,borderRadius:10,padding:"10px 13px",border:`1px solid ${T.border}`,fontSize:13,color:T.textSec,lineHeight:1.6}}>
                    {media[product.id].description}
                  </div>
                )}
              </div>
            )}

            {/* Если нет медиа — показать кнопку добавить */}
            {(!media[product.id]?.urls?.length)&&can(currentUser,"edit_prices")&&(
              <button onClick={()=>{setEditMedia(product.id);setMediaForm({urls:"",description:""});}}
                style={{width:"100%",background:"rgba(184,150,90,0.06)",border:`2px dashed rgba(184,150,90,0.2)`,borderRadius:12,padding:"18px",cursor:"pointer",fontSize:13,color:T.textSec,fontFamily:T.font,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                📷 Добавить фото/видео к этому продукту
              </button>
            )}

            {/* Цена */}
            <div style={{background:`${product.color}12`,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${product.color}20`}}>
              <div style={{fontSize:11,color:T.textSec,fontWeight:600}}>Цена за м²</div>
              <div style={{fontSize:26,fontWeight:800,color:product.color,fontFamily:T.mono}}>{fmt(product.price)}</div>
              <div style={{fontSize:10,color:T.textDim,marginTop:4}}>⚠️ Цены ориентировочные — итог зависит от площади, комплектации и монтажа</div>
            </div>

            <div style={{fontSize:14,color:T.textSec,marginBottom:18,lineHeight:1.6}}>{product.desc}</div>

            <div style={{fontSize:10,fontWeight:700,color:T.textSec,marginBottom:10,letterSpacing:1.5}}>КАК ЭТО РАБОТАЕТ</div>
            <div style={{background:"rgba(255,255,255,0.02)",borderRadius:12,padding:14,marginBottom:18,border:`1px solid ${T.border}`}}>
              {product.id==="greenawn"&&<div style={{fontSize:13,color:T.textSec,lineHeight:1.6}}>Алюминиевые ламели поворачиваются от 0° до 135° с помощью мотора Somfy. При 0° — полная тень. При 135° — максимум света и вентиляция. Дождевая вода стекает через ламели в водосток внутри колонн.</div>}
              {product.id==="igs_premium"&&<div style={{fontSize:13,color:T.textSec,lineHeight:1.6}}>Ламели не только поворачиваются (0–135°), но и сдвигаются в сторону, полностью открывая пространство над головой. Утеплённые пенные ламели обеспечивают герметичность в закрытом состоянии.</div>}
              {product.id==="toscana"&&<div style={{fontSize:13,color:T.textSec,lineHeight:1.6}}>ПВХ-крыша выдвигается по алюминиевым направляющим. В сложенном виде занимает минимум места. Проекция до 13.5 метров.</div>}
              {product.id==="sliding"&&<div style={{fontSize:13,color:T.textSec,lineHeight:1.6}}>2–4 стеклянные панели скользят по направляющим. Панели могут складываться друг за друга, полностью открывая проём. Бесшумное движение на роликовом механизме.</div>}
              {product.id==="guillotine"&&<div style={{fontSize:13,color:T.textSec,lineHeight:1.6}}>Стеклянные секции поднимаются вертикально вверх с помощью цепного привода. Ламинированное стекло для безопасности. Доступна полная автоматизация с пультом.</div>}
              {product.id==="zip"&&<div style={{fontSize:13,color:T.textSec,lineHeight:1.6}}>Ткань Dickson опускается из кассеты по боковым направляющим (zip-система). Не вырвет ветром до 180 км/ч. Защищает от солнца, ветра и насекомых одновременно.</div>}
              {product.id==="marquise"&&<div style={{fontSize:13,color:T.textSec,lineHeight:1.6}}>Складной навес выдвигается от стены на рычажном механизме. Ткань натягивается автоматически. Компактно складывается к стене.</div>}
            </div>

            <div style={{fontSize:10,fontWeight:700,color:T.textSec,marginBottom:10,letterSpacing:1.5}}>ПРЕИМУЩЕСТВА</div>
            {product.features.map(f=><div key={f} style={{display:"flex",gap:9,marginBottom:8}}><span style={{color:product.color}}>✓</span><span style={{fontSize:14}}>{f}</span></div>)}

            {product.options?.length>0&&(<>
              <div style={{fontSize:10,fontWeight:700,color:T.textSec,marginTop:20,marginBottom:10,letterSpacing:1.5}}>ДОП. ОПЦИИ</div>
              {product.options.map(opt=><div key={opt.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:14}}>{opt.label}</span><span style={{fontSize:14,color:product.color,fontFamily:T.mono,fontWeight:600}}>+{fmt(opt.price)}{opt.flat?"":"/м²"}</span></div>)}
            </>)}

            {product.isCustom&&can(currentUser,"edit_prices")&&(
              <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
                <button onClick={()=>{if(window.confirm(`Удалить «${product.name}»?`)){onDeleteProduct(product.id);setSelected(null);}}}
                  style={{background:T.dangerBg,border:`1px solid rgba(196,84,84,0.15)`,borderRadius:10,padding:"10px 18px",fontSize:13,color:T.danger,cursor:"pointer",fontFamily:T.font,fontWeight:600,width:"100%",textAlign:"center"}}>
                  Удалить продукт из каталога
                </button>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Форма добавления медиа */}
      {editMedia&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9999,overflowY:"auto"}}>
          <div style={{minHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
            <div style={{background:T.surface,borderRadius:16,width:"100%",maxWidth:480,padding:"22px 24px",fontFamily:T.font}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <div style={{fontSize:16,fontWeight:700,fontFamily:T.serif}}>📷 Добавить медиа</div>
                <button onClick={()=>setEditMedia(null)} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,color:T.textSec}}>✕</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:13}}>
                <div>
                  <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Загрузить фото / видео</div>
                  <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"rgba(184,150,90,0.08)",border:"2px dashed rgba(184,150,90,0.25)",borderRadius:10,padding:"16px",cursor:"pointer",marginBottom:10}}>
                    <input type="file" multiple accept="image/*,video/*" style={{display:"none"}}
                      onChange={async e=>{
                        const files=Array.from(e.target.files);
                        if(!files.length) return;
                        setMediaForm(f=>({...f,uploading:true,uploadProgress:0}));
                        const urls=[];
                        for(let i=0;i<files.length;i++){
                          try{
                            const url=await uploadCatalogFile(files[i],editMedia);
                            urls.push(url);
                            setMediaForm(f=>({...f,uploadProgress:Math.round((i+1)/files.length*100)}));
                          }catch(err){console.error(err);}
                        }
                        setMediaForm(f=>({...f,uploading:false,uploadProgress:0,uploadedUrls:[...(f.uploadedUrls||[]),...urls]}));
                      }}/>
                    <span style={{fontSize:24}}>📁</span>
                    <div>
                      <div style={{fontSize:13,color:T.gold,fontWeight:600}}>{mediaForm.uploading?`Загружаю... ${mediaForm.uploadProgress||0}%`:"Выбрать фото / видео"}</div>
                      <div style={{fontSize:10,color:T.textSec,marginTop:2}}>Фото и видео с телефона или компьютера</div>
                    </div>
                  </label>
                  {(mediaForm.uploadedUrls||[]).length>0&&(
                    <div style={{fontSize:12,color:T.green,marginBottom:8,background:"rgba(90,154,106,0.1)",borderRadius:8,padding:"7px 11px"}}>
                      ✓ Загружено: {mediaForm.uploadedUrls.length} файл(ов) — готово к сохранению
                    </div>
                  )}
                  <div style={{fontSize:10,color:T.textSec,marginBottom:5}}>Или вставить ссылки вручную:</div>
                  <textarea value={mediaForm.urls} onChange={e=>setMediaForm(f=>({...f,urls:e.target.value}))}
                    placeholder="https://..."
                    style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",color:T.text,fontSize:12,width:"100%",outline:"none",minHeight:50,resize:"vertical",fontFamily:T.mono}}/>
                </div>
                <div>
                  <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:6,textTransform:"uppercase"}}>Описание объекта (необязательно)</div>
                  <textarea value={mediaForm.description} onChange={e=>setMediaForm(f=>({...f,description:e.target.value}))}
                    placeholder="Например: Пентхаус, Алматы, 6×4 м, цвет антрацит..."
                    style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",color:T.text,fontSize:13,width:"100%",outline:"none",minHeight:60,resize:"vertical",fontFamily:T.font}}/>
                </div>

                {/* Текущие медиа */}
                {media[editMedia]?.urls?.length>0&&(
                  <div>
                    <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:6,textTransform:"uppercase"}}>Уже добавлено ({media[editMedia].urls.length})</div>
                    <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:150,overflowY:"auto"}}>
                      {media[editMedia].urls.map((url,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:T.card,borderRadius:8,padding:"6px 10px",border:`1px solid ${T.border}`}}>
                          <span style={{fontSize:11}}>{isVideo(url)?"🎥":"🖼️"}</span>
                          <span style={{fontSize:11,color:T.textSec,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</span>
                          <button onClick={()=>deleteMediaItem(editMedia,i)} style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:13,padding:0,flexShrink:0}}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={()=>{if(!mediaForm.uploading)saveProductMedia(editMedia, mediaForm.urls, mediaForm.description, mediaForm.uploadedUrls||[]);}}
                  style={{background:T.gold,color:"#0a0a0b",border:"none",borderRadius:10,padding:"13px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:T.font,opacity:mediaForm.uploading?0.5:1}}>
                  {mediaForm.uploading?"⏳ Загрузка...":"💾 Сохранить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {can(currentUser,"edit_prices")&&<AddProductModal open={showAdd} onClose={()=>setShowAdd(false)} onAdd={p=>{onAddProduct(p);setShowAdd(false);}}/>}
    </div>
  );
}
// ─── PRICE EDITOR ─────────────────────────────────────────────────────────────
function PriceEditor({onPricesChanged,isMobile}){
  const[draft,setDraft]=useState(()=>{const d={};PRODUCTS.forEach(p=>{d[p.id]={price:p.price,options:{}};p.options.forEach(o=>{d[p.id].options[o.id]=o.price;});});return d;});
  const[saved,setSaved]=useState(false);const[expanded,setExpanded]=useState(null);
  function setBase(pid,val){const n=parseInt(val.replace(/\D/g,""),10);setDraft(prev=>({...prev,[pid]:{...prev[pid],price:isNaN(n)?0:n}}));setSaved(false);}
  function setOpt(pid,oid,val){const n=parseInt(val.replace(/\D/g,""),10);setDraft(prev=>({...prev,[pid]:{...prev[pid],options:{...prev[pid].options,[oid]:isNaN(n)?0:n}}}));setSaved(false);}
  function handleSave(){applyPrices(draft);savePrices(draft);onPricesChanged();setSaved(true);setTimeout(()=>setSaved(false),2000);}

  return(
    <div className="fade-in">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          {!isMobile&&<div style={{fontSize:10,color:T.textDim,letterSpacing:3,marginBottom:3,fontWeight:600}}>УПРАВЛЕНИЕ</div>}
          <div style={{fontSize:isMobile?22:28,fontWeight:800,fontFamily:T.serif}}>💰 Цены</div>
          <div style={{fontSize:12,color:T.textSec,marginTop:2}}>Редактор цен на продукты и опции</div>
        </div>
        <Btn variant={saved?"green":"primary"} onClick={handleSave} style={{padding:"10px 22px"}}>{saved?"✓ Сохранено":"💾 Сохранить"}</Btn>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,paddingBottom:isMobile?110:0}}>
        {PRODUCTS.map(p=>{const isOpen=expanded===p.id;const d=draft[p.id]||{price:p.price,options:{}};const baseChanged=d.price!==p.price;return(
          <GlassCard key={p.id} style={{overflow:"hidden",borderLeft:`3px solid ${p.color}`}}>
            <button onClick={()=>setExpanded(isOpen?null:p.id)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",padding:"14px 18px",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
              <span style={{fontSize:22}}>{p.emoji}</span>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:T.text}}>{p.shortName}</div><div style={{fontSize:10,color:T.textSec,marginTop:2}}>{p.tag}</div></div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:15,fontWeight:800,color:baseChanged?T.gold:p.color,fontFamily:T.mono}}>{new Intl.NumberFormat("ru-KZ").format(d.price)} ₸</div>
                <div style={{fontSize:9,color:T.textDim}}>за м²</div>
              </div>
              <span style={{fontSize:14,color:T.textDim,transform:isOpen?"rotate(180deg)":"none",display:"inline-block",transition:"transform 0.3s"}}>▾</span>
            </button>
            {isOpen&&(
              <div style={{borderTop:`1px solid ${T.border}`,padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
                <div>
                  <div style={{fontSize:10,color:T.textSec,marginBottom:6,fontWeight:700,letterSpacing:1}}>БАЗОВАЯ ЦЕНА (₸/м²)</div>
                  <div style={{position:"relative"}}>
                    <Inp value={new Intl.NumberFormat("ru-KZ").format(d.price)} onChange={e=>setBase(p.id,e.target.value)} style={{fontSize:17,fontWeight:700,color:p.color,paddingRight:38}} inputMode="numeric"/>
                    <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:T.textDim,fontSize:13}}>₸</span>
                  </div>
                  {baseChanged&&<div style={{fontSize:10,color:T.textSec,marginTop:4}}>Было: <span style={{textDecoration:"line-through",color:T.textDim}}>{new Intl.NumberFormat("ru-KZ").format(p.price)} ₸</span> → <span style={{color:T.gold,fontWeight:600}}>{new Intl.NumberFormat("ru-KZ").format(d.price)} ₸</span></div>}
                </div>
                {p.options.length>0&&(
                  <div>
                    <div style={{fontSize:10,color:T.textSec,marginBottom:8,fontWeight:700,letterSpacing:1}}>ДОП. ОПЦИИ</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {p.options.map(opt=>{const ov=d.options[opt.id]??opt.price;const changed=ov!==opt.price;return(
                        <div key={opt.id} style={{background:"rgba(255,255,255,0.02)",borderRadius:12,padding:"11px 13px",border:`1px solid ${T.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><span style={{fontSize:12,color:T.text,fontWeight:500}}>{opt.label}</span><span style={{fontSize:9,color:T.textDim,fontWeight:600}}>{opt.flat?"фиксированная":"за м²"}</span></div>
                          <div style={{position:"relative"}}>
                            <Inp value={new Intl.NumberFormat("ru-KZ").format(ov)} onChange={e=>setOpt(p.id,opt.id,e.target.value)} style={{background:"rgba(255,255,255,0.03)",paddingRight:38,fontSize:14}} inputMode="numeric"/>
                            <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:T.textDim,fontSize:12}}>₸</span>
                          </div>
                          {changed&&<div style={{fontSize:9,color:T.textSec,marginTop:4}}>Было: <span style={{textDecoration:"line-through",color:T.textDim}}>{new Intl.NumberFormat("ru-KZ").format(opt.price)} ₸</span> → <span style={{color:T.gold,fontWeight:600}}>{new Intl.NumberFormat("ru-KZ").format(ov)} ₸</span></div>}
                        </div>
                      );})}
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        );})}
        <GlassCard style={{padding:"13px 16px",display:"flex",alignItems:"center",gap:10,background:"rgba(201,168,76,0.04)",border:"1px solid rgba(201,168,76,0.1)"}}>
          <span style={{fontSize:18}}>ℹ️</span>
          <div style={{fontSize:12,color:T.textSec}}>Изменения применяются ко всем новым расчётам КП после нажатия <b style={{color:T.gold}}>Сохранить</b>.</div>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── BOT LEADS ────────────────────────────────────────────────────────────────
// Защитный протокол
const BOT_LEADS_CACHE_KEY = "igs_bot_leads_cache_v1";
// Защитный протокол: все операции логируются, данные не удаляются физически
// а помечаются как deleted=true, реальное удаление только по явному подтверждению

function BotLeads({isMobile}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null); // лид на редактирование
  const [filter, setFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const STATUS_COLORS = {
    new:       {label:"Новый",           color:"#d97706", bg:"rgba(217,119,6,0.12)"},
    contacted: {label:"Связались",       color:"#2563eb", bg:"rgba(37,99,235,0.12)"},
    converted: {label:"Конвертирован",   color:"#16a34a", bg:"rgba(22,163,74,0.12)"},
    lost:      {label:"Потерян",         color:"#dc2626", bg:"rgba(220,38,38,0.12)"},
  };

  // ── ЗАГРУЗКА + REALTIME ─────────────────────────────────────────────────────
  useEffect(() => {
    // 1) Мгновенно из localStorage кэша
    try {
      const cached = JSON.parse(localStorage.getItem(BOT_LEADS_CACHE_KEY)||"null");
      if(Array.isArray(cached) && cached.length > 0) { setLeads(cached); setLoading(false); }
    } catch(_) {}
    setLoading(true);
    // 2) Из Firebase
    dbGet("bot_leads").then(data => {
      if (data && typeof data === "object") {
        const arr = Object.values(data)
          .filter(l => !l.deleted)
          .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
        setLeads(arr);
        try { localStorage.setItem(BOT_LEADS_CACHE_KEY, JSON.stringify(arr)); } catch(_) {}
      }
      setLoading(false);
    });
    // Realtime — любое изменение с любого устройства
    const unsub = dbListen("bot_leads", (data) => {
      if (data && typeof data === "object") {
        const arr = Object.values(data)
          .filter(l => !l.deleted)
          .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
        setLeads(arr);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // ── ОБНОВЛЕНИЕ СТАТУСА ──────────────────────────────────────────────────────
  async function updateLeadStatus(id, status) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    const updated = {...lead, status, updatedAt: new Date().toISOString()};
    // Пишем в Firebase
    await dbSet(`bot_leads/${id}`, updated);
    // Обновляем локально
    setLeads(prev => prev.map(l => l.id === id ? updated : l));
    // Если открыт detail — обновляем и его
    if (selected?.id === id) setSelected(updated);
  }

  // ── СОХРАНЕНИЕ ИЗМЕНЕНИЙ ─────────────────────────────────────────────────────
  async function saveLead(editedLead) {
    const updated = {...editedLead, updatedAt: new Date().toISOString()};
    // Защита: сначала бэкап старой версии
    const old = leads.find(l => l.id === editedLead.id);
    if (old) await dbSet(`bot_leads_backup/${old.id}_${Date.now()}`, old);
    // Сохраняем новую версию
    await dbSet(`bot_leads/${updated.id}`, updated);
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
    setSelected(updated);
    setEditing(null);
  }

  // ── МЯГКОЕ УДАЛЕНИЕ (с защитой) ─────────────────────────────────────────────
  async function deleteLead(id) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    // Защита: сохраняем копию в корзину Firebase перед удалением
    await dbSet(`bot_leads_trash/${id}`, {...lead, deletedAt: new Date().toISOString()});
    // Помечаем как удалённый (не удаляем физически)
    await dbSet(`bot_leads/${id}`, {...lead, deleted: true, deletedAt: new Date().toISOString()});
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelected(null);
    setDeleteConfirm(null);
  }

  // ── ФОРМАТИРОВАНИЕ ВРЕМЕНИ ──────────────────────────────────────────────────
  const fmtTime = iso => {
    if (!iso) return "—";
    const d = new Date(iso);
    const diff = Date.now() - d;
    if (diff < 60000) return "только что";
    if (diff < 3600000) return Math.floor(diff/60000) + " мин назад";
    if (diff < 86400000) return Math.floor(diff/3600000) + " ч назад";
    return d.toLocaleDateString("ru-KZ", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  };

  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);

  // ── КАРТОЧКА ЛИДА ───────────────────────────────────────────────────────────
  const LeadCard = ({lead}) => {
    const sc = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
    return (
      <div onClick={() => setSelected(lead)}
        style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"13px 15px",cursor:"pointer",transition:"all 0.2s",position:"relative"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=T.borderHover;e.currentTarget.style.background=T.elevated;}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.card;}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:34,height:34,borderRadius:9,background:"rgba(184,150,90,0.1)",border:`1px solid ${T.goldDim}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>🤖</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:T.text}}>{lead.name||"Неизвестно"}</div>
              {lead.phone&&<div style={{fontSize:11,color:T.textSec,fontFamily:T.mono,marginTop:1}}>{lead.phone}</div>}
            </div>
          </div>
          <span style={{background:sc.bg,color:sc.color,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700,flexShrink:0}}>{sc.label}</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
          {lead.product_type&&<span style={{background:"rgba(184,150,90,0.08)",color:T.gold,borderRadius:6,padding:"2px 8px",fontSize:11}}>🌿 {lead.product_type}</span>}
          {lead.productType&&<span style={{background:"rgba(184,150,90,0.08)",color:T.gold,borderRadius:6,padding:"2px 8px",fontSize:11}}>🌿 {lead.productType}</span>}
          {lead.dimensions&&<span style={{background:T.elevated,color:T.textSec,borderRadius:6,padding:"2px 8px",fontSize:11,fontFamily:T.mono}}>📐 {lead.dimensions}</span>}
          {lead.hasMedia&&<span style={{background:"rgba(96,165,250,0.1)",color:"#60a5fa",borderRadius:6,padding:"2px 8px",fontSize:11}}>📸 Фото</span>}
          {lead.wants_measure&&<span style={{background:"rgba(90,154,106,0.1)",color:T.green,borderRadius:6,padding:"2px 8px",fontSize:11}}>📅 Замер</span>}
        </div>
        {lead.notes&&<div style={{fontSize:12,color:T.textSec,borderTop:`1px solid ${T.border}`,paddingTop:6,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.notes}</div>}
        <div style={{fontSize:10,color:T.textDim,marginTop:6,textAlign:"right"}}>{fmtTime(lead.createdAt)}</div>
      </div>
    );
  };

  // ── ФОРМА РЕДАКТИРОВАНИЯ ────────────────────────────────────────────────────
  const EditForm = ({lead, onClose}) => {
    const [form, setForm] = useState({
      name: lead.name||"",
      phone: lead.phone||"",
      address: lead.address||"",
      product_type: lead.product_type||lead.productType||"",
      dimensions: lead.dimensions||"",
      notes: lead.notes||"",
      wants_measure: lead.wants_measure||"",
    });
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9999,overflowY:"auto"}}>
        <div style={{minHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background:T.surface,borderRadius:16,width:"100%",maxWidth:500,padding:"22px 24px",fontFamily:T.font}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontSize:16,fontWeight:700,fontFamily:T.serif}}>✏️ Редактировать лид</div>
              <button onClick={onClose} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,color:T.textSec}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[
                ["Имя клиента","name","text"],
                ["Телефон","phone","tel"],
                ["Адрес / локация","address","text"],
                ["Тип конструкции","product_type","text"],
                ["Размеры","dimensions","text"],
                ["Дата замера","wants_measure","text"],
              ].map(([label,key,type])=>(
                <div key={key}>
                  <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>{label}</div>
                  <Inp type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={label}/>
                </div>
              ))}
              <div>
                <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Заметки</div>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"11px 14px",color:T.text,fontSize:14,width:"100%",outline:"none",minHeight:80,resize:"vertical",fontFamily:T.font}}/>
              </div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>saveLead({...lead,...form})}
                  style={{flex:1,background:T.gold,color:"#0a0a0b",border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:T.font}}>
                  💾 Сохранить
                </button>
                <button onClick={onClose}
                  style={{flex:1,background:T.elevated,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:T.font}}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── ДЕТАЛЬНАЯ КАРТОЧКА ──────────────────────────────────────────────────────
  const LeadDetail = ({lead, onClose}) => {
    const sc = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9998,overflowY:"auto"}}>
        <div style={{minHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background:T.surface,borderRadius:16,width:"100%",maxWidth:500,padding:"22px 24px",fontFamily:T.font}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontSize:16,fontWeight:700,fontFamily:T.serif}}>🤖 Лид от бота</div>
              <div style={{display:"flex",gap:7}}>
                <button onClick={()=>{setEditing(lead);onClose();}}
                  style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,color:T.gold,fontFamily:T.font,fontWeight:600}}>✏️ Изменить</button>
                <button onClick={()=>setDeleteConfirm(lead.id)}
                  style={{background:T.dangerBg,border:"1px solid rgba(196,84,84,0.2)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,color:T.danger,fontFamily:T.font,fontWeight:600}}>🗑️</button>
                <button onClick={onClose}
                  style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,color:T.textSec}}>✕</button>
              </div>
            </div>

            {/* Статус */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:7,textTransform:"uppercase"}}>Статус</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(STATUS_COLORS).map(([k,v])=>(
                  <button key={k} onClick={()=>updateLeadStatus(lead.id,k)}
                    style={{background:lead.status===k?v.bg:T.elevated,color:lead.status===k?v.color:T.textSec,border:`1px solid ${lead.status===k?v.color:T.border}`,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.font,transition:"all 0.15s"}}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Данные */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {[
                ["👤 Имя",     lead.name],
                ["📞 Телефон", lead.phone],
                ["🌿 Продукт", lead.product_type||lead.productType],
                ["📐 Размеры", lead.dimensions],
                ["🏠 Объект",  lead.objectType],
                ["📍 Адрес",   lead.address],
                ["📅 Замер",   lead.wants_measure],
              ].filter(([,v])=>v).map(([label,val])=>(
                <div key={label} style={{background:T.card,borderRadius:9,padding:"10px 12px",border:`1px solid ${T.border}`}}>
                  <div style={{fontSize:9,color:T.textSec,marginBottom:3,fontWeight:600,letterSpacing:0.5}}>{label}</div>
                  <div style={{fontSize:13,fontWeight:500}}>{val}</div>
                </div>
              ))}
            </div>

            {lead.notes&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:6,textTransform:"uppercase"}}>Резюме / Этап</div>
                <div style={{background:T.card,borderRadius:9,padding:"11px 13px",border:`1px solid ${T.border}`,fontSize:13,lineHeight:1.6}}>{lead.notes}</div>
              </div>
            )}

            {/* Действия */}
            <div style={{display:"flex",gap:8}}>
              {lead.phone&&(
                <a href={`https://wa.me/${(lead.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(90,154,106,0.1)",color:T.green,border:`1px solid rgba(90,154,106,0.2)`,borderRadius:9,padding:"10px",fontWeight:600,fontSize:13,textDecoration:"none",fontFamily:T.font}}>
                  💬 WhatsApp
                </a>
              )}
              {lead.phone&&(
                <a href={`tel:${lead.phone}`}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:T.elevated,color:T.text,border:`1px solid ${T.border}`,borderRadius:9,padding:"10px",fontWeight:600,fontSize:13,textDecoration:"none",fontFamily:T.font}}>
                  📞 Позвонить
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ ──────────────────────────────────────────────────
  const DeleteConfirm = ({id, onClose}) => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{background:T.surface,borderRadius:16,padding:"24px",maxWidth:360,width:"100%",fontFamily:T.font,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>🗑️</div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Удалить лид?</div>
        <div style={{fontSize:13,color:T.textSec,marginBottom:20}}>Лид будет перемещён в корзину Firebase. Его можно восстановить через консоль Firebase.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>deleteLead(id)}
            style={{flex:1,background:T.dangerBg,color:T.danger,border:"1px solid rgba(196,84,84,0.25)",borderRadius:10,padding:"11px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:T.font}}>
            Удалить
          </button>
          <button onClick={onClose}
            style={{flex:1,background:T.elevated,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:T.font}}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );

  // ── РЕНДЕР ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:20}}>
        <div>
          {!isMobile&&<div style={{fontSize:11,color:T.textSec,letterSpacing:2,marginBottom:4,fontWeight:600}}>АВТОМАТИЗАЦИЯ</div>}
          <div style={{fontSize:isMobile?20:26,fontWeight:800,fontFamily:T.serif}}>
            Лиды от бота
            {leads.filter(l=>l.status==="new").length > 0 && (
              <span style={{marginLeft:10,background:"rgba(217,119,6,0.15)",color:"#d97706",borderRadius:8,padding:"2px 9px",fontSize:13,fontWeight:700,fontFamily:T.font}}>
                {leads.filter(l=>l.status==="new").length} новых
              </span>
            )}
          </div>
        </div>
        <div style={{fontSize:11,color:T.textSec,background:T.elevated,borderRadius:8,padding:"5px 11px",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:6,height:6,borderRadius:3,background:"#ef4444",display:"inline-block",animation:"pulse 1.5s infinite"}}/>
          live из Firebase
        </div>
      </div>

      {/* Фильтры */}
      <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:4,marginBottom:14}}>
        {[["all","Все",leads.length],...Object.entries(STATUS_COLORS).map(([k,v])=>[k,v.label,leads.filter(l=>l.status===k).length])].map(([k,label,count])=>{
          if(k!=="all"&&!count) return null;
          const sc = STATUS_COLORS[k];
          const active = filter===k;
          return(
            <button key={k} onClick={()=>setFilter(k)}
              style={{background:active?(sc?.bg||T.goldBg):"rgba(255,255,255,0.03)",color:active?(sc?.color||T.gold):T.textSec,border:`1px solid ${active?(sc?.color||T.gold):T.border}`,borderRadius:20,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:T.font,transition:"all 0.2s",flexShrink:0}}>
              {label} ({count})
            </button>
          );
        })}
      </div>

      {loading&&<div style={{textAlign:"center",padding:48,color:T.textSec}}>Загрузка…</div>}

      {!loading&&filtered.length===0&&(
        <div style={{textAlign:"center",padding:60}}>
          <div style={{fontSize:40,marginBottom:14}}>🤖</div>
          <div style={{fontSize:16,fontWeight:700,fontFamily:T.serif,marginBottom:8}}>Лидов пока нет</div>
          <div style={{fontSize:13,color:T.textSec,maxWidth:300,margin:"0 auto",lineHeight:1.6}}>
            Когда бот квалифицирует клиента — он появится здесь автоматически.
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8,paddingBottom:isMobile?100:0}}>
        {filtered.map(lead=><LeadCard key={lead.id} lead={lead}/>)}
      </div>

      {selected&&<LeadDetail lead={selected} onClose={()=>setSelected(null)}/>}
      {editing&&<EditForm lead={editing} onClose={()=>setEditing(null)}/>}
      {deleteConfirm&&<DeleteConfirm id={deleteConfirm} onClose={()=>setDeleteConfirm(null)}/>}
    </div>
  );
}


// ─── MEETINGS (Встречи) ───────────────────────────────────────────────────────
const MEETINGS_KEY = "igs_meetings_v1";

function loadMeetings(){try{const r=JSON.parse(localStorage.getItem(MEETINGS_KEY)||"null");if(Array.isArray(r))return r;}catch(_){}return[];}
function saveMeetings(data){
  try{localStorage.setItem(MEETINGS_KEY,JSON.stringify(data));}catch(_){}
  data.forEach(m=>{if(m&&m.id)dbSet(`meetings/${m.id}`,m);});
}

function Meetings({isMobile}) {
  const [meetings, setMeetings] = useState(()=>loadMeetings());
  const [filter, setFilter] = useState("upcoming");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Форма
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [meetType, setMeetType] = useState("showroom"); // showroom | measure
  const [meetDate, setMeetDate] = useState("");
  const [meetTime, setMeetTime] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("scheduled"); // scheduled | done | cancelled

  const SHOWROOM_ADDR = "ул. Сагдат Нурмагамбетова 140/10";

  // Синхронизация Firebase
  useEffect(()=>{
    dbGet("meetings").then(data=>{
      if(data && typeof data==="object"){
        const arr = Object.values(data).filter(m=>!m.deleted).sort((a,b)=>new Date(a.meetDate+" "+a.meetTime)-new Date(b.meetDate+" "+b.meetTime));
        setMeetings(arr);
        localStorage.setItem(MEETINGS_KEY, JSON.stringify(arr));
      }
    });
    const unsub = dbListen("meetings",(data)=>{
      if(data && typeof data==="object"){
        const arr = Object.values(data).filter(m=>!m.deleted).sort((a,b)=>new Date(a.meetDate+" "+a.meetTime)-new Date(b.meetDate+" "+b.meetTime));
        setMeetings(arr);
        localStorage.setItem(MEETINGS_KEY, JSON.stringify(arr));
      }
    });
    return unsub;
  },[]);

  function resetForm(){
    setClientName(""); setClientPhone(""); setMeetType("showroom");
    setMeetDate(""); setMeetTime(""); setAddress(""); setNotes(""); setStatus("scheduled");
    setEditId(null); setShowForm(false);
  }

  function handleSave(){
    if(!clientName.trim()||!meetDate||!meetTime) return;
    const now = new Date().toISOString();
    const meeting = {
      id: editId || Date.now().toString(),
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      meetType,
      meetDate,
      meetTime,
      address: meetType==="showroom" ? SHOWROOM_ADDR : address.trim(),
      notes: notes.trim(),
      status,
      createdAt: editId ? (meetings.find(m=>m.id===editId)?.createdAt||now) : now,
      updatedAt: now,
    };
    if(editId) dbSet(`meetings_backup/${editId}_${Date.now()}`, meetings.find(m=>m.id===editId)||{});
    const updated = editId ? meetings.map(m=>m.id===editId?meeting:m) : [...meetings, meeting].sort((a,b)=>new Date(a.meetDate+" "+a.meetTime)-new Date(b.meetDate+" "+b.meetTime));
    setMeetings(updated);
    saveMeetings(updated);
    if(selected?.id===editId) setSelected(meeting);
    resetForm();
  }

  function startEdit(m){
    setClientName(m.clientName); setClientPhone(m.clientPhone||"");
    setMeetType(m.meetType); setMeetDate(m.meetDate); setMeetTime(m.meetTime);
    setAddress(m.meetType==="measure"?m.address:""); setNotes(m.notes||"");
    setStatus(m.status); setEditId(m.id); setSelected(null); setShowForm(true);
  }

  function handleDelete(id){
    const m = meetings.find(x=>x.id===id);
    if(m) dbSet(`meetings_trash/${id}`,{...m,deletedAt:new Date().toISOString()});
    dbSet(`meetings/${id}`,{...m,deleted:true,deletedAt:new Date().toISOString()});
    setMeetings(meetings.filter(x=>x.id!==id));
    saveMeetings(meetings.filter(x=>x.id!==id));
    setSelected(null); setDeleteConfirm(null);
  }

  function updateStatus(id, st){
    const updated = meetings.map(m=>m.id===id?{...m,status:st,updatedAt:new Date().toISOString()}:m);
    setMeetings(updated); saveMeetings(updated);
    const upd = updated.find(m=>m.id===id);
    if(upd) dbSet(`meetings/${id}`,upd);
    if(selected?.id===id) setSelected(upd);
  }

  function generateWAText(m){
    const typeLabel = m.meetType==="showroom"?"визит в шоурум":"замер на объекте";
    return [
      `Ассаламуалейкум, это Жандильда — IGS Outdoor 🌿`,
      ``,
      `Подтверждаю вашу запись на ${typeLabel}:`,
      ``,
      `📅 ${formatDate(m.meetDate)}, ${m.meetTime}`,
      `📍 ${m.address}`,
      ``,
      m.meetType==="showroom"
        ? `В шоуруме вы сможете вживую посмотреть все образцы конструкций.`
        : `Наш специалист приедет по указанному адресу.`,
      ``,
      `Если планы изменятся — напишите заранее 🙏`,
    ].join("
");
  }

  function formatDate(dateStr){
    if(!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("ru-KZ",{weekday:"long",day:"numeric",month:"long"});
  }

  function isUpcoming(m){
    const dt = new Date(m.meetDate+"T"+m.meetTime);
    return dt >= new Date() && m.status==="scheduled";
  }
  function isPast(m){
    const dt = new Date(m.meetDate+"T"+m.meetTime);
    return dt < new Date() || m.status==="done" || m.status==="cancelled";
  }
  function isToday(m){
    return m.meetDate===new Date().toISOString().slice(0,10);
  }

  const STATUS_CFG = {
    scheduled: {label:"Запланирована", color:"#d97706", bg:"rgba(217,119,6,0.12)"},
    done:      {label:"Состоялась",    color:"#16a34a", bg:"rgba(22,163,74,0.12)"},
    cancelled: {label:"Отменена",      color:"#dc2626", bg:"rgba(220,38,38,0.12)"},
  };

  const filtered = filter==="upcoming"
    ? meetings.filter(m=>isUpcoming(m)||isToday(m))
    : filter==="today"
    ? meetings.filter(m=>isToday(m))
    : meetings.filter(m=>isPast(m));

  const todayCount = meetings.filter(m=>isToday(m)&&m.status==="scheduled").length;
  const upcomingCount = meetings.filter(m=>isUpcoming(m)).length;

  const MeetCard = ({m}) => {
    const sc = STATUS_CFG[m.status]||STATUS_CFG.scheduled;
    const today = isToday(m);
    return(
      <div onClick={()=>setSelected(m)}
        style={{background:today?`rgba(184,150,90,0.06)`:T.card,border:`1px solid ${today?"rgba(184,150,90,0.25)":T.border}`,borderRadius:12,padding:"13px 16px",cursor:"pointer",transition:"all .2s"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=T.borderHover;e.currentTarget.style.background=T.elevated;}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=today?"rgba(184,150,90,0.25)":T.border;e.currentTarget.style.background=today?`rgba(184,150,90,0.06)`:T.card;}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>{m.clientName}</div>
            {m.clientPhone&&<div style={{fontSize:11,color:T.textSec,fontFamily:T.mono,marginTop:1}}>{m.clientPhone}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <span style={{background:sc.bg,color:sc.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{sc.label}</span>
            {today&&<span style={{background:"rgba(184,150,90,0.15)",color:T.gold,borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:700}}>СЕГОДНЯ</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:12,color:T.text,fontWeight:600}}>📅 {formatDate(m.meetDate)}, {m.meetTime}</span>
        </div>
        <div style={{fontSize:11,color:T.textSec,marginTop:4}}>
          {m.meetType==="showroom"?"🏠 Шоурум":"🔧 Замер"} · {m.address}
        </div>
        {m.notes&&<div style={{fontSize:11,color:T.textDim,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.notes}</div>}
      </div>
    );
  };

  const MeetDetail = ({m}) => {
    const sc = STATUS_CFG[m.status]||STATUS_CFG.scheduled;
    const waText = generateWAText(m);
    const waUrl = m.clientPhone ? `https://wa.me/${m.clientPhone.replace(/\D/g,"")}?text=${encodeURIComponent(waText)}` : null;
    const [copied, setCopied] = useState(false);
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9999,overflowY:"auto"}}>
        <div style={{minHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background:T.surface,borderRadius:16,width:"100%",maxWidth:480,fontFamily:T.font}}>
            {/* Header */}
            <div style={{padding:"18px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,fontFamily:T.serif}}>📅 Встреча</div>
                <div style={{fontSize:12,color:T.textSec,marginTop:2}}>{m.clientName} {m.clientPhone&&`· ${m.clientPhone}`}</div>
              </div>
              <div style={{display:"flex",gap:7}}>
                <button onClick={()=>{setSelected(null);startEdit(m);}} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12,color:T.gold,fontFamily:T.font,fontWeight:600}}>✏️</button>
                <button onClick={()=>setDeleteConfirm(m.id)} style={{background:T.dangerBg,border:"1px solid rgba(196,84,84,0.2)",borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12,color:T.danger,fontFamily:T.font}}>🗑️</button>
                <button onClick={()=>setSelected(null)} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,color:T.textSec}}>✕</button>
              </div>
            </div>

            <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:12}}>
              {/* Статус */}
              <div>
                <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:7,textTransform:"uppercase"}}>Статус</div>
                <div style={{display:"flex",gap:6}}>
                  {Object.entries(STATUS_CFG).map(([k,v])=>(
                    <button key={k} onClick={()=>updateStatus(m.id,k)}
                      style={{background:m.status===k?v.bg:T.elevated,color:m.status===k?v.color:T.textSec,border:`1px solid ${m.status===k?v.color:T.border}`,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Детали */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  ["📅 Дата", formatDate(m.meetDate)],
                  ["🕐 Время", m.meetTime],
                  ["🏠 Тип", m.meetType==="showroom"?"Шоурум":"Замер на объекте"],
                  ["📍 Адрес", m.address],
                ].map(([label,val])=>val&&(
                  <div key={label} style={{background:T.card,borderRadius:9,padding:"10px 12px",border:`1px solid ${T.border}`,gridColumn:label==="📍 Адрес"?"1/-1":"auto"}}>
                    <div style={{fontSize:9,color:T.textSec,marginBottom:3,fontWeight:600}}>{label}</div>
                    <div style={{fontSize:13,fontWeight:500}}>{val}</div>
                  </div>
                ))}
              </div>

              {m.notes&&(
                <div style={{background:T.card,borderRadius:9,padding:"10px 12px",border:`1px solid ${T.border}`}}>
                  <div style={{fontSize:9,color:T.textSec,marginBottom:3,fontWeight:600}}>📝 ЗАМЕТКИ</div>
                  <div style={{fontSize:13}}>{m.notes}</div>
                </div>
              )}

              {/* Подтверждение клиенту */}
              <div style={{background:T.card,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`,fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap",color:T.text}}>
                {waText}
              </div>

              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{navigator.clipboard?.writeText(waText).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),2500);}}
                  style={{flex:1,background:copied?"rgba(90,154,106,0.15)":T.elevated,color:copied?T.green:T.text,border:`1px solid ${copied?"rgba(90,154,106,0.3)":T.border}`,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:T.font}}>
                  {copied?"✓ Скопировано":"📋 Копировать"}
                </button>
                {waUrl&&(
                  <a href={waUrl} target="_blank" rel="noreferrer"
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(90,154,106,0.1)",color:T.green,border:"1px solid rgba(90,154,106,0.25)",borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,textDecoration:"none",fontFamily:T.font}}>
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:20}}>
        <div>
          {!isMobile&&<div style={{fontSize:11,color:T.textSec,letterSpacing:2,marginBottom:4,fontWeight:600}}>РАСПИСАНИЕ</div>}
          <div style={{fontSize:isMobile?20:26,fontWeight:800,fontFamily:T.serif}}>
            Встречи 📅
            {todayCount>0&&<span style={{marginLeft:10,background:"rgba(184,150,90,0.15)",color:T.gold,borderRadius:8,padding:"2px 9px",fontSize:13,fontWeight:700,fontFamily:T.font}}>{todayCount} сегодня</span>}
          </div>
        </div>
        <Btn variant="primary" onClick={()=>{resetForm();setShowForm(true);}}>+ Записать встречу</Btn>
      </div>

      {/* Фильтры */}
      <div style={{display:"flex",gap:5,marginBottom:14}}>
        {[["upcoming",`Предстоящие (${upcomingCount})`],["today",`Сегодня (${todayCount})`],["past","Прошедшие"]].map(([k,label])=>(
          <button key={k} onClick={()=>setFilter(k)}
            style={{background:filter===k?T.goldBg:"rgba(255,255,255,0.03)",color:filter===k?T.gold:T.textSec,border:`1px solid ${filter===k?"rgba(184,150,90,0.2)":T.border}`,borderRadius:20,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.font,transition:"all .2s"}}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:60}}>
          <div style={{fontSize:40,marginBottom:14}}>📅</div>
          <div style={{fontSize:16,fontWeight:700,fontFamily:T.serif,marginBottom:8}}>
            {filter==="upcoming"?"Предстоящих встреч нет":filter==="today"?"Сегодня встреч нет":"Прошедших встреч нет"}
          </div>
          <div style={{fontSize:13,color:T.textSec,marginBottom:20}}>Записывайте визиты в шоурум и замеры</div>
          <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Записать встречу</Btn>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8,paddingBottom:isMobile?100:0}}>
        {filtered.map(m=><MeetCard key={m.id} m={m}/>)}
      </div>

      {/* Форма */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9999,overflowY:"auto"}}>
          <div style={{minHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
            <div style={{background:T.surface,borderRadius:16,width:"100%",maxWidth:480,padding:"22px 24px",fontFamily:T.font}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <div style={{fontSize:16,fontWeight:700,fontFamily:T.serif}}>{editId?"✏️ Редактировать":"📅 Новая встреча"}</div>
                <button onClick={resetForm} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,color:T.textSec}}>✕</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:13}}>
                {/* Клиент */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div>
                    <div style={{fontSize:10,color:T.textSec,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Имя *</div>
                    <Inp value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Имя клиента" autoFocus/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:T.textSec,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Телефон</div>
                    <Inp value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="+7 777..." type="tel"/>
                  </div>
                </div>

                {/* Тип */}
                <div>
                  <div style={{fontSize:10,color:T.textSec,marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Тип встречи</div>
                  <div style={{display:"flex",gap:8}}>
                    {[["showroom","🏠 Шоурум"],["measure","🔧 Замер на объекте"]].map(([k,label])=>(
                      <button key={k} onClick={()=>setMeetType(k)}
                        style={{flex:1,background:meetType===k?T.goldBg:T.elevated,color:meetType===k?T.gold:T.textSec,border:`1px solid ${meetType===k?"rgba(184,150,90,0.3)":T.border}`,borderRadius:10,padding:"10px",fontSize:13,fontWeight:meetType===k?700:400,cursor:"pointer",fontFamily:T.font}}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {meetType==="showroom"&&(
                    <div style={{marginTop:7,fontSize:11,color:T.textSec,background:T.card,borderRadius:8,padding:"7px 11px",border:`1px solid ${T.border}`}}>
                      📍 {SHOWROOM_ADDR} · 9:00–22:00
                    </div>
                  )}
                </div>

                {/* Дата и время */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div>
                    <div style={{fontSize:10,color:T.textSec,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Дата *</div>
                    <Inp type="date" value={meetDate} onChange={e=>setMeetDate(e.target.value)}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:T.textSec,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Время *</div>
                    <Inp type="time" value={meetTime} onChange={e=>setMeetTime(e.target.value)} min="09:00" max="22:00"/>
                  </div>
                </div>

                {/* Адрес для замера */}
                {meetType==="measure"&&(
                  <div>
                    <div style={{fontSize:10,color:T.textSec,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Адрес объекта</div>
                    <Inp value={address} onChange={e=>setAddress(e.target.value)} placeholder="Алматы, ул. ..."/>
                  </div>
                )}

                {/* Статус */}
                {editId&&(
                  <div>
                    <div style={{fontSize:10,color:T.textSec,marginBottom:7,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Статус</div>
                    <div style={{display:"flex",gap:6}}>
                      {Object.entries(STATUS_CFG).map(([k,v])=>(
                        <button key={k} onClick={()=>setStatus(k)}
                          style={{flex:1,background:status===k?v.bg:T.elevated,color:status===k?v.color:T.textSec,border:`1px solid ${status===k?v.color:T.border}`,borderRadius:8,padding:"6px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{fontSize:10,color:T.textSec,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Заметки</div>
                  <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Что интересует клиент…"
                    style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",color:T.text,fontSize:13,width:"100%",outline:"none",minHeight:60,resize:"vertical",fontFamily:T.font}}/>
                </div>

                <button onClick={handleSave} disabled={!clientName.trim()||!meetDate||!meetTime}
                  style={{background:clientName.trim()&&meetDate&&meetTime?T.gold:"rgba(255,255,255,0.1)",color:clientName.trim()&&meetDate&&meetTime?"#0a0a0b":T.textDim,border:"none",borderRadius:10,padding:"13px",fontWeight:700,fontSize:14,cursor:clientName.trim()&&meetDate&&meetTime?"pointer":"not-allowed",fontFamily:T.font}}>
                  {editId?"💾 Сохранить":"📅 Записать встречу"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected&&<MeetDetail m={selected}/>}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background:T.surface,borderRadius:16,padding:"24px",maxWidth:340,width:"100%",fontFamily:T.font,textAlign:"center"}}>
            <div style={{fontSize:30,marginBottom:12}}>🗑️</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Удалить встречу?</div>
            <div style={{fontSize:12,color:T.textSec,marginBottom:20}}>Встреча будет перемещена в корзину Firebase.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>handleDelete(deleteConfirm)} style={{flex:1,background:T.dangerBg,color:T.danger,border:"1px solid rgba(196,84,84,0.25)",borderRadius:10,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:T.font}}>Удалить</button>
              <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,background:T.elevated,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:T.font}}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── GLASS CALCULATOR (Калькулятор стекла Orizzonte) ─────────────────────────
const GLASS_STORAGE_KEY = "igs_glass_calcs_v1";

function loadGlassCalcs(){try{const r=JSON.parse(localStorage.getItem(GLASS_STORAGE_KEY)||"null");if(Array.isArray(r))return r;}catch(_){}return[];}
function saveGlassCalcs(data){
  try{localStorage.setItem(GLASS_STORAGE_KEY,JSON.stringify(data));}catch(_){}
  data.forEach(c=>{if(c&&c.id)dbSet(`glass_calcs/${c.id}`,c);});
}

// Формулы из файлов Orizzonte
function calcGlass(W, H, N, openFromCenter=false) {
  if(!W||!H||!N) return null;
  let glassW, glassH;
  if(openFromCenter) {
    // Открывание от центра (формула из правой части файла)
    glassW = (W - 15.4*2 + 8.6*(N-2) - 11.5) / N;
  } else {
    // Стандартное (формула из левой части файла)
    glassW = (W - 15.4*2 + 8.6*(N-1)) / N;
  }
  glassH = H - 73;
  return { glassW: Math.round(glassW*100)/100, glassH: Math.round(glassH), count: N };
}

// Раскрой профиля — точные формулы из файлов Orizzonte
// Проверено: N=4 W=2940 H=2221 и N=5 W=3580 H=2215
function calcProfile(W, H, N) {
  if(!W||!H||!N) return null;
  const isEven = N % 2 === 0;

  // Нижний профиль створки: (W - 15.4*2 + 8.6*(N-1)) / N
  const profileLen = Math.round(((W - 15.4*2 + 8.6*(N-1))/N)*100)/100;
  // Боковой профиль рамы: H - 47
  const sideFrameLen = Math.round(H - 47);
  // Боковой профиль створки: H - 103
  const sideSashLen = Math.round(H - 103);
  // Кол-во боковых профилей створки: N*2 - 2
  const sideSashQty = N * 2 - 2;

  // Кол-во профилей на 6м штанге: ROUNDUP(qty / ROUNDDOWN(6000/len))
  // ROUNDDOWN(6000/len, 1 знак) как в Excel, затем ROUNDUP(qty/result)
  const pcs = (len, qty) => { if(!qty||!len) return 0; const perBar = Math.floor(6000/len*10)/10; return perBar>0 ? Math.ceil(qty/perBar) : qty; };

  const profiles = [
    { name:"Нижний направляющий профиль 2 полосы",      len:W, qty: isEven?2:1, pcs: pcs(W, isEven?2:1) },
    { name:"Нижний направляющий профиль 3 полосы",      len:W, qty: isEven?0:1, pcs: pcs(W, isEven?0:1) },
    { name:"Верхний направляющий профиль рамы 2 полосы",len:W, qty: isEven?2:1, pcs: pcs(W, isEven?2:1) },
    { name:"Верхний направляющий профиль рамы 3 полосы",len:W, qty: isEven?0:1, pcs: pcs(W, isEven?0:1) },
    { name:"Алюминиевый рельс",                         len:W, qty: N,          pcs: pcs(W, N) },
    { name:"Нижний профиль створки под стекло 10 мм",   len:profileLen,  qty:N, pcs: pcs(profileLen, N) },
    { name:"Боковой профиль рамы",                      len:sideFrameLen,qty:2, pcs: pcs(sideFrameLen, 2) },
    { name:"Боковой профиль створки",                   len:sideSashLen, qty:sideSashQty, pcs: pcs(sideSashLen, sideSashQty) },
  ].filter(p=>p.qty>0);

  // Аксессуары — точно из файлов
  const accessories = [
    { name:"Алюминиевая конечная заглушка", qty:2 },
    { name:"Межстворочная заглушка",        qty: N*2-2 },
    { name:"Верхний ролик",                 qty: N*2 },
    { name:"Фетровый уплотнитель 5мм",      len:sideSashLen, qty: sideSashQty, note:"по боковым профилям створки" },
    { name:"Фетровый уплотнитель 7мм",      qty:12, note:"по направляющим (12 кусков)" },
    { name:"Ручка",                          qty:2 },
    { name:"Нижний ролик",                  qty: N*2 },
  ];

  // Итого профилей
  const totalPcs = profiles.reduce((s,p)=>s+p.pcs,0);

  return { profiles, accessories, totalPcs, totalQty: profiles.reduce((s,p)=>s+p.qty,0) };
}

// Рекомендация по количеству створок
function recommendSashes(W) {
  if(W <= 1800) return [2];
  if(W <= 2500) return [3,4];
  if(W <= 3500) return [4,5];
  if(W <= 4500) return [5,6];
  return [6,7,8];
}

function generateWhatsAppText(calc, phone) {
  const g = calc.glass;
  const lines = [
    `Ассаламуалейкум, это Жандильда — IGS Outdoor 🌿`,
    ``,
    `По вашему остеклению *Слайдинг (Orizzonte)*:`,
    ``,
    `📐 *Проём:* ${calc.width} × ${calc.height} мм`,
    `🔢 *Створок:* ${calc.sashes} шт`,
    ``,
    `🪟 *Размер стекла:* ${g.glassW} × ${g.glassH} мм`,
    `📦 *Количество:* ${g.count} шт`,
    `⚙️ *Тип:* под стекло 10 мм`,
    ``,
    `Пожалуйста, при заказе укажите эти размеры стекольщику.`,
    `Если есть вопросы — обращайтесь! 🙏`,
  ];
  return lines.join("\n");
}

function GlassCalc({isMobile}) {
  const [calcs, setCalcs] = useState(()=>loadGlassCalcs());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Форма
  const [width, setWidth] = useState("");
  const [ral, setRal] = useState("");
  const [height, setHeight] = useState("");
  const [sashes, setSashes] = useState("");
  const [openCenter, setOpenCenter] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Синхронизация с Firebase
  useEffect(()=>{
    dbGet("glass_calcs").then(data=>{
      if(data && typeof data==="object") {
        const arr = Object.values(data).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        setCalcs(arr);
        localStorage.setItem(GLASS_STORAGE_KEY, JSON.stringify(arr));
      }
    });
    const unsub = dbListen("glass_calcs", (data)=>{
      if(data && typeof data==="object") {
        const arr = Object.values(data).filter(c=>!c.deleted).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        setCalcs(arr);
        localStorage.setItem(GLASS_STORAGE_KEY, JSON.stringify(arr));
      }
    });
    return unsub;
  },[]);

  const W = parseFloat(width), H = parseFloat(height), N = parseInt(sashes);
  const glass = W&&H&&N ? calcGlass(W,H,N,openCenter) : null;
  const profile = W&&H&&N ? calcProfile(W,H,N) : null;
  const recommended = W ? recommendSashes(W) : [];

  function resetForm() {
    setWidth(""); setHeight(""); setSashes(""); setOpenCenter(false);
    setClientName(""); setClientPhone(""); setNotes(""); setRal("");
    setEditId(null); setShowForm(false);
  }

  function handleSave() {
    if(!W||!H||!N||!glass) return;
    const now = new Date().toISOString();
    const calc = {
      id: editId || Date.now().toString(),
      width:W, height:H, sashes:N, openCenter, ral: ral.trim(),
      glass, profile,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim().replace(/[^\d+\-()\s]/g,""),
      notes: notes.trim(),
      createdAt: editId ? (calcs.find(c=>c.id===editId)?.createdAt||now) : now,
      updatedAt: now,
    };
    // Бэкап перед сохранением
    if(editId) dbSet(`glass_calcs_backup/${editId}_${Date.now()}`, calcs.find(c=>c.id===editId)||{});
    const updated = editId ? calcs.map(c=>c.id===editId?calc:c) : [calc,...calcs];
    setCalcs(updated);
    saveGlassCalcs(updated);
    resetForm();
  }

  function startEdit(calc) {
    setWidth(String(calc.width)); setHeight(String(calc.height));
    setSashes(String(calc.sashes)); setOpenCenter(calc.openCenter||false);
    setClientName(calc.clientName||""); setClientPhone(calc.clientPhone||"");
    setNotes(calc.notes||""); setRal(calc.ral||""); setEditId(calc.id);
    setSelected(null); setShowForm(true);
  }

  function handleDelete(id) {
    const calc = calcs.find(c=>c.id===id);
    if(calc) dbSet(`glass_calcs_trash/${id}`, {...calc, deletedAt:new Date().toISOString()});
    dbSet(`glass_calcs/${id}`, {...calc, deleted:true, deletedAt:new Date().toISOString()});
    const updated = calcs.filter(c=>c.id!==id);
    setCalcs(updated);
    saveGlassCalcs(updated);
    setSelected(null); setDeleteConfirm(null);
  }

  function copyWA(calc) {
    const text = generateWhatsAppText(calc);
    navigator.clipboard?.writeText(text).catch(()=>{});
    setCopied(calc.id); setTimeout(()=>setCopied(null),2500);
  }

  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("ru-KZ",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";

  // ── ФОРМА РАСЧЁТА ──────────────────────────────────────────────────────────
  const CalcForm = () => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9999,overflowY:"auto"}}>
      <div style={{minHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:T.surface,borderRadius:16,width:"100%",maxWidth:520,padding:"22px 24px",fontFamily:T.font}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <div style={{fontSize:16,fontWeight:700,fontFamily:T.serif}}>{editId?"✏️ Редактировать":"🪟 Новый расчёт стекла"}</div>
            <button onClick={resetForm} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,color:T.textSec}}>✕</button>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:13}}>
            {/* Клиент */}
            <div style={{background:T.card,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`}}>
              <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Клиент (необязательно)</div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:T.textSec,marginBottom:4}}>Имя</div>
                  <Inp value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Имя клиента"/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:T.textSec,marginBottom:4}}>Телефон WhatsApp</div>
                  <Inp value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="+7 777 000 00 00" type="tel"/>
                </div>
              </div>
            </div>

            {/* Габариты */}
            <div>
              <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Габариты проёма (мм)</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <div style={{fontSize:10,color:T.textSec,marginBottom:4}}>Ширина (W)</div>
                  <Inp type="number" value={width} onChange={e=>setWidth(e.target.value)} placeholder="2495" inputMode="numeric"/>
                </div>
                <div>
                  <div style={{fontSize:10,color:T.textSec,marginBottom:4}}>Высота (H)</div>
                  <Inp type="number" value={height} onChange={e=>setHeight(e.target.value)} placeholder="2335" inputMode="numeric"/>
                </div>
              </div>
            </div>

            {/* Рекомендация по створкам */}
            {recommended.length>0&&(
              <div>
                <div style={{fontSize:10,color:T.textSec,marginBottom:6}}>Рекомендуем для ширины {W} мм:</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {recommended.map(n=>(
                    <button key={n} onClick={()=>setSashes(String(n))}
                      style={{background:parseInt(sashes)===n?T.goldBg:T.elevated,color:parseInt(sashes)===n?T.gold:T.textSec,border:`1px solid ${parseInt(sashes)===n?"rgba(184,150,90,0.3)":T.border}`,borderRadius:8,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>
                      {n} створок
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Количество створок */}
            <div>
              <div style={{fontSize:10,color:T.textSec,marginBottom:4,textTransform:"uppercase",fontWeight:600,letterSpacing:1}}>Количество створок</div>
              <Inp type="number" value={sashes} onChange={e=>setSashes(e.target.value)} placeholder="4" min="2" max="10" inputMode="numeric"/>
            </div>

            {/* Тип открывания */}
            <button onClick={()=>setOpenCenter(!openCenter)}
              style={{display:"flex",alignItems:"center",gap:10,background:openCenter?T.goldBg:T.elevated,border:`1px solid ${openCenter?"rgba(184,150,90,0.3)":T.border}`,borderRadius:10,padding:"10px 13px",cursor:"pointer",textAlign:"left",transition:"all .15s",fontFamily:T.font}}>
              <div style={{width:18,height:18,borderRadius:9,border:`2px solid ${openCenter?T.gold:T.border}`,background:openCenter?T.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {openCenter&&<span style={{color:"#0a0a0b",fontSize:10,fontWeight:800}}>✓</span>}
              </div>
              <div>
                <div style={{fontSize:13,color:T.text,fontWeight:500}}>Открывание от центра</div>
                <div style={{fontSize:10,color:T.textSec,marginTop:1}}>Для чётного числа створок с центральным разъёмом</div>
              </div>
            </button>

            {/* Предпросмотр результата */}
            {glass&&(
              <div style={{background:"rgba(184,150,90,0.06)",border:"1px solid rgba(184,150,90,0.2)",borderRadius:12,padding:14}}>
                <div style={{fontSize:10,color:T.textSec,fontWeight:600,letterSpacing:1,marginBottom:10,textTransform:"uppercase"}}>Предварительный расчёт</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div style={{background:T.card,borderRadius:9,padding:"10px 12px",border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:9,color:T.textSec,marginBottom:3}}>ШИРИНА СТЕКЛА</div>
                    <div style={{fontSize:18,fontWeight:700,color:T.gold,fontFamily:T.mono}}>{glass.glassW} <span style={{fontSize:11,color:T.textSec}}>мм</span></div>
                  </div>
                  <div style={{background:T.card,borderRadius:9,padding:"10px 12px",border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:9,color:T.textSec,marginBottom:3}}>ВЫСОТА СТЕКЛА</div>
                    <div style={{fontSize:18,fontWeight:700,color:T.gold,fontFamily:T.mono}}>{glass.glassH} <span style={{fontSize:11,color:T.textSec}}>мм</span></div>
                  </div>
                </div>
                <div style={{marginTop:8,fontSize:12,color:T.textSec,display:"flex",gap:12}}>
                  <span>📦 Количество: <b style={{color:T.text}}>{glass.count} шт</b></span>
                  <span>⚙️ Под стекло 10 мм</span>
                </div>
              </div>
            )}

            <div>
              <div style={{fontSize:10,color:T.textSec,marginBottom:4,textTransform:"uppercase",fontWeight:600,letterSpacing:1}}>Цвет RAL (необязательно)</div>
              <Inp value={ral} onChange={e=>setRal(e.target.value)} placeholder="Например: RAL 9005, RAL 7016, Белый..."/>
            </div>
            <div>
              <div style={{fontSize:10,color:T.textSec,marginBottom:4,textTransform:"uppercase",fontWeight:600,letterSpacing:1}}>Заметки</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Дополнительная информация…"
                style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",color:T.text,fontSize:13,width:"100%",outline:"none",minHeight:60,resize:"vertical",fontFamily:T.font}}/>
            </div>

            <button onClick={handleSave} disabled={!glass}
              style={{background:glass?T.gold:"rgba(255,255,255,0.1)",color:glass?"#0a0a0b":T.textDim,border:"none",borderRadius:10,padding:"13px",fontWeight:700,fontSize:14,cursor:glass?"pointer":"not-allowed",fontFamily:T.font,transition:"all .2s"}}>
              {editId?"💾 Сохранить изменения":"💾 Сохранить расчёт"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── ДЕТАЛЬНАЯ КАРТОЧКА ─────────────────────────────────────────────────────
  const CalcDetail = ({calc}) => {
    const g = calc.glass;
    const p = calc.profile;
    const [tab, setTab] = useState("glass");
    const waText = generateWhatsAppText(calc);
    const waUrl = calc.clientPhone ? `https://wa.me/${(calc.clientPhone||"").replace(/\D/g,"")}?text=${encodeURIComponent(waText)}` : null;

    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9998,overflowY:"auto"}}>
        <div style={{minHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background:T.surface,borderRadius:16,width:"100%",maxWidth:540,fontFamily:T.font}}>
            {/* Header */}
            <div style={{padding:"18px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,fontFamily:T.serif}}>🪟 Расчёт стекла</div>
                {calc.clientName&&<div style={{fontSize:12,color:T.textSec,marginTop:2}}>👤 {calc.clientName} {calc.clientPhone&&`· ${calc.clientPhone}`}</div>}
              </div>
              <div style={{display:"flex",gap:7}}>
                <button onClick={()=>{setSelected(null);startEdit(calc);}} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12,color:T.gold,fontFamily:T.font,fontWeight:600}}>✏️</button>
                <button onClick={()=>setDeleteConfirm(calc.id)} style={{background:T.dangerBg,border:"1px solid rgba(196,84,84,0.2)",borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12,color:T.danger,fontFamily:T.font}}>🗑️</button>
                <button onClick={()=>setSelected(null)} style={{background:T.elevated,border:`1px solid ${T.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,color:T.textSec}}>✕</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{display:"flex",borderBottom:`1px solid ${T.border}`}}>
              {[["glass","🪟 Стекло"],["profile","⚙️ Профиль"],["msg","💬 Сообщение"]].map(([id,label])=>(
                <button key={id} onClick={()=>setTab(id)} style={{flex:1,background:"none",border:"none",borderBottom:`2px solid ${tab===id?T.gold:"transparent"}`,padding:"10px 0",color:tab===id?T.gold:T.textSec,fontWeight:tab===id?600:400,fontSize:12,cursor:"pointer",fontFamily:T.font}}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{padding:"18px 22px",maxHeight:"60vh",overflowY:"auto"}}>
              {/* Стекло */}
              {tab==="glass"&&(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[["📐 Проём",`${calc.width} × ${calc.height} мм`],["🔢 Створок",`${calc.sashes} шт`],["🪟 Ширина стекла",`${g.glassW} мм`],["📏 Высота стекла",`${g.glassH} мм`]].map(([label,val])=>(
                      <div key={label} style={{background:T.card,borderRadius:9,padding:"11px 13px",border:`1px solid ${T.border}`}}>
                        <div style={{fontSize:9,color:T.textSec,marginBottom:3,fontWeight:600}}>{label}</div>
                        <div style={{fontSize:14,fontWeight:600,fontFamily:T.mono,color:T.gold}}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:"rgba(184,150,90,0.06)",border:"1px solid rgba(184,150,90,0.15)",borderRadius:10,padding:"11px 14px",fontSize:13}}>
                    <b>Итого:</b> {g.glassW} × {g.glassH} мм — <b>{g.count} шт</b> · под стекло 10 мм{calc.openCenter?" · от центра":""}{calc.ral?` · Цвет: ${calc.ral}`:""}
                  </div>
                  {calc.notes&&<div style={{background:T.card,borderRadius:9,padding:"10px 13px",border:`1px solid ${T.border}`,fontSize:12,color:T.textSec}}>{calc.notes}</div>}
                </div>
              )}

              {/* Профиль */}
              {tab==="profile"&&p&&(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{fontSize:11,color:T.textSec,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Профили</div>
                  {calc.ral&&<div style={{background:T.elevated,borderRadius:9,padding:"8px 12px",border:`1px solid ${T.border}`,fontSize:12,color:T.textSec,marginBottom:4}}>🎨 Цвет RAL: <b style={{color:T.text}}>{calc.ral}</b></div>}
                  {p.profiles.filter(pr=>pr.qty>0).map((pr,i)=>(
                    <div key={i} style={{background:T.card,borderRadius:9,border:`1px solid ${T.border}`,padding:"9px 12px"}}>
                      <div style={{fontSize:12,color:T.text,marginBottom:5,fontWeight:500}}>{pr.name}</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:T.textSec,fontFamily:T.mono}}>📏 {Math.round(pr.len)} мм</span>
                        <span style={{fontSize:11,color:T.gold,fontFamily:T.mono,fontWeight:700}}>× {pr.qty} шт</span>
                        <span style={{fontSize:11,color:T.textSec}}>= <b style={{color:T.text}}>{pr.pcs} штанг</b> по 6м</span>
                      </div>
                    </div>
                  ))}
                  <div style={{fontSize:11,color:T.textSec,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginTop:4}}>Аксессуары</div>
                  {p.accessories.filter(a=>a.qty>0).map((a,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",background:T.card,borderRadius:9,border:`1px solid ${T.border}`}}>
                      <div style={{fontSize:12,color:T.text,flex:1}}>
                        {a.name}
                        {a.note&&<span style={{fontSize:10,color:T.textDim,marginLeft:6}}>{a.note}</span>}
                        {a.len&&<span style={{fontSize:10,color:T.textSec,marginLeft:6,fontFamily:T.mono}}>{Math.round(a.len)} мм</span>}
                      </div>
                      <span style={{fontSize:12,fontWeight:700,color:T.gold,fontFamily:T.mono,flexShrink:0}}>{a.qty} шт</span>
                    </div>
                  ))}
                  <div style={{background:T.goldBg,borderRadius:9,padding:"9px 12px",border:`1px solid rgba(184,150,90,0.15)`}}>
                    <div style={{fontSize:11,color:T.textSec}}>ИТОГО профилей: <b style={{color:T.gold}}>{p.totalQty} шт</b> · штанг 6м: <b style={{color:T.gold}}>{p.totalPcs} шт</b></div>
                  </div>
                </div>
              )}

              {/* Сообщение */}
              {tab==="msg"&&(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{background:T.card,borderRadius:10,padding:"13px 15px",border:`1px solid ${T.border}`,fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",color:T.text}}>
                    {waText.replace(/\\n/g,"\n")}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>copyWA(calc)}
                      style={{flex:1,background:copied===calc.id?"rgba(90,154,106,0.15)":T.elevated,color:copied===calc.id?T.green:T.text,border:`1px solid ${copied===calc.id?"rgba(90,154,106,0.3)":T.border}`,borderRadius:10,padding:"11px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:T.font}}>
                      {copied===calc.id?"✓ Скопировано!":"📋 Копировать текст"}
                    </button>
                    {waUrl&&(
                      <a href={waUrl} target="_blank" rel="noreferrer"
                        style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(90,154,106,0.1)",color:T.green,border:"1px solid rgba(90,154,106,0.25)",borderRadius:10,padding:"11px",fontWeight:600,fontSize:13,textDecoration:"none",fontFamily:T.font}}>
                        💬 Открыть WhatsApp
                      </a>
                    )}
                  </div>
                  {!calc.clientPhone&&<div style={{fontSize:11,color:T.textSec,textAlign:"center"}}>Добавьте телефон клиента для прямой отправки в WhatsApp</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── РЕНДЕР ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:20}}>
        <div>
          {!isMobile&&<div style={{fontSize:11,color:T.textSec,letterSpacing:2,marginBottom:4,fontWeight:600}}>ORIZZONTE</div>}
          <div style={{fontSize:isMobile?20:26,fontWeight:800,fontFamily:T.serif}}>Стекло 🪟 <span style={{fontSize:14,color:T.textSec,fontWeight:400,fontFamily:T.font}}>({calcs.length})</span></div>
        </div>
        <Btn variant="primary" onClick={()=>{resetForm();setShowForm(true);}}>+ Новый расчёт</Btn>
      </div>

      {calcs.length===0&&(
        <div style={{textAlign:"center",padding:60}}>
          <div style={{fontSize:40,marginBottom:14}}>🪟</div>
          <div style={{fontSize:16,fontWeight:700,fontFamily:T.serif,marginBottom:8}}>Расчётов пока нет</div>
          <div style={{fontSize:13,color:T.textSec,marginBottom:20}}>Введите габариты проёма и количество створок</div>
          <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Первый расчёт</Btn>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8,paddingBottom:isMobile?100:0}}>
        {calcs.map(calc=>{
          const g = calc.glass;
          return(
            <div key={calc.id} onClick={()=>setSelected(calc)}
              style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"13px 16px",cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.borderHover;e.currentTarget.style.background=T.elevated;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.card;}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:T.text}}>{calc.clientName||"Без имени"} {calc.clientPhone&&<span style={{fontSize:11,color:T.textSec,fontFamily:T.mono}}>· {calc.clientPhone}</span>}</div>
                  <div style={{fontSize:11,color:T.textSec,marginTop:2}}>Проём: {calc.width} × {calc.height} мм · {calc.sashes} створок</div>
                </div>
                <div style={{fontSize:10,color:T.textDim,flexShrink:0}}>{fmtDate(calc.createdAt)}</div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <span style={{background:"rgba(184,150,90,0.08)",color:T.gold,borderRadius:6,padding:"3px 10px",fontSize:12,fontFamily:T.mono,fontWeight:600}}>
                  {g.glassW} × {g.glassH} мм
                </span>
                <span style={{background:T.elevated,color:T.textSec,borderRadius:6,padding:"3px 10px",fontSize:11}}>
                  {g.count} шт · 10 мм
                </span>
                {calc.openCenter&&<span style={{background:"rgba(37,99,235,0.1)",color:"#60a5fa",borderRadius:6,padding:"3px 10px",fontSize:11}}>от центра</span>}
              </div>
              {calc.notes&&<div style={{fontSize:11,color:T.textSec,marginTop:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{calc.notes}</div>}
            </div>
          );
        })}
      </div>

      {showForm&&<CalcForm/>}
      {selected&&<CalcDetail calc={selected}/>}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background:T.surface,borderRadius:16,padding:"24px",maxWidth:340,width:"100%",fontFamily:T.font,textAlign:"center"}}>
            <div style={{fontSize:30,marginBottom:12}}>🗑️</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Удалить расчёт?</div>
            <div style={{fontSize:12,color:T.textSec,marginBottom:20}}>Расчёт будет перемещён в корзину Firebase.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>handleDelete(deleteConfirm)} style={{flex:1,background:T.dangerBg,color:T.danger,border:"1px solid rgba(196,84,84,0.25)",borderRadius:10,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:T.font}}>Удалить</button>
              <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,background:T.elevated,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:T.font}}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function CRM({currentUser:propUser,onShowUserManager:propShowUM,onLogout:propLogout}){
  const isMobile=useIsMobile();
  const[page,setPage]=useState("dashboard");
  const[clients,setClients]=useState([]);
  const[selectedClientId,setSelectedClientId]=useState(null);
  const[loading,setLoading]=useState(true);
  const[storageStatus,setStorageStatus]=useState("idle");
  const[pricesVersion,setPricesVersion]=useState(0);
  const[kpClientId,setKpClientId]=useState(null);
  const[kpItems,setKpItems]=useState([]);
  const[kpStep,setKpStep]=useState(1);
  const[kpDiscount,setKpDiscount]=useState(0);

  const currentUser=propUser||{login:"zhan",role:"admin"};
  const onLogout=propLogout||(()=>{});
  const onShowUserManager=propShowUM||null;
  const skipSaveRef=useRef(false);
  const[customProducts,setCustomProducts]=useState([]);
  const[catalogVersion,setCatalogVersion]=useState(0);

  function handleAddProduct(product){
    const updated=[...customProducts,product];
    setCustomProducts(updated);
    saveCustomProducts(updated);
    mergeProducts(updated);
    setCatalogVersion(v=>v+1);
  }
  function handleDeleteProduct(id){
    const updated=customProducts.filter(p=>p.id!==id);
    setCustomProducts(updated);
    saveCustomProducts(updated);
    mergeProducts(updated);
    setCatalogVersion(v=>v+1);
  }

  // Загрузка данных: сначала localStorage (мгновенно), потом Firebase (async)
  useEffect(()=>{
    // 1) Мгновенно из localStorage
    const customLocal=loadCustomProducts();
    setCustomProducts(customLocal);
    mergeProducts(customLocal);
    const prices=loadPrices();applyPrices(prices);
    setClients(loadClients());
    setLoading(false);

    // 2) Асинхронно из Firebase — MERGE: объединяем локальных и Firebase по id
    (async()=>{
      try {
        const [fbClients, fbPrices, fbCustomProds] = await Promise.all([
          dbGet("clients"),
          dbGet("prices"),
          dbGet("custom_products")
        ]);
        if(Array.isArray(fbCustomProds)&&fbCustomProds.length>0){
          setCustomProducts(fbCustomProds);mergeProducts(fbCustomProds);
          localStorage.setItem(CUSTOM_PRODUCTS_KEY,JSON.stringify(fbCustomProds));
          setCatalogVersion(v=>v+1);
        }
        if(fbPrices) { applyPrices(fbPrices); localStorage.setItem(PRICES_KEY,JSON.stringify(fbPrices)); }

        const local = loadClients();
        // Firebase может вернуть объект {id: client} если писали по ключам
        const fbArr = Array.isArray(fbClients) ? fbClients
          : (fbClients && typeof fbClients === "object" ? Object.values(fbClients) : []);

        // Объединяем: берём все уникальные id из обоих источников
        // Если клиент есть в обоих — побеждает тот, у кого updatedAt новее
        const merged = mergeClients(local, fbArr);

        skipSaveRef.current = true;
        setClients(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        // Пишем каждого клиента отдельно — предотвращает race condition
        merged.forEach(c => { if(c && c.id) dbSet(`clients/${c.id}`, c); });
        setTimeout(()=>{ skipSaveRef.current = false; }, 1500);

      } catch(e) { console.error("Firebase load error:", e); }
    })();

    // 3) Realtime подписка на изменения клиентов — merge с локальными
    const unsubClients = dbListen("clients", (data) => {
      // Firebase возвращает объект {id: client} при хранении по ключам
      const fbArr = Array.isArray(data) ? data : (data && typeof data === "object" ? Object.values(data) : []);
      if(fbArr.length > 0) {
        setClients(prev => {
          const merged = mergeClients(prev, fbArr);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      }
    });

    // 4) Realtime подписка на цены
    const unsubPrices = dbListen("prices", (data) => {
      if(data) { applyPrices(data); localStorage.setItem(PRICES_KEY,JSON.stringify(data)); }
    });

    // 5) Realtime подписка на пользовательские продукты
    const unsubCustomProds = dbListen("custom_products", (data) => {
      if(Array.isArray(data)) {
        // Merge: объединяем по id чтобы не затирать локально добавленные продукты
        setCustomProducts(prev => {
          const map = new Map();
          (prev||[]).forEach(p => p && p.id && map.set(p.id, p));
          data.forEach(p => p && p.id && map.set(p.id, p)); // Firebase побеждает
          const merged = Array.from(map.values());
          mergeProducts(merged);
          localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(merged));
          return merged;
        });
        setCatalogVersion(v=>v+1);
      }
    });

    return ()=>{ unsubClients(); unsubPrices(); unsubCustomProds(); };
  },[]);

  // Сохранение клиентов при изменении (пропускаем если данные пришли из firebase)
  useEffect(()=>{
    if(loading) return;
    if(skipSaveRef.current) { setStorageStatus("saved"); setTimeout(()=>setStorageStatus("idle"),1000); return; }
    setStorageStatus("saving");
    const ok=saveClients(clients);
    setStorageStatus(ok?"saved":"error");
    setTimeout(()=>setStorageStatus("idle"),1800);
  },[clients]);

  // Автобэкап в Firebase каждые 3 минуты
  useEffect(()=>{
    if(loading) return;
    const interval = setInterval(()=>{
      if(clients.length > 0) {
        clients.forEach(c => { if(c && c.id) dbSet(`clients/${c.id}`, c); });
        // Также дублируем в отдельный backup-слот с датой
        const backupKey = "backup_" + new Date().toISOString().slice(0,10);
        dbSet(backupKey, clients);
      }
    }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  },[loading, clients]);

  function addClient(data){const c={id:Date.now().toString(),...data,status:"lead",kps:[],tasks:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};setClients(prev=>[c,...prev]);return c;}
  function updateClient(id,data){setClients(prev=>prev.map(c=>c.id===id?{...c,...data,updatedAt:new Date().toISOString()}:c));}
  function deleteClient(id){setClients(prev=>prev.filter(c=>c.id!==id));}
  function saveKP(clientId,items,discount){const kp={id:Date.now().toString(),items,discount,total:items.reduce((s,i)=>s+calcItem(i),0)*(1-discount/100),createdAt:new Date().toISOString()};setClients(prev=>prev.map(c=>c.id!==clientId?c:{...c,kps:[kp,...(c.kps||[])],status:c.status==="lead"?"kp_sent":c.status,updatedAt:new Date().toISOString()}));}
  function goToClient(id){setSelectedClientId(id);setPage("client-detail");}
  function startKP(clientId=null){setKpClientId(clientId);setKpItems([]);setKpStep(clientId?2:1);setKpDiscount(0);setPage("calculator");}

  const selectedClient=clients.find(c=>c.id===selectedClientId);

  if(loading)return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <GlobalStyles/>
      <div style={{color:T.gold,fontFamily:T.serif,fontSize:20}}>IGS Outdoor</div>
      <div style={{color:T.textDim,fontFamily:T.font,fontSize:12}}>Загрузка…</div>
    </div>
  );

  const showNav=page!=="client-detail";
  const dashProps={clients,onGoToClient:goToClient,onStartKP:startKP,onGoToPage:setPage,currentUser,onLogout,onShowUserManager};
  const calcProps={clients,kpClientId,setKpClientId,kpItems,setKpItems,kpStep,setKpStep,kpDiscount,setKpDiscount,onSaveKP:saveKP,onAddClient:addClient};

  if(!isMobile)return(
    <div style={{display:"flex",minHeight:"100vh",background:T.bg}}>
      <GlobalStyles/>
      <StorageBadge status={storageStatus}/>
      {showNav&&<Sidebar page={page} setPage={setPage} currentUser={currentUser} onLogout={onLogout} onShowUserManager={onShowUserManager}/>}
      <main style={{flex:1,marginLeft:showNav?220:0,padding:"32px 40px",minHeight:"100vh",overflowY:"auto"}}>
        {page==="dashboard"&&<Dashboard {...dashProps} isMobile={false}/>}
        {page==="clients"&&<ClientList clients={clients} onGoToClient={goToClient} onAddClient={addClient} onDeleteClient={id=>{deleteClient(id);}} isMobile={false} currentUser={currentUser}/>}
        {page==="client-detail"&&selectedClient&&<ClientDetail client={selectedClient} onBack={()=>setPage("clients")} onUpdate={data=>updateClient(selectedClient.id,data)} onDelete={()=>{deleteClient(selectedClient.id);setPage("clients");}} onStartKP={()=>startKP(selectedClient.id)} isMobile={false} currentUser={currentUser}/>}
        {page==="calculator"&&<Calculator {...calcProps} isMobile={false}/>}
        {page==="catalog"&&<Catalog key={catalogVersion} isMobile={false} currentUser={currentUser} onAddProduct={handleAddProduct} onDeleteProduct={handleDeleteProduct}/>}
        {page==="bot_leads"&&<BotLeads isMobile={false}/>}
        {page==="glass"&&<GlassCalc isMobile={false}/>}
        {page==="prices"&&can(currentUser,"edit_prices")&&<PriceEditor key={pricesVersion} onPricesChanged={()=>setPricesVersion(v=>v+1)} isMobile={false}/>}
      </main>
    </div>
  );

  return(
    <div style={{background:T.bg,minHeight:"100vh"}}>
      <GlobalStyles/>
      <StorageBadge status={storageStatus}/>
      {page==="dashboard"&&<Dashboard {...dashProps} isMobile/>}
      {page==="clients"&&<div style={{padding:"16px 0 0"}}><ClientList clients={clients} onGoToClient={goToClient} onAddClient={addClient} onDeleteClient={id=>{deleteClient(id);}} isMobile currentUser={currentUser}/></div>}
      {page==="client-detail"&&selectedClient&&<ClientDetail client={selectedClient} onBack={()=>setPage("clients")} onUpdate={data=>updateClient(selectedClient.id,data)} onDelete={()=>{deleteClient(selectedClient.id);setPage("clients");}} onStartKP={()=>startKP(selectedClient.id)} isMobile currentUser={currentUser}/>}
      {page==="calculator"&&<div style={{padding:"16px 13px 0"}}><Calculator {...calcProps} isMobile/></div>}
      {page==="catalog"&&<Catalog key={catalogVersion} isMobile currentUser={currentUser} onAddProduct={handleAddProduct} onDeleteProduct={handleDeleteProduct}/>}
      {page==="bot_leads"&&<div style={{padding:"16px 13px 0"}}><BotLeads isMobile/></div>}
      {page==="meetings"&&<div style={{padding:"16px 13px 0"}}><Meetings isMobile/></div>}
      {page==="glass"&&<div style={{padding:"16px 13px 0"}}><GlassCalc isMobile/></div>}
      {page==="prices"&&can(currentUser,"edit_prices")&&<div style={{padding:"16px 13px 0"}}><PriceEditor key={pricesVersion} onPricesChanged={()=>setPricesVersion(v=>v+1)} isMobile/></div>}
      {showNav&&<BottomNav page={page} setPage={setPage} currentUser={currentUser}/>}
    </div>
  );
}