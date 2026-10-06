import { appQrSvg } from "@/lib/app-qr";

/**
 * GET /api/handoff/qr — the QR on the result screen, as SVG.
 *
 * It encodes `/get-app`, which sends the phone that scans it to its own store. The
 * code is the same for every visitor — it used to carry the visitor's number, read
 * from `GET /v1/me` per request, until that number turned out to have no reader —
 * so it is drawn once at build time rather than on every page view.
 *
 * SVG, not PNG: it stays sharp at whatever size the layout ends up using, and it's
 * a few KB of text instead of an image buffer.
 */
export const dynamic = "force-static";

export async function GET() {
  // A wide quiet zone of its own: the plate's padding alone is thin at phone width.
  const svg = await appQrSvg({ margin: 2 });

  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
  });
}
