"use client";
import type { RoomConfig } from "@/stores/planner-store";

export function DiningSink({ room }: { room: RoomConfig }) {
  if (!room.diningSink) return null;
  return <group position={[room.width/2-.43,0,room.depth/2-.4]} rotation={[0,-Math.PI/2,0]}>
    <mesh castShadow receiveShadow position={[0,.4,0]}><boxGeometry args={[.72,.8,.5]} /><meshStandardMaterial color="#b99d76" roughness={.7} /></mesh>
    {[-1,1].map(side=><group key={side}>
      <mesh position={[side*.18,.43,.26]}><boxGeometry args={[.345,.68,.025]} /><meshStandardMaterial color="#d3bea0" roughness={.65} /></mesh>
      <mesh position={[side*.035,.62,.283]}><boxGeometry args={[.018,.13,.022]} /><meshStandardMaterial color="#655e51" metalness={.5} roughness={.3} /></mesh>
    </group>)}
    <mesh castShadow position={[0,.82,0]}><boxGeometry args={[.78,.055,.55]} /><meshStandardMaterial color="#eeece5" roughness={.35} /></mesh>
    <mesh position={[0,.86,.035]}><cylinderGeometry args={[.17,.145,.055,32]} /><meshStandardMaterial color="#f7f5ef" roughness={.25} /></mesh>
    <mesh position={[0,.89,.035]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.14,32]} /><meshStandardMaterial color="#c8d6d3" roughness={.25} /></mesh>
    <mesh position={[0,.9,.035]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.154,.014,8,32]} /><meshStandardMaterial color="#ffffff" roughness={.2} /></mesh>
    <mesh position={[0,.94,-.16]}><cylinderGeometry args={[.014,.018,.18,12]} /><meshStandardMaterial color="#c0a36d" metalness={.8} roughness={.22} /></mesh>
    <mesh position={[0,1.025,-.10]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.014,.014,.14,12]} /><meshStandardMaterial color="#c0a36d" metalness={.8} roughness={.22} /></mesh>
    <mesh position={[0,1.003,-.03]}><cylinderGeometry args={[.014,.014,.045,12]} /><meshStandardMaterial color="#c0a36d" metalness={.8} roughness={.22} /></mesh>
  </group>;
}
