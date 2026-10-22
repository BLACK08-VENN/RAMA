"use client";

import { useState } from "react";
import { Activity, ChevronDown, ClipboardCopy, Monitor, ShieldCheck, Wrench } from "lucide-react";
import "./troubleshooting-footer.css";

type DeviceCheck = {
  webgl: string;
  memory: string;
  processors: string;
  network: string;
  display: string;
};

function checkDevice(): DeviceCheck {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  let webgl = "Unavailable";
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (context) {
      webgl = "Available";
      context.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl = "Unable to check";
  }
  return {
    webgl,
    memory: nav.deviceMemory ? `${nav.deviceMemory} GB estimated device memory` : "Not reported by browser",
    processors: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} logical processors` : "Not reported by browser",
    network: nav.connection ? `${nav.connection.effectiveType ?? "Unknown"}${nav.connection.saveData ? " (data saver enabled)" : ""}` : "Not reported by browser",
    display: `${window.innerWidth} × ${window.innerHeight}, device pixel ratio ${window.devicePixelRatio.toFixed(1)}`,
  };
}

/** Accessible, opt-in diagnostics that do not clear, alter or reload saved room designs. */
export function TroubleshootingFooter() {
  const [check, setCheck] = useState<DeviceCheck | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  function measureInterfaceFps() {
    if (measuring) return;
    setMeasuring(true);
    const start = performance.now();
    let frames = 0;
    function sample(now: number) {
      frames += 1;
      if (now - start < 1500) {
        requestAnimationFrame(sample);
      } else {
        setFps(Math.round(frames * 1000 / (now - start)));
        setMeasuring(false);
      }
    }
    requestAnimationFrame(sample);
  }

  async function copyReport() {
    try {
      const report = [
        "FurnitureRama browser diagnostics",
        `Captured: ${new Date().toISOString()}`,
        JSON.stringify(check ?? checkDevice(), null, 2),
        `Interface FPS: ${fps ?? "not measured"} (not the 3D renderer FPS)`,
      ].join("\n");
      await navigator.clipboard.writeText(report);
      setCopyStatus("Report copied");
    } catch {
      setCopyStatus("Clipboard unavailable. Please select and copy the results.");
    }
  }

  return (
    <section className="rama-support" id="rama-troubleshooting" aria-label="Troubleshooting">
      <details className="rama-support-details">
        <summary>
          <span className="rama-support-title"><Wrench size={21} aria-hidden="true" /> Troubleshooting &amp; performance</span>
          <span className="rama-support-summary">Room slow, freezing, or missing products? <ChevronDown size={20} aria-hidden="true" /></span>
        </summary>
        <div className="rama-support-body">
          <p className="rama-support-intro">
            Quick checks for your device. These tools never delete designs, clear storage or restart the application.
          </p>
          <div className="rama-support-tips">
            <article>
              <h3>Room is freezing</h3>
              <p>When the 3D preview reports a problem, use <strong>Reopen 3D preview</strong>. Save your design before refreshing the page.</p>
            </article>
            <article>
              <h3>Rotation feels slow</h3>
              <p>Close heavy browser tabs, enable hardware acceleration and try a smaller number of detailed objects. Rama adjusts resolution automatically.</p>
            </article>
            <article>
              <h3>A model does not appear</h3>
              <p>Check your network. A downloadable GLB must be available; a Tripo Studio preview page is not a model file.</p>
            </article>
          </div>
          <div className="rama-support-tools">
            <div className="rama-support-tool-title"><Monitor size={18} aria-hidden="true" /> Browser checks</div>
            <div className="rama-support-actions">
              <button type="button" onClick={() => { setCheck(checkDevice()); setCopyStatus(""); }}>Check my device</button>
              <button type="button" onClick={measureInterfaceFps} disabled={measuring}>
                <Activity size={16} aria-hidden="true" /> {measuring ? "Measuring…" : "Measure interface FPS"}
              </button>
              <button type="button" onClick={() => void copyReport()}>
                <ClipboardCopy size={16} aria-hidden="true" /> Copy diagnostic report
              </button>
            </div>
            {(check || fps !== null) && (
              <div className="rama-support-results" role="status">
                {check && Object.entries(check).map(([label, value]) => (
                  <p key={label}><strong>{label === "webgl" ? "WebGL" : label}:</strong> {value}</p>
                ))}
                {fps !== null && <p><strong>Interface:</strong> {fps} FPS (not the 3D rendering frame rate)</p>}
              </div>
            )}
            {copyStatus && <p className="rama-support-feedback" role="status">{copyStatus}</p>}
            <p className="rama-support-note"><ShieldCheck size={16} aria-hidden="true" /> No personal data or design files are sent anywhere by these checks.</p>
          </div>
        </div>
      </details>
    </section>
  );
}
