import type { RoomConfig, WallSide } from "@/stores/planner-store";

export type ConferenceScreenConfig = {
  width: number;
  height: number;
  x: number;
  y: number;
  wall?: WallSide;
};

// Positions are in metres; x is relative to the centre of the chosen wall
// and y is the height of the display's centre above the finished floor.
export const DEFAULT_CONFERENCE_SCREEN: ConferenceScreenConfig = {
  width: 1.45,
  height: 0.89,
  x: -2.72,
  y: 1.83,
  wall: "back",
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function screenLimits(room: Pick<RoomConfig, "width" | "depth" | "height">, screenWidth: number, screenHeight: number, wall: WallSide = "back") {
  const span = wall === "left" || wall === "right" ? room.depth : room.width;
  const widthMax = Math.min(3.6, span - 0.32);
  const heightMax = Math.min(2.1, room.height - 0.42);
  const xLimit = Math.max(0, (span - screenWidth) / 2 - 0.14);
  const yMin = screenHeight / 2 + 0.3;
  const yMax = Math.max(yMin, room.height - screenHeight / 2 - 0.16);
  return { widthMax, heightMax, xLimit, yMin, yMax };
}

export function getConferenceScreen(
  room: Pick<RoomConfig, "width" | "depth" | "height" | "conferenceScreen">,
  update: Partial<ConferenceScreenConfig> = {},
): ConferenceScreenConfig {
  const config = { ...DEFAULT_CONFERENCE_SCREEN, ...room.conferenceScreen, ...update };
  const wall = config.wall ?? "back";
  const span = wall === "left" || wall === "right" ? room.depth : room.width;
  const width = clamp(config.width, 0.8, Math.min(3.6, span - 0.32));
  const height = clamp(config.height, 0.5, Math.min(2.1, room.height - 0.42));
  const limits = screenLimits(room, width, height, wall);
  return {
    width,
    height,
    wall,
    x: clamp(config.x, -limits.xLimit, limits.xLimit),
    y: clamp(config.y, limits.yMin, limits.yMax),
  };
}

export function screenWorldPosition(room: Pick<RoomConfig, "width" | "depth">, screen: ConferenceScreenConfig): [number, number, number] {
  switch (screen.wall ?? "back") {
    case "right": return [room.width / 2 - .165, screen.y, screen.x];
    case "front": return [-screen.x, screen.y, room.depth / 2 - .165];
    case "left": return [-room.width / 2 + .165, screen.y, -screen.x];
    default: return [screen.x, screen.y, -room.depth / 2 + .165];
  }
}

export function screenWallX(wall: WallSide, point: readonly number[]) {
  return wall === "right" ? point[2] : wall === "left" ? -point[2] : wall === "front" ? -point[0] : point[0];
}

// Keep the opposite corner fixed, so stretching feels like grabbing the display.
export function stretchConferenceScreen(room: Pick<RoomConfig, "width" | "depth" | "height">, screen: ConferenceScreenConfig, corner: readonly [number, number], point: readonly [number, number]): ConferenceScreenConfig {
  const [sx, sy] = corner;
  const anchorX = screen.x - sx * screen.width / 2;
  const anchorY = screen.y - sy * screen.height / 2;
  const span = screen.wall === "left" || screen.wall === "right" ? room.depth : room.width;
  const widthMax = Math.min(3.6, sx > 0 ? span / 2 - .14 - anchorX : anchorX + span / 2 - .14);
  const heightMax = Math.min(2.1, sy > 0 ? room.height - .16 - anchorY : anchorY - .3);
  const width = clamp(sx * (point[0] - anchorX), .8, widthMax);
  const height = clamp(sy * (point[1] - anchorY), .5, heightMax);
  return { ...screen, width, height, x: anchorX + sx * width / 2, y: anchorY + sy * height / 2 };
}
