import type { Metadata } from "next";
import Link from "next/link";
import { FunnelShell } from "@/components/funnel/FunnelShell";
import { STEP_PATHS } from "@/lib/funnel";

export const metadata: Metadata = {
  title: "ImageShield — You need to be 18 or older",
  description: "The Likeness Health Score is only available to people aged 18 and over.",
};

/**
 * Where someone who answered the quiz's age question with the under-18 band ends up.
 *
 * The funnel is adults-only, but the band is still on offer because the backend owns
 * the questions. The details and OTP screens send anyone who picked it here instead
 * of letting them ask for a code — see `declaresMinor` — so no code is texted, no
 * challenge cookie is set and nothing is written to a profile.
 *
 * Its own page rather than a message inside the details form, because the details
 * page's heading announces a score that is ready to send, which is the opposite of
 * what this has to say.
 */
export default function NotEligiblePage() {
  return (
    <FunnelShell
      title="You need to be 18 or older to get your score"
      subtitle="The Likeness Health Score is only available to people aged 18 and over, so we can't send one to you."
    >
      {/* The details screen's primary button, alone: full width on a phone, the
          design's 317px centred in the column above that. */}
      <Link
        href={STEP_PATHS.landing}
        className="mt-12 flex h-14 items-center justify-center rounded-full bg-brand text-base font-semibold text-ink-inverse transition-colors hover:bg-cta sm:mx-auto sm:w-[317px]"
      >
        Back to home
      </Link>
    </FunnelShell>
  );
}
