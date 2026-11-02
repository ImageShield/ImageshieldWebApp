"use client";

import { useEffect } from "react";
import { getAttribution } from "@/lib/attribution";

/**
 * Reads the visitor's attribution from the address bar as soon as any page mounts.
 *
 * Mounted from the root layout so the first screen, whichever route it is, captures it:
 * the redirect from imageshield.com can land on `/`, `/quiz` or `/quiz/questions`. It
 * renders nothing. `getAttribution` captures on its first call in a page load and
 * only reads after that, so this is safe to run twice, as React does in development.
 */
export function AttributionCapture() {
  useEffect(() => {
    getAttribution();
  }, []);
  return null;
}
