"use client";

import Image from "next/image";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { useState } from "react";

// Link to the store for current pricing instead of duplicating changing sale prices.
const offers = [
  { name: "Delton Single Sofa Bed Grey", image: "/delton-grey.jpg", url: "https://furniturerama.co.ke/delton-single-sofa-bed-grey" },
  { name: "Nikita Twin Sofa Bed Grey", image: "/products/nikita-twin-sofa-bed.jpg", url: "https://furniturerama.co.ke/home-furniture/living-room-furniture/sofa-beds/nikita-twin-sofa-bed-grey" },
  { name: "Berry 5 Piece Dining Table Set", image: "/products/berry-dining-set.jpg", url: "https://furniturerama.co.ke/home-furniture/dining-room-furniture/dining-tables/berry-5-piece-set-dining-table" },
  { name: "5 Feet Queen Size Bed PS 8870", image: "/products/queen-bed-ps8870.jpg", url: "https://furniturerama.co.ke/home-furniture/bedroom-furniture/beds/5-feet-queen-size-bed-ps-8870" },
];

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
          {offers.map(offer => <a className="offer-card" key={offer.name} href={offer.url} target="_blank" rel="noreferrer" tabIndex={copy === 1 ? -1 : undefined}>
            <Image src={offer.image} alt="" width={120} height={120} sizes="90px" />
            <div><span className="offer-card-label">FurnitureRama offers</span><h3>{offer.name}</h3><span className="offer-card-link">View current offer <ArrowUpRight size={15} /></span></div>
          </a>)}
        </div>)}
      </div>
    </div>
  </section>;
}
