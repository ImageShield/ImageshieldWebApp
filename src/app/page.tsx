import { redirect } from "next/navigation";
import { STEP_PATHS } from "@/lib/funnel";

/**
 * The quiz intro is the front door for now; the landing page below is parked, not
 * deleted. Uncomment it (and drop the redirect) to bring it back.
 *
 * `redirect`, a 307, rather than `permanentRedirect`'s 308: browsers cache a 308
 * indefinitely, so once the landing page returns, anyone who had visited `/` would
 * keep being sent to /quiz without ever asking the server again.
 */
export default function LandingPage() {
  redirect(STEP_PATHS.quiz);
}

// import type { Metadata, Viewport } from "next";
// import { DownloadSection } from "@/components/landing/DownloadSection";
// import { HeroSection } from "@/components/landing/HeroSection";
// import { HowItWorks } from "@/components/landing/HowItWorks";
// import { ScoreBanner } from "@/components/landing/ScoreBanner";
//
// export const metadata: Metadata = {
//   title: "ImageShield — What is your Likeness Health Score℠?",
//   description:
//     "Answer a few quick questions and find out how at risk you are of deepfakes, impersonation, and photo misuse.",
// };
//
// export const viewport: Viewport = {
//   // The funnel is white-on-brand; the landing page opens on a black canvas.
//   themeColor: "#000000",
// };
//
// /**
//  * Concept 1, top to bottom: the pitch over the photograph, the quiz ask on coral,
//  * the three steps, and what is left of the old footer strip.
//  *
//  * `font-sans`: the design is drawn in Plus Jakarta Sans — the app's own face,
//  * matched here against the export glyph by glyph.
//  */
// export default function LandingPage() {
//   return (
//     <main className="bg-night font-sans">
//       <HeroSection />
//       <ScoreBanner />
//       <HowItWorks />
//       <DownloadSection />
//     </main>
//   );
// }
