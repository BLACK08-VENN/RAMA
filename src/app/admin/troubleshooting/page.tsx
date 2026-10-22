"use client";
import Link from "next/link";
import { useState } from "react";
import "../admin.css";

type Result = { webgl: string; memory: string; processors: string; display: string; network: string };
export default function Troubleshooting() {
  const [result,setResult] = useState<Result|null>(null);
  const [fps,setFps] = useState<number|null>(null);
  const [running,setRunning] = useState(false);
  const inspect=()=>{
    const n=navigator as Navigator & { deviceMemory?:number; connection?:{effectiveType?:string;saveData?:boolean} };
    let webgl="Unavailable";
    try { const c=document.createElement("canvas"); const gl=c.getContext("webgl2")??c.getContext("webgl"); webgl=gl?"Available":"Unavailable";gl?.getExtension("WEBGL_lose_context")?.loseContext(); } catch { webgl="Check failed"; }
    setResult({webgl,memory:n.deviceMemory?`${n.deviceMemory} GB device estimate`:"Not reported",processors:String(n.hardwareConcurrency??"Not reported"),display:`${innerWidth} × ${innerHeight} · DPR ${devicePixelRatio.toFixed(1)}`,network:n.connection?.effectiveType??"Not reported"});
  };
  const checkFps=()=>{
    if(running)return;
    setRunning(true);let start=performance.now(),frames=0;
    const step=(now:number)=>{frames++;if(now-start<1500)requestAnimationFrame(step);else{setFps(Math.round(frames*1000/(now-start)));setRunning(false)}};
    requestAnimationFrame(step);
  };
  return <main className="rama-admin"><header className="rama-admin-head"><div><h1>Rama troubleshooting</h1><p>Safe, on-device diagnostics. No designs or files are deleted.</p></div><Link href="/admin">← Admin</Link></header>
    <section className="rama-admin-card"><h2>Quick checks</h2><div className="rama-admin-actions"><button onClick={inspect}>Check this device</button><button onClick={checkFps} disabled={running}>{running?"Checking…":"Test interface FPS"}</button></div>
    {result&&<div className="rama-diagnostics">{Object.entries(result).map(([k,v])=><div key={k}><strong>{k}</strong><span>{v}</span></div>)}<div><strong>UI frame rate</strong><span>{fps===null?"Not tested":`${fps} FPS (not 3D render FPS)`}</span></div></div>}
    <div className="rama-help-grid"><article><h3>Frozen 3D preview</h3><p>Use the room designer's Reopen 3D preview recovery button. Save the design before refreshing whenever possible.</p></article><article><h3>Lag during rotation</h3><p>Close other heavy tabs, use hardware acceleration and reduce model polygon and texture sizes. Rama adapts pixel density automatically.</p></article><article><h3>Missing models</h3><p>Check that the GLB URL exists and responds. Tripo Studio links cannot be loaded directly as GLB files.</p></article><article><h3>Whole app slow</h3><p>Check Vercel deployment status and server logs. These browser diagnostics cannot restart or repair backend services.</p></article></div>
    <button className="rama-report" onClick={()=>{const report=JSON.stringify({date:new Date().toISOString(),diagnostics:result,fps},null,2);void navigator.clipboard?.writeText(report)}}>Copy report</button></section>
  </main>;
}
