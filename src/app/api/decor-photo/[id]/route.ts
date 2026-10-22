import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin, cacheable thumbnails with an explicit allowlist of editorial
 * photo IDs. The endpoint cannot be used as an arbitrary URL proxy.
 * Photo credits and licenses: Pexels, https://www.pexels.com/license/
 */
const PHOTO_IDS = new Set([
  "12454083", "33771655", "6186516", "11018345", "15176015",
  "20337867", "5579163", "11216397", "7318095", "3705846",
  "1488378", "7245073", "6186523", "33678501", "4915847",
  "6129394", "19367517", "5551824", "6487966",
  "8767273", "10995881",
]);

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!PHOTO_IDS.has(id)) return new NextResponse("Not found", { status: 404 });

  const photoUrl = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=640&h=640&fit=crop`;
  try {
    const upstream = await fetch(photoUrl, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(8500),
      headers: { Accept: "image/jpeg,image/webp,image/*" },
    });
    if (!upstream.ok) throw new Error(`Image unavailable: ${upstream.status}`);
    const mime = upstream.headers.get("content-type") ?? "";
    if (!mime.startsWith("image/")) throw new Error("Invalid image response");
    const buffer = await upstream.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > 4_000_000) throw new Error("Invalid image size");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Photograph temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
