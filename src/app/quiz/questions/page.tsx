import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { QuizFlow } from "@/components/quiz/QuizFlow";

export const metadata: Metadata = {
  title: "ImageShield - Likeness Health Quiz",
};

/**
 * The questions themselves - one screen each, all served from this route with
 * the step in `?q=`, so the browser's own back button walks the quiz backwards.
 *
 * `signedIn` is now determined client-side by QuizFlow reading from the
 * browser session store, since tokens are no longer in httpOnly cookies.
 */
export default function QuizQuestionsPage() {
  return (
    <main className="relative min-h-[100dvh] bg-canvas-tint pt-[65px]">
      <SiteHeader />
      <Suspense>
        <QuizFlow />
      </Suspense>
    </main>
  );
}
