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
