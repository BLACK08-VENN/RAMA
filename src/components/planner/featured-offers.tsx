"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useState } from "react";

// Use supplied campaign artwork; dated June–August 2026 artwork is excluded.
const offers = [
  { name: "Outdoor furniture — Be outside wit it", image: "/offers/outdoor.png", width: 480, height: 480 },
  { name: "Office seating — Slide into something better", image: "/offers/office-chair.png", width: 1620, height: 1080 },
  { name: "Executive desks — Be on top", image: "/offers/executive-desk.png", width: 480, height: 480 },
  { name: "Filing cabinets — Never been lit", image: "/offers/filing.png", width: 480, height: 480 },
  { name: "Dining furniture — Made for together", image: "/offers/dining.png", width: 1000, height: 1000 },
  { name: "Sofas — The best seat in the house", image: "/offers/sofa.png", width: 1000, height: 1000 },
  { name: "Beds — Always be up for it", image: "/offers/bed.png", width: 1000, height: 1000 },
];
const offersUrl = "https://furniturerama.co.ke/index.php?route=product/special";

export function FeaturedOffers() {
  const [paused, setPaused] = useState(false);
  const [touching, setTouching] = useState(false);
  return <section className="featured-offers" aria-labelledby="featured-offers-title">
    <div className="featured-offers-heading">
      <div><span>Find something you love</span><h2 id="featured-offers-title">Featured offers</h2></div>
      <button className="offers-pause" aria-label={paused ? "Resume offers" : "Pause offers"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
        {paused ? <Play size={16} /> : <Pause size={16} />}<span>{paused ? "Play" : "Pause"}</span>
      </button>
    </div>
    <div className="offers-viewport" onPointerDown={() => setTouching(true)} onPointerUp={() => setTouching(false)} onPointerCancel={() => setTouching(false)} onPointerLeave={() => setTouching(false)}>
      <div className={`offers-track ${paused || touching ? "is-paused" : ""}`}>
        {[0, 1].map(copy => <div className="offers-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
          {offers.map(offer => <a className="offer-card" key={offer.name} href={offersUrl} aria-label={`${offer.name}. View FurnitureRama offers`} target="_blank" rel="noreferrer" tabIndex={copy === 1 ? -1 : undefined}>
            <Image src={offer.image} alt={offer.name + ". Artwork advertises 50% off selected items; call 0733 612 782."} width={offer.width} height={offer.height} sizes="(max-width: 540px) 86vw, 480px" />
          </a>)}
        </div>)}
      </div>
    </div>
  </section>;
}
