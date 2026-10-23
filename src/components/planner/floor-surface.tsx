"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { RoomConfig } from "@/stores/planner-store";

// The only permitted indoor floor materials. Legacy saved floor names fall
// back to WoodFloor051 rather than exposing discontinued options.
const materialForName: Record<string, string> = {
  "Natural oak": "WoodFloor051",
  "Light ash": "WoodFloor070",
  "Warm walnut": "WoodFloor052",
  "Charcoal slate tiles": "Tiles140",
  "Black onyx": "Onyx010",
  "Fabric floor": "Fabric081C",
  "Conference Fabric026": "Fabric026",
  "Conference Carpet004": "Carpet004",
  "Conference Fabric027": "Fabric027",
  "Conference Carpet005": "Carpet005",
  "Conference Fabric022": "Fabric022",
};
type Maps = { color: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture };

export function FloorSurface({ room }: { room: RoomConfig }) {
  const id = materialForName[room.floorName] ?? "WoodFloor051";
  const [loaded, setLoaded] = useState<{ id: string; maps: Partial<Maps> } | null>(null);
  const invalidate = useThree(state => state.invalidate);

  useEffect(() => {
    let active = true;
    const owned = new Set<THREE.Texture>();
    const loader = new THREE.TextureLoader();
    const root = `/materials/ambientcg/${id}/`;
    // Load the visible colour texture first. A missing optional PBR map must
    // never prevent a chosen floor from appearing.
    loader.loadAsync(root + "Color.jpg")
      .then(async color => {
        if (!active) { color.dispose(); return; }
        owned.add(color);
        color.colorSpace = THREE.SRGBColorSpace;
        color.wrapS = color.wrapT = THREE.RepeatWrapping;
        color.minFilter = THREE.LinearMipmapLinearFilter;
        color.anisotropy = 8;
        setLoaded({ id, maps: { color } });
        invalidate();
        const optional = await Promise.all(
          ["NormalGL", "Roughness"].map(name => loader.loadAsync(root + name + ".jpg").catch(() => null))
        );
        const [normal, roughness] = optional;
        if (!active) { normal?.dispose(); roughness?.dispose(); return; }
        [normal, roughness].forEach(map => {
          if (!map) return;
          owned.add(map);
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.minFilter = THREE.LinearMipmapLinearFilter;
          map.anisotropy = 8;
        });
        setLoaded({ id, maps: { color, normal: normal ?? undefined, roughness: roughness ?? undefined } });
        invalidate();
      })
      .catch(error => console.warn("Floor colour image not available", id, error));
    return () => { active = false; owned.forEach(texture => texture.dispose()); };
  }, [id]);

  const maps = loaded?.id === id ? loaded.maps : null;
  const textureSize = id === "Tiles140" ? 2 : 2.5;
  useEffect(() => {
    if (!maps) return;
    for (const map of [maps.color, maps.normal, maps.roughness]) {
      if (!map) continue;
      map.repeat.set(room.width / textureSize, room.depth / textureSize);
      map.needsUpdate = true;
    }
  }, [maps, room.width, room.depth, textureSize]);

  return <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[room.width, room.depth]} />
    <meshStandardMaterial
      key={`${id}-${maps?.color ? "textured" : "fallback"}`}
      map={maps?.color ?? null}
      normalMap={maps?.normal ?? null}
      roughnessMap={maps?.roughness ?? null}
      normalScale={new THREE.Vector2(0.45, 0.45)}
      color={maps?.color ? "#ffffff" : room.floorColor}
      roughness={maps ? 1 : 0.75}
      metalness={0}
    />
  </mesh>;
}
