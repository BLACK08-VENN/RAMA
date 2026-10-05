"use client";

import { Environment, Grid, Html, OrbitControls, PerformanceMonitor, RoundedBox, useGLTF } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { productById, productModels, type ProductModel } from "@/data/products";
import {
  clampItemPosition,
  wallRotation,
  type WallSide,
  getOutdoorMetrics,
  type PlacedItem,
  type RoomConfig,
} from "@/stores/planner-store";

import { createWallDragProjection, isWallVisible } from "./wall-drag";
import { useObjectDrag, pointerCaptureTarget } from "./use-object-drag";
import { DecorModel } from "./decor-models";
import { DiningSink } from "./dining-sink";
import { BuiltInStorage } from "./built-in-storage";
import { OutdoorSpaces } from "./outdoor-spaces";
import { FloorSurface } from "./floor-surface";
import { CutawayWall, ArchitecturalWalls, Ceiling, DesignerWindow, SlidingDoor, Chandelier } from "./architectural-features";

export type CameraView = "perspective" | "top" | "front";

type ZoomRequest = {
  id: number;
  direction: "in" | "out";
};

type RoomSceneProps = {
  cameraView: CameraView;
  editMode: boolean;
  showGrid: boolean;
  zoomRequest: ZoomRequest;
  room: RoomConfig;
  placedItems: PlacedItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: [number, number, number], wall?: WallSide) => void;
  onResize: (dimension: "width" | "depth", value: number) => void;
  onStorageMove: (position: [number, number]) => void;
};

const initialCameraPosition: [number, number, number] = [7, 5.5, 7];

// Zooming all the way in drops the camera to standing height and looks the room dead level,
// so the far end of the space reads like you are standing in it rather than hovering above it.
const EYE_HEIGHT = 1.55;
const WALK_ELEVATION = 0.1;
const WALK_DISTANCE = 0.9;
const MIN_CAMERA_DISTANCE = 0.7;
const ZOOM_STEP = 0.34;
const MAX_ZOOM_BACK = 1;
const TOP_VIEW_ZOOM = 0.28;

// Renders at up to 2x device pixels. A phone at 3x would be sharper still, but the fragment
// cost of MSAA plus a 2048 shadow map makes the orbit draggy long before the extra pixels
// are visible, so 2x is the point where sharpness stops paying for itself.
const MAX_PIXEL_RATIO = 2;
const MIN_PIXEL_RATIO = 1;
const SHADOW_MAP_SIZE = 2048;
const ENVIRONMENT_INTENSITY = 0.4;

type CameraPose = { position: THREE.Vector3; target: THREE.Vector3 };

// Starts at the device ceiling and walks the pixel ratio down while frames run long, so a
// strong phone keeps the full 2x and a weak one still gets smooth orbiting instead of a
// frozen canvas. On demand rendering the monitor only samples frames that are actually
// drawn, which means it reacts during orbiting and zooming rather than penalising idling.
function AdaptiveResolution() {
  const setDpr = useThree(state => state.setDpr);
  const ceiling = useMemo(() => Math.min(window.devicePixelRatio || MIN_PIXEL_RATIO, MAX_PIXEL_RATIO), []);
  useEffect(() => { setDpr(ceiling); }, [ceiling, setDpr]);
  return (
    <PerformanceMonitor
      factor={1}
      flipflops={4}
      onChange={({ factor }) => setDpr(MIN_PIXEL_RATIO + factor * (ceiling - MIN_PIXEL_RATIO))}
      onFallback={() => setDpr(MIN_PIXEL_RATIO)}
    />
  );
}

// A procedural light rig gives every standard material something to reflect, which is what
// stops the floor and the sofa reading as flat matte colour. It is built from child geometry
// and prefiltered once, so it costs no download and no bytes on the wire.
const softboxes: { position: [number, number, number]; scale: [number, number, number]; tint: string }[] = [
  { position: [-5, 4, 2], scale: [7, 5, 1], tint: "#ffffff" },
  { position: [5, 3, -3], scale: [4, 3, 1], tint: "#dff2f4" },
  { position: [0, 7, 0], scale: [9, 9, 1], tint: "#f6fafa" },
];

function StudioEnvironment() {
  return (
    <Environment frames={1} resolution={256} environmentIntensity={ENVIRONMENT_INTENSITY}>
      <color attach="background" args={["#8f9a9b"]} />
      {softboxes.map((box, index) => (
        <mesh key={`softbox-${index}`} position={box.position} scale={box.scale}>
          <planeGeometry />
          <meshBasicMaterial color={box.tint} />
        </mesh>
      ))}
    </Environment>
  );
}

function viewPose(view: CameraView, roomHeight: number, span: number, centerZ: number): CameraPose {
  const offsets: Record<CameraView, [number, number, number]> = {
    perspective: [span * 1.35, span, span * 1.35],
    top: [0, span * 2.25, 0.01],
    front: [0, span * 0.7, span * 2],
  };
  const [x, y, z] = offsets[view];
  return {
    position: new THREE.Vector3(x, y, z + centerZ),
    target: new THREE.Vector3(0, roomHeight * 0.35, centerZ),
  };
}

/**
 * Reshapes the view's framing along the current orbit bearing. `immersion` runs 0 at the
 * default framing, 1 fully inside the room, and negative for pulling back past the default.
 */
function poseImmersion(
  base: CameraPose,
  centerZ: number,
  azimuth: number,
  immersion: number,
  walkable: boolean,
): CameraPose {
  const offset = base.position.clone().sub(base.target);
  const baseDistance = Math.max(offset.length(), 0.001);
  const baseElevation = Math.asin(THREE.MathUtils.clamp(offset.y / baseDistance, -1, 1));
  const inward = Math.max(0, immersion);
  const outward = Math.max(0, -immersion);

  if (!walkable) {
    const distance = inward > 0
      ? baseDistance * THREE.MathUtils.lerp(1, TOP_VIEW_ZOOM, inward)
      : baseDistance * (1 + outward * 0.55);
    return { position: base.target.clone().add(offset.setLength(distance)), target: base.target.clone() };
  }

  const distance = inward > 0
    ? THREE.MathUtils.lerp(baseDistance, WALK_DISTANCE, inward)
    : baseDistance * (1 + outward * 0.55);
  const elevation = inward > 0
    ? THREE.MathUtils.lerp(baseElevation, WALK_ELEVATION, inward)
    : baseElevation + outward * 0.12;
  const target = new THREE.Vector3(
    0,
    inward > 0 ? THREE.MathUtils.lerp(base.target.y, EYE_HEIGHT, inward) : base.target.y,
    centerZ,
  );
  const flat = Math.cos(elevation) * distance;
  return {
    target,
    position: new THREE.Vector3(
      target.x + Math.sin(azimuth) * flat,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * flat,
    ),
  };
}

function CameraRig({
  view,
  room,
  zoomRequest,
  controlsRef,
}: {
  view: CameraView;
  room: RoomConfig;
  zoomRequest: ZoomRequest;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const { span, centerZ } = getOutdoorMetrics(room);
  const roomHeight = room.height;
  const goal = useRef<CameraPose | null>(viewPose("perspective", roomHeight, span, centerZ));
  const lastZoomRequest = useRef(zoomRequest.id);

  useEffect(() => {
    goal.current = viewPose(view, roomHeight, span, centerZ);
    invalidate();
  }, [view, roomHeight, span, centerZ, invalidate]);

  // A hand on the scene takes priority, so stop easing the moment they orbit or pinch.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const takeOver = () => {
      goal.current = null;
    };
    controls.addEventListener("start", takeOver);
    return () => controls.removeEventListener("start", takeOver);
  }, [camera, controlsRef]);

  useEffect(() => {
    if (zoomRequest.id === lastZoomRequest.current) return;
    lastZoomRequest.current = zoomRequest.id;

    const base = viewPose(view, roomHeight, span, centerZ);
    // Read immersion off the live camera so pinching and stepping never disagree.
    const offset = camera.position.clone().sub(controlsRef.current?.target ?? base.target);
    const spread = Math.max(base.position.distanceTo(base.target) - WALK_DISTANCE, 0.001);
    const immersion = THREE.MathUtils.clamp(
      (base.position.distanceTo(base.target) - offset.length()) / spread
        + (zoomRequest.direction === "in" ? ZOOM_STEP : -ZOOM_STEP),
      -MAX_ZOOM_BACK,
      1,
    );
    goal.current = poseImmersion(base, centerZ, Math.atan2(offset.x, offset.z), immersion, view !== "top");
    invalidate();
  }, [camera, centerZ, controlsRef, roomHeight, span, view, zoomRequest, invalidate]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls?.enabled || !goal.current) return;
    if (goal.current.position.distanceTo(camera.position) < 0.005 && goal.current.target.distanceTo(controls.target) < 0.005) { goal.current = null; return; }
    const alpha = 1 - Math.exp(-5.5 * Math.min(delta, 0.1));
    camera.position.lerp(goal.current.position, alpha);
    controls.target.lerp(goal.current.target, alpha);
    controls.update();
    invalidate();
  });

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
  onMove: (id: string, position: [number, number, number], wall?: WallSide) => void;
  onDraggingChange: (dragging: boolean) => void;
  children: React.ReactNode;
}) {
  const decor = productById[item.productId]?.decor;
  const mounted = decor?.mount === "wall";
  const wall = item.wall ?? "back";
  const previewWall = useRef<WallSide>(wall);
  const camera = useThree(state => state.camera);
  useEffect(() => { previewWall.current = wall; }, [wall]);
  const drag = useObjectDrag({
    enabled: dragEnabled,
    position: item.position,
    normal: mounted ? new THREE.Vector3(wall === "left" || wall === "right" ? 1 : 0, 0, wall === "left" || wall === "right" ? 0 : 1) : new THREE.Vector3(0, 1, 0),
    clamp: position => clampItemPosition(room, item.kind, position, item.productId, mounted ? previewWall.current : item.wall, item.rotation[1]),
    createProjection: mounted ? (origin, grabbed) => {
      previewWall.current = wall;
      const project = createWallDragProjection(room, wall, origin, grabbed, camera.position.clone());
      return ray => {
        const result = project(ray);
        if (!result) return null;
        previewWall.current = result.wall;
        return result.position;
      };
    } : undefined,
    onPreview: mounted ? (group, position) => {
      const angle = wallRotation[previewWall.current];
      // Keep the piece flush against its new wall rather than easing through the corner.
      if (Math.abs(group.rotation.y - angle) > .001) group.position.set(...position);
      group.rotation.set(0, angle, 0);
    } : undefined,
    onCancel: () => { previewWall.current = wall; },
    isVisible: mounted ? () => isWallVisible(room, previewWall.current, camera.position) : undefined,
    onSelect: () => onSelect(item.id),
    onMove: position => onMove(item.id, position, mounted ? previewWall.current : undefined),
    onDraggingChange,
  });

  return (
    <group
      {...drag}
      position={item.position}
      rotation={item.rotation}
      scale={selected ? 1.035 : 1}
    >
      {children}
      {selected && !mounted && (
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
      <RoundedBox args={[2.25, 0.42, 0.9]} position={[0, 0.48, 0]} radius={0.12} smoothness={2} bevelSegments={2}>
        <meshStandardMaterial color="#373735" roughness={0.78} />
      </RoundedBox>
      <RoundedBox args={[2.25, 0.9, 0.28]} position={[0, 1.02, -0.34]} radius={0.12} smoothness={2} bevelSegments={2}>
        <meshStandardMaterial color="#2d2d2b" roughness={0.8} />
      </RoundedBox>
      {[-0.72, 0, 0.72].map((x) => (
        <RoundedBox key={x} args={[0.67, 0.2, 0.68]} position={[x, 0.76, 0.05]} radius={0.08} smoothness={2} bevelSegments={2}>
          <meshStandardMaterial color="#41413f" roughness={0.86} />
        </RoundedBox>
      ))}
      {[-0.96, 0.96].map((x) => (
        <RoundedBox key={x} args={[0.28, 0.72, 0.88]} position={[x, 0.67, 0]} radius={0.1} smoothness={2} bevelSegments={2}>
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
      <RoundedBox args={[1.7, 0.12, 0.86]} position={[0, 0.55, 0]} radius={0.04} smoothness={2} bevelSegments={2}>
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
      <RoundedBox args={[0.68, 0.16, 0.66]} position={[0, 0.66, 0]} radius={0.06} smoothness={2} bevelSegments={2}>
        <meshStandardMaterial color="#202428" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.68, 0.88, 0.12]} position={[0, 1.15, -0.27]} radius={0.05} smoothness={2} bevelSegments={2}>
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
      <RoundedBox args={[0.9, 1.35, 0.72]} position={[0, 0.72, 0]} radius={0.05} smoothness={2} bevelSegments={2}>
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
      <RoundedBox args={[1.5, 0.28, 2.02]} position={[0, 0.32, 0]} radius={0.05} smoothness={2} bevelSegments={2}>
        <meshStandardMaterial color="#6b4a2f" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[1.46, 0.22, 1.96]} position={[0, 0.55, 0]} radius={0.07} smoothness={2} bevelSegments={2}>
        <meshStandardMaterial color="#e6e2d8" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[1.5, 0.62, 0.1]} position={[0, 0.63, -0.98]} radius={0.06} smoothness={2} bevelSegments={2}>
        <meshStandardMaterial color="#5c4030" roughness={0.68} />
      </RoundedBox>
      {[-0.36, 0.36].map((x) => (
        <RoundedBox key={x} args={[0.6, 0.12, 0.38]} position={[x, 0.7, -0.74]} radius={0.06} smoothness={2} bevelSegments={2}>
          <meshStandardMaterial color="#f2efe7" roughness={0.9} />
        </RoundedBox>
      ))}
      <RoundedBox args={[1.5, 0.06, 1.1]} position={[0, 0.68, 0.36]} radius={0.04} smoothness={2} bevelSegments={2}>
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
  const maxAnisotropy = useThree(state => state.gl.capabilities.getMaxAnisotropy());

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
      // The imported fabric maps are authored for a distant camera, so they blur out once
      // you walk up to the sofa. Sharpening their filtering keeps the weave readable close in.
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        const textured = material as THREE.MeshStandardMaterial;
        [textured.map, textured.normalMap, textured.roughnessMap].forEach((surface) => {
          if (surface) surface.anisotropy = maxAnisotropy;
        });
      });
    });
    return {
      object: clone,
      scale: nextScale,
      offset: new THREE.Vector3(-center.x * nextScale.x, -bounds.min.y * nextScale.y, -center.z * nextScale.z),
    };
  }, [gltf, model, maxAnisotropy]);

  return (
    <group position={offset} scale={scale}>
      <primitive object={object} />
    </group>
  );
}

function Furniture({ item }: { item: PlacedItem }) {
  if (["plant", "rug", "mirror", "vase", "wall-art"].includes(item.kind)) return <DecorModel item={item} />;
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

function StyledRoom({ room, editMode, onStorageMove, onDraggingChange }: { room: RoomConfig; editMode: boolean; onStorageMove: (position: [number, number]) => void; onDraggingChange: (dragging: boolean) => void }) {
  if (room.spaceType === "balcony" || room.spaceType === "garden") return <OutdoorSpaces room={room} />;
  return (
    <group>
      <FloorSurface room={room} />
      <OutdoorSpaces room={room} />
      <ArchitecturalWalls room={room} />
      <Ceiling room={room} />
      <CutawayWall room={room} wall="left"><DoorFeature room={room} /></CutawayWall>
      <CutawayWall room={room} wall="back"><DesignerWindow room={room} /></CutawayWall>
      <Chandelier room={room} />
      <BuiltInStorage dragEnabled={editMode} room={room} onMove={onStorageMove} onDraggingChange={onDraggingChange} />
      <DiningSink room={room} />
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
  const startCoordinate = useRef(0);
  const floor = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const [startMeasurement, setStartMeasurement] = useState(room[dimension]);
  const position: [number, number, number] = dimension === "width"
    ? [side * room.width / 2, 0.12, 0]
    : [0, 0.12, side * room.depth / 2];

  const pointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    event.stopPropagation();
    const hit = event.ray.intersectPlane(floor.current, new THREE.Vector3());
    if (!hit) return;
    const coordinate = dimension === "width" ? hit.x : hit.z;
    const delta = side * (coordinate - startCoordinate.current);
    if (Math.abs(delta) < .05) return;
    const value = Math.round(THREE.MathUtils.clamp(startValue.current + delta * .8, 2.5, 12) * 10) / 10;
    if (value === nextValue.current) return;
    nextValue.current = value;
    onPreview(dimension, value);
  };

  const finish = (event: ThreeEvent<PointerEvent>, commit = true) => {
    if (!dragging.current) return;
    event.stopPropagation();
    dragging.current = false;
    setActive(false);
    const target = event.nativeEvent.target;
    if (pointerCaptureTarget(event).hasPointerCapture(event.pointerId)) {
      pointerCaptureTarget(event).releasePointerCapture(event.pointerId);
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
      {active && <Html position={[0, .42, 0]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
        <div className="resize-readout"><strong>{dimension === "width" ? "Width" : "Depth"}: {room[dimension].toFixed(1)} m</strong>{active && <span>{room[dimension] - startMeasurement >= 0 ? "+" : ""}{(room[dimension] - startMeasurement).toFixed(1)} m change · {(room.width * room.depth).toFixed(1)} m² floor</span>}</div>
      </Html>}
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
          const hit = event.ray.intersectPlane(floor.current, new THREE.Vector3());
          if (!hit) return;
          startCoordinate.current = dimension === "width" ? hit.x : hit.z;
          dragging.current = true;
          setActive(true);
          nextValue.current = null;
          startValue.current = room[dimension];
          setStartMeasurement(room[dimension]);
          pointerCaptureTarget(event).setPointerCapture(event.pointerId);
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
        <RoundedBox args={[0.25, 0.065, 0.09]} radius={0.03} smoothness={2} bevelSegments={2} raycast={() => null}>
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
  editMode,
  showGrid,
  zoomRequest,
  room,
  placedItems,
  selectedId,
  onSelect,
  onMove,
  onResize,
  onStorageMove,
}: RoomSceneProps) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewRoom, setPreviewRoom] = useState<RoomConfig | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const visibleRoom = previewRoom ?? room;
  const handleDraggingChange = (active: boolean) => {
    const controls = controlsRef.current;
    if (controls) {
      if (active) controls.dispatchEvent({ type: "start", target: controls });
      controls.enabled = !active;
    }
    setDragging(active);
  };
  // Fit the shadow frustum to the space instead of a fixed 24m box, so every one of the
  // 2048 texels lands on the room and the contact shadows under the furniture stay crisp.
  const shadowExtent = useMemo(() => getOutdoorMetrics(visibleRoom).span * 0.9 + 1.5, [visibleRoom]);

  useEffect(() => {
    const probeId = window.requestAnimationFrame(() => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      setWebglAvailable(Boolean(context));
      context?.getExtension("WEBGL_lose_context")?.loseContext();
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
      frameloop="demand"
      // "percentage" is PCFShadowMap. Both the bare boolean and "soft" resolve to
      // PCFSoftShadowMap, which three deprecated in r186, so the renderer silently
      // downgraded them. PCF still honours shadow-radius, which is where the softness
      // on these shadows actually comes from.
      shadows="percentage"
      dpr={[MIN_PIXEL_RATIO, MAX_PIXEL_RATIO]}
      camera={{ position: initialCameraPosition, fov: 42 }}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={["#e9eeee"]} />
      <fog attach="fog" args={["#e9eeee", getOutdoorMetrics(room).span * 3, getOutdoorMetrics(room).span * 5]} />
      <AdaptiveResolution />
      <StudioEnvironment />
      <ambientLight intensity={1.4} />
      <directionalLight
        castShadow
        position={[4, 8, 5]}
        intensity={2.3}
        shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={0.5}
        shadow-camera-far={26}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      <directionalLight position={[-4, 4, -2]} intensity={0.6} color="#caecee" />
      <CameraRig view={cameraView} room={room} zoomRequest={zoomRequest} controlsRef={controlsRef} />
      <StyledRoom editMode={editMode} room={visibleRoom} onStorageMove={onStorageMove} onDraggingChange={handleDraggingChange} />
      {editMode && (["width", "depth"] as const).flatMap((dimension) =>
        ([-1, 1] as const).map((side) => (
          <RoomResizeHandle
            key={`${dimension}-${side}`}
            room={visibleRoom}
            dimension={dimension}
            side={side}
            onPreview={(key, value) => setPreviewRoom((current) => ({ ...(current ?? room), [key]: value }))}
            onResize={onResize}
            onDraggingChange={(active) => { handleDraggingChange(active); if (!active) setPreviewRoom(null); }}
          />
        )),
      )}
      {placedItems.map((item) => {
        const content = (
        <DraggableFurniture
          key={item.id}
          item={item}
          room={room}
          selected={selectedId === item.id}
          dragEnabled={editMode && (cameraView !== "front" || productById[item.productId]?.decor?.mount === "wall")}
          onSelect={onSelect}
          onMove={onMove}
          onDraggingChange={handleDraggingChange}
        >
          <Furniture item={item} />
        </DraggableFurniture>
        );
        return content;
      })}
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
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        enabled={!dragging}
        minDistance={MIN_CAMERA_DISTANCE}
        maxDistance={getOutdoorMetrics(room).span * 3.5}
        maxPolarAngle={cameraView === "top" ? 0.15 : Math.PI / 2.02}
      />
    </Canvas>
  );
}

