"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { RoomConfig } from "@/stores/planner-store";

export function FloorSurface({ room }: { room: RoomConfig }) {
  const tiled = room.floorName.endsWith(" tiles");
  const wooden = ["Natural oak", "Light ash", "Warm walnut"].includes(room.floorName);
  const large = room.floorName.startsWith("Large ");
  const texture = useMemo(() => {
    if ((!tiled && !wooden) || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = room.floorColor;
    context.fillRect(0, 0, 256, 256);
    // Seeded surface detail keeps the finish stable as room dimensions change.
    let seed = 17;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 1200; i++) {
      context.fillStyle = i % 2 ? "rgba(255,255,255,.045)" : "rgba(30,35,35,.035)";
      context.fillRect(random() * 256, random() * 256, 2, 2);
    }
    if (room.floorName === "Marble white tiles") {
      for (let i = 0; i < 5; i++) {
        context.beginPath();
        const x = random() * 256;
        context.moveTo(x, 0);
        context.bezierCurveTo(x - 80, 80, x + 80, 155, x - 20, 256);
        context.strokeStyle = i % 2 ? "rgba(153,142,128,.14)" : "rgba(116,128,132,.1)";
        context.lineWidth = i % 2 ? 1 : 3;
        context.stroke();
      }
    }
    if (room.floorName === "Sand terrazzo tiles") {
      const chips = ["#ad9780", "#f5ede1", "#c8b8a4", "#85796e"];
      for (let i = 0; i < 130; i++) {
        const x = random() * 250 + 3, y = random() * 250 + 3, size = random() * 3 + 1;
        context.beginPath(); context.moveTo(x, y); context.lineTo(x + size, y + 1); context.lineTo(x + 1, y + size);
        context.closePath(); context.fillStyle = chips[i % chips.length]; context.fill();
      }
    }
    if (wooden) {
      for (let row = 0; row < 4; row++) {
        const top = row * 64;
        context.fillStyle = row % 2 ? "rgba(62,35,13,.065)" : "rgba(255,241,203,.055)";
        context.fillRect(0, top, 256, 64);
        for (let grain = 0; grain < 85; grain++) {
          const y = top + random() * 61 + 1;
          context.beginPath(); context.moveTo(0, y);
          context.bezierCurveTo(85, y + random() * 4 - 2, 175, y + random() * 4 - 2, 256, y);
          context.strokeStyle = grain % 3 ? "rgba(70,39,18,.09)" : "rgba(255,240,211,.16)";
          context.lineWidth = random() * .6 + .25; context.stroke();
        }
        context.strokeStyle = "rgba(49,33,20,.3)"; context.lineWidth = 1;
        context.beginPath(); context.moveTo(0, top); context.lineTo(256, top);
        const joint = row % 2 ? 128 : 0;
        context.moveTo(joint, top); context.lineTo(joint, top + 64); context.stroke();
      }
    } else {
      context.strokeStyle = room.floorName === "Charcoal slate tiles" ? "#676865" : large ? "#c6c0b5" : "#b5afa5";
      context.lineWidth = large ? 1 : 3;
      context.strokeRect(0, 0, 256, 256);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    return map;
  }, [tiled, wooden, large, room.floorColor, room.floorName]);

  useEffect(() => () => { texture?.dispose(); }, [texture]);
  useEffect(() => {
    texture?.repeat.set(room.width / (wooden ? 1.8 : large ? 1.2 : .6), room.depth / (wooden ? .72 : large ? 1.2 : .6));
  }, [texture, room.width, room.depth, wooden, large]);
  const polished = large || room.floorName === "Marble white tiles";
  return <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[room.width, room.depth]} />
    <meshStandardMaterial key={room.floorName} map={texture} color={texture ? "#ffffff" : room.floorColor} roughness={polished ? .3 : tiled || wooden ? .65 : .92} metalness={polished ? .06 : 0} />
  </mesh>;
}
