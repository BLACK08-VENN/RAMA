"use client";

import { Html } from "@react-three/drei";
import { RotateCcw } from "lucide-react";
import * as THREE from "three";
import { useObjectDrag } from "./use-object-drag";
import { getStoragePlacement, getRotatedStorage, usePlannerStore, isBedroomRoom, type RoomConfig } from "@/stores/planner-store";

export function BuiltInStorage({ room, dragEnabled, onMove, onDraggingChange }: { room: RoomConfig; dragEnabled: boolean; onMove: (position: [number, number]) => void; onDraggingChange: (dragging: boolean) => void }) {
  const updateRoom = usePlannerStore(state => state.updateRoom);
  const position = getStoragePlacement(room);
  const drag = useObjectDrag({
    enabled: dragEnabled,
    position: [position[0], 0, position[1]],
    normal: new THREE.Vector3(0, 1, 0),
    clamp: ([x, , z]) => { const next = getStoragePlacement(room, [x, z]); return [next[0], 0, next[1]]; },
    onMove: ([x, , z]) => onMove([x, z]),
    onDraggingChange,
  });
  if (!isBedroomRoom(room) || !room.builtInStorage?.enabled) return null;
  const width = Math.min(room.builtInStorage.width, room.depth - .4, room.width - .4);
  const height = Math.min(room.height - .12, 2.6);
  const bays = Math.max(2, Math.ceil(width / .8)), bayWidth = width / bays;
  const rotation = (room.builtInStorage.rotation ?? -90) * Math.PI / 180;
  return <group {...drag} position={[position[0],0,position[1]]} rotation={[0,rotation,0]}>

    {dragEnabled && <Html position={[0, height + .25, 0]} center zIndexRange={[8, 0]}>
      <button className="storage-scene-rotate" aria-label="Rotate bedroom drawers 45 degrees" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); updateRoom({ builtInStorage: getRotatedStorage(room, 45) }); }}><RotateCcw size={18} /><span>Rotate</span></button>
    </Html>}
    <mesh castShadow receiveShadow position={[0, height / 2, 0]}><boxGeometry args={[width, height, .58]} /><meshStandardMaterial color="#b9a487" roughness={.75} /></mesh>
    <mesh position={[0, .06, .29]}><boxGeometry args={[width - .05, .12, .03]} /><meshStandardMaterial color="#665e52" roughness={.8} /></mesh>
    {Array.from({length:bays},(_,i) => { const x=-width/2+bayWidth*(i+.5); return <group key={i} position={[x,0,.305]}>
      <mesh castShadow position={[0, .9+(height-.9)/2, 0]}><boxGeometry args={[bayWidth-.025,height-.93,.035]} /><meshStandardMaterial color="#e6dfd3" roughness={.65} /></mesh>
      <mesh position={[bayWidth*.3,1.45,.035]}><boxGeometry args={[.018,.24,.025]} /><meshStandardMaterial color="#a4864d" metalness={.7} roughness={.3} /></mesh>
      {[.25,.5,.75].map(y=><group key={y} position={[0,y,0]}>
        <mesh castShadow><boxGeometry args={[bayWidth-.025,.225,.045]} /><meshStandardMaterial color="#d4c5ae" roughness={.65} /></mesh>
        <mesh position={[0,.035,.04]}><boxGeometry args={[bayWidth*.35,.018,.025]} /><meshStandardMaterial color="#a4864d" metalness={.7} roughness={.3} /></mesh>
      </group>)}
    </group>;})}
  </group>;
}
