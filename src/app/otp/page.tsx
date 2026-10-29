import type { Metadata } from "next";
import { FunnelShell } from "@/components/funnel/FunnelShell";
import { OtpForm } from "@/components/funnel/OtpForm";

export const metadata: Metadata = {
  title: "ImageShield - Enter your verification code",
};

/**
 * Phone verification.
 *
 * The design set doesn't include this screen, so it borrows the details screen's
 * shell verbatim - same header, same 560px column, same heading and button sizes -
 * and takes its behaviour from the app's OTPScreen, which is the version of this
 * step users of the product already know.
 *
 * The 15 minutes in the subtitle is the funnel's own pending window, which is a limit
 * this side genuinely enforces - the API's challenge carries its own `expires_at`, and
 * quoting a number we don't control would be a promise we can't keep. Whichever runs
 * out first, the screen's dead end is the same and it offers a fresh number.
 *
 * No guard here, and it is not because there is nothing to guard: the quiz IS
 * answered by this point. `OtpForm` bounces a visitor with no phone in the store back
 * to the details form, and that form is what checks the quiz - so nobody reaches this
 * screen without both. Nothing this page could add on the server would help anyway,
 * since the answers live in the tab and have never been sent.
 */
export default function OtpPage() {
  return (
    <FunnelShell
      title="Enter your verification code"
      subtitle="We texted you a 6-digit code. Enter it within 15 minutes."
    >
      <OtpForm />
    </FunnelShell>
  );
}
