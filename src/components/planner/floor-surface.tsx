"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import type { RoomConfig } from "@/stores/planner-store";

// The only permitted indoor floor materials. Legacy saved floor names fall
// back to WoodFloor051 rather than exposing discontinued options.
const materialForName: Record<string, string> = {
  "Natural oak": "WoodFloor051",
  "Light ash": "WoodFloor070",
  "Warm walnut": "WoodFloor052",
  "Charcoal slate tiles": "Tiles140",
};
type Maps = { color: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture };

export function FloorSurface({ room }: { room: RoomConfig }) {
  const id = materialForName[room.floorName] ?? "WoodFloor051";
  const [loaded, setLoaded] = useState<{ id: string; maps: Maps } | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new THREE.TextureLoader();
    const root = `/materials/ambientcg/${id}/`;
    Promise.all(["Color", "NormalGL", "Roughness"].map(name => loader.loadAsync(root + name + ".jpg")))
      .then(([color, normal, roughness]) => {
        if (!active) { color.dispose(); normal.dispose(); roughness.dispose(); return; }
        color.colorSpace = THREE.SRGBColorSpace;
        [color, normal, roughness].forEach(map => {
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.minFilter = THREE.LinearMipmapLinearFilter;
          map.magFilter = THREE.LinearFilter;
          map.anisotropy = 8;
        });
        setLoaded({ id, maps: { color, normal, roughness } });
      })
      .catch(() => { if (active) setLoaded(null); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => () => {
    loaded?.maps.color.dispose();
    loaded?.maps.normal.dispose();
    loaded?.maps.roughness.dispose();
  }, [loaded]);

  const maps = loaded?.id === id ? loaded.maps : null;
  const textureSize = id === "Tiles140" ? 2 : 2.5;
  useEffect(() => {
    if (!maps) return;
    for (const map of [maps.color, maps.normal, maps.roughness]) {
      map.repeat.set(room.width / textureSize, room.depth / textureSize);
      map.needsUpdate = true;
    }
  }, [maps, room.width, room.depth, textureSize]);

  return <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[room.width, room.depth]} />
    <meshStandardMaterial
      map={maps?.color ?? null}
      normalMap={maps?.normal ?? null}
      roughnessMap={maps?.roughness ?? null}
      normalScale={new THREE.Vector2(0.45, 0.45)}
      color={maps ? "#ffffff" : "#c5b8a4"}
      roughness={maps ? 1 : 0.75}
      metalness={0}
    />
  </mesh>;
}
