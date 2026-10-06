"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { backPath, NOT_ELIGIBLE_PATH, nextPath, STEP_PATHS } from "@/lib/funnel";
import { readFunnel, useFunnel } from "@/lib/funnel-state";
import { declaresMinor } from "@/lib/quiz";

/**
 * The six-digit code, ported from the app's OTPScreen.
 *
 * Same behaviour as the phone: one box per digit, focus walks forward as you type
 * and backward on backspace into an empty box, a paste fills the row, and a full
 * code verifies itself rather than waiting for a tap on a button — QC flagged that
 * last one on mobile as needless friction, and it is the same friction here.
 *
 * Two states now, where there were three. This screen used to submit the quiz answers
 * along with the code, which meant it had to handle the case where the code was
 * ACCEPTED and the write after it failed — a dead end with nothing to retype, because
 * the challenge was spent. The answers are still waiting in the tab at this point, but
 * they are no longer this screen's business: the code buys a session and nothing else,
 * and `/calculating` does the write with that session, retrying as often as it likes.
 *
 *   code     typing, resending, verifying — the screen as drawn.
 *   expired  the pending challenge cookie is gone (15 minutes), so neither verifying
 *            nor resending can work — both answer 401. The only way on is a new
 *            number, so that is the only thing offered.
 *   blocked  the API refused the NUMBER, not the code: its last account was deleted
 *            and is still inside its waiting period (409, `blocked`). The code may
 *            well have been right, so nothing here is drawn as a mistake to correct.
 */const LENGTH = 6;

/** Only used until the API has told us its own cooldown — `/api/otp/start` relays
 *  `resend_after`, and that is the number the API will actually enforce. */
const FALLBACK_COOLDOWN_S = 60;

const EMPTY = Array<string>(LENGTH).fill("");

type Stage = "code" | "expired" | "blocked";

export function OtpForm() {
  const router = useRouter();
  const { phone, resendAfter } = useFunnel();

  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [stage, setStage] = useState<Stage>("code");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(resendAfter ?? FALLBACK_COOLDOWN_S);

  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  /* Guards the auto-submit against a double fire. The server counts every wrong
     code against a rate limit, so submitting the same six digits twice costs the
     user one of their attempts for nothing. */
  const submitted = useRef<string | undefined>(undefined);

  const code = digits.join("");

  useEffect(() => {
    /* The details form already turns away an under-18 answer, but the quiz can be
       re-answered after the code is sent — back, change the age, forward to here.
       Verifying is what writes the adult placeholder birth date, so this screen
       checks too. */
    if (declaresMinor(readFunnel().answers)) {
      router.replace(NOT_ELIGIBLE_PATH);
      return;
    }
    // No number means the details step never completed, so no code was ever sent.
    if (!readFunnel().phone) {
      router.replace(STEP_PATHS.details);
      return;
    }
    boxes.current[0]?.focus();
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = useCallback(
    async (entered: string) => {
      if (submitted.current === entered) return;
      if (declaresMinor(readFunnel().answers)) {
        router.replace(NOT_ELIGIBLE_PATH);
        return;
      }
      submitted.current = entered;

      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: entered }),
        });
        const body = (await res.json()) as {
          error?: string;
          blocked?: boolean;
          quizAlreadyTaken?: boolean;
        };

        if (!res.ok) {
          /* The number is serving a deletion cooldown. This arrives AFTER the code
             was accepted, so the digits stay on screen and the row is not cleared —
             there is nothing wrong with them to fix. */
          if (body.blocked) {
            setStage("blocked");
            setError(body.error ?? "This number can't open a new account yet.");
            return;
          }

          /* The session went before the code came back. Retyping and resending both
             answer 401 from here, so the screen stops offering either. */
          if (res.status === 401) {
            setStage("expired");
            setError(body.error ?? "Your code expired. Start again.");
            return;
          }

          setError(body.error ?? "That code isn't right");
          setDigits(EMPTY);
          boxes.current[0]?.focus();
          // Let the same digits be tried again after a clear — the user may have
          // simply mistyped, and the server is the one keeping count.
          submitted.current = undefined;
          return;
        }

        /* An account that already took the quiz — in the app, or here before — has
           a score, and the answers in this tab are not going to replace it. So it
           skips the loader and reads its score. Only a shortcut: `/api/quiz` refuses
           the overwrite on its own, which is what covers a verify that couldn't read
           the account and so reported false. */
        router.push(
          body.quizAlreadyTaken === true
            ? STEP_PATHS.score
            : (nextPath("otp") ?? STEP_PATHS.landing),
        );
      } catch {
        setError("We couldn't reach the server. Check your connection.");
        submitted.current = undefined;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  /**
   * Types a digit, or spreads a pasted code across the row.
   *
   * The auto-verify fires from here rather than from an effect watching the code:
   * completing the code is an event, not state to synchronise, and running it in an
   * effect re-submits on any re-render that happens to leave six digits in place.
   */
  function change(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    setError(null);

    let next: string[];
    if (cleaned.length > 1) {
      // A paste (or an SMS autofill) — lay it out from the first box, not this one.
      next = [...EMPTY];
      cleaned
        .slice(0, LENGTH)
        .split("")
        .forEach((c, i) => (next[i] = c));
      boxes.current[Math.min(cleaned.length, LENGTH - 1)]?.focus();
    } else {
      next = [...digits];
      next[index] = cleaned;
      if (cleaned && index < LENGTH - 1) boxes.current[index + 1]?.focus();
    }

    setDigits(next);

    const entered = next.join("");
    if (entered.length === LENGTH) verify(entered);
  }

  function keyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      // Clear the box behind and step into it, so one press does one visible thing.
      event.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
      boxes.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < LENGTH - 1) {
      boxes.current[index + 1]?.focus();
    }
  }

  async function resend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      /* `/api/otp/start` needs the full contact again, but this screen deliberately
         never held the name and email. The number is enough to re-send: the pending
         session cookie still carries the rest. */
      const res = await fetch("/api/otp/resend", { method: "POST" });
      const body = (await res.json()) as {
        error?: string;
        blocked?: boolean;
        resendAfter?: number | null;
      };
      if (!res.ok) {
        if (body.blocked) {
          setStage("blocked");
          setError(body.error ?? "This number can't open a new account yet.");
          return;
        }
        if (res.status === 401) {
          setStage("expired");
          setError(body.error ?? "Your session expired. Start again.");
          return;
        }
        setError(body.error ?? "Couldn't resend your code.");
        return;
      }
      setDigits(EMPTY);
      submitted.current = undefined;
      boxes.current[0]?.focus();
      setCooldown(body.resendAfter ?? FALLBACK_COOLDOWN_S);
    } catch {
      setError("We couldn't reach the server. Check your connection.");
    } finally {
      setResending(false);
    }
  }

  /* Shared by both dead ends. A code that never arrives is usually a mistyped
     number, and the backend answers 200 to a send whether or not the SMS actually
     went out (server.js swallows the Twilio error), so the funnel cannot tell the
     user it failed — the way it stays honest is by always leaving this door open. */
  const changeNumber = (
    <Link
      href={STEP_PATHS.details}
      className="text-sm font-medium text-brand transition-colors hover:opacity-70"
    >
      Use a different number
    </Link>
  );

  if (stage === "blocked") {
    return (
      <div className="mt-7">
        <p role="alert" className="text-sm text-danger">
          {error ?? "This number can't open a new account yet."}
        </p>
        <p className="mt-3 text-[14px] leading-[21px] text-black/45">
          The wait belongs to the number, not to the code you entered — resending
          won&apos;t shorten it. Another number can start straight away.
        </p>
        <Link
          href={STEP_PATHS.details}
          className="mt-8 flex h-14 w-full items-center justify-center rounded-full bg-brand text-base font-semibold text-ink-inverse transition-colors hover:bg-cta sm:w-[317px]"
        >
          Use a different number
        </Link>
      </div>
    );
  }

  if (stage === "expired") {
    return (
      <div className="mt-7">
        <p role="alert" className="text-sm text-danger">
          {error ?? "Your code expired."}
        </p>
        <p className="mt-3 text-[14px] leading-[21px] text-black/45">
          Codes are only good for 15 minutes. Enter your number again and we&apos;ll
          text you a new one.
        </p>
        <Link
          href={STEP_PATHS.details}
          className="mt-8 flex h-14 w-full items-center justify-center rounded-full bg-brand text-base font-semibold text-ink-inverse transition-colors hover:bg-cta sm:w-[317px]"
        >
          Enter your number again
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-7">
      {/* The number the code went to. `/api/otp/start` hands back its own normalised
          copy for exactly this, and until now the screen never showed it — a digit
          typed wrong was invisible, and the silence that follows looks identical to
          a carrier delay. */}
      {phone ? (
        <p className="text-[14px] leading-[21px] text-black/45">
          Sent to <span className="font-semibold text-ink">{phone}</span>.{" "}
          {changeNumber}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2 sm:gap-4">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            value={digit}
            onChange={(e) => change(i, e.target.value)}
            onKeyDown={(e) => keyDown(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            // Not `maxLength={1}`: a paste has to be allowed in so it can be spread
            // across the row, which is what the app does too.
            maxLength={LENGTH}
            aria-label={`Digit ${i + 1} of ${LENGTH}`}
            disabled={busy}
            className={`h-14 min-w-0 flex-1 rounded-xl border-[1.6px] bg-canvas text-center text-[22px] font-semibold text-ink transition-colors focus:border-brand focus:outline-none disabled:opacity-60 sm:h-[72px] ${
              digit ? "border-brand/70" : "border-line-soft"
            }`}
          />
        ))}
      </div>

      <div aria-live="polite" className="mt-4 min-h-6 text-sm">
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : busy ? (
          <p className="text-ink-muted">Verifying…</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0 || resending}
        className="mt-2 self-start text-sm font-medium text-brand transition-colors disabled:text-ink-faint"
      >
        {resending
          ? "Sending…"
          : cooldown > 0
            ? `Resend code in ${cooldown}s`
            : "Resend code"}
      </button>

      <div className="mt-12 flex flex-col-reverse gap-4 sm:flex-row sm:justify-center sm:gap-5">
        <button
          type="button"
          onClick={() => router.push(backPath("otp") ?? STEP_PATHS.details)}
          className="flex h-14 items-center justify-center rounded-full bg-canvas text-base font-semibold text-brand-ink transition-colors hover:bg-surface sm:w-44"
        >
          Back
        </button>
        {/*
         * The button is disabled for two unrelated reasons and they have to
         * look different: fewer than six digits typed is "not yet", which is
         * the dim, and a code being checked is "working", which is the sweep.
         * Sharing one dim between them meant a verify on a slow connection was
         * indistinguishable from a button that had never been armed — and this
         * is the step where the visitor is most likely to think they mistyped
         * and start over. The dim is dropped while `busy` so the sweep runs on
         * the full purple rather than on a washed-out ghost of it.
         */}
        <button
          type="button"
          onClick={() => verify(code)}
          disabled={code.length < LENGTH || busy}
          aria-busy={busy}
          className={`flex h-14 items-center justify-center rounded-full bg-brand text-base font-semibold text-ink-inverse transition-colors hover:bg-cta sm:w-[317px] ${
            busy ? "shimmer" : "disabled:opacity-40"
          }`}
        >
          {busy ? "Verifying…" : "Get my score"}
        </button>
      </div>
    </div>
  );
}
