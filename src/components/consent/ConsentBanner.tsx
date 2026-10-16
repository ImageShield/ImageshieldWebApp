"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import type { Consent } from "@/lib/consent";
import { PRIVACY_POLICY_URL } from "@/lib/site-nav";

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
    detail:
      "Google Tag Manager, and any measurement tools we run through it, such as Google Analytics where enabled: which screens people reach and where they stop.",
  },
  {
    key: "marketing",
    label: "Marketing",
    detail:
      "HubSpot and Google's advertising signals. Where enabled, HubSpot may track your visits, collect what you enter in our forms (such as your name, email and phone number), run advertising pixels that measure our ads, and show pop-ups.",
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
 * button just pressed — otherwise that button is removed while focused and the
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
          Cookies on the quiz
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
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              With your OK, we use Google Tag Manager to see how the quiz is used, and
              HubSpot for marketing, which can include collecting what you enter in our
              forms. Neither loads unless you say yes, the quiz works the same either
              way, and you can change your mind from &ldquo;Cookie settings&rdquo; at
              the bottom of any page.{" "}
              <a href={PRIVACY_POLICY_URL} className="font-semibold text-brand-ink underline">
                Privacy policy
              </a>
            </p>
          )}
        </div>

        <div className="mt-4 flex shrink-0 gap-3">
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
