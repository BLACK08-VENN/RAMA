"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomConfig } from "@/stores/planner-store";

export function FloorSurface({ room }: { room: RoomConfig }) {
  const maxAnisotropy = useThree(state => state.gl.capabilities.getMaxAnisotropy());
  const tiled = room.floorName.endsWith(" tiles") || room.floorName === "Marble white tiles";
  const wooden = ["Natural oak", "Light ash", "Warm walnut"].includes(room.floorName);
  const large = room.floorName.startsWith("Large ");
  const texture = useMemo(() => {
    if ((!tiled && !wooden) || typeof document === "undefined") return null;
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = room.floorColor;
    context.fillRect(0, 0, size, size);
    // Seeded surface detail keeps the finish stable as room dimensions change.
    let seed = 17;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 7200; i++) {
      context.fillStyle = i % 2 ? "rgba(255,255,255,.045)" : "rgba(30,35,35,.035)";
      context.fillRect(random() * size, random() * size, 2, 2);
    }
    if (room.floorName === "Marble white tiles") {
      for (let i = 0; i < 5; i++) {
        context.beginPath();
        const x = random() * size;
        context.moveTo(x, 0);
        context.bezierCurveTo(x - 80, 80, x + 80, 155, x - 20, size);
        context.strokeStyle = i % 2 ? "rgba(153,142,128,.14)" : "rgba(116,128,132,.1)";
        context.lineWidth = i % 2 ? 1 : 3;
        context.stroke();
      }
    }
    if (room.floorName === "Sand terrazzo tiles") {
      const chips = ["#ad9780", "#f5ede1", "#c8b8a4", "#85796e"];
      for (let i = 0; i < 520; i++) {
        const x = random() * (size - 6) + 3, y = random() * (size - 6) + 3, chip = random() * 3 + 1;
        context.beginPath(); context.moveTo(x, y); context.lineTo(x + chip, y + 1); context.lineTo(x + 1, y + chip);
        context.closePath(); context.fillStyle = chips[i % chips.length]; context.fill();
      }
    }
    if (wooden) {
      // Continuous timber boards at an architectural scale rather than repeating
      // thick horizontal bands. The tile is 3.2m wide x 2.4m deep and includes
      // staggered end joints; each plank is ~20cm wide.
      const boards = 12;
      const boardHeight = size / boards;
      const finish = room.floorName === "Warm walnut" ? 0.66 : room.floorName === "Light ash" ? 1.13 : 1;
      for (let row = 0; row < boards; row++) {
        const y0 = row * boardHeight;
        const shade = Math.floor((random() - .5) * 20);
        context.fillStyle = `rgba(115,83,54,${Math.max(.008,(.035 + shade / 900) / finish)})`;
        context.fillRect(0, y0 + 1.2, size, boardHeight - 2.4);
        // Hundreds of delicate, irregular fibres follow the board length, while
        // the base colour stays natural without contrasting stripes.
        for (let line = 0; line < 155; line++) {
          const y = y0 + 2 + random() * (boardHeight - 4);
          const x = random() * size;
          const length = 90 + random() * 440;
          context.beginPath();
          context.moveTo(x, y);
          context.bezierCurveTo(x + length * .25, y - 1.7 + random() * 3.4,
            x + length * .65, y - 1.4 + random() * 2.8,
            Math.min(size, x + length), y + random() * 2 - 1);
          context.strokeStyle = line % 3
            ? "rgba(74,52,35,.055)"
            : "rgba(255,248,227,.075)";
          context.lineWidth = .35 + random() * .65;
          context.stroke();
        }
        // Subtle seams and regularly staggered but unequal plank lengths.
        context.strokeStyle = "rgba(60,48,36,.24)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(0, y0 + .7);context.lineTo(size, y0 + .7);
        const offset = (row * 239 + 121) % size;
        const joint = 350 + (row * 173 % 260);
        for (let x = offset % joint; x < size; x += joint) {
          context.moveTo(x, y0 + 1);
          context.lineTo(x + (random() - .5) * 1.2, y0 + boardHeight - 1);
        }
        context.stroke();
      }
    } else {
      context.strokeStyle = room.floorName === "Charcoal slate tiles" ? "#636663" : large ? "rgba(123,113,99,.24)" : "rgba(106,100,92,.3)";
      context.lineWidth = large ? 1.2 : 2;
      context.strokeRect(0, 0, size, size);
    }
    // Surface normal/bump comes from the same stable texture coordinate system,
    // avoiding seams, independent UV drift or additional network textures.
    const map = new THREE.CanvasTexture(canvas);
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    // The floor is nearly always seen at a grazing angle, where trilinear filtering alone
    // smears the tile lines into mush. Anisotropy is what keeps them legible from standing height.
    map.anisotropy = maxAnisotropy;
    return map;
  }, [tiled, wooden, large, maxAnisotropy, room.floorColor, room.floorName]);

  useEffect(() => () => { texture?.dispose(); }, [texture]);
  useEffect(() => {
    texture?.repeat.set(room.width / (wooden ? 3.2 : large ? 1.2 : .6), room.depth / (wooden ? 2.4 : large ? 1.2 : .6));
  }, [texture, room.width, room.depth, wooden, large]);
  const polished = large || room.floorName === "Marble white tiles";
  const marble = room.floorName === "Marble white tiles";
  return <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[room.width, room.depth]} />
    <meshStandardMaterial
      key={room.floorName}
      map={texture}
      bumpMap={texture}
      bumpScale={wooden ? .0035 : marble ? .0009 : tiled ? .0017 : 0}
      color={texture ? "#ffffff" : room.floorColor}
      roughness={marble ? .26 : polished ? .33 : tiled ? .46 : wooden ? .59 : .88}
      metalness={polished ? .015 : 0}
      envMapIntensity={polished ? 0.9 : wooden ? .55 : 0.6}
    />
  </mesh>;
}
