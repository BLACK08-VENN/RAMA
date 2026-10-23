import type { RoomConfig } from "@/stores/planner-store";

export type ConferenceScreenConfig = {
  width: number;
  height: number;
  x: number;
  y: number;
};

// Positions are in metres; x is relative to the centre of the back wall
// and y is the height of the display's centre above the finished floor.
export const DEFAULT_CONFERENCE_SCREEN: ConferenceScreenConfig = {
  width: 1.45,
  height: 0.89,
  x: -2.72,
  y: 1.83,
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function screenLimits(room: Pick<RoomConfig, "width" | "height">, screenWidth: number, screenHeight: number) {
  const widthMax = Math.min(3.6, room.width - 0.32);
  const heightMax = Math.min(2.1, room.height - 0.42);
  const xLimit = Math.max(0, (room.width - screenWidth) / 2 - 0.14);
  const yMin = screenHeight / 2 + 0.3;
  const yMax = Math.max(yMin, room.height - screenHeight / 2 - 0.16);
  return { widthMax, heightMax, xLimit, yMin, yMax };
}

export function getConferenceScreen(
  room: Pick<RoomConfig, "width" | "height" | "conferenceScreen">,
  update: Partial<ConferenceScreenConfig> = {},
): ConferenceScreenConfig {
  const config = { ...DEFAULT_CONFERENCE_SCREEN, ...room.conferenceScreen, ...update };
  const width = clamp(config.width, 0.8, Math.min(3.6, room.width - 0.32));
  const height = clamp(config.height, 0.5, Math.min(2.1, room.height - 0.42));
  const limits = screenLimits(room, width, height);
  return {
    width,
    height,
    x: clamp(config.x, -limits.xLimit, limits.xLimit),
    y: clamp(config.y, limits.yMin, limits.yMax),
  };
}
