/**
 * The bridge from this browser to the app.
 *
 * There is no token to redeem: the score is already sitting on the user record
 * keyed by phone number, so the handoff is simply "install the app and sign in
 * with the number you just verified".
 *
 * The store links are the landing page's `STORE_LINKS`, not env vars of their own:
 * there is one App Store listing and one Play listing, and while the two were
 * configured separately this screen kept pointing at placeholders the landing page
 * had already outgrown.
 */
import { SHARE_URL } from "./score-share";
import { STORE_LINKS } from "./site-nav";

/**
 * What the QR encodes: `/get-app` on this site, which sends a phone to its own
 * store. Absolute because a QR is read on a different device, and taken from
 * `SHARE_URL` because that is this deployment's public address — not the address
 * bar, which is localhost in development and an internal host behind the proxy.
 *
 * It used to be `https://imageshield.ai/open?phone=…`, meant as a universal link
 * that opened the app with the login prefilled. Nothing was ever behind it: that
 * domain is another product's single-page site, serving no
 * `apple-app-site-association` or `assetlinks.json`, and the app claims only
 * `prod.imageshield.com` and never read `phone` anyway — so every scan landed on a
 * stranger's catch-all page, with the visitor's number in the URL. A prefill
 * couldn't survive an install from the store either, and someone scanning off a
 * laptop screen almost never has the app yet.
 */
export const GET_APP_URL = `${SHARE_URL.replace(/\/$/, "")}/get-app`;

export type Handoff = {
  appStoreUrl: string;
  playStoreUrl: string;
};

export function handoffFor(): Handoff {
  return {
    appStoreUrl: STORE_LINKS.appStore,
    playStoreUrl: STORE_LINKS.googlePlay,
  };
}
