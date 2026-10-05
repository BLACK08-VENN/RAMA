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
    // Fine crossed fibres and grain give fabric/canvas a tactile surface.
    ctx.globalAlpha = .08;
    for (let x = 0; x < 256; x += 3) { ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
    for (let i = 0; i < 1800; i++) { const x = (i * 73) % 256, y = (i * 137 + Math.floor(i / 256) * 19) % 256; ctx.fillStyle = i % 2 ? "#fff" : "#30281f"; ctx.fillRect(x, y, 1, 1); }
    ctx.globalAlpha = 1;
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [spec, art]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Rug({ spec }: { spec: DecorSpec }) {
  const texture = useDecorTexture(spec);
  const fibres = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, 128, 128);
    // A seamless weave repeats at a fixed physical scale on every rug size.
    for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) {
      const horizontal = (x / 8 + y / 8) % 2 === 0;
      const shade = 145 + ((x * 17 + y * 13) % 45);
      ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
      ctx.fillRect(x + 1, y + 1, horizontal ? 7 : 5, horizontal ? 5 : 7);
      ctx.fillStyle = "#626262";
      ctx.fillRect(x, y, 1, 8);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(spec.width * 3, (spec.shape === "round" ? spec.width : spec.depth) * 3);
    map.anisotropy = 4;
    return map;
  }, [spec.width, spec.depth, spec.shape]);
  const outline = useMemo(() => {
    const shape = new THREE.Shape();
    if (spec.shape === "round") {
      shape.absarc(0, 0, spec.width / 2, 0, Math.PI * 2, false);
    } else {
      const x = spec.width / 2, y = spec.depth / 2, r = .025;
      shape.moveTo(-x + r, -y); shape.lineTo(x - r, -y);
      shape.quadraticCurveTo(x, -y, x, -y + r); shape.lineTo(x, y - r);
      shape.quadraticCurveTo(x, y, x - r, y); shape.lineTo(-x + r, y);
      shape.quadraticCurveTo(-x, y, -x, y - r); shape.lineTo(-x, -y + r);
      shape.quadraticCurveTo(-x, -y, -x + r, -y);
    }
    return shape;
  }, [spec.width, spec.depth, spec.shape]);
  const surface = useMemo(() => {
    const geometry = new THREE.ShapeGeometry(outline, 48);
    const positions = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
    const depth = spec.shape === "round" ? spec.width : spec.depth;
    for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) / spec.width + .5, positions.getY(i) / depth + .5);
    return geometry;
  }, [outline, spec.width, spec.depth, spec.shape]);
  useEffect(() => () => { fibres.dispose(); surface.dispose(); }, [fibres, surface]);
  return <group rotation={[-Math.PI / 2, 0, 0]} position={[0, .008, 0]}>
    <mesh receiveShadow castShadow>
      <extrudeGeometry args={[outline, { depth: .009, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .003, bevelThickness: .003, curveSegments: 48 }]} />
      <meshStandardMaterial color={spec.color} roughness={1} />
    </mesh>
    <mesh receiveShadow position={[0, 0, .013]} geometry={surface}>
      <meshPhysicalMaterial map={texture} bumpMap={fibres} bumpScale={.006} roughness={1} sheen={.65} sheenColor={spec.color} sheenRoughness={1} />
    </mesh>
  </group>;
}

function createLeafGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row <= 10; row++) {
    const t = row / 10, width = Math.sin(Math.PI * t) * (.9 - t * .25);
    for (let column = 0; column < 3; column++) {
      positions.push((column - 1) * width, t * 2 - 1, Math.sin(t * Math.PI) * .22 - Math.abs(column - 1) * .09);
      uvs.push(column / 2, t);
    }
  }
  for (let row = 0; row < 10; row++) for (let column = 0; column < 2; column++) {
    const i = row * 3 + column; indices.push(i, i + 1, i + 3, i + 1, i + 4, i + 3);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function Plant({ spec }: { spec: DecorSpec }) {
  const hanging = spec.mount === "ceiling", potY = hanging ? -.45 : .15;
  const leaf = useMemo(() => createLeafGeometry(), []);
  const leafMap = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 128, 0);
    gradient.addColorStop(0, "#456a37"); gradient.addColorStop(.5, "#a3b87a"); gradient.addColorStop(1, "#4c753e");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#c1ce91"; ctx.globalAlpha = .45; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.stroke();
    for (let y = 12; y < 128; y += 14) { ctx.beginPath(); ctx.moveTo(10, y - 12); ctx.lineTo(64, y); ctx.lineTo(118, y - 12); ctx.stroke(); }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
  }, []);
  useEffect(() => () => { leaf.dispose(); leafMap.dispose(); }, [leaf, leafMap]);
  const count = spec.style === "palm" || spec.style === "fern" ? 10 : 14;
  return <group scale={[spec.width, spec.height, spec.depth]}>
    {hanging && [0, 1, 2].map(i => <mesh key={i} position={[Math.cos(i * 2.094) * .1, -.18, Math.sin(i * 2.094) * .1]} rotation={[0, i * 2.094, -.35]}>
      <cylinderGeometry args={[.004, .004, .5, 6]} /><meshStandardMaterial color="#b5a082" roughness={1} />
    </mesh>)}
    <mesh castShadow receiveShadow position={[0, potY, 0]}><cylinderGeometry args={[.2, .14, hanging ? .24 : .3, 24, 1, true]} /><meshStandardMaterial color={spec.style === "fern" ? "#b98564" : "#ddd1bf"} roughness={.68} side={THREE.DoubleSide} /></mesh>
    <mesh castShadow position={[0, potY + (hanging ? .12 : .15), 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.193, .012, 6, 24]} /><meshStandardMaterial color={spec.style === "fern" ? "#bb8969" : "#e5d9c7"} roughness={.7} /></mesh>
    <mesh receiveShadow position={[0, potY + (hanging ? .105 : .135), 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.18, 24]} /><meshStandardMaterial color="#33281d" roughness={1} /></mesh>
    {Array.from({ length: count }, (_, i) => {
      const angle = i * 2.399, snake = spec.style === "snake", succulent = spec.style === "succulent";
      const frond = spec.style === "palm" || spec.style === "fern";
      const length = .35 + (i % 5) * .06;
      const y = hanging ? -.56 - i * .024 : succulent ? .32 : .42 + (i % 7) * .07;
      return <group key={i} rotation={[0, angle, 0]}>
        {!snake && !succulent && <mesh position={[.09, hanging ? -.5 : y / 2 + .15, 0]} rotation={[0, 0, hanging ? .2 : -.22]}><cylinderGeometry args={[.004, .007, hanging ? .22 : y - .22, 5]} /><meshStandardMaterial color="#61734a" roughness={.85} /></mesh>}
        <group position={[snake ? .08 : succulent ? .08 : .16, snake ? .58 + (i % 3) * .035 : y, 0]} rotation={[.12 * Math.sin(i), 0, snake ? -.07 : hanging ? .55 : succulent ? -.8 : -.55]}>
          <mesh geometry={leaf} castShadow scale={[snake ? .035 : frond ? .038 : succulent ? .11 : .12, snake ? .3 : succulent ? .14 : length / 2, succulent ? .55 : .3]}>
            <meshPhysicalMaterial map={leafMap} color={i % 4 ? spec.color : "#9bad74"} roughness={.52} clearcoat={.12} clearcoatRoughness={.65} side={THREE.DoubleSide} />
          </mesh>
          {frond && Array.from({ length: 5 }, (_, j) => [-1, 1].map(side => <mesh key={`${j}-${side}`} geometry={leaf} castShadow position={[side * .07, (j / 5 - .45) * length, 0]} rotation={[0, 0, side * -.95]} scale={[.025, .1 * (1 - j * .08), .2]}>
            <meshStandardMaterial map={leafMap} color={spec.color} roughness={.6} side={THREE.DoubleSide} />
          </mesh>))}
        </group>
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
    <mesh castShadow><extrudeGeometry args={[shapes[0], { depth: .012, bevelEnabled: true, bevelSize: .003, bevelThickness: .002, bevelSegments: 1, steps: 1, curveSegments: 24 }]} /><meshStandardMaterial color={spec.color} metalness={.85} roughness={.23} /></mesh>
    <mesh position={[0, 0, .017]}><shapeGeometry args={[shapes[1], 24]} /><meshStandardMaterial color="#e6eeec" metalness={1} roughness={.045} envMapIntensity={1.25} /></mesh>
  </group>;
}

function WallArt({ spec }: { spec: DecorSpec }) {
  const texture = useDecorTexture(spec, true);
  return <group>
    <mesh castShadow><boxGeometry args={[spec.width, spec.height, .035]} /><meshStandardMaterial color={spec.style === "woven" ? "#b49976" : "#695340"} roughness={.8} /></mesh>
    <mesh position={[0, 0, .019]}><planeGeometry args={[spec.width - .045, spec.height - .045]} /><meshStandardMaterial color="#f4eee3" roughness={.9} /></mesh>
    <mesh position={[0, 0, .021]}><planeGeometry args={[spec.width - .085, spec.height - .085]} /><meshStandardMaterial map={texture} bumpMap={texture} bumpScale={.001} roughness={.95} /></mesh>
  </group>;
}

function Vase({ spec }: { spec: DecorSpec }) {
  const profile = useMemo(() => [[.07, 0], [.14, .015], [.19, .13], [.2, .26], [.17, .4], [.085, .51], [.068, .6], [.065, .64], [.053, .64], [.057, .6], [.074, .51], [.15, .39], [.18, .26], [.17, .13], [.12, .025]].map(([x, y]) => new THREE.Vector2(x, y)), []);
  return <group scale={[spec.width / .4, spec.height / 1.3, spec.depth / .4]}>
    <mesh castShadow receiveShadow><latheGeometry args={[profile, 28]} /><meshPhysicalMaterial color={spec.color} roughness={.48} clearcoat={.2} clearcoatRoughness={.5} side={THREE.DoubleSide} /></mesh>
    {[-.18, 0, .18, .3, -.3].map((x, i) => <group key={x} position={[x / 8, .6, 0]} rotation={[.1 * Math.sin(i), i, -x]}>
      <mesh position={[0, .3, 0]}><cylinderGeometry args={[.003, .004, .6, 5]} /><meshStandardMaterial color="#a48656" roughness={.9} /></mesh>
      {Array.from({ length: 7 }, (_, j) => <mesh key={j} position={[Math.sin(j * 2.4) * .02, .5 + j * .025, Math.cos(j * 2.4) * .02]} rotation={[.15, j, .2]} scale={[.018, .09, .012]}><sphereGeometry args={[1, 6, 4]} /><meshStandardMaterial color={j % 2 ? "#c9b18a" : "#d7c3a1"} roughness={1} /></mesh>)}
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
  return <Vase spec={spec} />;
}
