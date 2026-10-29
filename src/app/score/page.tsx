import type { Metadata } from "next";
import { ScoreLoader } from "@/components/score/ScoreLoader";

export const metadata: Metadata = {
  title: "ImageShield — Your Likeness Health Score",
};

/**
 * The result screen.
 *
 * Now client-rendered: the browser holds the session tokens and fetches the
 * score from the API directly. The server component is a thin shell that
 * provides metadata and mounts the client-side loader.
 */
export default function ScorePage() {
  return <ScoreLoader />;
}
