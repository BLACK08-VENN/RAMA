import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Supabase is contacted straight from the browser for auth and table reads, so its origin
// has to be reachable under connect-src. Derived from the same env var the client uses,
// which keeps the project ref out of the repo; the wildcards stay as a fallback so a
// project on a custom domain or a new project ref works without a config edit.
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
})();

const supabaseSources = [
  supabaseOrigin,
  "https://*.supabase.co",
  "wss://*.supabase.co",
]
  .filter(Boolean)
  .join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  // Nonces would force dynamic rendering and forfeit static generation for a page that
  // runs entirely on the client, so this uses the documented no-nonce form. 'unsafe-eval'
  // is only there for the React dev overlay.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // react-three-fiber positions the canvas and meshes via inline style attributes.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseSources}`,
  // three.js decoders (DRACO, KTX2, meshopt) spin their workers up from blob URLs.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .join("; ")
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Legacy fallback for frame-ancestors 'none' on older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // same-origin-allow-popups rather than same-origin: keeps the top-level browsing
  // context isolated without breaking the popup flow a Supabase OAuth sign-in would use.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  // Stops Next.js advertising its version on every response.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
