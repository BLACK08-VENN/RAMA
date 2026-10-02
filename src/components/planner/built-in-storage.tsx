"use client";

import type { RoomConfig } from "@/stores/planner-store";

export function BuiltInStorage({ room }: { room: RoomConfig }) {
  if (!room.builtInStorage?.enabled) return null;
  const width = Math.min(room.builtInStorage.width, room.depth - .4);
  const height = Math.min(room.height - .12, 2.6);
  const bays = Math.max(2, Math.ceil(width / .8)), bayWidth = width / bays;
  return <group position={[room.width / 2 - .3, 0, -room.depth / 2 + width / 2 + .2]} rotation={[0, -Math.PI / 2, 0]}>
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
