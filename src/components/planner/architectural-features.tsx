"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { ReactNode } from "react";
import * as THREE from "three";
import { wallRotation, type RoomConfig } from "@/stores/planner-store";
import { getConferenceScreen, screenWorldPosition, screenWallX, stretchConferenceScreen, type ConferenceScreenConfig } from "@/lib/conference-screen";
import { useObjectDrag } from "./use-object-drag";
import { isWallVisible } from "./wall-drag";

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
  const invalidate = useThree(state => state.invalidate);
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
        invalidate();
      }).catch(() => { if(active){ setLoaded(null); invalidate(); } });
    return () => { active = false; };
  }, [finish, invalidate]);
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
    key={`${finish}-${maps ? "pbr" : "fallback"}`}
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

// ShapeGeometry (walls with openings) uses metre-based UVs, unlike PlaneGeometry.
// Normalise both so the same brick texture appears consistently on all four walls.
function WallOpeningGeometry({ shape, span, height }: { shape: THREE.Shape; span: number; height: number }) {
  const geometry = useMemo(() => {
    const mesh = new THREE.ShapeGeometry(shape, 48);
    const position = mesh.getAttribute("position");
    const uv = mesh.getAttribute("uv");
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, position.getX(i) / span + 0.5, position.getY(i) / height);
    }
    uv.needsUpdate = true;
    return mesh;
  }, [shape, span, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

function ConferenceGlassWall({ span, height, position, rotation }: { span: number; height: number; position: [number,number,number]; rotation: [number,number,number] }) {
  return <group position={position} rotation={rotation}>
    <mesh position={[0,height/2,0]}>
      <planeGeometry args={[span,height]}/>
      <meshPhysicalMaterial color="#dce8e9" roughness={.76} metalness={0} transparent opacity={.67} depthWrite={false} side={THREE.DoubleSide} clearcoat={.22} clearcoatRoughness={.64}/>
    </mesh>
    {/* Fine satin haze: obscures detail while allowing silhouettes and light through. */}
    <mesh position={[0,height/2,.003]}>
      <planeGeometry args={[span*.99,height*.99]}/>
      <meshBasicMaterial color="#f4f7f5" transparent opacity={.085} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    <mesh position={[span*.18,height*.57,.008]} rotation={[0,0,-.23]}>
      <planeGeometry args={[span*.10,height*.52]}/>
      <meshBasicMaterial color="#ffffff" transparent opacity={.045} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    {[-span/2,-span/6,span/6,span/2].map(x=><mesh key={x} position={[x,height/2,.018]}><boxGeometry args={[.038,height,.06]}/><meshStandardMaterial color="#3d484d" metalness={.48} roughness={.3}/></mesh>)}
    {[0,height].map(y=><mesh key={y} position={[0,y,.018]}><boxGeometry args={[span+.06,.05,.06]}/><meshStandardMaterial color="#3d484d" metalness={.48} roughness={.3}/></mesh>)}
  </group>;
}

function ScreenStretchHandle({ room, screen, preview, corner, onPreview, onChange, onDraggingChange }: {
  room: RoomConfig;
  screen: ConferenceScreenConfig;
  preview: ConferenceScreenConfig;
  corner: readonly [number, number];
  onPreview: (screen: ConferenceScreenConfig | null) => void;
  onChange?: (screen: ConferenceScreenConfig) => void;
  onDraggingChange?: (active: boolean) => void;
}) {
  const wall = screen.wall ?? "back";
  const position: [number, number, number] = [preview.x - screen.x + corner[0] * preview.width / 2, preview.y - screen.y + corner[1] * preview.height / 2, .065];
  const configAt = (point: number[]) => stretchConferenceScreen(room, screen, corner, [screen.x + point[0], screen.y + point[1]]);
  const lastPreview = useRef("");
  const { camera, viewport, size, gl } = useThree();
  useEffect(() => () => { gl.domElement.style.removeProperty("cursor"); }, [gl]);
  const drag = useObjectDrag({
    enabled: Boolean(onChange), position, normal: new THREE.Vector3(0, 0, 1),
    createProjection: (origin, grabbed) => {
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...screenWorldPosition(room, screen)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, wallRotation[wall], 0)), new THREE.Vector3(1, 1, 1));
      const inverse = matrix.clone().invert();
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(matrix);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, grabbed);
      const offset = origin.clone().sub(grabbed.clone().applyMatrix4(inverse));
      return ray => {
        if (Math.abs(ray.direction.dot(normal)) < .015) return null;
        const hit = ray.intersectPlane(plane, new THREE.Vector3());
        return hit ? hit.applyMatrix4(inverse).add(offset) : null;
      };
    },
    clamp: point => {
      const next = configAt(point);
      return [next.x - screen.x + corner[0] * next.width / 2, next.y - screen.y + corner[1] * next.height / 2, .065];
    },
    onPreview: (_, point) => {
      const next = configAt(point);
      const key = `${next.width},${next.height},${next.x},${next.y}`;
      if (lastPreview.current !== key) { lastPreview.current = key; onPreview(next); }
    },
    onMove: point => onChange?.(configAt(point)),
    onCancel: () => onPreview(null),
    onDraggingChange: active => { if (!active) { lastPreview.current = ""; onPreview(null); } onDraggingChange?.(active); },
  });
  useFrame(() => {
    const handle = drag.ref.current;
    if (!handle) return;
    const height = viewport.getCurrentViewport(camera, handle.getWorldPosition(new THREE.Vector3()), size).height;
    handle.scale.setScalar(height / Math.max(1, size.height) * 44 / .24);
  });
  return <group {...drag} position={position}
    onPointerOver={event => { event.stopPropagation(); gl.domElement.style.setProperty("cursor", corner[0] === corner[1] ? "nesw-resize" : "nwse-resize"); }}
    onPointerOut={() => { gl.domElement.style.removeProperty("cursor"); }}>
    {/* Invisible touch target keeps corner stretching without visible boxes. */}
    <mesh><planeGeometry args={[.24, .24]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>
  </group>;
}

function ConferencePresentationScreen({ room, dragEnabled, onChange, onDraggingChange }: {
  room: RoomConfig;
  dragEnabled: boolean;
  onChange?: (change: Partial<ConferenceScreenConfig>) => void;
  onDraggingChange?: (active: boolean) => void;
}) {
  const screen = getConferenceScreen(room);
  const wall = screen.wall ?? "back";
  const [preview, setPreview] = useState<ConferenceScreenConfig | null>(null);
  const visible = preview ?? screen;
  const camera = useThree(state => state.camera);
  const drag = useObjectDrag({
    enabled: dragEnabled && Boolean(onChange),
    position: screenWorldPosition(room, screen),
    normal: new THREE.Vector3(wall === "left" || wall === "right" ? 1 : 0, 0, wall === "left" || wall === "right" ? 0 : 1),
    isVisible: () => isWallVisible(room, wall, camera.position),
    clamp: (next) => {
      return screenWorldPosition(room, getConferenceScreen(room, { x: screenWallX(wall, next), y: next[1] }));
    },
    onMove: (next) => onChange?.({ x: screenWallX(wall, next), y: next[1] }),
    onDraggingChange: (active) => onDraggingChange?.(active),
  });
  return <group {...drag} position={screenWorldPosition(room, screen)} rotation={[0, wallRotation[wall], 0]}>
    <group position={[visible.x - screen.x, visible.y - screen.y, 0]} scale={[visible.width / screen.width, visible.height / screen.height, 1]}>
    <mesh><boxGeometry args={[screen.width,screen.height,.085]}/><meshStandardMaterial color="#212729" roughness={.34}/></mesh>
    <mesh position={[0,0,.049]}><planeGeometry args={[screen.width-.09,screen.height-.09]}/><meshBasicMaterial color="#12202a" toneMapped={false}/></mesh>
    <mesh position={[-screen.width*.14,screen.height*.135,.051]}><planeGeometry args={[screen.width*.50,.007]}/><meshBasicMaterial color="#74a6ae"/></mesh>
    <mesh position={[-screen.width*.14,-screen.height*.045,.051]}><planeGeometry args={[screen.width*.50,.007]}/><meshBasicMaterial color="#477f90"/></mesh>
    <mesh position={[0,-screen.height/2-.115,-.025]}><boxGeometry args={[Math.min(.72,screen.width*.5),.045,.12]}/><meshStandardMaterial color="#4a4c4b" metalness={.4} roughness={.5}/></mesh>
    </group>
    {dragEnabled && ([-1, 1] as const).flatMap(x => ([-1, 1] as const).map(y => <ScreenStretchHandle key={`${wall}-${x}-${y}`} room={room} screen={screen} preview={visible} corner={[x, y]} onPreview={setPreview} onChange={onChange} onDraggingChange={onDraggingChange} />))}
  </group>;
}

function ConferencePresentationFeatures({ room, screenDragEnabled = false, onScreenChange, onDraggingChange }: {
  room: RoomConfig;
  screenDragEnabled?: boolean;
  onScreenChange?: (change: Partial<ConferenceScreenConfig>) => void;
  onDraggingChange?: (active: boolean) => void;
}) {
  if (room.presetId !== "conference-room") return null;
  const z = -room.depth / 2 + .09;
  return <group>
    {room.conferenceAcousticPanels && [-1,1].map(side =>
      <group key={side} position={[side*(room.width/2-.48),0,z]}>
        {Array.from({length:6},(_,i)=><mesh key={i} position={[(i-2.5)*.115,room.height/2,.005]}>
          <boxGeometry args={[.094,Math.min(2.3,room.height-.4),.055]}/>
          <meshStandardMaterial color={i%2 ? "#977e69" : "#b9a18a"} roughness={.95}/>
        </mesh>)}
      </group>
    )}
    {room.conferencePresentationWall && <ConferencePresentationScreen
      key={room.conferenceScreen?.wall ?? "back"}
      room={room}
      dragEnabled={screenDragEnabled}
      onChange={onScreenChange}
      onDraggingChange={onDraggingChange}
    />}
  </group>;
}

export function ArchitecturalWalls({ room, screenDragEnabled = false, onScreenChange, onDraggingChange }: {
  room: RoomConfig;
  screenDragEnabled?: boolean;
  onScreenChange?: (change: Partial<ConferenceScreenConfig>) => void;
  onDraggingChange?: (active: boolean) => void;
}) {
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
    <ConferencePresentationFeatures room={room} screenDragEnabled={screenDragEnabled} onScreenChange={onScreenChange} onDraggingChange={onDraggingChange}/>
    <CutawayWall room={room} wall="back">
      <mesh receiveShadow position={[0, 0, -room.depth / 2]}><WallOpeningGeometry shape={back} span={room.width} height={room.height} /><WallPaintMaterial color={room.wallColor} finish={room.wallFinish} span={room.width} height={room.height} /></mesh>
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
    <CutawayWall room={room} wall="left"><mesh receiveShadow position={[-room.width / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}><WallOpeningGeometry shape={left} span={room.depth} height={room.height} /><WallPaintMaterial color={room.wallColor} finish={room.wallFinish} span={room.depth} height={room.height} /></mesh></CutawayWall>
    <CutawayWall room={room} wall="right">{room.presetId === "conference-room" && room.conferenceGlassWalls ? <ConferenceGlassWall span={room.depth} height={room.height} position={[room.width/2,0,0]} rotation={[0,-Math.PI/2,0]}/> : <mesh receiveShadow position={[room.width / 2, room.height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[room.depth, room.height]} /><WallPaintMaterial color={room.wallColor} finish={room.wallFinish} span={room.depth} height={room.height} /></mesh>}</CutawayWall>
    <CutawayWall room={room} wall="front">{room.presetId === "conference-room" && room.conferenceGlassWalls ? <ConferenceGlassWall span={room.width} height={room.height} position={[0,0,room.depth/2]} rotation={[0,Math.PI,0]}/> : <mesh receiveShadow position={[0, room.height / 2, room.depth / 2]} rotation={[0, Math.PI, 0]}><planeGeometry args={[room.width, room.height]} /><WallPaintMaterial color={room.wallColor} finish={room.wallFinish} span={room.width} height={room.height} /></mesh>}</CutawayWall>
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
    {room.presetId === "conference-room" && room.conferenceCeilingBulkhead && [
      {position:[0,room.height-.13,-room.depth*.37] as const,size:[room.width*.75,.19,.22] as const},
      {position:[0,room.height-.13,room.depth*.37] as const,size:[room.width*.75,.19,.22] as const},
      {position:[-room.width*.37,room.height-.13,0] as const,size:[.22,.19,room.depth*.74] as const},
      {position:[room.width*.37,room.height-.13,0] as const,size:[.22,.19,room.depth*.74] as const},
    ].map((piece,index)=><mesh key={index} position={piece.position}><boxGeometry args={piece.size}/><meshStandardMaterial color="#eeeae3" roughness={.86}/></mesh>)}
    {room.presetId === "conference-room" && room.conferenceRecessedLights && [-1, 1].flatMap(row => [-1.5,-.5,.5,1.5].map(col => <group key={`${row}-${col}`} position={[col*room.width/5,room.height-.014,row*room.depth/4]}>
      <mesh rotation={[Math.PI/2,0,0]}><ringGeometry args={[.085,.115,24]}/><meshStandardMaterial color="#dddcd4" roughness={.4} side={THREE.DoubleSide}/></mesh>
      <mesh rotation={[Math.PI/2,0,0]} position={[0,-.008,0]}><circleGeometry args={[.084,24]}/><meshBasicMaterial color="#fff2d8" side={THREE.DoubleSide} toneMapped={false}/></mesh>
      <pointLight position={[0,-.12,0]} intensity={.28} distance={3.2} decay={2} color="#fff0d4"/>
    </group>))}
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

function GridSliderWindow({ width, height, room }: { width: number; height: number; room: RoomConfig }) {
  const frame = room.window.frameColor === "black" ? "#292c2b" : room.window.frameColor === "wood" ? "#9b714f" : "#f3f2eb";
  const trim = room.window.frameColor === "black" ? "#474947" : room.window.frameColor === "wood" ? "#b1875e" : "#d9dbd8";
  const open = Math.max(0, Math.min(1, room.window.openAmount ?? 0));
  const sashW = width / 2 - .035;
  const sashH = height - .085;
  const bar = Math.max(.016, Math.min(.035, width * .017));
  return <group>
    <WindowExterior width={width} height={height} />
    {/* Glazed opening and outer casing, without an opaque block over the glass. */}
    <mesh position={[0, height / 2, -.005]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color="#e9f4f7" metalness={.15} roughness={.13} transparent opacity={.13} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * (width / 2), height / 2, .045]}><boxGeometry args={[.075, height + .12, .11]} /><meshStandardMaterial color={frame} roughness={.32} /></mesh>
    </group>)}
    {[0, height].map(y => <mesh key={y} position={[0,y,.045]}><boxGeometry args={[width + .15,.075,.11]} /><meshStandardMaterial color={frame} roughness={.32} /></mesh>)}
    <mesh position={[0,height / 2,.07]}><boxGeometry args={[.055,height,.075]} /><meshStandardMaterial color={trim} roughness={.36}/></mesh>
    {[-1,1].map((side,index) => <group key={side} position={[side * (width / 4) - (index === 1 ? open * (sashW - .05) : 0), height / 2, index === 1 ? .13 : .09]}>
      <mesh><planeGeometry args={[sashW - .055,sashH - .045]}/><meshPhysicalMaterial color="#cde0e4" metalness={.08} roughness={.08} transmission={.16} transparent opacity={.26} depthWrite={false} side={THREE.DoubleSide} clearcoat={.8} clearcoatRoughness={.09}/></mesh>
      {[-1,1].map(edge=><group key={edge}>
        <mesh position={[edge * sashW / 2,0,.015]}><boxGeometry args={[.048,sashH,.064]}/><meshStandardMaterial color={frame} roughness={.32}/></mesh>
        <mesh position={[0,edge * sashH / 2,.015]}><boxGeometry args={[sashW,.048,.064]}/><meshStandardMaterial color={frame} roughness={.32}/></mesh>
      </group>)}
      {[-1/6,1/6].map(fraction=><mesh key={fraction} position={[fraction*sashW,0,.035]}><boxGeometry args={[bar,sashH-.06,.035]}/><meshStandardMaterial color={trim} roughness={.32}/></mesh>)}
      {[-1/6,1/6].map(fraction=><mesh key={fraction} position={[0,fraction*sashH,.035]}><boxGeometry args={[sashW-.06,bar,.035]}/><meshStandardMaterial color={trim} roughness={.32}/></mesh>)}
      <mesh position={[sashW*.2,sashH*.1,.042]} rotation={[0,0,-.22]}><planeGeometry args={[sashW*.08,sashH*.62]}/><meshBasicMaterial color="#ffffff" transparent opacity={.09} depthWrite={false}/></mesh>
    </group>)}
    <mesh position={[0,-.045,.11]}><boxGeometry args={[width+.21,.055,.23]}/><meshStandardMaterial color={frame} roughness={.38}/></mesh>
    {room.window.curtains && <group position={[0,height / 2,.23]}>
      <mesh position={[0,height / 2 + .13,0]} rotation={[0,0,Math.PI / 2]}><cylinderGeometry args={[.014,.014,width+.26,10]}/><meshStandardMaterial color="#a69b89" metalness={.55} roughness={.3}/></mesh>
      {Array.from({length:18},(_,i)=> {
        const side = i < 9 ? -1 : 1;
        const n = i % 9;
        const x = side * (width*.32) + (n-4) * width*.018;
        return <mesh key={i} position={[x,0,.04 + .018*Math.cos(n*Math.PI)]}>
          <planeGeometry args={[width*.04,height+.04]}/>
          <meshStandardMaterial color={n%2 ? "#ded7ca" : "#eee8de"} side={THREE.DoubleSide} transparent opacity={.88} roughness={.95}/>
        </mesh>;
      })}
    </group>}
  </group>;
}

export function DesignerWindow({ room }: { room: RoomConfig }) {
  const width = Math.min(room.window.width, room.width - .7);
  const height = Math.max(.6, Math.min(room.window.height, room.height - room.window.sillHeight - .15));
  const arched = room.window.style === "arched";
  const shape = useMemo(() => openingShape(width, height, arched), [width, height, arched]);
  const radius = Math.min(width / 2, height * .4);
  if (!room.window.enabled) return null;
  return <group position={[room.window.position * (room.width - width), room.window.sillHeight, -room.depth / 2 + .01]}>
    {room.window.style === "grid-slider" ? <GridSliderWindow width={width} height={height} room={room} /> : <>
    <WindowExterior width={width} height={height} />
    <mesh><shapeGeometry args={[shape, 48]} /><meshStandardMaterial color="#e6eff0" metalness={.08} roughness={.12} transparent opacity={.18} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    {[-width / 2, width / 2].map(x => <mesh key={x} position={[x, (height - (arched ? radius : 0)) / 2, .025]}><boxGeometry args={[.045, height - (arched ? radius : 0), .07]} /><meshStandardMaterial color="#343d3b" metalness={.5} roughness={.35} /></mesh>)}
    <mesh position={[0, 0, .025]}><boxGeometry args={[width + .09, .05, .08]} /><meshStandardMaterial color="#343d3b" /></mesh>
    {arched ? <group position={[0, height - radius, .025]} scale={[1, radius / (width / 2), 1]}><mesh><torusGeometry args={[width / 2, .025, 8, 48, Math.PI]} /><meshStandardMaterial color="#b39762" metalness={.65} roughness={.3} /></mesh></group> : <mesh position={[0, height, .025]}><boxGeometry args={[width + .09, .045, .07]} /><meshStandardMaterial color="#343d3b" /></mesh>}
    {(room.window.style === "panoramic" ? [-width / 6, width / 6] : [0]).map(x => <mesh key={x} position={[x, (height - (arched ? radius : 0)) / 2, .025]}><boxGeometry args={[.035, height - (arched ? radius : 0), .065]} /><meshStandardMaterial color="#343d3b" /></mesh>)}
    <mesh position={[width * .2, height * .46, .03]} rotation={[0, 0, -.3]}><planeGeometry args={[width * .12, height * .7]} /><meshBasicMaterial color="#ffffff" transparent opacity={.08} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </>}
    {room.window.curtains && room.window.style !== "grid-slider" && <group position={[0,height/2,.22]}>
      <mesh position={[0,height/2+.12,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.014,.014,width+.22,12]}/><meshStandardMaterial color="#a79a88" metalness={.4} roughness={.42}/></mesh>
      {Array.from({length:18},(_,i)=> {
        const side = i<9 ? -1 : 1;
        const n=i%9;
        const x=side*(width*.31)+(n-4)*width*.018;
        return <mesh key={i} position={[x,0,.03+.015*Math.cos(n*Math.PI)]}>
          <planeGeometry args={[width*.04,height+.02]}/>
          <meshStandardMaterial color={n%2 ? "#ded7ca" : "#efe9df"} side={THREE.DoubleSide} transparent opacity={.91} roughness={1}/>
        </mesh>;
      })}
    </group>}
    {room.window.blinds && <group position={[0,height/2,.26]}>
      <mesh position={[0,height/2-.02,0]}><boxGeometry args={[width+.12,.095,.115]}/><meshStandardMaterial color="#d8d6d0" roughness={.76}/></mesh>
      {Array.from({length:17},(_,i)=><mesh key={i} position={[0,-height/2+(i+.5)*height/18,.01]} rotation={[-.06,0,0]}>
        <boxGeometry args={[width-.05,.048,.018]}/>
        <meshStandardMaterial color={i%2 ? "#e3e2dc" : "#d5d5d0"} roughness={.88} side={THREE.DoubleSide}/>
      </mesh>)}
    </group>}
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
