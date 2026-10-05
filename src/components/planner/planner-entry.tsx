"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowRight, Box, Leaf, Ruler, Sparkles } from "lucide-react";
import { useState } from "react";

const Planner = dynamic(() => import("./planner-shell").then(module => module.PlannerShell), {
  ssr: false,
  loading: () => <div className="welcome-loading" role="status">Preparing your creative space…</div>,
});

function RoomIllustration() {
  return <svg className="welcome-room-art" viewBox="0 0 640 470" aria-hidden="true">
    <defs>
      <linearGradient id="welcome-floor" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#dfc8a3" /><stop offset="1" stopColor="#b4936b" /></linearGradient>
      <linearGradient id="welcome-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d9eeec" /><stop offset="1" stopColor="#8eb9b8" /></linearGradient>
      <filter id="welcome-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="12" /></filter>
    </defs>
    <ellipse cx="322" cy="407" rx="224" ry="26" fill="#718e7f" opacity=".15" filter="url(#welcome-shadow)" />
    <path d="M75 302L319 161L565 304L319 445Z" fill="url(#welcome-floor)" />
    <path d="M75 302V116L319 22V161Z" fill="#deded2" />
    <path d="M319 22L565 116V304L319 161Z" fill="#f5f0e4" />
    <path d="M75 302L319 161L565 304" fill="none" stroke="#faf6eb" strokeWidth="7" />
    <path d="M130 335L374 193M186 368L429 225M244 402L487 259M143 263L385 407M204 227L447 371M262 194L506 337" fill="none" stroke="#9c7d56" strokeWidth="1" opacity=".25" />
    <g transform="translate(352 238) rotate(30) skewX(-30)"><rect width="156" height="100" rx="12" fill="#9aaca0" /><rect x="8" y="8" width="140" height="84" rx="8" fill="none" stroke="#e8e4d7" strokeWidth="3" /><path d="M30 14V86M60 14V86M90 14V86M120 14V86" stroke="#e8e4d7" opacity=".25" /></g>
    <g transform="translate(133 125) skewY(-21)"><path d="M0 87V30a40 40 0 0180 0v57Z" fill="url(#welcome-glass)" stroke="#fbfaf6" strokeWidth="7" /><path d="M40 0V87M0 47H80" stroke="#fbfaf6" strokeWidth="4" /></g>
    <g transform="translate(400 91) skewY(21)"><rect width="74" height="93" rx="2" fill="#826b4c" /><rect x="5" y="5" width="64" height="83" fill="#e8dcc6" /><circle cx="46" cy="29" r="15" fill="#cb9776" /><path d="M7 76Q33 24 67 76V86H7Z" fill="#728c7a" /></g>
    <g transform="translate(253 83) skewY(-21)"><ellipse cx="0" cy="38" rx="29" ry="38" fill="url(#welcome-glass)" stroke="#ae945e" strokeWidth="4" /><path d="M-15 32L8 9M-10 60L16 32" stroke="#f8ffff" strokeWidth="5" opacity=".6" /></g>
    <g transform="translate(161 264)"><ellipse cy="35" rx="33" ry="12" fill="#5d725b" opacity=".15" /><path d="M-22 0H22L17 34Q0 44 -17 34Z" fill="#bd9273" /><ellipse rx="22" ry="8" fill="#8d6c50" /><path d="M0 0V-105M0-28L-29-67M0-50L29-87" stroke="#63734a" strokeWidth="4" /><ellipse cx="-27" cy="-70" rx="14" ry="27" transform="rotate(-35 -27 -70)" fill="#5c7d53" /><ellipse cx="26" cy="-85" rx="13" ry="25" transform="rotate(35 26 -85)" fill="#789361" /><ellipse cy="-105" rx="14" ry="27" fill="#486c4f" /><ellipse cx="-15" cy="-30" rx="12" ry="22" transform="rotate(-40 -15 -30)" fill="#789361" /></g>
    <g transform="translate(491 221)"><path d="M-12 0Q-21 24 -16 45Q0 58 16 45Q21 24 12 0Z" fill="#e2ccb0" /><path d="M0 0L-8-65M0 0L15-79M0 0L29-47" stroke="#a99170" strokeWidth="3" /><ellipse cx="-8" cy="-65" rx="7" ry="16" fill="#c2aa81" /><ellipse cx="15" cy="-79" rx="6" ry="17" fill="#b6a27d" /></g>
  </svg>;
}

export function PlannerEntry() {
  const [started, setStarted] = useState(false);
  if (started) return <Planner onWelcome={() => setStarted(false)} />;

  return <main className="welcome-screen">
    <header className="welcome-header">
      <Image src="/furniturerama-logo.png" width={619} height={152} alt="FurnitureRama — the furniture people" priority />
      <span>ROOM STUDIO</span>
    </header>
    <div className="welcome-content">
      <div className="welcome-copy">
        <p className="welcome-eyebrow">Hello, welcome to FurnitureRama</p>
        <h1>Let’s get creative.<br /><span>Make the room yours.</span></h1>
        <p className="welcome-intro">Design a room you’ll love. Choose your space, explore décor, and bring your ideas to life.</p>
        <button className="welcome-start" onClick={() => setStarted(true)}>Let’s get creative <ArrowRight size={24} /></button>
        <p className="welcome-reassurance">No experience needed. Just tap to begin.</p>
      </div>
      <div className="welcome-visual">
        <div className="welcome-visual-halo" />
        <RoomIllustration />
        <span className="welcome-visual-label"><Sparkles size={18} /> A little inspiration. Endless possibilities.</span>
      </div>
    </div>
    <ol className="welcome-steps" aria-label="How it works">
      <li><Ruler /><span><strong>Choose your room</strong><small>A space that fits your vision</small></span></li>
      <li><Leaf /><span><strong>Style it your way</strong><small>Plants, mirrors, rugs and more</small></span></li>
      <li><Box /><span><strong>Save your creation</strong><small>Come back to your ideas later</small></span></li>
    </ol>
  </main>;
}
