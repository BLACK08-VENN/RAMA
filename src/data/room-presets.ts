export type RoomPreset = {
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
    style?: "picture" | "panoramic" | "arched";
    enabled: boolean;
    width: number;
    height: number;
    sillHeight: number;
    position: number;
  };
};

export const roomPresets: RoomPreset[] = [
  {
    id: "panoramic-loft", name: "Panoramic loft", description: "Empty · expansive glass & floating light rings", empty: true,
    width: 6.4, depth: 4.8, height: 3.4, wallColor: "#eeeae3", floorColor: "#c8b79f", floorName: "Light ash", chandelier: "rings",
    door: { enabled: true, style: "sliding", width: 2.4, height: 2.5, position: 0.05 },
    window: { enabled: true, style: "panoramic", width: 4.6, height: 2.4, sillHeight: 0.45, position: 0 },
  },
  {
    id: "arched-suite", name: "The arched suite", description: "Empty · sculptural arch & brass globe chandelier", empty: true,
    width: 5.2, depth: 4.1, height: 3.2, wallColor: "#e9dfd0", floorColor: "#8d6746", floorName: "Warm walnut", chandelier: "globes",
    door: { enabled: true, style: "hinged", width: 1.1, height: 2.4, position: 0.2 },
    window: { enabled: true, style: "arched", width: 2.2, height: 2.4, sillHeight: 0.45, position: 0 },
  },
  {
    id: "garden-lounge", name: "Garden lounge", description: "Empty · sliding glass & calm modern proportions", empty: true,
    width: 5.8, depth: 4.6, height: 3, wallColor: "#e4ede8", floorColor: "#d8b78e", floorName: "Natural oak", chandelier: "rings",
    door: { enabled: true, style: "sliding", width: 3, height: 2.5, position: 0 },
    window: { enabled: true, style: "panoramic", width: 3.8, height: 2.2, sillHeight: 0.45, position: 0 },
  },
  {
    id: "compact-lounge",
    name: "Compact lounge",
    description: "Apartment sitting area",
    width: 3.6,
    depth: 3.2,
    height: 2.5,
    wallColor: "#f3f0e9",
    floorColor: "#c8b79f",
    floorName: "Light ash",
    door: { enabled: true, width: 0.85, height: 2.05, position: 0.18 },
    window: { enabled: true, width: 1.2, height: 1.2, sillHeight: 0.85, position: 0.2 },
  },
  {
    id: "standard-living",
    name: "Standard living room",
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
    id: "family-lounge",
    name: "Family lounge",
    description: "Wide room for big seating",
    width: 5.6,
    depth: 4.4,
    height: 2.8,
    wallColor: "#e4ded2",
    floorColor: "#d8b78e",
    floorName: "Natural oak",
    door: { enabled: true, width: 0.95, height: 2.1, position: 0.15 },
    window: { enabled: true, width: 2, height: 1.5, sillHeight: 0.8, position: 0.18 },
  },
  {
    id: "open-plan",
    name: "Open plan living & dining",
    description: "One big space for both",
    width: 7.2,
    depth: 4.2,
    height: 2.9,
    wallColor: "#f3f0e9",
    floorColor: "#8d6746",
    floorName: "Warm walnut",
    door: { enabled: true, width: 1, height: 2.15, position: 0.12 },
    window: { enabled: true, width: 2.2, height: 1.6, sillHeight: 0.8, position: 0.2 },
  },
  {
    id: "master-bedroom",
    name: "Master bedroom",
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
    id: "guest-bedroom",
    name: "Guest bedroom",
    description: "Compact visitor room",
    width: 3.4,
    depth: 3.2,
    height: 2.5,
    wallColor: "#f3f0e9",
    floorColor: "#c8b79f",
    floorName: "Light ash",
    door: { enabled: true, width: 0.8, height: 2.05, position: 0.22 },
    window: { enabled: true, width: 1.1, height: 1.15, sillHeight: 0.9, position: 0.22 },
  },
  {
    id: "kids-bedroom",
    name: "Kids bedroom",
    description: "Playful small space",
    width: 3,
    depth: 2.8,
    height: 2.5,
    wallColor: "#b7b2a8",
    floorColor: "#d8b78e",
    floorName: "Natural oak",
    door: { enabled: true, width: 0.8, height: 2.05, position: 0.25 },
    window: { enabled: true, width: 1, height: 1.1, sillHeight: 0.9, position: 0.2 },
  },
  {
    id: "home-office",
    name: "Home office",
    description: "Desk and storage zone",
    width: 3.2,
    depth: 2.6,
    height: 2.5,
    wallColor: "#e4ded2",
    floorColor: "#8d6746",
    floorName: "Warm walnut",
    door: { enabled: true, width: 0.8, height: 2.05, position: 0.25 },
    window: { enabled: true, width: 1.1, height: 1.15, sillHeight: 0.85, position: 0.2 },
  },
  {
    id: "dining-room",
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
  },
  {
    id: "studio-apartment",
    name: "Studio apartment",
    description: "All-round single space",
    width: 5,
    depth: 4,
    height: 2.7,
    wallColor: "#e4ded2",
    floorColor: "#c8b79f",
    floorName: "Light ash",
    door: { enabled: true, width: 0.9, height: 2.1, position: 0.1 },
    window: { enabled: true, width: 1.8, height: 1.4, sillHeight: 0.85, position: 0.15 },
  },
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

