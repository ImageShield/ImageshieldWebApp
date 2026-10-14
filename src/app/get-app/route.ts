import { DOWNLOAD_URL, STORE_LINKS } from "@/lib/site-nav";

/**
 * GET /get-app — where the result screen's QR code points.
 *
 * A QR can carry one address, and the person scanning it has one of two phones, so
 * this picks the store from the User-Agent and redirects there. When the app is
 * already installed the store page itself offers "Open", which is all a universal
 * link would add for someone scanning off a laptop screen.
 *
 * Anything that isn't an iPhone or Android phone goes to imageshield.com's download
 * section, which carries both badges. That includes an iPad: iPadOS Safari sends a
 * Mac's User-Agent by default, so it can't be told apart from a desktop here. It
 * used to be the landing page, but `/` now redirects to the quiz intro, which has
 * no badges at all.
 */
export function GET(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  const target = /iPhone|iPad|iPod/i.test(ua)
    ? STORE_LINKS.appStore
    : /Android/i.test(ua)
      ? STORE_LINKS.googlePlay
      : DOWNLOAD_URL;

  return new Response(null, {
    // 302, not 301: a permanent redirect is cached by the phone indefinitely, and
    // the store listings are not ours to promise will never move.
    status: 302,
    headers: {
      Location: target,
      // The answer depends on who asked. A CDN that kept one would send every
      // phone after the first to that first phone's store.
      "Cache-Control": "no-store",
    },
  });
}
