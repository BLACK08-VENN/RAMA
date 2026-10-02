"use client";

import { ContactShadows, Grid, OrbitControls, RoundedBox, useGLTF } from "@react-three/drei";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { productModels, type ProductModel } from "@/data/products";
import {
  getItemPlacementBounds,
  type PlacedItem,
  type RoomConfig,
} from "@/stores/planner-store";

import { ArchitecturalWalls, DesignerWindow, SlidingDoor, Chandelier } from "./architectural-features";

export type CameraView = "perspective" | "top" | "front";

type ZoomRequest = {
  id: number;
  direction: "in" | "out";
};

type RoomSceneProps = {
  cameraView: CameraView;
  showGrid: boolean;
  zoomRequest: ZoomRequest;
  room: RoomConfig;
  placedItems: PlacedItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: [number, number, number]) => void;
  onResize: (dimension: "width" | "depth", value: number) => void;
};

const initialCameraPosition: [number, number, number] = [7, 5.5, 7];

function CameraRig({
  view,
  room,
  zoomRequest,
}: {
  view: CameraView;
  room: RoomConfig;
  zoomRequest: ZoomRequest;
}) {
  const { camera } = useThree();
  const lastZoomRequest = useRef(zoomRequest.id);

  useEffect(() => {
    const span = Math.max(room.width, room.depth);
    const positions: Record<CameraView, [number, number, number]> = {
      perspective: [span * 1.35, span, span * 1.35],
      top: [0, span * 2.25, 0.01],
      front: [0, span * 0.7, span * 2],
    };
    camera.position.set(...positions[view]);
    camera.lookAt(0, room.height * 0.35, 0);
    camera.updateProjectionMatrix();
  }, [camera, room.depth, room.height, room.width, view]);

  useEffect(() => {
    if (zoomRequest.id === lastZoomRequest.current) return;
    lastZoomRequest.current = zoomRequest.id;

    const span = Math.max(room.width, room.depth);
    const target = new THREE.Vector3(0, room.height * 0.3, 0);
    const offset = camera.position.clone().sub(target);
    const nextDistance = THREE.MathUtils.clamp(
      offset.length() * (zoomRequest.direction === "in" ? 0.82 : 1.22),
      span,
      span * 3.5,
    );
    camera.position.copy(target.add(offset.setLength(nextDistance)));
    camera.lookAt(0, room.height * 0.3, 0);
    camera.updateProjectionMatrix();
  }, [camera, room.depth, room.height, room.width, zoomRequest]);

  return null;
}

function DraggableFurniture({
  item,
  room,
  selected,
  dragEnabled,
  onSelect,
  onMove,
  onDraggingChange,
  children,
}: {
  item: PlacedItem;
  room: RoomConfig;
  selected: boolean;
  dragEnabled: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, position: [number, number, number]) => void;
  onDraggingChange: (dragging: boolean) => void;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const dragOffset = useRef(new THREE.Vector3());
  const finalPosition = useRef<[number, number, number]>(item.position);
  const startPosition = useRef<[number, number, number]>(item.position);
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onSelect(item.id);
    if (!dragEnabled) return;
    const point = event.ray.intersectPlane(floorPlane.current, new THREE.Vector3());
    if (!point) return;
    dragging.current = true;
    startPosition.current = [...item.position];
    finalPosition.current = [...item.position];
    dragOffset.current.set(item.position[0] - point.x, 0, item.position[2] - point.z);
    const target = event.nativeEvent.target;
    if (target instanceof Element) target.setPointerCapture(event.pointerId);
    onDraggingChange(true);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !groupRef.current) return;
    event.stopPropagation();
    const point = event.ray.intersectPlane(floorPlane.current, new THREE.Vector3());
    if (!point) return;
    const { maxX, maxZ } = getItemPlacementBounds(room, item.kind);
    const position: [number, number, number] = [
      Math.max(-maxX, Math.min(maxX, point.x + dragOffset.current.x)),
      0,
      Math.max(-maxZ, Math.min(maxZ, point.z + dragOffset.current.z)),
    ];
    groupRef.current.position.set(...position);
    finalPosition.current = position;
  };

  const finishDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    event.stopPropagation();
    dragging.current = false;
    const target = event.nativeEvent.target;
    if (target instanceof Element && target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    onDraggingChange(false);
    const start = startPosition.current;
    const next = finalPosition.current;
    if (start[0] !== next[0] || start[2] !== next[2]) {
      onMove(item.id, next);
    }
  };

  return (
    <group
      ref={groupRef}
      position={item.position}
      rotation={item.rotation}
      scale={selected ? 1.035 : 1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      {children}
      {selected && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.18, 1.24, 48]} />
          <meshBasicMaterial color="#0d9399" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

function Sofa() {
  return (
    <group>
      <RoundedBox args={[2.25, 0.42, 0.9]} position={[0, 0.48, 0]} radius={0.12} smoothness={4}>
        <meshStandardMaterial color="#373735" roughness={0.78} />
      </RoundedBox>
      <RoundedBox args={[2.25, 0.9, 0.28]} position={[0, 1.02, -0.34]} radius={0.12} smoothness={4}>
        <meshStandardMaterial color="#2d2d2b" roughness={0.8} />
      </RoundedBox>
      {[-0.72, 0, 0.72].map((x) => (
        <RoundedBox key={x} args={[0.67, 0.2, 0.68]} position={[x, 0.76, 0.05]} radius={0.08} smoothness={3}>
          <meshStandardMaterial color="#41413f" roughness={0.86} />
        </RoundedBox>
      ))}
      {[-0.96, 0.96].map((x) => (
        <RoundedBox key={x} args={[0.28, 0.72, 0.88]} position={[x, 0.67, 0]} radius={0.1} smoothness={3}>
          <meshStandardMaterial color="#333331" roughness={0.82} />
        </RoundedBox>
      ))}
      {[-0.88, 0.88].map((x) =>
        [-0.3, 0.3].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.17, z]}>
            <cylinderGeometry args={[0.035, 0.045, 0.3, 12]} />
            <meshStandardMaterial color="#b79a62" metalness={0.35} roughness={0.35} />
          </mesh>
        )),
      )}
    </group>
  );
}

function CoffeeTable() {
  return (
    <group>
      <RoundedBox args={[1.7, 0.12, 0.86]} position={[0, 0.55, 0]} radius={0.04} smoothness={3}>
        <meshStandardMaterial color="#6c4630" roughness={0.58} />
      </RoundedBox>
      {[-0.7, 0.7].map((x) =>
        [-0.3, 0.3].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.28, z]}>
            <boxGeometry args={[0.07, 0.55, 0.07]} />
            <meshStandardMaterial color="#252a2c" metalness={0.45} roughness={0.35} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Chair() {
  return (
    <group>
      <RoundedBox args={[0.68, 0.16, 0.66]} position={[0, 0.66, 0]} radius={0.06} smoothness={3}>
        <meshStandardMaterial color="#202428" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.68, 0.88, 0.12]} position={[0, 1.15, -0.27]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#2e3538" wireframe />
      </RoundedBox>
      {[-0.26, 0.26].map((x) =>
        [-0.24, 0.24].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.32, z]}>
            <boxGeometry args={[0.045, 0.65, 0.045]} />
            <meshStandardMaterial color="#7e8588" metalness={0.8} roughness={0.2} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Cabinet() {
  return (
    <group>
      <RoundedBox args={[0.9, 1.35, 0.72]} position={[0, 0.72, 0]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#92989a" metalness={0.25} roughness={0.48} />
      </RoundedBox>
      {[0.45, 0.9].map((y) => (
        <group key={y}>
          <mesh position={[0, y, 0.365]}>
            <boxGeometry args={[0.78, 0.025, 0.015]} />
            <meshStandardMaterial color="#5e6568" />
          </mesh>
          <mesh position={[0, y + 0.13, 0.38]}>
            <boxGeometry args={[0.24, 0.035, 0.03]} />
            <meshStandardMaterial color="#303638" metalness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Bed() {
  return (
    <group>
      <RoundedBox args={[1.5, 0.28, 2.02]} position={[0, 0.32, 0]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#6b4a2f" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[1.46, 0.22, 1.96]} position={[0, 0.55, 0]} radius={0.07} smoothness={3}>
        <meshStandardMaterial color="#e6e2d8" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[1.5, 0.62, 0.1]} position={[0, 0.63, -0.98]} radius={0.06} smoothness={3}>
        <meshStandardMaterial color="#5c4030" roughness={0.68} />
      </RoundedBox>
      {[-0.36, 0.36].map((x) => (
        <RoundedBox key={x} args={[0.6, 0.12, 0.38]} position={[x, 0.7, -0.74]} radius={0.06} smoothness={3}>
          <meshStandardMaterial color="#f2efe7" roughness={0.9} />
        </RoundedBox>
      ))}
      <RoundedBox args={[1.5, 0.06, 1.1]} position={[0, 0.68, 0.36]} radius={0.04} smoothness={3}>
        <meshStandardMaterial color="#9aa3a6" roughness={0.92} />
      </RoundedBox>
      {[[-0.66, 0.88], [0.66, 0.88], [-0.66, -0.88], [0.66, -0.88]].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.09, z]}>
          <boxGeometry args={[0.07, 0.18, 0.07]} />
          <meshStandardMaterial color="#3c3229" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function GlbModel({ model }: { model: ProductModel }) {
  const gltf = useGLTF(model.url);

  const { object, scale, offset } = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const nextScale = new THREE.Vector3(model.width / size.x, model.height / size.y, model.depth / size.z);
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return {
      object: clone,
      scale: nextScale,
      offset: new THREE.Vector3(-center.x * nextScale.x, -bounds.min.y * nextScale.y, -center.z * nextScale.z),
    };
  }, [gltf, model]);

  return (
    <group position={offset} scale={scale}>
      <primitive object={object} />
    </group>
  );
}

function Furniture({ item }: { item: PlacedItem }) {
  const model = productModels[item.productId];

  if (model) {
    return (
      <Suspense fallback={<Placeholder item={item} />}>
        <GlbModel model={model} />
      </Suspense>
    );
  }

  return <Placeholder item={item} />;
}

function Placeholder({ item }: { item: PlacedItem }) {
  if (item.kind === "sofa") return <Sofa />;
  if (item.kind === "table") return <CoffeeTable />;
  if (item.kind === "bed") return <Bed />;
  if (item.kind === "chair") return <Chair />;
  return <Cabinet />;
}

function DoorFeature({ room }: { room: RoomConfig }) {
  if (!room.door.enabled) return null;
  if (room.door.style === "sliding") return <SlidingDoor room={room} />;

  const width = Math.min(room.door.width, room.depth - 0.7);
  const height = Math.min(room.door.height, room.height - 0.08);
  const z = room.door.position * (room.depth - width);
  const panelWidth = width * 0.62;

  return (
    <group position={[-room.width / 2 + 0.055, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[width, height, 0.05]} />
        <meshStandardMaterial color="#eceeec" roughness={0.6} />
      </mesh>
      {[
        { y: height * 0.67, h: height * 0.44 },
        { y: height * 0.21, h: height * 0.2 },
      ].map((panel) => (
        <mesh key={panel.y} position={[0, panel.y, 0.028]} castShadow>
          <boxGeometry args={[panelWidth, panel.h, 0.012]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      ))}
      {[-width / 2 - 0.035, width / 2 + 0.035].map((x) => (
        <mesh key={x} position={[x, height / 2, 0.02]} castShadow>
          <boxGeometry args={[0.07, height + 0.08, 0.095]} />
          <meshStandardMaterial color="#fbfbfa" roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.035, 0.02]} castShadow>
        <boxGeometry args={[width + 0.14, 0.07, 0.095]} />
        <meshStandardMaterial color="#fbfbfa" roughness={0.55} />
      </mesh>
      <group position={[width * 0.36, height * 0.47, 0.03]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.034, 0.022, 20]} />
          <meshStandardMaterial color="#2c2d2e" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[-0.08, 0, 0.024]} castShadow>
          <boxGeometry args={[0.15, 0.022, 0.022]} />
          <meshStandardMaterial color="#2c2d2e" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

function StyledRoom({ room }: { room: RoomConfig }) {
  const rugWidth = Math.min(2.6, room.width * 0.58);
  const rugDepth = Math.min(2, room.depth * 0.62);

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial color={room.floorColor} roughness={0.92} />
      </mesh>
      <ArchitecturalWalls room={room} />
      <DoorFeature room={room} />
      <DesignerWindow room={room} />
      <Chandelier room={room} />
      {!room.emptyShell && <mesh position={[-room.width * 0.2, 0.018, room.depth * 0.14]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[rugWidth, rugDepth]} />
        <meshStandardMaterial color="#d8d2c5" roughness={1} />
      </mesh>}
    </group>
  );
}

function RoomResizeHandle({
  room,
  dimension,
  side,
  onPreview,
  onResize,
  onDraggingChange,
}: {
  room: RoomConfig;
  dimension: "width" | "depth";
  side: -1 | 1;
  onPreview: (dimension: "width" | "depth", value: number) => void;
  onResize: (dimension: "width" | "depth", value: number) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const dragging = useRef(false);
  const nextValue = useRef<number | null>(null);
  const startValue = useRef(room[dimension]);
  const floor = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const position: [number, number, number] = dimension === "width"
    ? [side * room.width / 2, 0.12, 0]
    : [0, 0.12, side * room.depth / 2];

  const pointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    event.stopPropagation();
    const hit = event.ray.intersectPlane(floor.current, new THREE.Vector3());
    if (!hit) return;
    const coordinate = dimension === "width" ? hit.x : hit.z;
    const value = Math.round(THREE.MathUtils.clamp(side * coordinate * 2, 2.5, 12) * 10) / 10;
    nextValue.current = value;
    onPreview(dimension, value);
  };

  const finish = (event: ThreeEvent<PointerEvent>, commit = true) => {
    if (!dragging.current) return;
    event.stopPropagation();
    dragging.current = false;
    setActive(false);
    const target = event.nativeEvent.target;
    if (target instanceof Element && target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    if (target instanceof HTMLElement) target.style.cursor = "";
    onDraggingChange(false);
    if (commit && nextValue.current !== null && nextValue.current !== startValue.current) {
      onResize(dimension, nextValue.current);
    }
    nextValue.current = null;
  };

  return (
    <group position={position}>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          if (event.nativeEvent.target instanceof HTMLElement) {
            event.nativeEvent.target.style.cursor = dimension === "width" ? "ew-resize" : "ns-resize";
          }
        }}
        onPointerOut={(event) => {
          setHovered(false);
          if (!dragging.current && event.nativeEvent.target instanceof HTMLElement) {
            event.nativeEvent.target.style.cursor = "";
          }
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          dragging.current = true;
          setActive(true);
          nextValue.current = null;
          startValue.current = room[dimension];
          const target = event.nativeEvent.target;
          if (target instanceof Element) target.setPointerCapture(event.pointerId);
          onDraggingChange(true);
        }}
        onPointerMove={pointerMove}
        onPointerUp={finish}
        onPointerCancel={(event) => finish(event, false)}
      >
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group rotation={dimension === "width" ? [0, 0, 0] : [0, Math.PI / 2, 0]}>
        <RoundedBox args={[0.25, 0.065, 0.09]} radius={0.03} smoothness={4} raycast={() => null}>
          <meshStandardMaterial color={hovered || active ? "#087c82" : "#177f83"} metalness={0.24} roughness={0.36} depthTest={false} />
        </RoundedBox>
        <mesh position={[0, 0.034, 0]} raycast={() => null}>
          <boxGeometry args={[0.11, 0.004, 0.008]} />
          <meshBasicMaterial color="#e5faf8" depthTest={false} />
        </mesh>
      </group>
    </group>
  );
}

export function RoomScene({
  cameraView,
  showGrid,
  zoomRequest,
  room,
  placedItems,
  selectedId,
  onSelect,
  onMove,
  onResize,
}: RoomSceneProps) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewRoom, setPreviewRoom] = useState<RoomConfig | null>(null);
  const visibleRoom = previewRoom ?? room;

  useEffect(() => {
    const probeId = window.requestAnimationFrame(() => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      setWebglAvailable(Boolean(context));
    });

    return () => window.cancelAnimationFrame(probeId);
  }, []);

  if (webglAvailable === null) {
    return (
      <div className="scene-loading">
        <div className="scene-loading-mark" />
        <span>Preparing your room</span>
      </div>
    );
  }

  if (!webglAvailable) {
    return (
      <div className="webgl-fallback">
        <div className="fallback-room">
          <div className="fallback-window" />
          <div className="fallback-sofa" />
          <div className="fallback-table" />
          <div className="fallback-rug" />
        </div>
        <div className="fallback-message">
          <strong>3D preview is unavailable</strong>
          <span>Enable hardware acceleration or open the planner in a WebGL-compatible browser.</span>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: initialCameraPosition, fov: 42 }}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={["#e9eeee"]} />
      <fog attach="fog" args={["#e9eeee", 14, 24]} />
      <ambientLight intensity={1.4} />
      <directionalLight castShadow position={[4, 8, 5]} intensity={2.3} shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 4, -2]} intensity={0.6} color="#caecee" />
      <CameraRig view={cameraView} room={room} zoomRequest={zoomRequest} />
      <StyledRoom room={visibleRoom} />
      {(["width", "depth"] as const).flatMap((dimension) =>
        ([-1, 1] as const).map((side) => (
          <RoomResizeHandle
            key={`${dimension}-${side}`}
            room={visibleRoom}
            dimension={dimension}
            side={side}
            onPreview={(key, value) => setPreviewRoom((current) => ({ ...(current ?? room), [key]: value }))}
            onResize={onResize}
            onDraggingChange={(active) => { setDragging(active); if (!active) setPreviewRoom(null); }}
          />
        )),
      )}
      {placedItems.map((item) => (
        <DraggableFurniture
          key={item.id}
          item={item}
          room={room}
          selected={selectedId === item.id}
          dragEnabled={cameraView !== "front"}
          onSelect={onSelect}
          onMove={onMove}
          onDraggingChange={setDragging}
        >
          <Furniture item={item} />
        </DraggableFurniture>
      ))}
      {showGrid && (
        <Grid
          position={[0, 0.025, 0]}
          args={[room.width, room.depth]}
          cellSize={0.5}
          cellThickness={0.55}
          cellColor="#6c9698"
          sectionSize={1}
          sectionThickness={0.85}
          sectionColor="#0d9399"
          fadeDistance={Math.max(room.width, room.depth) * 2.5}
          fadeStrength={1.5}
          infiniteGrid={false}
        />
      )}
      <ContactShadows
        position={[0, 0.03, 0]}
        opacity={0.3}
        scale={Math.max(room.width, room.depth) * 1.4}
        blur={2.8}
        far={room.height + 2}
      />
      <OrbitControls
        makeDefault
        enableDamping
        enabled={!dragging}
        minDistance={Math.max(room.width, room.depth)}
        maxDistance={Math.max(room.width, room.depth) * 3.5}
        maxPolarAngle={cameraView === "top" ? 0.15 : Math.PI / 2.02}
        target={[0, room.height * 0.3, 0]}
      />
    </Canvas>
  );
}

