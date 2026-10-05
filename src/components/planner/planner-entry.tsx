"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { FeaturedOffers } from "./featured-offers";

const Planner = dynamic(() => import("./planner-shell").then(module => module.PlannerShell), {
  ssr: false,
  loading: () => <div className="welcome-loading" role="status">Preparing your creative space…</div>,
});

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
        <Image className="welcome-room-photo" src="/furnished-room-hero.webp" width={1536} height={1024} sizes="(max-width: 760px) 90vw, 50vw" alt="A charcoal sofa and wooden dining set in a naturally lit room with woven rugs and plants" priority />
        <span className="welcome-visual-label">A little inspiration. Endless possibilities.</span>
      </div>
    </div>
    <FeaturedOffers />
    <ol className="welcome-steps" aria-label="How it works">
      <li><span><strong>Choose your room</strong><small>A space that fits your vision</small></span></li>
      <li><span><strong>Style it your way</strong><small>Plants, mirrors, rugs and more</small></span></li>
      <li><span><strong>Save your creation</strong><small>Come back to your ideas later</small></span></li>
    </ol>
  </main>;
}
