import * as THREE from "three";
import type { RoomConfig, WallSide } from "@/stores/planner-store";

export function isWallVisible(room: Pick<RoomConfig, "width" | "depth">, wall: WallSide, camera: THREE.Vector3) {
  return wall === "left" ? camera.x > -room.width / 2 : wall === "right" ? camera.x < room.width / 2 : wall === "back" ? camera.z > -room.depth / 2 : camera.z < room.depth / 2;
}

const tangents: Record<WallSide, THREE.Vector3> = {
  back: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(0, 0, 1),
  front: new THREE.Vector3(-1, 0, 0), left: new THREE.Vector3(0, 0, -1),
};

/** Project onto the room walls rather than locking the gesture to its starting wall. */
export function createWallDragProjection(room: Pick<RoomConfig, "width" | "depth">, wall: WallSide, origin: THREE.Vector3, grabbed: THREE.Vector3, camera: THREE.Vector3) {
  const alongOffset = origin.clone().sub(grabbed).dot(tangents[wall]);
  const heightOffset = origin.y - grabbed.y;
  const surfaces = (["back", "right", "front", "left"] as WallSide[]).map(side => {
    const horizontal = side === "back" || side === "front";
    const normal = horizontal ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const coordinate = (side === "back" || side === "left" ? -1 : 1) * ((horizontal ? room.depth : room.width) / 2 - .025);
    return { side, horizontal, plane: new THREE.Plane(normal, -coordinate), limit: (horizontal ? room.width : room.depth) / 2 };
  });
  return (ray: THREE.Ray): { wall: WallSide; position: THREE.Vector3 } | null => {
    let result: { wall: WallSide; position: THREE.Vector3 } | null = null;
    let nearest = Infinity;
    for (const surface of surfaces) {
      if (!isWallVisible(room, surface.side, camera) || Math.abs(ray.direction.dot(surface.plane.normal)) < .015) continue;
      const hit = ray.intersectPlane(surface.plane, new THREE.Vector3());
      if (!hit || Math.abs(surface.horizontal ? hit.x : hit.z) > surface.limit + .001) continue;
      const distance = hit.distanceToSquared(ray.origin);
      if (distance >= nearest) continue;
      nearest = distance;
      hit.addScaledVector(tangents[surface.side], alongOffset);
      hit.y += heightOffset;
      result = { wall: surface.side, position: hit };
    }
    return result;
  };
}
