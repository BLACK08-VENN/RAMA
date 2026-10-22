"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { ReactNode } from "react";
import * as THREE from "three";
import type { RoomConfig } from "@/stores/planner-store";

export function CutawayWall({ room, wall, children }: { room: RoomConfig; wall: "left" | "right" | "front" | "back" | "ceiling"; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (!group.current) return;
    const visible = wall === "ceiling" ? camera.position.y < room.height : wall === "left" ? camera.position.x > -room.width / 2 : wall === "right" ? camera.position.x < room.width / 2 : wall === "back" ? camera.position.z > -room.depth / 2 : camera.position.z < room.depth / 2;
    group.current.visible = visible;
  });
  return <group ref={group}>{children}</group>;
}

function openingShape(width: number, height: number, arched: boolean) {
  const shape = new THREE.Shape();
  const radius = Math.min(width / 2, height * .4);
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0);
  if (arched) {
    shape.lineTo(width / 2, height - radius);
    shape.absellipse(0, height - radius, width / 2, radius, 0, Math.PI, false, 0);
  } else { shape.lineTo(width / 2, height); shape.lineTo(-width / 2, height); }
  shape.lineTo(-width / 2, 0); shape.closePath();
  return shape;
}

/** Fine-grain paint/plaster relief; a shared tiny tile rather than a flat solid wall. */
type WallMaps = { color: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture };
function WallPaintMaterial({ color, finish = "paint", span = 4, height = 3 }: { color: string; finish?: RoomConfig["wallFinish"]; span?: number; height?: number }) {
  const [loaded, setLoaded] = useState<{ finish: string; maps: WallMaps } | null>(null);
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const pixels = ctx.createImageData(256, 256);
    let seed = 1151;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < pixels.data.length; i += 4) {
      const value = 123 + Math.floor(random() * 26);
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(6, 5);
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    return map;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  useEffect(() => {
    if (!finish || finish === "paint") return;
    let active = true;
    const loader = new THREE.TextureLoader();
    const root = `/materials/ambientcg/${finish}/`;
    Promise.all(["Color", "NormalGL", "Roughness"].map(kind => loader.loadAsync(root + kind + ".jpg")))
      .then(([albedo, normal, roughness]) => {
        if (!active) {albedo.dispose();normal.dispose();roughness.dispose();return;}
        albedo.colorSpace = THREE.SRGBColorSpace;
        [albedo, normal, roughness].forEach(map => {
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.minFilter = THREE.LinearMipmapLinearFilter;
          map.anisotropy = 8;
        });
        setLoaded({finish, maps:{color:albedo,normal,roughness}});
      }).catch(() => { if(active)setLoaded(null); });
    return () => { active = false; };
  }, [finish]);
  useEffect(() => () => {
    loaded?.maps.color.dispose();
    loaded?.maps.normal.dispose();
    loaded?.maps.roughness.dispose();
  }, [loaded]);
  const maps = loaded?.finish === finish ? loaded.maps : null;
  // Consistent metre-based UV scale on each architectural wall.
  if (maps) for (const map of [maps.color, maps.normal, maps.roughness]) {
    map.repeat.set(span / 1.5, height / 1.5);
    map.needsUpdate = true;
  }
  return <meshStandardMaterial
    color={maps ? "#ffffff" : color}
    map={maps?.color ?? null}
    normalMap={maps?.normal ?? null}
    normalScale={new THREE.Vector2(.42,.42)}
    roughnessMap={maps?.roughness ?? null}
    roughness={maps ? 1 : .93}
    bumpMap={maps ? null : texture}
    bumpScale={maps ? 0 : .009}
    metalness={0}
    side={THREE.DoubleSide}
  />;
}

export function ArchitecturalWalls({ room }: { room: RoomConfig }) {
  const back = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-room.width / 2, 0); shape.lineTo(room.width / 2, 0); shape.lineTo(room.width / 2, room.height); shape.lineTo(-room.width / 2, room.height); shape.closePath();
    if (room.window.enabled) {
      const width = Math.min(room.window.width, room.width - .7);
      const height = Math.max(.6, Math.min(room.window.height, room.height - room.window.sillHeight - .15));
      const hole = openingShape(width, height, room.window.style === "arched");
      const points = hole.getPoints(48).map(p => new THREE.Vector2(p.x + room.window.position * (room.width - width), p.y + room.window.sillHeight));
      shape.holes.push(new THREE.Path(points.reverse()));
    }
    return shape;
  }, [room.width, room.height, room.window]);
  const left = useMemo(() => {
    const shape = new THREE.Shape();
    const span = room.depth, height = Math.min(room.door.height, room.height - .08), width = Math.min(room.door.width, span - .7);
    const center = -room.door.position * (span - width);
    // A door opening reaches the floor, so follow its outline rather than making a closed hole.
    shape.moveTo(-span / 2, 0);
    if (room.door.enabled) { shape.lineTo(center - width / 2, 0); shape.lineTo(center - width / 2, height); shape.lineTo(center + width / 2, height); shape.lineTo(center + width / 2, 0); }
    shape.lineTo(span / 2, 0); shape.lineTo(span / 2, room.height); shape.lineTo(-span / 2, room.height); shape.closePath(); return shape;
  }, [room.depth, room.height, room.door]);
  return <group>
    <CutawayWall room={room} wall="back">
      <mesh receiveShadow position={[0, 0, -room.depth / 2]}><shapeGeometry args={[back, 48]} /><WallPaintMaterial color={room.wallColor} finish={room.wallFinish} span={room.width} height={room.height} /></mesh>
      <mesh position={[0, .045, -room.depth / 2 + .04]}><boxGeometry args={[room.width, .09, .05]} /><meshStandardMaterial color="#f8f5ef" /></mesh>
    </CutawayWall>
    {/* Thin painted skirting gives walls a believable floor junction without changing openings. */}
    <CutawayWall room={room} wall="back">
      <mesh position={[0, .055, -room.depth / 2 + .055]} receiveShadow>
        <boxGeometry args={[room.width, .11, .035]} />
        <meshStandardMaterial color="#f5f3ee" roughness={.7} />
      </mesh>
    </CutawayWall>
    <CutawayWall room={room} wall="right">
      <mesh position={[room.width / 2 - .055, .055, 0]} receiveShadow>
        <boxGeometry args={[.035, .11, room.depth]} />
        <meshStandardMaterial color="#f5f3ee" roughness={.7} />
      </mesh>
    </CutawayWall>
    <CutawayWall room={room} wall="front">
      <mesh position={[0, .055, room.depth / 2 - .055]} receiveShadow>
        <boxGeometry args={[room.width, .11, .035]} />
        <meshStandardMaterial color="#f5f3ee" roughness={.7} />
      </mesh>
    </CutawayWall>
    {/* Shallow ceiling crown moulding creates a real architectural junction.
        Small profiles give highlights without creating floating decorative bars. */}
    {[
      { wall: "back" as const, position: [0, room.height - .045, -room.depth / 2 + .04] as [number,number,number], size: [room.width, .075, .07] as [number,number,number] },
      { wall: "front" as const, position: [0, room.height - .045, room.depth / 2 - .04] as [number,number,number], size: [room.width, .075, .07] as [number,number,number] },
      { wall: "left" as const, position: [-room.width / 2 + .04, room.height - .045, 0] as [number,number,number], size: [.07, .075, room.depth] as [number,number,number] },
      { wall: "right" as const, position: [room.width / 2 - .04, room.height - .045, 0] as [number,number,number], size: [.07, .075, room.depth] as [number,number,number] },
    ].map(({ wall, position, size }) => (
      <CutawayWall key={wall} room={room} wall={wall}>
        <mesh position={position} receiveShadow castShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color="#efede8" roughness={.79} />
        </mesh>
      </CutawayWall>
    ))}
    <CutawayWall room={room} wall="left"><mesh receiveShadow position={[-room.width / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}><shapeGeometry args={[left]} /><WallPaintMaterial color={room.wallColor} finish={room.wallFinish} span={room.depth} height={room.height} /></mesh></CutawayWall>
    <CutawayWall room={room} wall="right"><mesh receiveShadow position={[room.width / 2, room.height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[room.depth, room.height]} /><WallPaintMaterial color={room.wallColor} finish={room.wallFinish} span={room.depth} height={room.height} /></mesh></CutawayWall>
    <CutawayWall room={room} wall="front"><mesh receiveShadow position={[0, room.height / 2, room.depth / 2]} rotation={[0, Math.PI, 0]}><planeGeometry args={[room.width, room.height]} /><WallPaintMaterial color={room.wallColor} finish={room.wallFinish} span={room.width} height={room.height} /></mesh></CutawayWall>
  </group>;
}

export function Ceiling({ room }: { room: RoomConfig }) {
  // Underside faces down, so it only ever renders for a camera below the slab.
  const tone = useMemo(() => new THREE.Color(room.wallColor).lerp(new THREE.Color("#ffffff"), 0.6).getStyle(), [room.wallColor]);
  const band = 0.09, trim = 0.055;
  const insetX = room.width / 2 - trim / 2, insetZ = room.depth / 2 - trim / 2;
  const drop = room.height - band / 2;
  return <CutawayWall room={room} wall="ceiling">
    <mesh position={[0, room.height, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[room.width, room.depth]} />
      <meshStandardMaterial color={tone} roughness={0.95} />
    </mesh>
    {[
      { position: [0, drop, insetZ] as const, size: [room.width, band, trim] as const },
      { position: [0, drop, -insetZ] as const, size: [room.width, band, trim] as const },
      { position: [insetX, drop, 0] as const, size: [trim, band, room.depth] as const },
      { position: [-insetX, drop, 0] as const, size: [trim, band, room.depth] as const },
    ].map((piece) => (
      <mesh key={piece.position.join(",")} position={piece.position} receiveShadow>
        <boxGeometry args={piece.size} />
        <meshStandardMaterial color="#fbfaf6" roughness={0.8} />
      </mesh>
    ))}
  </CutawayWall>;
}

// A softly defocused exterior beyond the glass restores depth to a window.
// Kept deliberately low-frequency to avoid obvious game-like illustrated scenery.
function WindowExterior({ width, height }: { width: number; height: number }) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 384;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const sky = ctx.createLinearGradient(0, 0, 0, 384);
    sky.addColorStop(0, "#c4d2d5");
    sky.addColorStop(.52, "#e7e8e2");
    sky.addColorStop(.71, "#b9c5b9");
    sky.addColorStop(1, "#849685");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 384);
    ctx.filter = "blur(28px)";
    const forms = [
      [58, 280, 110, 130, "#7f967a"],
      [193, 300, 145, 175, "#9eaf99"],
      [372, 260, 140, 160, "#879e87"],
      [478, 314, 95, 150, "#718d76"],
    ] as const;
    for (const [x,y,rx,ry,col] of forms) {
      ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();
    }
    ctx.filter = "none";
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  return <mesh position={[0, height / 2, -.10]}>
    <planeGeometry args={[width * 1.005, height * 1.005]} />
    <meshBasicMaterial map={texture} color={texture ? "#ffffff" : "#dbe0dc"} side={THREE.DoubleSide} toneMapped={false} />
  </mesh>;
}

export function DesignerWindow({ room }: { room: RoomConfig }) {
  const width = Math.min(room.window.width, room.width - .7);
  const height = Math.max(.6, Math.min(room.window.height, room.height - room.window.sillHeight - .15));
  const arched = room.window.style === "arched";
  const shape = useMemo(() => openingShape(width, height, arched), [width, height, arched]);
  const radius = Math.min(width / 2, height * .4);
  if (!room.window.enabled) return null;
  return <group position={[room.window.position * (room.width - width), room.window.sillHeight, -room.depth / 2 + .01]}>
    <WindowExterior width={width} height={height} />
    <mesh><shapeGeometry args={[shape, 48]} /><meshStandardMaterial color="#e6eff0" metalness={.08} roughness={.12} transparent opacity={.18} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    {[-width / 2, width / 2].map(x => <mesh key={x} position={[x, (height - (arched ? radius : 0)) / 2, .025]}><boxGeometry args={[.045, height - (arched ? radius : 0), .07]} /><meshStandardMaterial color="#343d3b" metalness={.5} roughness={.35} /></mesh>)}
    <mesh position={[0, 0, .025]}><boxGeometry args={[width + .09, .05, .08]} /><meshStandardMaterial color="#343d3b" /></mesh>
    {arched ? <group position={[0, height - radius, .025]} scale={[1, radius / (width / 2), 1]}><mesh><torusGeometry args={[width / 2, .025, 8, 48, Math.PI]} /><meshStandardMaterial color="#b39762" metalness={.65} roughness={.3} /></mesh></group> : <mesh position={[0, height, .025]}><boxGeometry args={[width + .09, .045, .07]} /><meshStandardMaterial color="#343d3b" /></mesh>}
    {(room.window.style === "panoramic" ? [-width / 6, width / 6] : [0]).map(x => <mesh key={x} position={[x, (height - (arched ? radius : 0)) / 2, .025]}><boxGeometry args={[.035, height - (arched ? radius : 0), .065]} /><meshStandardMaterial color="#343d3b" /></mesh>)}
    <mesh position={[width * .2, height * .46, .03]} rotation={[0, 0, -.3]}><planeGeometry args={[width * .12, height * .7]} /><meshBasicMaterial color="#ffffff" transparent opacity={.08} depthWrite={false} side={THREE.DoubleSide} /></mesh>
  </group>;
}

export function SlidingDoor({ room }: { room: RoomConfig }) {
  if (!room.door.enabled || room.door.style !== "sliding") return null;
  const width = Math.min(room.door.width, room.depth - .7), height = Math.min(room.door.height, room.height - .08);
  return <group position={[-room.width / 2 + .02, 0, room.door.position * (room.depth - width)]} rotation={[0, Math.PI / 2, 0]}>
    {[-1, 1].map(side => <group key={side} position={[side * width / 4, height / 2, side === 1 ? .03 : 0]}>
      <mesh><boxGeometry args={[width / 2, height, .025]} /><meshStandardMaterial color="#e6eff0" transparent opacity={.2} depthWrite={false} metalness={.08} roughness={.12} /></mesh>
      {[-width / 4, width / 4].map(x => <mesh key={x} position={[x, 0, .025]}><boxGeometry args={[.045, height, .07]} /><meshStandardMaterial color="#303b39" metalness={.6} roughness={.3} /></mesh>)}
      <mesh position={[-side * width / 4 + side * .09, 0, .08]}><boxGeometry args={[.025, .28, .03]} /><meshStandardMaterial color="#c1a46f" metalness={.7} roughness={.25} /></mesh>
    </group>)}
    {[.025, height].map(y => <mesh key={y} position={[0, y, .025]}><boxGeometry args={[width + .1, .06, .12]} /><meshStandardMaterial color="#303b39" metalness={.6} roughness={.3} /></mesh>)}
  </group>;
}

export function Chandelier({ room }: { room: RoomConfig }) {
  if (!room.chandelier || room.chandelier === "none") return null;
  const y = room.height - .65;
  return <group position={[0, y, 0]}>
    <mesh position={[0, .61, 0]}><cylinderGeometry args={[.13, .13, .07, 24]} /><meshStandardMaterial color="#ad8b50" metalness={.7} roughness={.3} /></mesh>
    {room.chandelier === "rings" ? <group>
      {[{r:.55, y:0}, {r:.36, y:-.2}].map(ring => <group key={ring.r} position={[0, ring.y, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[ring.r, .026, 10, 64]} /><meshStandardMaterial color="#c9ad75" metalness={.65} roughness={.3} emissive="#ffdda0" emissiveIntensity={.5} /></mesh>
        {[-1, 1].map(side => <mesh key={side} position={[side * ring.r * .6, (.55 - ring.y) / 2, 0]}><cylinderGeometry args={[.004, .004, .55 - ring.y, 6]} /><meshStandardMaterial color="#7d7464" /></mesh>)}
      </group>)}
    </group> : <group>
      <mesh position={[0, .3, 0]}><cylinderGeometry args={[.015, .015, .6, 12]} /><meshStandardMaterial color="#b9995c" metalness={.7} roughness={.3} /></mesh>
      {Array.from({length:6}, (_, i) => { const a=i*Math.PI/3, x=Math.cos(a)*.45, z=Math.sin(a)*.45; return <group key={i}>
        <mesh position={[x/2, 0, z/2]} rotation={[0, -a, Math.PI/2]}><cylinderGeometry args={[.016, .016, .45, 10]} /><meshStandardMaterial color="#b9995c" metalness={.7} roughness={.3} /></mesh>
        <mesh position={[x, i%2 ? -.1 : .05, z]}><sphereGeometry args={[.12, 20, 16]} /><meshStandardMaterial color="#fff4dd" roughness={.25} emissive="#ffe3b0" emissiveIntensity={.65} /></mesh>
      </group>; })}
    </group>}
    <pointLight color="#ffe4b9" intensity={2} distance={5} decay={2} />
  </group>;
}
