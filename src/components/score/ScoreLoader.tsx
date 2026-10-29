"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ShieldMark } from "@/components/ShieldMark";
import { STEP_PATHS } from "@/lib/funnel";
import { loadScore, type ScoreLoad } from "@/lib/browser-score";
import { ResumeSave } from "./ResumeSave";
import { ScoreResult } from "./ScoreResult";
import { SessionRefresh } from "./SessionRefresh";

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-canvas-tint px-5 text-center">
      <SiteHeader />
      {children}
    </main>
  );
}

export function ScoreLoader() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<ScoreLoad | null>(null);

  useEffect(() => {
    let live = true;
    loadScore().then((result) => {
      if (!live) return;
      if (result.ok === false && result.reason === "signed-out") {
        router.replace(STEP_PATHS.details);
        return;
      }
      if (result.ok === false && result.reason === "outdated") {
        router.replace(STEP_PATHS["quiz-questions"]);
        return;
      }
      setLoaded(result);
    });
    return () => {
      live = false;
    };
  }, [router]);

  if (loaded === null) {
    return (
      <Centred>
        <ShieldMark monotone className="w-[37px] text-brand" />
        <h1 className="mt-8 max-w-[320px] text-2xl leading-9 font-bold text-ink">
          Loading your Likeness Health Score
          <sup className="align-[2px] text-[0.5em]">SM</sup>
        </h1>
      </Centred>
    );
  }

  if (!loaded.ok) {
    switch (loaded.reason) {
      case "stale":
        return (
          <Centred>
            <SessionRefresh />
          </Centred>
        );

      case "missing":
        return (
          <Centred>
            <ResumeSave />
          </Centred>
        );

      case "pending":
        return (
          <Centred>
            <h1 className="max-w-[420px] text-2xl leading-9 font-bold text-ink">
              Your score is being worked out
            </h1>
            <p className="mt-4 max-w-[420px] text-base text-ink-muted">
              We&apos;ve saved your answers. Your Likeness Health Score
              <sup className="align-[2px] text-[0.5em]">SM</sup> will be ready
              shortly.
            </p>
            <Link
              href={STEP_PATHS.score}
              className="mt-8 flex h-14 w-full max-w-[317px] items-center justify-center rounded-full bg-brand text-lg font-semibold text-ink-inverse transition-colors hover:bg-cta"
            >
              Check again
            </Link>
          </Centred>
        );

      case "unavailable":
        return (
          <Centred>
            <h1 className="max-w-[420px] text-2xl leading-9 font-bold text-ink">
              We couldn&apos;t load your score just now
            </h1>
            <p className="mt-4 max-w-[420px] text-base text-ink-muted">
              It&apos;s saved against your account — this is on us. Try again in a
              moment.
            </p>
            <Link
              href={STEP_PATHS.score}
              className="mt-8 flex h-14 w-full max-w-[317px] items-center justify-center rounded-full bg-brand text-lg font-semibold text-ink-inverse transition-colors hover:bg-cta"
            >
              Try again
            </Link>
          </Centred>
        );

      default:
        return null;
    }
  }

  return <ScoreResult record={loaded.record} handoff={loaded.handoff} />;
}
