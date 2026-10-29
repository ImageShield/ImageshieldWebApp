"use client";

import { useEffect, useRef, useState } from "react";
import { accessToken } from "@/lib/browser-session";
import { POSTER_FILENAME, shareCaption } from "@/lib/score-share";
import { Share } from "../funnel/icons";

/**
 * The poster, fetched once per score per page and shared by every button that
 * offers it — the result screen draws one beside the phone's caption and one at
 * the corner of the desktop's gauge, and only one of them is ever visible.
 *
 * Fetched AHEAD of the tap, not inside it. Safari only opens the share sheet from
 * a user gesture, and an `await` on a network round trip inside the click handler
 * outlives that gesture: the sheet is refused with `NotAllowedError` and the tap
 * appears to do nothing. With the file already in hand, `navigator.share` runs in
 * the same task as the tap.
 *
 * A failed fetch is forgotten rather than cached, so the next tap tries again.
 */
const posters = new Map<string, Promise<File | null>>();

function poster(key: string): Promise<File | null> {
  let pending = posters.get(key);
  if (!pending) {
    pending = fetchPoster()
      .catch(() => null)
      .then((file) => {
        if (!file) posters.delete(key);
        return file;
      });
    posters.set(key, pending);
  }
  return pending;
}

/**
 * One poster, fetched via the two-step share-token flow:
 *   1. POST the visitor's access token to `/api/share/score-token`, which
 *      independently reads the score from the backend and returns an
 *      HMAC-signed, expiring token.
 *   2. Pass that token to `/api/share/score-card?token=…`, which verifies
 *      it and renders the PNG.
 *
 * The browser never supplies the score directly — the server reads it itself
 * and signs the result, so the poster always reflects a real score.
 */
async function fetchPoster(): Promise<File | null> {
  const bearer = accessToken();
  if (!bearer) return null;

  const tokenRes = await fetch("/api/share/score-token", {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });
  if (!tokenRes.ok) return null;

  const { token } = (await tokenRes.json()) as { token: string };
  const res = await fetch(`/api/share/score-card?token=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return new File([await res.blob()], POSTER_FILENAME, { type: "image/png" });
}

/** A dismissed sheet. Not a failure, and not worth a word. */
const dismissed = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  /* Revoked on the next turn rather than at once: some browsers start the download
     after `click()` returns, and a revoked URL downloads nothing. */
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shares the score card: a picture of it, captioned with the score and the quiz
 * link — the app's `shareScoreCard`, on the web.
 *
 * Where the browser can share a file (phones, Safari, Chromium on a Mac) that's
 * the system share sheet with the picture and the caption, same as the app. Where
 * it can't (Firefox) the picture is downloaded and the caption copied, and a short
 * note says which of the two actually happened.
 *
 * Never the caption alone. The app falls back to it, and on the web that hid the
 * failure: the sheet opened, the post went out, and nobody learned the picture
 * was missing until someone saw the post. A share that can't carry the picture
 * says so and goes nowhere.
 *
 * `score` and `band` are the values the page renders, passed straight in, so the
 * caption can't disagree with the number on screen.
 */
export function ShareScoreButton({
  score,
  band,
  className = "",
}: {
  score: number;
  band: string;
  className?: string;
}) {
  const key = `${score}|${band}`;
  const file = useRef<File | null>(null);
  const busy = useRef(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void poster(key).then((ready) => {
      if (live) file.current = ready;
    });
    return () => {
      live = false;
    };
  }, [key, score, band]);

  /* The note is a status, not a dialog: it clears itself. */
  useEffect(() => {
    if (note === null) return;
    const timer = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(timer);
  }, [note]);

  async function share() {
    /* Guarded, not debounced: the sheet takes a moment to open, and a second tap in
       that window would queue a second sheet behind the first. */
    if (busy.current) return;
    busy.current = true;
    setNote(null);

    const caption = shareCaption({ live: score, band });
    try {
      /* In hand already, or still coming — see `poster` for why that matters. */
      const waited = file.current === null;
      const picture = file.current ?? (await poster(key));
      if (!picture) {
        setNote("Couldn't create the image — please try again");
        return;
      }
      file.current = picture;

      if (navigator.canShare?.({ files: [picture] })) {
        try {
          /* Picture and caption together, as the app shares them. They reach the
             sheet as two items and each target keeps what it likes — Telegram's Mac
             share extension keeps only the text, story surfaces only the picture.
             Chosen knowingly over sharing the picture alone, which every target
             takes but which loses the tappable link; the poster carries the score
             and the address for the targets that drop the text. */
          await navigator.share({ files: [picture], text: caption });
          return;
        } catch (error) {
          if (dismissed(error)) return;
          /* Safari refuses a sheet opened after a wait that outlived the tap. The
             picture is in hand now, so the next tap opens it at once — better than
             dropping a download into a phone's Files app. */
          if (waited && error instanceof DOMException && error.name === "NotAllowedError") {
            setNote("Image ready — tap share again");
            return;
          }
          /* Refused for some other reason — hand it over by hand instead. */
        }
      }

      download(picture);
      const copied = await copy(caption);
      setNote(copied ? "Image saved and caption copied" : "Image saved");
    } finally {
      busy.current = false;
    }
  }

  return (
    <span className={`relative inline-flex ${className}`}>
      {/* 20px of glyph in a 44px target — the floor on touch screens. The glyph is
          small because the caption beside it is; the tappable area is not. */}
      <button
        type="button"
        onClick={share}
        aria-label="Share your Likeness Health Score"
        className="flex size-11 items-center justify-center rounded-full text-[#1A1A2E] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Share />
      </button>
      <span
        role="status"
        /* Lined up with the button's right edge, so it grows leftward: both
           buttons sit near the right of their column, and a centred note could
           run off a narrow screen. */
        className={`pointer-events-none absolute top-full right-0 z-10 mt-1 w-max max-w-[16rem] rounded-lg bg-ink px-3 py-2 text-xs leading-4 text-white shadow-lg transition-opacity ${
          note ? "opacity-100" : "opacity-0"
        }`}
      >
        {note}
      </span>
    </span>
  );
}
