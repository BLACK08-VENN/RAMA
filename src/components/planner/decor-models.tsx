"use client";

import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { PlacedItem } from "@/stores/planner-store";

function Rug({ round }: { round: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = round ? "#c8ad82" : "#e5ded0";
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) {
      ctx.strokeStyle = y % 4 ? "#b7a488" : "#f1e8d8";
      ctx.globalAlpha = .35;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#a3947c"; ctx.lineWidth = 3;
    for (let inset = 12; inset < 26; inset += 6) ctx.strokeRect(inset, inset, 256 - inset * 2, 256 - inset * 2);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [round]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group>
    <mesh receiveShadow position={[0, .016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {round ? <circleGeometry args={[1, 64]} /> : <planeGeometry args={[2.4, 1.6]} />}
      <meshStandardMaterial map={texture} roughness={1} side={THREE.DoubleSide} />
    </mesh>
    {!round && [-1, 1].map(side => Array.from({ length: 24 }, (_, i) => <mesh key={side + ":" + i} position={[side * 1.23, .015, -.76 + i * .066]}>
      <boxGeometry args={[.07, .012, .015]} /><meshStandardMaterial color="#e3d7c1" roughness={1} />
    </mesh>))}
  </group>;
}

function Plant({ tall }: { tall: boolean }) {
  return <group scale={tall ? 1 : .75}>
    <mesh castShadow position={[0, .22, 0]}><cylinderGeometry args={[.23, .18, .44, 24]} /><meshStandardMaterial color={tall ? "#ddd1bf" : "#b77a5b"} roughness={.9} /></mesh>
    <mesh position={[0, .445, 0]}><cylinderGeometry args={[.21, .21, .012, 24]} /><meshStandardMaterial color="#44372b" roughness={1} /></mesh>
    {Array.from({ length: tall ? 13 : 9 }, (_, i) => {
      const angle = i * 2.399, y = .65 + i * .062;
      return <group key={i} rotation={[0, angle, 0]}>
        <mesh castShadow position={[.12, y - .08, 0]} rotation={[0, 0, -.45]}><cylinderGeometry args={[.009, .012, .6, 6]} /><meshStandardMaterial color="#4d6332" /></mesh>
        <mesh castShadow position={[.24, y + .12, 0]} rotation={[0, 0, -.65]} scale={[.13, .3, .045]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={i % 3 ? "#4b7445" : "#72935c"} roughness={.8} /></mesh>
      </group>;
    })}
  </group>;
}

function Mirror() {
  return <group rotation={[-.08, 0, 0]}>
    <RoundedBox args={[.8, 1.8, .075]} radius={.18} smoothness={2} bevelSegments={2} position={[0, .94, 0]} castShadow><meshStandardMaterial color="#a98b53" metalness={.65} roughness={.3} /></RoundedBox>
    <RoundedBox args={[.73, 1.72, .018]} radius={.16} smoothness={2} bevelSegments={2} position={[0, .94, .045]}><meshStandardMaterial color="#a9c2c6" metalness={.85} roughness={.12} /></RoundedBox>
    <mesh position={[.16, 1.1, .057]} rotation={[0, 0, -.22]}><planeGeometry args={[.065, 1.35]} /><meshBasicMaterial color="#eef5f1" transparent opacity={.3} /></mesh>
    <mesh position={[0, .03, -.18]}><boxGeometry args={[.65, .06, .45]} /><meshStandardMaterial color="#5d5448" /></mesh>
  </group>;
}

function Vase() {
  return <group>
    <mesh castShadow position={[0, .3, 0]} scale={[1, 1.45, 1]}><sphereGeometry args={[.2, 24, 16]} /><meshStandardMaterial color="#d8c7ae" roughness={.8} /></mesh>
    <mesh castShadow position={[0, .58, 0]}><cylinderGeometry args={[.07, .09, .18, 20, 1, true]} /><meshStandardMaterial color="#d8c7ae" side={THREE.DoubleSide} roughness={.8} /></mesh>
    {[-.18, 0, .18].map((x, i) => <group key={x} position={[x / 2, .6, 0]} rotation={[0, i, -x]}>
      <mesh position={[0, .35, 0]}><cylinderGeometry args={[.004, .005, .7, 6]} /><meshStandardMaterial color="#b29260" /></mesh>
      <mesh position={[0, .7, 0]} scale={[.045, .22, .045]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#c9b18a" roughness={1} /></mesh>
    </group>)}
  </group>;
}

export function DecorModel({ item }: { item: PlacedItem }) {
  if (item.kind === "plant") return <Plant tall={item.productId === "decor-tall-plant"} />;
  if (item.kind === "rug") return <Rug round={item.productId === "decor-round-rug"} />;
  if (item.kind === "mirror") return <Mirror />;
  return <Vase />;
}
