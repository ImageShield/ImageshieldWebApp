"use client";

import { useEffect } from "react";

/**
 * Keeps the tab icon in step with the browser's light or dark theme.
 *
 * `app/icon.svg` already picks navy or white with a `prefers-color-scheme` query,
 * but browsers rasterise a favicon once and keep that image until the page
 * reloads. Changing the link's URL makes them fetch it again, and the fresh copy
 * is drawn against the theme in force now.
 */
export function FaviconTheme() {
  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)");

    const onChange = () => {
      const link = document.querySelector<HTMLLinkElement>(
        'link[rel="icon"][type="image/svg+xml"]',
      );
      if (!link) return;
      const url = new URL(link.href);
      url.searchParams.set("theme", dark.matches ? "dark" : "light");
      link.href = url.toString();
    };

    dark.addEventListener("change", onChange);
    return () => dark.removeEventListener("change", onChange);
  }, []);

  return null;
}
