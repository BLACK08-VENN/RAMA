"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { productById } from "@/data/products";
import type { DecorSpec } from "@/data/decor-catalog";
import type { PlacedItem } from "@/stores/planner-store";

function useDecorTexture(spec: DecorSpec, art = false) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = art ? "#efe8d9" : spec.color;
    ctx.fillRect(0, 0, 256, 256);
    if (art && spec.style === "landscape") {
      ctx.fillStyle = spec.color; ctx.fillRect(0, 85, 256, 85);
      ctx.fillStyle = "#bba68b"; ctx.beginPath(); ctx.moveTo(0, 170); ctx.quadraticCurveTo(120, 115, 256, 160); ctx.lineTo(256, 256); ctx.lineTo(0, 256); ctx.fill();
      ctx.fillStyle = "#d6b98b"; ctx.beginPath(); ctx.arc(190, 60, 23, 0, Math.PI * 2); ctx.fill();
    } else if (art && spec.style === "botanical") {
      ctx.strokeStyle = "#62714f"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(125, 240); ctx.lineTo(125, 40); ctx.stroke();
      ctx.fillStyle = spec.color;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(i % 2 ? 100 : 150, 60 + i * 26, 17, 32, i % 2 ? -.7 : .7, 0, Math.PI * 2); ctx.fill(); }
    } else if (spec.style === "geometric" || (art && spec.style === "abstract")) {
      ctx.fillStyle = spec.color; ctx.beginPath(); ctx.arc(155, 110, 70, Math.PI, 0); ctx.lineTo(225, 230); ctx.lineTo(85, 230); ctx.fill();
      ctx.fillStyle = "#5c7168"; ctx.fillRect(25, 120, 45, 110);
      ctx.fillStyle = "#dfc5a3"; ctx.beginPath(); ctx.arc(85, 85, 45, 0, Math.PI * 2); ctx.fill();
    }
    if (!art || spec.style === "woven") {
      ctx.globalAlpha = .2;
      for (let y = 0; y < 256; y += 3) { ctx.strokeStyle = y % 2 ? "#fff7e4" : "#77654c"; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (spec.shape !== "round") { ctx.strokeStyle = "#a3947c"; ctx.lineWidth = 2; ctx.strokeRect(12, 12, 232, 232); }
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [spec, art]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Rug({ spec }: { spec: DecorSpec }) {
  const texture = useDecorTexture(spec);
  return <mesh receiveShadow position={[0, .018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    {spec.shape === "round" ? <circleGeometry args={[spec.width / 2, 40]} /> : <planeGeometry args={[spec.width, spec.depth]} />}
    <meshStandardMaterial map={texture} roughness={1} side={THREE.DoubleSide} />
  </mesh>;
}

function Plant({ spec }: { spec: DecorSpec }) {
  const hanging = spec.mount === "ceiling";
  const potY = hanging ? -.45 : .15;
  return <group scale={[spec.width, spec.height, spec.depth]}>
    {hanging && [-1, 1].map(side => <mesh key={side} position={[side * .13, -.19, 0]} rotation={[0, 0, side * -.55]}>
      <cylinderGeometry args={[.006, .006, .43, 6]} /><meshStandardMaterial color="#b5a082" roughness={1} />
    </mesh>)}
    <mesh castShadow position={[0, potY, 0]}><cylinderGeometry args={[.2, .15, hanging ? .24 : .3, 16]} /><meshStandardMaterial color={spec.style === "fern" ? "#b98564" : "#ddd1bf"} roughness={.9} /></mesh>
    <mesh position={[0, potY + (hanging ? .125 : .155), 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.18, 16]} /><meshStandardMaterial color="#44372b" side={THREE.DoubleSide} /></mesh>
    {Array.from({ length: spec.style === "palm" ? 12 : 9 }, (_, i) => {
      const angle = i * 2.399, trailing = hanging && spec.style === "trailing";
      const y = hanging ? -.52 - (trailing ? i * .048 : -.12) : .42 + i * (spec.style === "palm" ? .02 : .046);
      const snake = spec.style === "snake", succulent = spec.style === "succulent", palm = spec.style === "palm";
      return <group key={i} rotation={[0, angle, 0]}>
        {!succulent && !snake && <mesh position={[.1, hanging ? -.5 : .5, 0]} rotation={[0, 0, -.25]}><cylinderGeometry args={[.006, .008, hanging ? .2 : .42, 5]} /><meshStandardMaterial color="#506b3e" /></mesh>}
        <mesh castShadow position={[snake ? .09 + i * .008 : succulent ? .13 : .23, snake ? .62 : succulent ? .63 : y, 0]}
          rotation={[0, 0, snake ? -.08 : trailing ? .3 : -.65]} scale={[snake ? .035 : palm ? .055 : .13, snake ? .36 : succulent ? .28 : palm ? .32 : .19, .035]}>
          <sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color={i % 3 ? spec.color : "#91a878"} roughness={.9} />
        </mesh>
      </group>;
    })}
  </group>;
}

function mirrorShape(spec: DecorSpec, inset = 0) {
  const w = spec.width - inset * 2, h = spec.height - inset * 2, shape = new THREE.Shape();
  if (spec.shape === "round" || spec.shape === "oval") {
    shape.absellipse(0, 0, w / 2, h / 2, 0, Math.PI * 2, false, 0);
  } else if (spec.shape === "hexagon") {
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; if (i === 0) shape.moveTo(Math.cos(a) * w / 2, Math.sin(a) * h / 2); else shape.lineTo(Math.cos(a) * w / 2, Math.sin(a) * h / 2); }
  } else {
    shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2);
    if (spec.shape === "arch") { shape.lineTo(w / 2, h / 2 - w / 2); shape.absarc(0, h / 2 - w / 2, w / 2, 0, Math.PI, false); }
    else { shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); }
  }
  shape.closePath(); return shape;
}

function Mirror({ spec }: { spec: DecorSpec }) {
  const shapes = useMemo(() => [mirrorShape(spec), mirrorShape(spec, .012)], [spec]);
  return <group>
    <mesh><shapeGeometry args={[shapes[0], 24]} /><meshStandardMaterial color={spec.color} metalness={.6} roughness={.35} /></mesh>
    <mesh position={[0, 0, .008]}><shapeGeometry args={[shapes[1], 24]} /><meshStandardMaterial color="#b4cbd0" metalness={.7} roughness={.16} /></mesh>
    <mesh position={[spec.width * .15, 0, .01]} rotation={[0, 0, -.15]}><planeGeometry args={[spec.width * .05, spec.height * .55]} /><meshBasicMaterial color="#f2f6f1" transparent opacity={.4} /></mesh>
  </group>;
}

function WallArt({ spec }: { spec: DecorSpec }) {
  const texture = useDecorTexture(spec, true);
  return <group>
    <mesh><boxGeometry args={[spec.width, spec.height, .025]} /><meshStandardMaterial color={spec.style === "woven" ? "#b49976" : "#695340"} roughness={.8} /></mesh>
    <mesh position={[0, 0, .014]}><planeGeometry args={[spec.width - .025, spec.height - .025]} /><meshStandardMaterial map={texture} roughness={1} /></mesh>
  </group>;
}

function Vase() {
  return <group>
    <mesh castShadow position={[0, .3, 0]} scale={[1, 1.45, 1]}><sphereGeometry args={[.2, 16, 12]} /><meshStandardMaterial color="#d8c7ae" roughness={.8} /></mesh>
    <mesh position={[0, .58, 0]}><cylinderGeometry args={[.07, .09, .18, 12, 1, true]} /><meshStandardMaterial color="#d8c7ae" side={THREE.DoubleSide} roughness={.8} /></mesh>
    {[-.18, 0, .18].map((x, i) => <group key={x} position={[x / 2, .6, 0]} rotation={[0, i, -x]}>
      <mesh position={[0, .35, 0]}><cylinderGeometry args={[.004, .005, .7, 5]} /><meshStandardMaterial color="#b29260" /></mesh>
      <mesh position={[0, .7, 0]} scale={[.045, .22, .045]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#c9b18a" roughness={1} /></mesh>
    </group>)}
  </group>;
}

export function DecorModel({ item }: { item: PlacedItem }) {
  const spec = productById[item.productId]?.decor;
  if (!spec) return null;
  if (item.kind === "plant") return <Plant spec={spec} />;
  if (item.kind === "rug") return <Rug spec={spec} />;
  if (item.kind === "mirror") return <Mirror spec={spec} />;
  if (item.kind === "wall-art") return <WallArt spec={spec} />;
  return <Vase />;
}
