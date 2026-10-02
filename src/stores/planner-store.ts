import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductKind } from "@/data/products";
import { findRoomPreset, matchRoomPreset } from "@/data/room-presets";

export type DoorConfig = {
  style?: "hinged" | "sliding";
  enabled: boolean;
  width: number;
  height: number;
  position: number;
};

export type WindowConfig = {
  style?: "picture" | "panoramic" | "arched";
  enabled: boolean;
  width: number;
  height: number;
  sillHeight: number;
  position: number;
};

export type OutdoorArea = { enabled: boolean; width: number; depth: number };

export type RoomConfig = {
  balcony?: OutdoorArea;
  yard?: OutdoorArea;
  chandelier?: "none" | "rings" | "globes";
  emptyShell?: boolean;
  presetId: string | null;
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  floorColor: string;
  floorName: string;
  door: DoorConfig;
  window: WindowConfig;
};

export type PlacedItem = {
  id: string;
  productId: string;
  kind: ProductKind;
  position: [number, number, number];
  rotation: [number, number, number];
};

const itemClearance: Record<ProductKind, number> = {
  sofa: 1.15,
  table: 0.9,
  chair: 0.4,
  cabinet: 0.5,
  bed: 1.1,
};

export const getOutdoorMetrics = (room: RoomConfig) => {
  const balconyDepth = room.balcony?.enabled ? room.balcony.depth : 0;
  const yardDepth = room.yard?.enabled ? room.yard.depth : 0;
  return { balconyDepth, yardDepth, centerZ: (balconyDepth + yardDepth) / 2,
    span: Math.max(room.width, room.depth + balconyDepth + yardDepth, room.balcony?.enabled ? room.balcony.width : 0, room.yard?.enabled ? room.yard.width : 0) };
};

export const getItemPlacementBounds = (room: RoomConfig, kind: ProductKind) => {
  const clearance = itemClearance[kind];
  return { maxX: Math.max(0, room.width / 2 - clearance), maxZ: Math.max(0, room.depth / 2 - clearance) };
};

export const clampItemPosition = (room: RoomConfig, kind: ProductKind, position: [number, number, number]): [number, number, number] => {
  const clearance = itemClearance[kind], { balconyDepth } = getOutdoorMetrics(room);
  const surfaces = [{ width: room.width, depth: room.depth, z: 0 }];
  if (room.balcony?.enabled) surfaces.push({ width: room.balcony.width, depth: room.balcony.depth, z: room.depth / 2 + room.balcony.depth / 2 });
  if (room.yard?.enabled) surfaces.push({ width: room.yard.width, depth: room.yard.depth, z: room.depth / 2 + balconyDepth + room.yard.depth / 2 });
  let best: [number, number, number] = [0, 0, 0], distance = Infinity;
  for (const surface of surfaces) {
    const halfX = Math.max(0, surface.width / 2 - clearance), halfZ = Math.max(0, surface.depth / 2 - clearance);
    const x = Math.max(-halfX, Math.min(halfX, position[0]));
    const z = Math.max(surface.z - halfZ, Math.min(surface.z + halfZ, position[2]));
    const delta = (x - position[0]) ** 2 + (z - position[2]) ** 2;
    if (delta < distance) { distance = delta; best = [x, 0, z]; }
  }
  return best;
};

export type DesignDocument = {
  version: 2;
  title: string;
  room: RoomConfig;
  items: PlacedItem[];
  updatedAt: string;
};

type PlannerState = {
  design: DesignDocument;
  selectedId: string | null;
  history: DesignDocument[];
  future: DesignDocument[];
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  selectItem: (id: string | null) => void;
  loadDesign: (design: DesignDocument) => void;
  renameDesign: (title: string) => void;
  updateRoom: (room: Partial<RoomConfig>) => void;
  applyRoomPreset: (presetId: string) => void;
  addItem: (item: PlacedItem) => void;
  removeItem: (id: string) => void;
  rotateItem: (id: string, radians?: number) => void;
  moveItem: (id: string, position: [number, number, number]) => void;
  undo: () => void;
  redo: () => void;
};

const initialDesign: DesignDocument = {
  version: 2,
  title: "Modern living room",
  room: {
    presetId: "standard-living",
    width: 4.8,
    depth: 3.5,
    height: 2.7,
    wallColor: "#f3f0e9",
    floorColor: "#d8b78e",
    floorName: "Natural oak",
    door: {
      enabled: true,
      width: 0.9,
      height: 2.1,
      position: 0.18,
    },
    window: {
      enabled: true,
      width: 1.5,
      height: 1.35,
      sillHeight: 0.85,
      position: 0.2,
    },
  },
  items: [
    {
      id: "delton-sofa-1",
      productId: "delton-sofa",
      kind: "sofa",
      position: [-1.2, 0, -0.8],
      rotation: [0, 0.18, 0],
    },
    {
      id: "austin-dining-1",
      productId: "austin-dining",
      kind: "table",
      position: [-1.05, 0, 0.6],
      rotation: [0, -0.08, 0],
    },
    {
      id: "file-cabinet-1",
      productId: "file-cabinet",
      kind: "cabinet",
      position: [1.85, 0, -1.18],
      rotation: [0, -0.05, 0],
    },
  ],
  updatedAt: "2026-09-25T00:00:00.000Z",
};

type PersistedRoom = Partial<Omit<RoomConfig, "door" | "window">> & {
  door?: Partial<DoorConfig>;
  window?: Partial<WindowConfig>;
};

type PersistedDesign = Omit<Partial<DesignDocument>, "room" | "version"> & {
  version?: number;
  room?: PersistedRoom;
};

const normalizeDesign = (design?: PersistedDesign): DesignDocument => {
  const room = {
    ...initialDesign.room,
    ...design?.room,
    door: { ...initialDesign.room.door, ...design?.room?.door },
    window: { ...initialDesign.room.window, ...design?.room?.window },
  };

  return {
    ...initialDesign,
    ...design,
    version: 2,
    room: {
      ...room,
      presetId:
        typeof room.presetId === "string" && findRoomPreset(room.presetId)
          ? room.presetId
          : matchRoomPreset(room)?.id ?? null,
    },
    items: design?.items ?? initialDesign.items,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);

const isValidOutdoorArea = (value: unknown) => value === undefined || (isRecord(value) && typeof value.enabled === "boolean" && isFiniteNumber(value.width) && (value.width as number) >= 2.5 && (value.width as number) <= 12 && isFiniteNumber(value.depth) && (value.depth as number) >= 1.5 && (value.depth as number) <= 12);

const isValidSharedDesign = (design: DesignDocument) => {
  const { room } = design;
  const validKinds: ProductKind[] = ["sofa", "table", "chair", "cabinet", "bed"];
  return (
    isValidOutdoorArea(room.balcony) && isValidOutdoorArea(room.yard) &&
    design.version === 2 &&
    typeof design.title === "string" &&
    design.title.trim().length > 0 &&
    design.title.length <= 120 &&
    typeof design.updatedAt === "string" &&
    (room.presetId === null || (typeof room.presetId === "string" && room.presetId.length <= 60)) &&
    isFiniteNumber(room.width) && room.width >= 2.5 && room.width <= 12 &&
    isFiniteNumber(room.depth) && room.depth >= 2.5 && room.depth <= 12 &&
    isFiniteNumber(room.height) && room.height >= 2.2 && room.height <= 4.5 &&
    typeof room.wallColor === "string" && room.wallColor.length <= 32 &&
    typeof room.floorColor === "string" && room.floorColor.length <= 32 &&
    typeof room.floorName === "string" && room.floorName.length <= 80 &&
    (room.chandelier === undefined || ["none", "rings", "globes"].includes(room.chandelier)) &&
    (room.emptyShell === undefined || typeof room.emptyShell === "boolean") &&
    (room.door.style === undefined || ["hinged", "sliding"].includes(room.door.style)) &&
    (room.window.style === undefined || ["picture", "panoramic", "arched"].includes(room.window.style)) &&
    typeof room.door.enabled === "boolean" &&
    isFiniteNumber(room.door.width) && room.door.width >= 0.7 && room.door.width <= 3.6 &&
    isFiniteNumber(room.door.height) && room.door.height >= 1.8 && room.door.height <= 2.5 &&
    isFiniteNumber(room.door.position) && Math.abs(room.door.position) <= 0.35 &&
    typeof room.window.enabled === "boolean" &&
    isFiniteNumber(room.window.width) && room.window.width >= 0.8 && room.window.width <= 5.5 &&
    isFiniteNumber(room.window.height) && room.window.height >= 0.6 && room.window.height <= 2.4 &&
    isFiniteNumber(room.window.sillHeight) && room.window.sillHeight >= 0.15 && room.window.sillHeight <= 1.4 &&
    isFiniteNumber(room.window.position) && Math.abs(room.window.position) <= 0.35 &&
    Array.isArray(design.items) &&
    design.items.length <= 100 &&
    design.items.every((item) =>
      isRecord(item) &&
      typeof item.id === "string" && item.id.length > 0 && item.id.length <= 120 &&
      typeof item.productId === "string" && item.productId.length > 0 && item.productId.length <= 120 &&
      validKinds.includes(item.kind as PlacedItem["kind"]) &&
      Array.isArray(item.position) && item.position.length === 3 && item.position.every(isFiniteNumber) &&
      Array.isArray(item.rotation) && item.rotation.length === 3 && item.rotation.every(isFiniteNumber),
    )
  );
};

export const encodeSharedDesign = (design: DesignDocument) => {
  const bytes = new TextEncoder().encode(JSON.stringify(design));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const decodeSharedDesign = (payload: string): DesignDocument | null => {
  if (payload.length === 0 || payload.length > 50_000 || !/^[A-Za-z0-9_-]+$/.test(payload)) {
    return null;
  }

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(parsed) || !isRecord(parsed.room) || !Array.isArray(parsed.items)) return null;
    const design = normalizeDesign(parsed as PersistedDesign);
    return isValidSharedDesign(design) ? design : null;
  } catch {
    return null;
  }
};

const clampItemsToRoom = (items: PlacedItem[], room: RoomConfig): PlacedItem[] =>
  items.map(item => ({ ...item, position: clampItemPosition(room, item.kind, item.position) }));

const withTimestamp = (design: DesignDocument): DesignDocument => ({
  ...design,
  updatedAt: new Date().toISOString(),
});

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => {
      const commit = (update: (design: DesignDocument) => DesignDocument) => {
        const current = get().design;
        const next = withTimestamp(update(current));
        set((state) => ({
          design: next,
          history: [...state.history.slice(-29), current],
          future: [],
        }));
      };

      return {
        design: initialDesign,
        selectedId: initialDesign.items[0].id,
        history: [],
        future: [],
        hydrated: false,
        setHydrated: (hydrated) => set({ hydrated }),
        selectItem: (selectedId) => set({ selectedId }),
        loadDesign: (design) => set({
          design: withTimestamp(design),
          selectedId: design.items[0]?.id ?? null,
          history: [],
          future: [],
        }),
        renameDesign: (title) => commit((design) => ({ ...design, title })),
        updateRoom: (room) => commit((design) => {
          const merged = { ...design.room, ...room };
          const nextRoom: RoomConfig = {
            ...merged,
            presetId:
              room.presetId !== undefined
                ? room.presetId
                : matchRoomPreset(merged)?.id ?? null,
          };
          return {
            ...design,
            room: nextRoom,
            items: clampItemsToRoom(design.items, nextRoom),
          };
        }),
        applyRoomPreset: (presetId) => commit((design) => {
          const preset = findRoomPreset(presetId);
          if (!preset) return design;
          const nextRoom: RoomConfig = {
            presetId: preset.id,
            balcony: preset.balcony ? { ...preset.balcony } : undefined,
            yard: preset.yard ? { ...preset.yard } : undefined,
            chandelier: preset.chandelier ?? "none",
            emptyShell: preset.empty ?? false,
            width: preset.width,
            depth: preset.depth,
            height: preset.height,
            wallColor: preset.wallColor,
            floorColor: preset.floorColor,
            floorName: preset.floorName,
            door: { ...preset.door },
            window: { ...preset.window },
          };
          return {
            ...design,
            room: nextRoom,
            items: preset.empty ? [] : clampItemsToRoom(design.items, nextRoom),
          };
        }),
        addItem: (item) => {
          commit((design) => ({ ...design, items: [...design.items, item] }));
          set({ selectedId: item.id });
        },
        removeItem: (id) => {
          commit((design) => ({
            ...design,
            items: design.items.filter((item) => item.id !== id),
          }));
          set((state) => ({ selectedId: state.selectedId === id ? null : state.selectedId }));
        },
        rotateItem: (id, radians = Math.PI / 4) => commit((design) => ({
          ...design,
          items: design.items.map((item) =>
            item.id === id
              ? { ...item, rotation: [item.rotation[0], item.rotation[1] + radians, item.rotation[2]] }
              : item,
          ),
        })),
        moveItem: (id, position) => commit((design) => ({
          ...design,
          items: design.items.map((item) => item.id === id ? { ...item, position } : item),
        })),
        undo: () => {
          const { history, design, selectedId } = get();
          const previous = history.at(-1);
          if (!previous) return;
          set({
            design: previous,
            selectedId: previous.items.some((item) => item.id === selectedId) ? selectedId : null,
            history: history.slice(0, -1),
            future: [design, ...get().future].slice(0, 30),
          });
        },
        redo: () => {
          const { future, design, selectedId } = get();
          const next = future[0];
          if (!next) return;
          set({
            design: next,
            selectedId: next.items.some((item) => item.id === selectedId) ? selectedId : null,
            history: [...get().history, design].slice(-30),
            future: future.slice(1),
          });
        },
      };
    },
    {
      name: "furniturerama-planner-design-v1",
      version: 2,
      partialize: (state) => ({ design: state.design }),
      migrate: (persistedState) => {
        const persisted = persistedState as { design?: PersistedDesign };
        return { ...persisted, design: normalizeDesign(persisted.design) };
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { design?: PersistedDesign };
        return {
          ...currentState,
          ...persisted,
          design: normalizeDesign(persisted.design),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.design.items.some((item) => item.id === state.selectedId)) {
          state.selectItem(state.design.items[0]?.id ?? null);
        }
        state.setHydrated(true);
      },
    },
  ),
);

