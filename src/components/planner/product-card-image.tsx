"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Photographic images should never silently revert to the old cartoon SVGs.
 * Image URL errors show a restrained neutral placeholder and make the failure visible.
 */
export function ProductCardImage({ src, fallback, alt }: { src: string; fallback: string; alt: string }) {
  const isDecor = fallback.startsWith("/decor/");
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed && isDecor) {
    return <div className="product-image product-photo-unavailable" role="img" aria-label={`Photograph unavailable for ${alt}`}>
      <span>Photo currently unavailable</span>
    </div>;
  }
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
      onError={() => setFailed(true)}
    />
  );
}
