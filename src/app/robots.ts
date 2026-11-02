import type { MetadataRoute } from "next";
import { NOT_ELIGIBLE_PATH, STEP_PATHS } from "@/lib/funnel";

/**
 * quiz.imageshield.com/robots.txt.
 *
 * The front door - `/` and the quiz intro at `/quiz` - stays open to crawlers: it is
 * the public face of the funnel. Everything after it is somebody's own session: their
 * contact form, code entry, loading screen and score, plus the not-eligible page and the
 * API routes. None of those has anything to index and several are personal.
 *
 * `/quiz/questions` is not listed: a crawler that follows the intro lands there, and an
 * unanswered question is harmless. Note robots.txt only asks crawlers not to fetch; it
 * does not remove a URL that is linked from elsewhere, and is no access control.
 *
 * No `sitemap`: the site has none to point at.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", STEP_PATHS.quiz],
      disallow: [
        STEP_PATHS.details,
        STEP_PATHS.otp,
        STEP_PATHS.calculating,
        STEP_PATHS.score,
        NOT_ELIGIBLE_PATH,
        "/api/",
      ],
    },
  };
}
