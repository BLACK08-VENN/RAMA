"use client";

// Trial-only furniture assets. Keep large GLBs in the browser instead of
// bundling them into every Vercel deployment or exposing them as public uploads.
const DATABASE = "rama-trial-furniture";
const OBJECT_STORE = "glb-files";
const VERSION = 1;

export const trialModelIds = [
  "trial-office-chair",
  "trial-seat",
  "trial-dining-table",
  "trial-conference-table",
  "trial-white-seat",
  "trial-couch",
] as const;

export type TrialModelId = (typeof trialModelIds)[number];

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Browser storage is unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
        request.result.createObjectStore(OBJECT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open model storage"));
  });
}

export async function saveTrialModel(id: TrialModelId, model: Blob): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OBJECT_STORE, "readwrite");
    transaction.objectStore(OBJECT_STORE).put(model, id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("Cannot save trial model")); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("Trial model storage was interrupted")); };
  });
}

export async function readTrialModel(id: TrialModelId): Promise<Blob | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OBJECT_STORE, "readonly");
    const request = transaction.objectStore(OBJECT_STORE).get(id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error("Cannot read trial model"));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

export async function verifyGlb(file: File): Promise<boolean> {
  if (file.size < 32 || file.size > 100 * 1024 * 1024) return false;
  const header = new DataView(await file.slice(0, 12).arrayBuffer());
  return header.getUint32(0, true) === 0x46546c67 &&
    header.getUint32(4, true) === 2 &&
    header.getUint32(8, true) === file.size;
}
