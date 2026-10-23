export type RoomPreset = {
  spaceType?: "indoor" | "balcony" | "garden";
  diningSink?: boolean;
  builtInStorage?: { enabled: boolean; width: number };
  balcony?: { enabled: boolean; width: number; depth: number };
  yard?: { enabled: boolean; width: number; depth: number };
  empty?: boolean;
  chandelier?: "none" | "rings" | "globes";
  id: string;
  name: string;
  description: string;
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  floorColor: string;
  floorName: string;
  door: {
    style?: "hinged" | "sliding";
    enabled: boolean;
    width: number;
    height: number;
    position: number;
  };
  window: {
    style?: "picture" | "panoramic" | "arched" | "grid-slider";
    enabled: boolean;
    width: number;
    height: number;
    sillHeight: number;
    position: number;
  };
};

export const roomPresets: RoomPreset[
  {
      id: "balcony", name: "Balcony", description: "Empty · independent timber deck with glass rails", empty: true, spaceType: "balcony",
      width: 5.4, depth: 2.8, height: 2.7, wallColor: "#eeeae3", floorColor: "#bca78a", floorName: "Natural oak",
      door: { enabled: false, width: .9, height: 2.1, position: 0 },
      window: { enabled: false, width: 1.5, height: 1.2, sillHeight: .85, position: 0 },
    },
  {
      id: "backyard-garden", name: "Backyard", description: "Empty · independent grass lawn for outdoor furniture", empty: true, spaceType: "garden",
      width: 7, depth: 5.5, height: 2.7, wallColor: "#eeeae3", floorColor: "#749455", floorName: "Grass lawn",
      door: { enabled: false, width: .9, height: 2.1, position: 0 },
      window: { enabled: false, width: 1.5, height: 1.2, sillHeight: .85, position: 0 },
    },
  {
      id: "standard-living",
      name: "Lounge / Standard room",
      description: "Everyday family lounge",
      width: 4.8,
      depth: 3.5,
      height: 2.7,
      wallColor: "#f3f0e9",
      floorColor: "#d8b78e",
      floorName: "Natural oak",
      door: { enabled: true, width: 0.9, height: 2.1, position: 0.18 },
      window: { enabled: true, width: 1.5, height: 1.35, sillHeight: 0.85, position: 0.2 },
    },
  {
      id: "master-bedroom",
      builtInStorage: { enabled: true, width: 2.4 },
      name: "Bedroom",
      description: "Suite with space to dress",
      width: 4.5,
      depth: 3.8,
      height: 2.7,
      wallColor: "#cbdcdc",
      floorColor: "#c8b79f",
      floorName: "Light ash",
      door: { enabled: true, width: 0.9, height: 2.1, position: 0.2 },
      window: { enabled: true, width: 1.6, height: 1.35, sillHeight: 0.85, position: 0.18 },
    },
  {
      id: "conference-room",
      name: "Conference room",
      description: "Spacious meeting room with panoramic daylight",
      empty: true,
      width: 7.2, depth: 5.4, height: 3.1,
      wallColor: "#e4ded2", floorColor: "#c8b79f", floorName: "Light ash",
      chandelier: "none",
      door: { enabled: true, style: "hinged", width: 1.2, height: 2.2, position: 0.1 },
      window: { enabled: true, style: "panoramic", width: 3.6, height: 1.75, sillHeight: 0.95, position: 0 },
    },
  {
      id: "dining-room",
      diningSink: true, chandelier: "globes",
      name: "Dining room",
      description: "Table-first space",
      width: 4.2,
      depth: 3.4,
      height: 2.7,
      wallColor: "#f3f0e9",
      floorColor: "#d8b78e",
      floorName: "Natural oak",
      door: { enabled: true, width: 0.9, height: 2.1, position: 0.15 },
      window: { enabled: true, width: 1.4, height: 1.3, sillHeight: 0.85, position: 0.2 },
    }

];

const dimensionTolerance = 0.02;

export const findRoomPreset = (presetId: string | null | undefined) =>
  roomPresets.find((preset) => preset.id === presetId) ?? null;

export const matchRoomPreset = (
  room: { width: number; depth: number; height: number },
  tolerance = dimensionTolerance,
) =>
  roomPresets.find(
    (preset) =>
      Math.abs(preset.width - room.width) <= tolerance &&
      Math.abs(preset.depth - room.depth) <= tolerance &&
      Math.abs(preset.height - room.height) <= tolerance,
  ) ?? null;

export const getRoomArea = (room: { width: number; depth: number }) => room.width * room.depth;

