"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { tripoModelSubmissions } from "@/lib/tripo-model-submissions";
import "./admin.css";

type Diagnostics = { memory: string; cores: string; connection: string; screen: string; webgl: string; fps: string; };
function inspectWebgl(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return "Unavailable — 3D rendering cannot run";
    const result = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return `Available · max texture ${result}px`;
  } catch { return "Could not check"; }
}
function snapshot(): Diagnostics {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; saveData?: boolean } };
  return {
    memory: nav.deviceMemory ? `${nav.deviceMemory} GB (device estimate)` : "Not reported",
    cores: nav.hardwareConcurrency ? String(nav.hardwareConcurrency) : "Not reported",
    connection: nav.connection ? `${nav.connection.effectiveType ?? "Unknown"}${nav.connection.saveData ? " · Data saver on" : ""}` : "Not reported",
    screen: `${window.innerWidth} × ${window.innerHeight} · DPR ${window.devicePixelRatio.toFixed(1)}`,
    webgl: inspectWebgl(),
    fps: "Run frame-rate check",
  };
}
export default function RamaAdminPage() {
  const { user, loading, isConfigured } = useAuth();
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const authorized = user?.app_metadata?.role === "admin" || user?.app_metadata?.rama_admin === true;
  const rows = useMemo(() => tripoModelSubmissions, []);

  const frameCheck = () => {
    if (testing) return;
    setTesting(true);
    const samples: number[] = []; let previous = performance.now();
    const started = previous;
    const measure = (now: number) => {
      samples.push(now - previous); previous = now;
      if (now - started < 1500) requestAnimationFrame(measure);
      else {
        const average = samples.reduce((sum, v) => sum + v, 0) / Math.max(samples.length, 1);
        setFps(Math.min(240, Math.round(1000 / Math.max(average, 1))));
        setTesting(false);
      }
    };
    requestAnimationFrame(measure);
  };
  if (loading) return <main className="rama-admin"><p>Checking access…</p></main>;
  if (!isConfigured) return <main className="rama-admin"><h1>Rama administration</h1><p>Authentication is not configured for this deployment. Administrator access is unavailable.</p><Link href="/admin/troubleshooting">Open troubleshooting</Link> · <Link href="/">Back to Rama</Link></main>;
  if (!user || !authorized) return <main className="rama-admin"><h1>Administrator access required</h1><p>This workspace is restricted to accounts authorized through secure administrator account metadata. Signing in as a regular user does not grant access.</p><Link href="/">Back to Rama</Link></main>;
  return <main className="rama-admin">
    <header className="rama-admin-head"><div><span>FurnitureRama / Operations</span><h1>Admin workspace</h1><p>Model review and quick performance troubleshooting</p></div><Link href="/">← Return to studio</Link></header>
    <section className="rama-admin-card"><div className="rama-admin-title"><h2>3D model approval queue</h2><span>{rows.length} submitted</span></div>
      <p className="rama-admin-muted">Models require an actual validated GLB before approval. Studio preview links are not 3D files. Publishing and approval are disabled until Rama has its own protected asset storage and review database.</p>
      <div className="rama-model-grid">{rows.map(model=><article className="rama-model" key={model.id}><span className="rama-model-pill">{model.status.replaceAll("_"," ")}</span><h3>{model.title}</h3><p>{model.description}</p><div>Category: {model.category}</div><div>3D asset: {model.assetPath ?? "Not uploaded"}</div><a href={model.sourceUrl} target="_blank" rel="noopener noreferrer">Open in Tripo ↗</a><button disabled title="Requires secure model-storage and approval backend">Approve and publish</button></article>)}</div>
    </section>
    <section className="rama-admin-card"><div className="rama-admin-title"><h2>Quick troubleshooting</h2><span>Safe checks only</span></div>
      <p className="rama-admin-muted">These checks run on this device. They do not restart the server, clear customer designs or remove stored assets.</p>
      <div className="rama-admin-actions"><button onClick={() => { setDiagnostics(snapshot()); setFps(null); }}>Run device diagnostics</button><button onClick={frameCheck} disabled={testing}>{testing ? "Measuring…" : "Test interface frame rate"}</button><button onClick={() => location.reload()}>Refresh admin interface</button></div>
      {diagnostics && <div className="rama-diagnostics">{Object.entries({...diagnostics, fps:fps===null?"Not measured":`${fps} FPS (interface only)`}).map(([key,value])=><div key={key}><strong>{key}</strong><span>{value}</span></div>)}</div>}
      <div className="rama-help-grid"><article><h3>If the room hangs</h3><p>Save the design first if possible. Reopen the 3D preview from its recovery button. Avoid repeatedly refreshing while an unsaved design is open.</p></article><article><h3>If rotation is slow</h3><p>Close heavy browser tabs, test another browser and reduce the number of high-polygon models. Rama already adjusts rendering resolution on slower devices.</p></article><article><h3>If models fail to appear</h3><p>Check that the file is a valid GLB, that its URL loads successfully, and that its textures are embedded or accessible.</p></article><article><h3>If the entire site is slow</h3><p>Check network conditions and the Vercel deployment logs. This panel cannot measure server load without a protected monitoring service.</p></article></div>
      <button className="rama-report" onClick={async()=>{const text=[`Rama diagnostics · ${new Date().toISOString()}`,JSON.stringify(diagnostics??snapshot(),null,2),`Interface FPS: ${fps??"not tested"}`].join("\n");try{await navigator.clipboard.writeText(text);setCopied(true)}catch{setCopied(false)}}}>{copied?"Report copied":"Copy diagnostic report"}</button>
    </section>
  </main>;
}
