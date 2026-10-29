import { decodeSharedDesign, encodeSharedDesign, type DesignDocument } from "@/stores/planner-store";

const key = "rama-saved-rooms-v1";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export type SavedRoom = { id: string; title: string; updatedAt: string; payload: string };

export function readSavedRooms(storage: StorageAccess): SavedRoom[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((room): room is SavedRoom => !!room && typeof room.id === "string" && typeof room.title === "string" && typeof room.updatedAt === "string" && typeof room.payload === "string" && decodeSharedDesign(room.payload) !== null);
  } catch { return []; }
}

export function saveRoomSnapshot(storage: StorageAccess, design: DesignDocument): SavedRoom[] {
  const rooms = readSavedRooms(storage);
  const title = design.title.trim() || "My decorated room";
  const previous = rooms.find(room => room.title === title);
  const saved: SavedRoom = { id: previous?.id ?? crypto.randomUUID(), title, updatedAt: new Date().toISOString(), payload: encodeSharedDesign(design) };
  const next = [saved, ...rooms.filter(room => room.id !== saved.id)];
  storage.setItem(key, JSON.stringify(next));
  return next;
}

export function deleteRoomSnapshot(storage: StorageAccess, id: string): SavedRoom[] {
  const next = readSavedRooms(storage).filter(room => room.id !== id);
  storage.setItem(key, JSON.stringify(next));
  return next;
}

/** Export the exact browser-local showroom layouts. GLB binaries are separate. */
export function exportSavedRoomArchive(storage: StorageAccess, currentDesign?: DesignDocument): string {
  const rooms = readSavedRooms(storage);
  if (currentDesign?.items.length && !rooms.some(room => room.payload === encodeSharedDesign(currentDesign))) {
    rooms.unshift({
      id: crypto.randomUUID(),
      title: currentDesign.title.trim() || "Current decorated room",
      updatedAt: new Date().toISOString(),
      payload: encodeSharedDesign(currentDesign),
    });
  }
  return JSON.stringify({ format: "furniture-rama-saved-rooms", version: 1, rooms }, null, 2);
}

/** Safely merge an exported showroom package without deleting existing rooms. */
export function importSavedRoomArchive(storage: StorageAccess, raw: string): { imported: number; total: number } {
  if (raw.length > 8_000_000) throw new Error("This showroom file is too large.");
  const doc: unknown = JSON.parse(raw);
  if (!doc || typeof doc !== "object" || !("format" in doc) || doc.format !== "furniture-rama-saved-rooms" || !("version" in doc) || doc.version !== 1 || !("rooms" in doc) || !Array.isArray(doc.rooms)) {
    throw new Error("Select a Furniture Rama showroom backup (.json).");
  }
  const oldRooms = readSavedRooms(storage);
  const existing = new Set(oldRooms.map(room => room.id));
  const rooms = [...oldRooms];
  let imported = 0;
  for (const candidate of doc.rooms.slice(0, 120)) {
    if (!candidate || typeof candidate !== "object") continue;
    const room = candidate as Partial<SavedRoom>;
    if (typeof room.id !== "string" || typeof room.title !== "string" || typeof room.updatedAt !== "string" || typeof room.payload !== "string") continue;
    if (room.title.length > 160 || room.payload.length > 100_000 || !decodeSharedDesign(room.payload)) continue;
    if (existing.has(room.id)) continue;
    rooms.push({ id: room.id, title: room.title, updatedAt: room.updatedAt, payload: room.payload });
    existing.add(room.id);
    imported++;
  }
  storage.setItem(key, JSON.stringify(rooms));
  return { imported, total: rooms.length };
}
