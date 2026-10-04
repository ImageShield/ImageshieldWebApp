import type { Metadata } from "next";
import { DetailsForm } from "@/components/funnel/DetailsForm";
import { FunnelShell } from "@/components/funnel/FunnelShell";

export const metadata: Metadata = {
  title: "ImageShield — Where should we send your score?",
  description:
    "Tell us where to send your Likeness Health Score. We won't share your information with anyone.",
};

/**
 * Full name, email, phone and an 18+ confirmation. Submitting it sends the
 * verification code.
 *
 * The step after the questions rather than before them, which is what the copy is
 * leaning on: there is a finished quiz behind this form, so it asks for a number in
 * order to send something the visitor has already earned.
 *
 * Whether they really finished it can only be checked in the browser — the answers
 * live in this tab's sessionStorage and never reach the server until after the code
 * is verified — so the guard is inside `DetailsForm` rather than a redirect here.
 */
export default function DetailsPage() {
  return (
    <FunnelShell
      title={
        <>
          Your Likeness Health Score
          {/* Service mark, set so it hangs off the cap line like the design draws it. */}
          <sup className="align-[6px] text-[0.42em]">SM</sup> is ready! How can we
          send it to you?
        </>
      }
      subtitle="We won't share your information with anyone."
    >
      <DetailsForm />
    </FunnelShell>
  );
}
