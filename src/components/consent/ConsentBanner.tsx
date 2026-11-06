"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import { ANSWER_ANALYTICS_APPROVED } from "@/lib/analytics-approval";
import type { Consent } from "@/lib/consent";
import { PRIVACY_POLICY_URL } from "@/lib/site-nav";

/* The analytics wording live today, and the one drafted for legal review that names
   answer-level collection. The second shows only once ANSWER_ANALYTICS_APPROVED is on,
   which also moves consent to v4 so nobody's earlier "yes" is read as a "yes" to it.

   The Meta Pixel is described here, not under marketing, because that is where it
   runs: the Tag Manager container loads with the analytics choice, and the Pixel's tags
   in it carry no consent check of their own. They fire on every page load and page
   change, on quiz_start, quiz_complete and on reaching /score, and the Pixel's
   automatic configuration is on, which reports button clicks and page details. Advanced
   matching is off, so nothing typed into a form reaches it. */
export const META_PIXEL_DETAIL =
  "The Meta Pixel, also run through Tag Manager, tells Meta the pages you visit, the quiz steps you reach and the buttons you press, so we can measure our ads on Facebook and Instagram.";
const ANALYTICS_DETAIL =
  `Google Tag Manager, and Google Analytics through it: which screens people reach and where they stop. ${META_PIXEL_DETAIL}`;
export const ANALYTICS_DETAIL_WITH_ANSWERS =
  `Google Tag Manager, and Google Analytics through it: which quiz questions people reach, where they stop, and the options chosen for some questions - which platforms you use, how often photos of you are shared, and how you monitor your likeness. Never your age, gender, experience of misuse, name, email or phone number. ${META_PIXEL_DETAIL}`;
/* HubSpot and Google's advertising signals: what the marketing choice loads. */
export const MARKETING_DETAIL =
  "HubSpot and Google's advertising signals. Where enabled, HubSpot may track your visits, collect what you enter in our forms (such as your name, email and phone number), run advertising pixels that measure our ads, and show pop-ups.";
const SUMMARY_ANALYTICS = ANSWER_ANALYTICS_APPROVED
  ? "With your permission, Google Analytics helps us understand how the quiz is used, including some of your answers."
  : "With your permission, Google Analytics helps us understand how the quiz is used.";

const ALL: Consent = { analytics: true, marketing: true };
const NONE: Consent = { analytics: false, marketing: false };

const CATEGORIES: ReadonlyArray<{
  key: keyof Consent;
  label: string;
  detail: string;
}> = [
  {
    key: "analytics",
    label: "Analytics",
    detail: ANSWER_ANALYTICS_APPROVED ? ANALYTICS_DETAIL_WITH_ANSWERS : ANALYTICS_DETAIL,
  },
  {
    key: "marketing",
    label: "Marketing",
    detail: MARKETING_DETAIL,
  },
];

/**
 * A click from a mouse or a tap has a `detail` of at least 1; Enter, Space and a
 * screen reader's activation all arrive as 0.
 */
const byPointer = (event: MouseEvent) => event.detail > 0;

/**
 * The cookie question, pinned to the bottom of the screen.
 *
 * Not modal: the quiz stays usable underneath, and nothing optional runs until a
 * button here is pressed. "Reject all" sits beside "Accept all" at the same size,
 * because refusing has to be as easy as agreeing.
 *
 * Opens on the two-button summary for a first visit, or straight on the per-category
 * choices when the visitor came back through "Cookie settings".
 *
 * Focus follows the visitor, never the page load: a first-visit banner appearing
 * doesn't take it, but switching views moves it into the view that replaced the
 * button just pressed - otherwise that button is removed while focused and the
 * browser drops focus back to the top of the document.
 */
export function ConsentBanner({
  initial,
  manage,
  onSave,
  onCancel,
}: {
  initial: Consent;
  manage: boolean;
  onSave: (consent: Consent, byPointer: boolean) => void;
  /** Only once a choice exists; a first visit has to answer. */
  onCancel?: (byPointer: boolean) => void;
}) {
  const [managing, setManaging] = useState(manage);
  const [choice, setChoice] = useState(initial);
  const firstChoice = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  /* Where focus goes once the next view has rendered. Set only by the control that
     changes the view (or by opening from "Cookie settings"), and cleared once used. */
  const focusNext = useRef<"choices" | "choose" | null>(manage ? "choices" : null);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "choices") firstChoice.current?.focus();
    if (target === "choose") chooseButton.current?.focus();
  }, [managing]);

  function showChoices(show: boolean) {
    focusNext.current = show ? "choices" : "choose";
    setManaging(show);
  }

  const secondary =
    "flex h-12 flex-1 items-center justify-center rounded-full border border-line-strong bg-canvas text-sm font-semibold text-brand-ink transition-colors hover:bg-surface";
  const primary =
    "flex h-12 flex-1 items-center justify-center rounded-full bg-brand text-sm font-semibold text-ink-inverse transition-colors hover:bg-cta";

  return (
    <section
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {/* Capped at the screen: the choices run taller than a 320×568 phone, which
          pushed the heading off the top. Only the copy between the heading and the
          buttons scrolls, so the buttons are never what gets cut off. 3rem leaves
          room for the bottom inset. */}
      <div className="mx-auto flex max-h-[calc(100dvh-3rem)] max-w-[40rem] flex-col rounded-2xl bg-canvas p-5 shadow-[0_10px_40px_rgba(0,0,0,0.18)] ring-1 ring-line-soft sm:p-6">
        <h2 id="consent-title" className="shrink-0 text-base font-bold text-ink">
          Your privacy matters
        </h2>

        <div className="min-h-0 overflow-y-auto">
          {managing ? (
            <fieldset className="mt-3 flex flex-col gap-2">
              <legend className="sr-only">Optional cookies</legend>
              {CATEGORIES.map(({ key, label, detail }, i) => (
                <label
                  key={key}
                  className="flex cursor-pointer gap-3 rounded-xl border border-line-soft p-3"
                >
                  <input
                    ref={i === 0 ? firstChoice : undefined}
                    type="checkbox"
                    checked={choice[key]}
                    onChange={(e) => setChoice({ ...choice, [key]: e.target.checked })}
                    className="mt-0.5 size-4 shrink-0 accent-brand"
                  />
                  <span className="text-sm leading-5">
                    <span className="block font-semibold text-ink">{label}</span>
                    <span className="block text-ink-muted">{detail}</span>
                  </span>
                </label>
              ))}
              <p className="px-1 text-xs leading-5 text-ink-muted">
                Always on, because the quiz needs them: the browser storage that
                holds your answers, the cookies that check your code and keep you
                signed in, and the one that remembers this choice.
              </p>
            </fieldset>
          ) : (
            /* Short paragraphs, sized so the privacy policy link is in view on a
               320×568 phone without scrolling. The Meta Pixel sits with Google
               Analytics because it is loaded the same way - through Tag Manager, under
               the analytics choice. The forms sentence names HubSpot alone: its
               collected-forms script reads the details form; the Pixel runs without
               advanced matching and reads none of it. */
            <div className="mt-2 flex flex-col gap-1.5 text-sm leading-5 text-ink-soft sm:gap-2 sm:leading-6">
              <p>
                {SUMMARY_ANALYTICS} The Meta Pixel measures which quiz steps visitors
                reach to help us understand advertising performance.
              </p>
              <p>
                HubSpot and Google&apos;s advertising signals help us measure our
                marketing. HubSpot may also use information you provide through our forms.
              </p>
              <p>
                The quiz works the same whatever you choose. You can change your
                preferences anytime through Cookie settings at the bottom of any page.{" "}
                <a href={PRIVACY_POLICY_URL} className="font-semibold text-brand-ink underline">
                  Privacy policy
                </a>
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 flex shrink-0 gap-3 sm:mt-4">
          {managing ? (
            <>
              <button
                type="button"
                onClick={(e) => (onCancel ? onCancel(byPointer(e)) : showChoices(false))}
                className={secondary}
              >
                {onCancel ? "Cancel" : "Back"}
              </button>
              <button
                type="button"
                onClick={(e) => onSave(choice, byPointer(e))}
                className={primary}
              >
                Save choices
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => onSave(NONE, byPointer(e))}
                className={secondary}
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={(e) => onSave(ALL, byPointer(e))}
                className={primary}
              >
                Accept all
              </button>
            </>
          )}
        </div>

        {managing ? null : (
          <button
            ref={chooseButton}
            type="button"
            onClick={() => showChoices(true)}
            className="mt-3 w-full shrink-0 text-center text-sm font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            Choose what to allow
          </button>
        )}
      </div>
    </section>
  );
}
