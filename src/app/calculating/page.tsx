import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Calculating } from "@/components/quiz/Calculating";

export const metadata: Metadata = {
  title: "ImageShield - Calculating your score",
};

/**
 * Where the answers are submitted and the score computed.
 *
 * The session check is now done client-side by the Calculating component,
 * since tokens are held in the browser rather than in httpOnly cookies.
 */
export default function CalculatingPage() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-canvas-tint px-5">
      <SiteHeader />
      <Calculating />
    </main>
  );
}
