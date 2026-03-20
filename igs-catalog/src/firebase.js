import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, onValue } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// Firebase для медиа каталога
const storageConfig = {
  apiKey: "AIzaSyBhyfODbv1yBuDebcB26mpyuD-RHtq5qNw",
  authDomain: "catalog-photo-e2636.firebaseapp.com",
  projectId: "catalog-photo-e2636",
  storageBucket: "catalog-photo-e2636.firebasestorage.app",
  messagingSenderId: "7108248926",
  appId: "1:7108248926:web:f8d739ba2d85f51da7fbcf",
};

// Firebase для данных (медиа ссылки хранятся в основной БД)
const dbConfig = {
  apiKey: "AIzaSyAs9o4Q7Td6sZ37E-qnBaNKi3bsD0Y8BAs",
  authDomain: "igs-crm-59901.firebaseapp.com",
  databaseURL: "https://igs-crm-59901-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "igs-crm-59901",
  storageBucket: "igs-crm-59901.firebasestorage.app",
  messagingSenderId: "160461403127",
  appId: "1:160461403127:web:1819c36739b7e0586a74f2",
};

let dbApp = null, db = null;
let storageApp = null, storage = null;

try {
  dbApp = initializeApp(dbConfig, "db");
  db = getDatabase(dbApp);
} catch(e) { console.error("DB error:", e); }

try {
  storageApp = initializeApp(storageConfig, "storage");
  storage = getStorage(storageApp);
} catch(e) { console.error("Storage error:", e); }

export async function getCatalogMedia() {
  if (!db) return {};
  try {
    const snap = await get(ref(db, "catalog_media"));
    return snap.exists() ? snap.val() : {};
  } catch(e) { return {}; }
}

export function listenCatalogMedia(cb) {
  if (!db) return () => {};
  const r = ref(db, "catalog_media");
  onValue(r, snap => { if(snap.exists()) cb(snap.val()); });
  return () => {};
}

export async function uploadFile(file, productId) {
  if (!storage) throw new Error("Storage не инициализирован");
  const ext = file.name.split(".").pop();
  const path = `catalog/${productId}/${Date.now()}.${ext}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file);
  return await getDownloadURL(sRef);
}
