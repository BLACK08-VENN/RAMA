"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { FeaturedOffers } from "./featured-offers";
import "./editorial-home.css";

const Planner = dynamic(() => import("./planner-shell").then(module => module.PlannerShell), {
  ssr: false,
  loading: () => <div className="welcome-loading" role="status">Preparing your creative space…</div>,
});

const shopUrl = "https://www.furniturerama.co.ke/";

export function PlannerEntry() {
  const [started, setStarted] = useState(false);
  if (started) return <Planner onWelcome={() => setStarted(false)} />;

  return <main className="welcome-screen rama-editorial">
    <section className="rama-hero" aria-label="FurnitureRama room design studio">
      <Image className="rama-hero-photo" src="/furnished-room-hero.webp" alt="Beautiful furnished living space with sofa and dining furniture" fill priority sizes="100vw" />
      <header className="rama-navigation">
        <a className="rama-logo-wrap" href={shopUrl} aria-label="FurnitureRama website">
          <Image src="/furniturerama-logo.png" width={619} height={152} alt="FurnitureRama" priority />
        </a>
        <nav className="rama-nav-links" aria-label="Main navigation">
          <button onClick={() => setStarted(true)}>Room Designer</button>
          <a href="#rama-offers">Offers</a>
          <a href={shopUrl} target="_blank" rel="noopener noreferrer">Furniture</a>
        </nav>
        <button className="rama-nav-action" onClick={() => setStarted(true)}>Design a room <ArrowRight aria-hidden="true" /></button>
      </header>
      <div className="rama-hero-body">
        <p className="rama-kicker">FurnitureRama · Room Studio</p>
        <h1 className="rama-hero-title">Beautiful spaces.<br />Made yours.</h1>
        <p className="rama-hero-subtitle">Imagine it. Style it. See it come to life in your own interactive room.</p>
      </div>
      <div className="rama-hero-footer">
        <button className="rama-primary-cta" onClick={() => setStarted(true)}>
          START DESIGNING <span><ArrowRight size={21} aria-hidden="true" /></span>
        </button>
        <a className="rama-secondary-link" href="#rama-offers">Explore collections ↓</a>
      </div>
    </section>
    <div className="rama-below" id="rama-offers">
      <FeaturedOffers />
      <ol className="welcome-steps" aria-label="How it works">
        <li><span><strong>Choose your room</strong><small>A space that fits your vision</small></span></li>
        <li><span><strong>Style it your way</strong><small>Plants, mirrors, rugs and more</small></span></li>
        <li><span><strong>Save your creation</strong><small>Come back to your ideas later</small></span></li>
      </ol>
    </div>
  </main>;
}
