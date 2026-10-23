"use client";

// Trial-only furniture assets. Keep large GLBs in the browser instead of
// bundling them into every Vercel deployment or exposing them as public uploads.
const DATABASE = "rama-trial-furniture";
const OBJECT_STORE = "glb-files";
const VERSION = 2;
const UPLOAD_STORE = "uploaded-models";

export const trialModelIds = [
  "trial-office-chair",
  "trial-seat",
  "trial-dining-table",
  "trial-conference-table",
  "trial-white-seat",
  "trial-couch",
] as const;

export type TrialModelId = (typeof trialModelIds)[number];

export type UploadedTrialModel = {
  id: string;
  name: string;
  kind: "chair" | "sofa" | "table" | "bed" | "cabinet";
  width: number;
  depth: number;
  height: number;
  fileName: string;
  createdAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Browser storage is unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
        request.result.createObjectStore(OBJECT_STORE);
      }
      if (!request.result.objectStoreNames.contains(UPLOAD_STORE)) {
        request.result.createObjectStore(UPLOAD_STORE, { keyPath: "id" });
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


/** Save the new catalogue entry and its GLB in one IndexedDB transaction. */
export async function addUploadedTrialModel(entry: UploadedTrialModel, glb: Blob): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([OBJECT_STORE, UPLOAD_STORE], "readwrite");
    tx.objectStore(OBJECT_STORE).put(glb, entry.id);
    tx.objectStore(UPLOAD_STORE).put(entry);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Unable to save the model")); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("The model upload could not be stored")); };
  });
}

/** Metadata only: blobs are fetched separately to avoid unnecessary memory use. */
export async function listUploadedTrialModels(): Promise<UploadedTrialModel[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(UPLOAD_STORE, "readonly");
    const request = tx.objectStore(UPLOAD_STORE).getAll();
    request.onsuccess = () => {
      const data = Array.isArray(request.result) ? request.result : [];
      resolve(data.filter((item): item is UploadedTrialModel =>
        typeof item?.id === "string" && item.id.startsWith("trial-upload-") &&
        typeof item.name === "string" && typeof item.kind === "string" &&
        Number.isFinite(item.width) && Number.isFinite(item.depth) && Number.isFinite(item.height)
      ).sort((a,b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to list trial furniture"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

/** Read the uploaded model without removing it from any saved room. */
export async function removeUploadedTrialModel(id: string): Promise<void> {
  if (!id.startsWith("trial-upload-")) throw new Error("Cannot remove built-in trial model");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([OBJECT_STORE, UPLOAD_STORE], "readwrite");
    tx.objectStore(OBJECT_STORE).delete(id);
    tx.objectStore(UPLOAD_STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Unable to remove model")); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Unable to remove model")); };
  });
}

export async function verifyGlb(file: File): Promise<boolean> {
  if (file.size < 32 || file.size > 100 * 1024 * 1024) return false;
  const header = new DataView(await file.slice(0, 12).arrayBuffer());
  return header.getUint32(0, true) === 0x46546c67 &&
    header.getUint32(4, true) === 2 &&
    header.getUint32(8, true) === file.size;
}
