"use client";

import Image from "next/image";
import { useState } from "react";

/** Fail safely when an editorial photograph is missing or blocked. */
export function ProductCardImage({ src, fallback, alt }: { src: string; fallback: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const resolved = failed ? fallback : src;
  return (
    <Image
      key={resolved}
      src={resolved}
      unoptimized={resolved.startsWith("https://")}
      width={500}
      height={500}
      sizes="(max-width: 640px) 42vw, 160px"
      alt={alt}
      className="product-image"
      onError={() => { if (!failed) setFailed(true); }}
    />
  );
}
