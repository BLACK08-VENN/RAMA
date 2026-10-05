"use client";

import { useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { getStoragePlacement, isBedroomRoom, type RoomConfig } from "@/stores/planner-store";

export function BuiltInStorage({ room, dragEnabled, onMove, onDraggingChange }: { room: RoomConfig; dragEnabled: boolean; onMove: (position: [number, number]) => void; onDraggingChange: (dragging: boolean) => void }) {
  const invalidate = useThree(state => state.invalidate);
  const group = useRef<THREE.Group>(null);
  const dragging = useRef(false), offset = useRef(new THREE.Vector3());
  const nextPosition = useRef<[number, number] | null>(null);
  const floor = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  if (!isBedroomRoom(room) || !room.builtInStorage?.enabled) return null;
  const width = Math.min(room.builtInStorage.width, room.depth - .4, room.width - .4);
  const height = Math.min(room.height - .12, 2.6);
  const bays = Math.max(2, Math.ceil(width / .8)), bayWidth = width / bays;
  const clamp = (x: number, z: number) => getStoragePlacement(room, [x, z]);
  const position = getStoragePlacement(room);
  const rotation = (room.builtInStorage.rotation ?? -90) * Math.PI / 180;
  const finish = (event: ThreeEvent<PointerEvent>, commit: boolean) => {
    if (!dragging.current) return;
    event.stopPropagation(); dragging.current = false;
    const target = event.nativeEvent.target;
    if (target instanceof Element && target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    if (commit && nextPosition.current) onMove(nextPosition.current);
    else group.current?.position.set(position[0], 0, position[1]);
    nextPosition.current = null; invalidate(); onDraggingChange(false);
  };
  return <group ref={group} position={[position[0],0,position[1]]} rotation={[0,rotation,0]}
    onPointerDown={event => { if (!dragEnabled) return; event.stopPropagation(); const hit = event.ray.intersectPlane(floor.current, new THREE.Vector3()); if (!hit) return; dragging.current = true; offset.current.set(position[0]-hit.x,0,position[1]-hit.z); nextPosition.current = null; const target = event.nativeEvent.target; if(target instanceof Element) target.setPointerCapture(event.pointerId); onDraggingChange(true); }}
    onPointerMove={event => { if (!dragging.current || !group.current) return; event.stopPropagation(); const hit = event.ray.intersectPlane(floor.current,new THREE.Vector3()); if (!hit) return; const next = clamp(hit.x+offset.current.x, hit.z+offset.current.z); group.current.position.set(next[0],0,next[1]); nextPosition.current = next; invalidate(); }}
    onPointerUp={event => finish(event,true)} onPointerCancel={event => finish(event,false)}>

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
