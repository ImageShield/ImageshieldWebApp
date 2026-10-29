"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ShieldMark } from "@/components/ShieldMark";
import { STEP_PATHS } from "@/lib/funnel";
import { refreshSession } from "@/lib/api-client";

/**
 * Rotates a spent access token and re-renders the page behind it.
 *
 * Calls the backend directly via the browser-side API client.
 */
export function SessionRefresh() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let live = true;
    refreshSession()
      .then((ok) => {
        if (!live) return;
        if (ok) return router.refresh();
        return router.replace(STEP_PATHS.details);
      })
      .catch(() => {
        if (live) setFailed(true);
      });

    return () => {
      live = false;
    };
  }, [router]);

  return (
    <div role="status" className="flex flex-col items-center text-center">
      <ShieldMark monotone className="w-[37px] text-brand" />
      {failed ? (
        <>
          <h1 className="mt-8 max-w-[420px] text-2xl leading-9 font-bold text-ink">
            We couldn&apos;t reach the server
          </h1>
          <p className="mt-4 max-w-[420px] text-base text-ink-muted">
            Your score is saved - this is just this request. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              started.current = false;
              router.refresh();
            }}
            className="mt-8 flex h-14 w-full max-w-[317px] items-center justify-center rounded-full bg-brand text-lg font-semibold text-ink-inverse transition-colors hover:bg-cta"
          >
            Try again
          </button>
        </>
      ) : (
        <h1 className="mt-8 max-w-[320px] text-2xl leading-9 font-bold text-ink">
          Loading your Likeness Health Score
          <sup className="align-[2px] text-[0.5em]">SM</sup>
        </h1>
      )}
    </div>
  );
}
