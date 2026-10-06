import "server-only";

import QRCode from "qrcode";
import { GET_APP_URL } from "./handoff";

/**
 * The QR code every "get the app" spot on the site draws — the landing hero's
 * card and the result screen's two prompts — so they can only ever point at the
 * same place. The hero's used to be a file in `public/` encoding imageshield.com,
 * which is how a card reading "Free to download!" came to open a website.
 *
 * `margin` is the caller's because the quiet zone is: the hero's plate already
 * pads the code in white, and every module spent on margin there is taken out of
 * a 73px square.
 */
export function appQrSvg({ margin }: { margin: number }): Promise<string> {
  return QRCode.toString(GET_APP_URL, {
    type: "svg",
    margin,
    // Phone cameras read this off a screen at arm's length; the higher correction
    // level survives glare and a smallish render box.
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
