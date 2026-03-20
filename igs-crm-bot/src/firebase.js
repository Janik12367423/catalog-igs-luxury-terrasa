import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, off } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// ─── Firebase Storage для каталога (отдельный проект) ────────────────────────
const catalogStorageConfig = {
  apiKey: "AIzaSyBhyfODbv1yBuDebcB26mpyuD-RHtq5qNw",
  authDomain: "catalog-photo-e2636.firebaseapp.com",
  projectId: "catalog-photo-e2636",
  storageBucket: "catalog-photo-e2636.firebasestorage.app",
  messagingSenderId: "7108248926",
  appId: "1:7108248926:web:f8d739ba2d85f51da7fbcf",
};

let catalogApp = null;
let catalogStorage = null;

try {
  catalogApp = initializeApp(catalogStorageConfig, "catalog");
  catalogStorage = getStorage(catalogApp);
} catch(e) {
  console.error("Catalog Storage error:", e);
}

export async function uploadCatalogFile(file, productId) {
  if (!catalogStorage) throw new Error("Storage не инициализирован");
  const ext = file.name.split(".").pop();
  const path = `catalog/${productId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const sRef = storageRef(catalogStorage, path);
  await uploadBytes(sRef, file);
  const url = await getDownloadURL(sRef);
  return url;
}

// ═══════════════════════════════════════════════════════════════════════════
// ВАЖНО: замени ТОЛЬКО значения в кавычках ниже на свои из Firebase Console
// НЕ вставляй сюда код из Firebase! Только значения между кавычками!
// ═══════════════════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyAs9o4Q7Td6sZ37E-qnBaNKi3bsD0Y8BAs",
  authDomain: "igs-crm-59901.firebaseapp.com",
  databaseURL: "https://igs-crm-59901-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "igs-crm-59901",
  storageBucket: "igs-crm-59901.firebasestorage.app",
  messagingSenderId: "160461403127",
  appId: "1:160461403127:web:1819c36739b7e0586a74f2",
  measurementId: "G-1HH187BK82"
};

let app = null;
let db = null;
let isFirebaseReady = false;

function isConfigured() {
  return !firebaseConfig.apiKey.startsWith("ВСТАВЬ");
}

try {
  if (isConfigured()) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    isFirebaseReady = true;
  }
} catch (e) {
  console.error("Firebase error:", e);
}

export async function dbSet(path, data) {
  try { localStorage.setItem("igs_fb_" + path, JSON.stringify(data)); } catch(_) {}
  if (isFirebaseReady && db) {
    try { await set(ref(db, path), data); return true; } catch (e) { return false; }
  }
  return true;
}

export async function dbGet(path, defaultValue = null) {
  if (isFirebaseReady && db) {
    try {
      const snapshot = await get(ref(db, path));
      if (snapshot.exists()) return snapshot.val();
      return defaultValue;
    } catch (e) { /* fallback below */ }
  }
  try {
    const cached = JSON.parse(localStorage.getItem("igs_fb_" + path) || "null");
    if (cached !== null) return cached;
  } catch (_) {}
  return defaultValue;
}

export function dbListen(path, callback) {
  if (isFirebaseReady && db) {
    const dbRef = ref(db, path);
    onValue(dbRef, (snapshot) => { if (snapshot.exists()) callback(snapshot.val()); });
    return () => off(dbRef);
  }
  return () => {};
}

export function isOnline() {
  return isFirebaseReady;
}

// ─── BOT LEADS ────────────────────────────────────────────────────────────────
export async function saveBotLead(lead) {
  return dbSet(`bot_leads/${lead.id}`, lead);
}

export async function getBotLeads() {
  const data = await dbGet("bot_leads", {});
  if (!data || typeof data !== "object") return [];
  return Object.values(data).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
