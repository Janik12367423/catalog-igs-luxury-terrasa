import { useState, useEffect } from "react";
import CRM from "./CRM.jsx";
import { dbSet, dbGet, dbListen, isOnline } from "./firebase.js";

// ─── PERMISSIONS ──────────────────────────────────────────────────────────────
export const PERMISSIONS = {
  view_dashboard:  { label:"Главная (дашборд)",      icon:"🏠" },
  view_clients:    { label:"Просмотр клиентов",      icon:"👁️" },
  add_clients:     { label:"Добавлять клиентов",     icon:"➕" },
  edit_clients:    { label:"Редактировать клиентов", icon:"✏️" },
  delete_clients:  { label:"Удалять клиентов",       icon:"🗑️" },
  view_calculator: { label:"Расчёт КП",              icon:"🧮" },
  view_catalog:    { label:"Каталог",                icon:"📋" },
  edit_prices:     { label:"Редактировать цены",     icon:"💰" },
};

export const ROLE_PRESETS = {
  admin:        { label:"Администратор",  icon:"👑", color:"#b8965a", perms:Object.fromEntries(Object.keys(PERMISSIONS).map(k=>[k,true])) },
  manager:      { label:"Менеджер",       icon:"💼", color:"#5a9a6a", perms:{view_dashboard:true,view_clients:true,add_clients:true,edit_clients:true,delete_clients:false,view_calculator:true,view_catalog:true,edit_prices:false} },
  sales:        { label:"Продавец",       icon:"🤝", color:"#2563eb", perms:{view_dashboard:true,view_clients:true,add_clients:true,edit_clients:false,delete_clients:false,view_calculator:true,view_catalog:true,edit_prices:false} },
  readonly:     { label:"Только чтение", icon:"👀", color:"#7c3aed", perms:{view_dashboard:true,view_clients:true,add_clients:false,edit_clients:false,delete_clients:false,view_calculator:false,view_catalog:true,edit_prices:false} },
  catalog_only: { label:"Только каталог",icon:"📋", color:"#6b7280", perms:{view_dashboard:false,view_clients:false,add_clients:false,edit_clients:false,delete_clients:false,view_calculator:false,view_catalog:true,edit_prices:false} },
};

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
const AUTH_KEY="igs_auth_session", USERS_KEY="igs_auth_users", LOCKOUT_KEY="igs_auth_lockout", MAX_ATTEMPTS=5;

function simpleHash(str) {
  let h=0; for(let i=0;i<str.length;i++) h=(Math.imul(31,h)+str.charCodeAt(i))|0; return h.toString(36);
}

const DEFAULT_USERS = { zhan:{ passwordHash:simpleHash("88828822"), role:"admin", perms:ROLE_PRESETS.admin.perms } };

function getUsers() {
  try { const u=JSON.parse(localStorage.getItem(USERS_KEY)||"null"); if(u) return u; } catch(_){}
  localStorage.setItem(USERS_KEY,JSON.stringify(DEFAULT_USERS)); return DEFAULT_USERS;
}
function saveUsers(u) { 
  localStorage.setItem(USERS_KEY,JSON.stringify(u));
  dbSet("users", u); // sync to firebase
}
function getSession() {
  try { const s=JSON.parse(localStorage.getItem(AUTH_KEY)||"null"); if(s&&s.expires>Date.now()) return s; } catch(_){} return null;
}
function saveSession(login,role,perms) {
  const s={login,role,perms,expires:Date.now()+7*24*60*60*1000};
  localStorage.setItem(AUTH_KEY,JSON.stringify(s)); return s;
}
function clearSession() { localStorage.removeItem(AUTH_KEY); }
function getLockout() {
  try { return JSON.parse(localStorage.getItem(LOCKOUT_KEY)||"null")||{attempts:0,until:0}; } catch(_){ return {attempts:0,until:0}; }
}
function saveLockout(d) { localStorage.setItem(LOCKOUT_KEY,JSON.stringify(d)); }

export function can(session,perm) {
  if(!session) return false;
  if(session.role==="admin") return true;
  return !!(session.perms?.[perm]);
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [login,setLogin]=useState("");
  const [password,setPassword]=useState("");
  const [showPass,setShowPass]=useState(false);
  const [error,setError]=useState("");
  const [locked,setLocked]=useState(false);
  const [lockSec,setLockSec]=useState(0);
  const [focused,setFocused]=useState(null);

  useEffect(()=>{ const lk=getLockout(); if(lk.until>Date.now()){setLocked(true);cd(lk.until);} },[]);

  function cd(until) {
    const tick=()=>{ const left=Math.ceil((until-Date.now())/1000); if(left<=0){setLocked(false);setLockSec(0);return;} setLockSec(left); setTimeout(tick,1000); }; tick();
  }
  function handleSubmit() {
    const lk=getLockout(); if(lk.until>Date.now()) return;
    const users=getUsers(); 
    const loginKey = login.trim().toLowerCase();
    const user=users[loginKey];
    if(!user) {
      const att=(lk.attempts||0)+1;
      if(att>=MAX_ATTEMPTS){ const u=Date.now()+30*60*1000; saveLockout({attempts:att,until:u}); setLocked(true); cd(u); setError(`Превышено ${MAX_ATTEMPTS} попыток. Блокировка на 30 минут.`); }
      else { saveLockout({attempts:att,until:0}); setError(`Пользователь «${loginKey}» не найден. Осталось: ${MAX_ATTEMPTS-att}`); }
    } else if(user.passwordHash!==simpleHash(password.trim())) {
      const att=(lk.attempts||0)+1;
      if(att>=MAX_ATTEMPTS){ const u=Date.now()+30*60*1000; saveLockout({attempts:att,until:u}); setLocked(true); cd(u); setError(`Превышено ${MAX_ATTEMPTS} попыток. Блокировка на 30 минут.`); }
      else { saveLockout({attempts:att,until:0}); setError(`Неверный пароль. Осталось: ${MAX_ATTEMPTS-att}`); }
    } else {
      saveLockout({attempts:0,until:0});
      onLogin(saveSession(loginKey, user.role, user.perms||ROLE_PRESETS[user.role]?.perms||ROLE_PRESETS.manager.perms));
    }
    setPassword("");
  }
  const fmtT=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{minHeight:"100vh",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'General Sans',system-ui"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#09090b;-webkit-font-smoothing:antialiased;}
        ::selection{background:rgba(184,150,90,0.25);color:#fff;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .li{background:#1a1a1d;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:11px 14px;color:#eae6e1;font-size:14px;width:100%;outline:none;font-family:'General Sans',system-ui;transition:all 0.2s ease;}
        .li:focus{border-color:rgba(184,150,90,0.4);box-shadow:0 0 0 2px rgba(184,150,90,0.08);}
        .li::placeholder{color:rgba(255,255,255,0.2);}
        .lb{background:#b8965a;color:#09090b;border:none;border-radius:8px;padding:12px;font-weight:600;font-size:14px;cursor:pointer;font-family:'General Sans',system-ui;width:100%;transition:all 0.2s;letter-spacing:0.3px;}
        .lb:hover:not(:disabled){box-shadow:0 4px 20px rgba(184,150,90,0.25);}
        .lb:disabled{opacity:0.3;cursor:not-allowed;}
      `}</style>

      <div style={{width:"100%",maxWidth:360,animation:"fadeUp 0.6s cubic-bezier(0.22,1,0.36,1)"}}>
        <div style={{marginBottom:48}}>
          <div style={{fontSize:24,fontFamily:"'Instrument Serif',Georgia,serif",color:"#b8965a",marginBottom:4}}>IGS Outdoor</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.2)",letterSpacing:3,textTransform:"uppercase",fontWeight:500}}>Внутренняя система</div>
        </div>

        <div style={{background:"#111113",borderRadius:12,padding:"28px 24px",border:"1px solid rgba(255,255,255,0.07)"}}>
          {locked ? (
            <div style={{textAlign:"center",padding:"16px 0"}}>
              <div style={{color:"#c45454",fontWeight:600,marginBottom:8,fontSize:14}}>Доступ заблокирован</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:12,marginBottom:12}}>Повторите через</div>
              <div style={{color:"#b8965a",fontSize:28,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace"}}>{fmtT(lockSec)}</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:6,fontWeight:600,letterSpacing:2,textTransform:"uppercase"}}>Логин</div>
                <input value={login} onChange={e=>{setLogin(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="Введите логин" className="li" autoCapitalize="none" autoComplete="username"/>
              </div>
              <div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:6,fontWeight:600,letterSpacing:2,textTransform:"uppercase"}}>Пароль</div>
                <div style={{position:"relative"}}>
                  <input type={showPass?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="Введите пароль" className="li" style={{paddingRight:44}} autoComplete="current-password"/>
                  <button onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:15,color:"rgba(255,255,255,0.2)"}}>{showPass?"🙈":"👁️"}</button>
                </div>
              </div>
              {error&&<div style={{background:"rgba(196,84,84,0.08)",border:"1px solid rgba(196,84,84,0.12)",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#c45454",fontWeight:500}}>{error}</div>}
              <button onClick={handleSubmit} disabled={!login.trim()||!password} className="lb" style={{marginTop:2}}>Войти</button>
            </div>
          )}
        </div>

        <div style={{textAlign:"center",marginTop:32,fontSize:10,color:"rgba(255,255,255,0.12)",letterSpacing:1}}>© {new Date().getFullYear()} IGS Outdoor</div>
      </div>
    </div>
  );
}

// ─── PERM TOGGLE ──────────────────────────────────────────────────────────────
function PermToggle({permKey,value,onChange}) {
  return (
    <button onClick={()=>onChange(!value)} style={{display:"flex",alignItems:"center",gap:11,background:value?"rgba(184,150,90,0.06)":"rgba(255,255,255,0.02)",border:`1px solid ${value?"rgba(184,150,90,0.2)":"rgba(255,255,255,0.06)"}`,borderRadius:12,padding:"10px 14px",cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.2s",fontFamily:"'General Sans',system-ui"}}>
      <div style={{width:20,height:20,borderRadius:10,border:`2px solid ${value?"#b8965a":"rgba(255,255,255,0.12)"}`,background:value?"#b8965a":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
        {value&&<span style={{color:"#09090b",fontSize:10,fontWeight:800}}>✓</span>}
      </div>
      <span style={{fontSize:13,color:value?"#eae6e1":"rgba(255,255,255,0.25)",transition:"color 0.2s"}}>{PERMISSIONS[permKey].icon} {PERMISSIONS[permKey].label}</span>
    </button>
  );
}

// ─── USER MANAGER ─────────────────────────────────────────────────────────────
function UserManager({currentUser,onClose}) {
  const [users,setUsers]=useState(getUsers());
  const [view,setView]=useState("list");
  const [editKey,setEditKey]=useState(null);
  const [newLogin,setNewLogin]=useState("");
  const [newPass,setNewPass]=useState("");
  const [selPreset,setSelPreset]=useState("manager");
  const [customPerms,setCustomPerms]=useState({...ROLE_PRESETS.manager.perms});
  const [useCustom,setUseCustom]=useState(false);
  const [msg,setMsg]=useState({text:"",ok:true});

  function showMsg(text,ok=true){ setMsg({text,ok}); setTimeout(()=>setMsg({text:"",ok:true}),ok?5000:3000); }
  function applyPreset(pk){ setSelPreset(pk); setCustomPerms({...ROLE_PRESETS[pk].perms}); }
  function getRoleInfo(u) {
    if(u.role==="admin") return ROLE_PRESETS.admin;
    for(const [pk,pv] of Object.entries(ROLE_PRESETS)) {
      if(JSON.stringify(pv.perms)===JSON.stringify(u.perms)) return pv;
    }
    return {label:"Настроено вручную",icon:"⚙️",color:"#6b7280"};
  }
  function startEdit(key) { setEditKey(key); setCustomPerms({...(users[key].perms||ROLE_PRESETS.manager.perms)}); setView("edit"); }
  function saveEdit() {
    const updated={...users,[editKey]:{...users[editKey],perms:customPerms}};
    saveUsers(updated); setUsers(updated); showMsg(`Права «${editKey}» обновлены`); setView("list");
  }
  function addUser() {
    if(!newLogin.trim()||!newPass.trim()) return;
    if(newPass.trim().length<4){ showMsg("Пароль минимум 4 символа",false); return; }
    const key=newLogin.trim().toLowerCase();
    if(users[key]){ showMsg("Такой логин уже существует",false); return; }
    const perms=useCustom?customPerms:{...(ROLE_PRESETS[selPreset]?.perms||ROLE_PRESETS.manager.perms)};
    const role=selPreset==="admin"?"admin":"user";
    const newUser={passwordHash:simpleHash(newPass.trim()),role,perms};
    const updated={...users,[key]:newUser};
    saveUsers(updated); setUsers(updated);
    const savedPass=newPass.trim();
    setNewLogin(""); setNewPass(""); setUseCustom(false); setSelPreset("manager");
    showMsg(`✅ «${key}» добавлен. Логин: ${key} / Пароль: ${savedPass}`);
    setView("list");
  }
  function deleteUser(key) {
    if(key===currentUser.login){ showMsg("Нельзя удалить себя",false); return; }
    if(!window.confirm(`Удалить «${key}»?`)) return;
    const updated={...users}; delete updated[key]; saveUsers(updated); setUsers(updated);
  }

  const inputStyle = {background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"13px 15px",color:"#eae6e1",fontSize:14,width:"100%",outline:"none",fontFamily:"'General Sans',system-ui",transition:"all 0.2s"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",zIndex:9999,overflowY:"auto",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"linear-gradient(145deg,#111113,#09090b)",borderRadius:24,width:"100%",maxWidth:500,padding:"24px 26px 30px",fontFamily:"'General Sans',system-ui",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 20px 60px rgba(0,0,0,0.6)",animation:"slideUp 0.3s ease",maxHeight:"90vh",overflowY:"auto"}}>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {view!=="list"&&<button onClick={()=>setView("list")} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,cursor:"pointer",color:"rgba(255,255,255,0.35)",transition:"all 0.2s"}}>←</button>}
            <div style={{fontSize:16,fontWeight:700,color:"#eae6e1"}}>
              {view==="list"?"👥 Пользователи":view==="add"?"➕ Новый пользователь":`✏️ Права: ${editKey}`}
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,cursor:"pointer",color:"rgba(255,255,255,0.35)"}}>✕</button>
        </div>

        {msg.text&&<div style={{background:msg.ok?"rgba(90,154,106,0.08)":"rgba(196,84,84,0.08)",border:`1px solid ${msg.ok?"rgba(90,154,106,0.2)":"rgba(196,84,84,0.2)"}`,borderRadius:12,padding:"10px 14px",fontSize:13,color:msg.ok?"#5a9a6a":"#c45454",marginBottom:14}}>{msg.text}</div>}

        {view==="list"&&(
          <>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {Object.entries(users).map(([key,u])=>{
                const rl=getRoleInfo(u);
                const permCount=Object.values(u.perms||{}).filter(Boolean).length;
                return (
                  <div key={key} style={{background:"rgba(255,255,255,0.02)",borderRadius:14,padding:"13px 15px",display:"flex",alignItems:"center",gap:11,border:"1px solid rgba(255,255,255,0.05)"}}>
                    <div style={{width:38,height:38,borderRadius:10,background:`${rl.color}15`,border:`1px solid ${rl.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{rl.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#eae6e1"}}>{key}</div>
                      <div style={{fontSize:11,color:rl.color,marginTop:2}}>{rl.label} · {permCount}/{Object.keys(PERMISSIONS).length} прав</div>
                    </div>
                    {key!==currentUser.login&&(
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>startEdit(key)} style={{background:"rgba(184,150,90,0.08)",border:"1px solid rgba(184,150,90,0.2)",borderRadius:9,padding:"6px 12px",fontSize:11,color:"#b8965a",cursor:"pointer",fontFamily:"'General Sans',system-ui",fontWeight:600}}>Права</button>
                        <button onClick={()=>deleteUser(key)} style={{background:"rgba(196,84,84,0.06)",border:"1px solid rgba(196,84,84,0.15)",borderRadius:9,padding:"6px 10px",fontSize:13,color:"#c45454",cursor:"pointer"}}>🗑️</button>
                      </div>
                    )}
                    {key===currentUser.login&&<div style={{fontSize:10,color:"rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.03)",borderRadius:7,padding:"3px 9px",fontWeight:600}}>вы</div>}
                  </div>
                );
              })}
            </div>
            <button onClick={()=>setView("add")} style={{background:"linear-gradient(135deg,#b8965a,#9a7d4a)",color:"#09090b",border:"none",borderRadius:14,padding:"14px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'General Sans',system-ui",width:"100%",transition:"all 0.2s"}}>
              ➕ Добавить пользователя
            </button>
          </>
        )}

        {view==="add"&&(
          <div style={{display:"flex",flexDirection:"column",gap:13}}>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:5,fontWeight:700,letterSpacing:1}}>ЛОГИН</div>
              <input value={newLogin} onChange={e=>setNewLogin(e.target.value)} placeholder="Введите логин" style={inputStyle} autoCapitalize="none"/>
            </div>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:5,fontWeight:700,letterSpacing:1}}>ПАРОЛЬ</div>
              <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Введите пароль" style={inputStyle}/>
            </div>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:8,fontWeight:700,letterSpacing:1}}>РОЛЬ / УРОВЕНЬ ДОСТУПА</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:6}}>
                {Object.entries(ROLE_PRESETS).map(([pk,pv])=>(
                  <button key={pk} onClick={()=>{applyPreset(pk);setUseCustom(false);}} style={{background:!useCustom&&selPreset===pk?`${pv.color}12`:"rgba(255,255,255,0.02)",border:`1px solid ${!useCustom&&selPreset===pk?`${pv.color}40`:"rgba(255,255,255,0.06)"}`,borderRadius:12,padding:"12px 13px",cursor:"pointer",textAlign:"left",transition:"all 0.2s",fontFamily:"'General Sans',system-ui"}}>
                    <div style={{fontSize:20,marginBottom:5}}>{pv.icon}</div>
                    <div style={{fontSize:12,fontWeight:700,color:!useCustom&&selPreset===pk?pv.color:"#eae6e1",lineHeight:1.2}}>{pv.label}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.15)",marginTop:4}}>{Object.values(pv.perms).filter(Boolean).length}/{Object.keys(PERMISSIONS).length} прав</div>
                  </button>
                ))}
                <button onClick={()=>setUseCustom(true)} style={{background:useCustom?"rgba(184,150,90,0.08)":"rgba(255,255,255,0.02)",border:`1px solid ${useCustom?"rgba(184,150,90,0.2)":"rgba(255,255,255,0.06)"}`,borderRadius:12,padding:"12px 13px",cursor:"pointer",textAlign:"left",fontFamily:"'General Sans',system-ui"}}>
                  <div style={{fontSize:20,marginBottom:5}}>⚙️</div>
                  <div style={{fontSize:12,fontWeight:700,color:useCustom?"#b8965a":"#eae6e1"}}>Вручную</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.15)",marginTop:4}}>Настроить каждое право</div>
                </button>
              </div>
            </div>
            {useCustom&&(
              <div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:7,fontWeight:700,letterSpacing:1}}>РАЗРЕШЕНИЯ</div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {Object.keys(PERMISSIONS).map(pk=>(
                    <PermToggle key={pk} permKey={pk} value={!!customPerms[pk]} onChange={v=>setCustomPerms(p=>({...p,[pk]:v}))}/>
                  ))}
                </div>
              </div>
            )}
            <button onClick={addUser} disabled={!newLogin.trim()||!newPass.trim()} style={{background:"linear-gradient(135deg,#b8965a,#9a7d4a)",color:"#09090b",border:"none",borderRadius:14,padding:"14px",fontWeight:700,fontSize:14,cursor:newLogin.trim()&&newPass.trim()?"pointer":"not-allowed",opacity:newLogin.trim()&&newPass.trim()?1:0.4,fontFamily:"'General Sans',system-ui",marginTop:4}}>
              Добавить пользователя
            </button>
          </div>
        )}

        {view==="edit"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:2,fontWeight:700,letterSpacing:1}}>БЫСТРЫЙ ПРЕСЕТ</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
              {Object.entries(ROLE_PRESETS).map(([pk,pv])=>(
                <button key={pk} onClick={()=>setCustomPerms({...pv.perms})} style={{background:`${pv.color}10`,border:`1px solid ${pv.color}30`,borderRadius:9,padding:"6px 12px",fontSize:11,fontWeight:600,color:pv.color,cursor:"pointer",fontFamily:"'General Sans',system-ui"}}>
                  {pv.icon} {pv.label}
                </button>
              ))}
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:2,fontWeight:700,letterSpacing:1}}>РАЗРЕШЕНИЯ</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {Object.keys(PERMISSIONS).map(pk=>(
                <PermToggle key={pk} permKey={pk} value={!!customPerms[pk]} onChange={v=>setCustomPerms(p=>({...p,[pk]:v}))}/>
              ))}
            </div>
            <button onClick={saveEdit} style={{background:"linear-gradient(135deg,#b8965a,#9a7d4a)",color:"#09090b",border:"none",borderRadius:14,padding:"14px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'General Sans',system-ui",marginTop:6}}>
              💾 Сохранить права
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
// ─── ПУБЛИЧНЫЙ КАТАЛОГ ────────────────────────────────────────────────────────
const PUBLIC_PRODUCTS = [
  { id:"greenawn",   name:"Биоклиматическая пергола Greenawn",  tag:"Эксклюзив РК · Villa 2.0",     price:250000, color:"#2d7a4f", emoji:"🌿",
    desc:"Поворотные алюминиевые ламели 0–135°, автоматизация Somfy, водосток в колоннах. Работает в любую погоду.",
    features:["Поворот ламелей 0–135°","Автоматизация Somfy","Водосток в колоннах","Алюминий 6063-T6","Сертификат CE"],
    options:["LED подсветка","Инфракрасный обогреватель","Zip-шторы по периметру"] },
  { id:"igs_premium",name:"Биоклиматическая пергола IGS Premium",tag:"Поворотно-сдвижная",          price:280000, color:"#1a5276", emoji:"⭐",
    desc:"Ламели поворачиваются и сдвигаются в сторону, полностью открывая небо. Утеплённые пенные ламели для герметичности.",
    features:["Поворотно-сдвижная система","Утеплённые ламели","Герметичная конструкция","Макс. ширина 12м"],
    options:["LED подсветка","Инфракрасный обогреватель"] },
  { id:"toscana",    name:"Тентовая пергола Toscana",           tag:"Pergotek · Европейский дизайн",price:130000, color:"#7d6608", emoji:"⛺",
    desc:"Выдвижная ПВХ-крыша итальянского производства. Проекция до 13.5 м. Элегантный дизайн для террас и кафе.",
    features:["Выдвижная ПВХ-крыша","Проекция до 13.5м","Алюминиевый каркас","Итальянский дизайн"],
    options:["LED подсветка","Моторизация"] },
  { id:"sliding",    name:"Слайдинг",                           tag:"Панорамное остекление",         price:100000, color:"#1a6b8a", emoji:"🪟",
    desc:"Раздвижное панорамное остекление. Стеклянные панели складываются в сторону, полностью открывая пространство.",
    features:["2–4 секции","Одинарное/двойное стекло","Алюминиевый профиль","Бесшумное движение"],
    options:["Двойное остекление"] },
  { id:"guillotine", name:"Гильотина",                          tag:"Автоматизированная",            price:200000, color:"#6c3483", emoji:"🔳",
    desc:"Стеклянные секции поднимаются вертикально вверх. Цепной привод, ламинированное стекло, полная автоматизация.",
    features:["2–3 секции","Цепной привод","Ламинированное стекло","Автоматизация с пультом"],
    options:["Автоматизация"] },
  { id:"zip",        name:"Zip-шторы",                          tag:"Ветрозащита",                   price:75000,  color:"#784212", emoji:"🌬️",
    desc:"Защита от ветра до 180 км/ч. Ткань Dickson опускается по боковым направляющим. Защита от солнца, ветра и насекомых.",
    features:["Ветрозащита до 180 км/ч","Защита от насекомых","Ткань Dickson","Кассетная система"],
    options:["Моторизация","Москитная сетка"] },
  { id:"marquise",   name:"Маркизы",                            tag:"Мобильное затенение",           price:100000, color:"#1e8449", emoji:"☂️",
    desc:"Мобильное решение для затенения террас и балконов. Компактно складывается к стене. Ручное или моторизированное управление.",
    features:["Мобильная установка","Различные ткани","Ручное/моторизированное","Компактное хранение"],
    options:["Моторизация"] },
];

function PublicCatalog() {
  const [selected, setSelected] = useState(null);
  const [media, setMedia] = useState({});
  const product = PUBLIC_PRODUCTS.find(p=>p.id===selected);

  useEffect(()=>{
    // Загружаем медиа из Firebase
    import("./firebase.js").then(({dbGet,dbListen})=>{
      dbGet("catalog_media").then(data=>{
        if(data&&typeof data==="object") setMedia(data);
      });
      dbListen("catalog_media",(data)=>{
        if(data&&typeof data==="object") setMedia(data);
      });
    });
  },[]);

  const fmt = n => new Intl.NumberFormat("ru-KZ").format(n)+" ₸";
  const isVideo = url => url&&(url.includes(".mp4")||url.includes(".mov")||url.includes(".webm"));

  const bioProducts = PUBLIC_PRODUCTS.filter(p=>p.id==="greenawn"||p.id==="igs_premium");
  const otherProducts = PUBLIC_PRODUCTS.filter(p=>p.id!=="greenawn"&&p.id!=="igs_premium");

  return(
    <div style={{minHeight:"100vh",background:"#09090b",color:"#f4f4f5",fontFamily:"'General Sans',system-ui,sans-serif"}}>
      {/* Хедер */}
      <div style={{background:"linear-gradient(135deg,#0f1a0f,#0a0f0a)",borderBottom:"1px solid rgba(184,150,90,0.15)",padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:24,fontWeight:800,fontFamily:"'Instrument Serif',Georgia,serif",color:"#b8965a"}}>IGS Outdoor</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>Перголы · Остекление · Защита от солнца · Алматы</div>
        </div>
        <a href="https://wa.me/77075771234" target="_blank" rel="noreferrer"
          style={{display:"flex",alignItems:"center",gap:8,background:"rgba(90,154,106,0.15)",color:"#5a9a6a",border:"1px solid rgba(90,154,106,0.25)",borderRadius:10,padding:"9px 16px",textDecoration:"none",fontSize:13,fontWeight:600}}>
          💬 Написать в WhatsApp
        </a>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 16px"}}>
        {/* Дисклеймер */}
        <div style={{background:"rgba(184,150,90,0.06)",border:"1px solid rgba(184,150,90,0.15)",borderRadius:12,padding:"12px 16px",marginBottom:28,fontSize:13,color:"rgba(255,255,255,0.5)",textAlign:"center"}}>
          ⚠️ Все цены указаны за м² и являются ориентировочными. Итоговая стоимость зависит от площади, комплектации и монтажа. Точный расчёт — после замера.
        </div>

        {/* Биоклиматические перголы */}
        <div style={{marginBottom:32}}>
          <div style={{fontSize:11,color:"rgba(184,150,90,0.7)",fontWeight:700,letterSpacing:2,marginBottom:14,textTransform:"uppercase"}}>🌿 Биоклиматические перголы</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
            {bioProducts.map(p=><PublicCard key={p.id} p={p} media={media[p.id]} onClick={()=>setSelected(p.id)} fmt={fmt} isVideo={isVideo}/>)}
          </div>
        </div>

        {/* Остальные */}
        <div>
          <div style={{fontSize:11,color:"rgba(184,150,90,0.7)",fontWeight:700,letterSpacing:2,marginBottom:14,textTransform:"uppercase"}}>🏗️ Остальные конструкции</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
            {otherProducts.map(p=><PublicCard key={p.id} p={p} media={media[p.id]} onClick={()=>setSelected(p.id)} fmt={fmt} isVideo={isVideo}/>)}
          </div>
        </div>

        {/* Футер */}
        <div style={{textAlign:"center",padding:"40px 0 20px",color:"rgba(255,255,255,0.2)",fontSize:12}}>
          📍 Шоурум: ул. Сагдат Нурмагамбетова 140/10 · Ежедневно 9:00–22:00
        </div>
      </div>

      {/* Детальная карточка */}
      {product&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,overflowY:"auto"}}>
          <div style={{minHeight:"100%",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px"}}>
            <div style={{background:"#111",borderRadius:16,width:"100%",maxWidth:560,fontFamily:"'General Sans',system-ui",border:"1px solid rgba(255,255,255,0.08)"}}>
              {/* Header */}
              <div style={{padding:"18px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:16,fontWeight:700,color:"#f4f4f5",fontFamily:"'Instrument Serif',Georgia,serif"}}>{product.emoji} {product.name}</div>
                <button onClick={()=>setSelected(null)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"rgba(255,255,255,0.5)"}}>✕</button>
              </div>

              <div style={{padding:"18px 20px",display:"flex",flexDirection:"column",gap:14}}>
                {/* Медиагалерея */}
                {media[product.id]?.urls?.length>0&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {media[product.id].urls.slice(0,6).map((url,i)=>(
                      <div key={i} style={{borderRadius:10,overflow:"hidden",background:"#1a1a1a",aspectRatio:"4/3"}}>
                        {isVideo(url)?(
                          <video src={url} controls style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                        ):(
                          <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.parentElement.style.display="none";}}/>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Цена */}
                <div style={{background:`${product.color}15`,border:`1px solid ${product.color}25`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4}}>Цена от</div>
                  <div style={{fontSize:28,fontWeight:800,color:product.color,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(product.price)}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>за м² · цена ориентировочная</div>
                </div>

                {/* Описание */}
                <div style={{fontSize:14,color:"rgba(255,255,255,0.6)",lineHeight:1.7}}>{product.desc}</div>

                {/* Преимущества */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",letterSpacing:1.5,marginBottom:10,textTransform:"uppercase"}}>Преимущества</div>
                  {product.features.map(f=>(
                    <div key={f} style={{display:"flex",gap:9,marginBottom:8,alignItems:"flex-start"}}>
                      <span style={{color:product.color,flexShrink:0}}>✓</span>
                      <span style={{fontSize:14,color:"rgba(255,255,255,0.7)"}}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Доп. опции */}
                {product.options?.length>0&&(
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",letterSpacing:1.5,marginBottom:10,textTransform:"uppercase"}}>Доп. опции</div>
                    {product.options.map(o=>(
                      <div key={o} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                        <span style={{color:product.color,fontSize:12}}>+</span>
                        <span style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>{o}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <a href={`https://wa.me/77075771234?text=${encodeURIComponent(`Здравствуйте! Интересует ${product.name}. Хотел бы узнать подробнее.`)}`}
                  target="_blank" rel="noreferrer"
                  style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"rgba(90,154,106,0.15)",color:"#5a9a6a",border:"1px solid rgba(90,154,106,0.25)",borderRadius:12,padding:"14px",fontWeight:700,fontSize:15,textDecoration:"none",marginTop:4}}>
                  💬 Узнать цену в WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PublicCard({p, media, onClick, fmt, isVideo}) {
  const hasMedia = media?.urls?.length>0;
  const firstImg = hasMedia ? media.urls.find(u=>!isVideo(u)) : null;
  return(
    <div onClick={onClick} style={{background:"#111",border:`1px solid rgba(255,255,255,0.07)`,borderLeft:`3px solid ${p.color}`,borderRadius:12,overflow:"hidden",cursor:"pointer",transition:"all 0.2s"}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=p.color;e.currentTarget.style.transform="translateY(-2px)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";e.currentTarget.style.transform="none";}}>
      {firstImg&&(
        <div style={{height:180,overflow:"hidden"}}>
          <img src={firstImg} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover",transition:"transform 0.3s"}}
            onError={e=>{e.target.parentElement.style.display="none";}}/>
        </div>
      )}
      {!firstImg&&(
        <div style={{height:100,background:`${p.color}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40}}>
          {p.emoji}
        </div>
      )}
      <div style={{padding:"14px 16px"}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:4}}>{p.tag}</div>
        <div style={{fontSize:16,fontWeight:700,color:"#f4f4f5",marginBottom:8}}>{p.name}</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:12,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.desc}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:p.color,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(p.price)}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginTop:1}}>за м² · ориентировочно</div>
          </div>
          <div style={{background:`${p.color}20`,color:p.color,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600}}>Подробнее →</div>
        </div>
      </div>
    </div>
  );
}


export default function App() {
  // Публичный каталог — без логина
  if(window.location.pathname==="/catalog"||window.location.search.includes("catalog=1")) {
    return <PublicCatalog/>;
  }

  const [session,setSession]=useState(()=>getSession());
  const [showUM,setShowUM]=useState(false);
  const [ready,setReady]=useState(false);

  // Загрузить юзеров из Firebase при старте
  useEffect(()=>{
    (async()=>{
      try {
        const fbUsers = await dbGet("users");
        if(fbUsers && typeof fbUsers === "object") {
          // Мержим: Firebase + локальные (Firebase приоритет)
          const local = getUsers();
          const merged = {...local, ...fbUsers};
          localStorage.setItem(USERS_KEY, JSON.stringify(merged));
          // Если в Firebase нет дефолтного юзера — загружаем
          if(!fbUsers.zhan) {
            await dbSet("users", merged);
          }
        } else {
          // Firebase пуст — загружаем локальных
          await dbSet("users", getUsers());
        }
      } catch(e) { console.error("Users sync error:", e); }
      setReady(true);
    })();
    // Слушаем изменения юзеров в реальном времени
    const unsub = dbListen("users", (data) => {
      if(data && typeof data === "object") {
        localStorage.setItem(USERS_KEY, JSON.stringify(data));
      }
    });
    return unsub;
  },[]);

  function handleLogin(s){ setSession(s); }
  function handleLogout(){ clearSession(); setSession(null); }

  if(!ready) return(
    <div style={{minHeight:"100vh",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      <div style={{fontSize:44}}>🌿</div>
      <div style={{color:"#b8965a",fontFamily:"'Instrument Serif',Georgia,serif",fontSize:20,fontWeight:800}}>IGS Outdoor CRM</div>
      <div style={{color:"rgba(255,255,255,0.25)",fontSize:13}}>Подключение…</div>
    </div>
  );

  if(!session) return <LoginScreen onLogin={handleLogin}/>;
  return (
    <>
      <CRM currentUser={session} onShowUserManager={session.role==="admin"?()=>setShowUM(true):null} onLogout={handleLogout}/>
      {showUM&&<UserManager currentUser={session} onClose={()=>setShowUM(false)}/>}
    </>
  );
}
