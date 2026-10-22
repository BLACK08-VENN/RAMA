"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getOutdoorMetrics, type RoomConfig } from "@/stores/planner-store";

export function OutdoorSpaces({ room }: { room: RoomConfig }) {
  const standalone = room.spaceType === "balcony" || room.spaceType === "garden";
  const grassWidth = room.spaceType === "garden" ? room.width : room.yard?.width;
  const grassDepth = room.spaceType === "garden" ? room.depth : room.yard?.depth;
  const grassEnabled = room.spaceType === "garden" || Boolean(room.yard?.enabled);
  const grass = useMemo(() => {
    if (!grassEnabled || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const c = canvas.getContext("2d"); if (!c) return null;
    c.fillStyle = "#749455"; c.fillRect(0, 0, 256, 256);
    let seed = 23;
    const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 6000; i++) { const x = random() * 256, y = random() * 256; c.strokeStyle = i % 2 ? "#92ac6b" : "#5e7e45"; c.lineWidth = .6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + random() * 2 - 1, y - random() * 4); c.stroke(); }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 2; return map;
  }, [grassEnabled]);
  useEffect(() => () => { grass?.dispose(); }, [grass]);
  useEffect(() => { grass?.repeat.set(grassWidth ?? 1, grassDepth ?? 1); }, [grass, grassWidth, grassDepth]);
  const { balconyDepth } = getOutdoorMetrics(room);
  const deck = room.spaceType === "balcony" ? { enabled: true, width: room.width, depth: room.depth } : room.balcony, yard = room.spaceType === "garden" ? { enabled: true, width: room.width, depth: room.depth } : room.yard;
  return <group>
    {deck?.enabled && <group position={[0, 0, standalone ? 0 : room.depth / 2 + deck.depth / 2]}>
      <mesh receiveShadow position={[0, -.09, 0]}><boxGeometry args={[deck.width, .18, deck.depth]} /><meshStandardMaterial color="#bca78a" roughness={.8} /></mesh>
      {Array.from({ length: Math.ceil(deck.width / .18) }, (_, i) => { const x = -deck.width / 2 + i * .18 + .09; return <mesh key={i} position={[Math.min(x, deck.width / 2 - .01), .002, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.004, deck.depth]} /><meshStandardMaterial color="#8b785f" roughness={.85} /></mesh>; })}
      {[-1, 1].map(side => <group key={side} position={[side * deck.width / 2, .55, 0]}>
        <mesh><boxGeometry args={[.025, 1.05, deck.depth]} /><meshStandardMaterial color="#c4e0dd" transparent opacity={.3} roughness={.16} metalness={.15} /></mesh>
        <mesh position={[0, .55, 0]}><boxGeometry args={[.05, .04, deck.depth]} /><meshStandardMaterial color="#414d49" metalness={.5} roughness={.3} /></mesh>
        {[-1, 1].map(end => <mesh key={end} position={[0, 0, end * deck.depth / 2]}><boxGeometry args={[.04, 1.1, .04]} /><meshStandardMaterial color="#414d49" metalness={.5} /></mesh>)}
      </group>)}
    </group>}
    {yard?.enabled && <group position={[0, 0, standalone ? 0 : room.depth / 2 + balconyDepth + yard.depth / 2]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[yard.width, yard.depth]} /><meshStandardMaterial color={grass ? "#ffffff" : "#749455"} map={grass} roughness={1} /></mesh>
      <mesh position={[0, -.12, 0]}><boxGeometry args={[yard.width, .2, yard.depth]} /><meshStandardMaterial color="#796b50" roughness={1} /></mesh>
      {[-1, 1].map(side => <mesh key={side} position={[side * yard.width / 2, -.025, 0]}><boxGeometry args={[.07, .08, yard.depth]} /><meshStandardMaterial color="#d0c6b1" roughness={.9} /></mesh>)}
      <mesh position={[0, -.025, yard.depth / 2]}><boxGeometry args={[yard.width, .08, .07]} /><meshStandardMaterial color="#d0c6b1" roughness={.9} /></mesh>
    </group>}
  </group>;
}
