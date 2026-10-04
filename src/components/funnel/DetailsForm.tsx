"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "@/components/landing/icons";
import {
  CALLING_CODES,
  composePhone,
  DEFAULT_CALLING_CODE,
  DEFAULT_COUNTRY,
} from "@/lib/calling-codes";
import { backPath, NOT_ELIGIBLE_PATH, nextPath, STEP_PATHS } from "@/lib/funnel";
import { readFunnel, writeFunnel } from "@/lib/funnel-state";
import { declaresMinor, quizIncomplete } from "@/lib/quiz";
import { useQuizDefinition } from "@/lib/use-quiz-definition";
import { ContactCard, Envelope } from "./icons";

/**
 * First and last name, email, phone and an 18+ confirmation — the gate in front of
 * the score.
 *
 * Submitting sends the OTP. Nothing is written to the shared user record here: the
 * server only remembers the details in a signed cookie until the code comes back,
 * so an unverified phone number can't overwrite somebody else's score.
 *
 * The details are deliberately NOT kept in `funnel-state`. sessionStorage survives a
 * reload, and a shared phone would hand the next person a stranger's name and email
 * back on a plate — the server already holds them for the one hop to the OTP screen.
 * Only the phone is stored, and only so the OTP screen can say where it texted.
 *
 * The form guards itself against being reached with no quiz behind it, which the page
 * cannot do: the answers are in this tab's sessionStorage and the server has never
 * seen them. Without the guard, someone who opened /details directly would hand over
 * a phone number, spend a code, and land on a loader that immediately bounced them
 * back to question one — having verified for nothing.
 */

const FIELD =
  "h-14 w-full rounded-[14px] border-[1.6px] bg-canvas pr-4 text-base text-ink transition-colors placeholder:text-ink-placeholder focus:outline-none";

/* Clears the icon `Field` draws. The phone field keeps its own, wider inset
   instead, because the country picker sits where the icon would. */
const FIELD_PL = "pl-[55px]";

function Field({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      {/* The three field icons all draw 20.25 wide, 19.5px in from the field's
          left edge. The box matches so they sit on one vertical line. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-[19.5px] flex w-[20.25px] -translate-y-1/2 justify-center text-ink-faint"
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

export function DetailsForm() {
  const router = useRouter();
  const ids = useId();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  /* A checkbox, not a date of birth. The funnel deliberately stopped collecting birth
     dates; the API's required `date_of_birth` gets a fixed placeholder server-side
     (`SYNTHETIC_ADULT_DOB`), and only this boolean ever leaves the browser. */
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /* Adults only: someone who answered the age question with the under-18 band is
     sent away before this form can text them a code — no challenge cookie, and no
     adult placeholder birth date written to a profile on the strength of an 18+ box
     they would have to tick against their own answer. Doesn't wait for the
     definition like the guard below, because it needs nothing from it: the answer
     is either in this tab's store or it isn't. */
  useEffect(() => {
    if (declaresMinor(readFunnel().answers)) router.replace(NOT_ELIGIBLE_PATH);
  }, [router]);

  /* No quiz behind this form means there is no score to send anywhere, so there is
     nothing to ask for. Same shape as the guard on the OTP screen, and same reason it
     is an effect rather than a redirect on the page: the answers are in this tab's
     sessionStorage and the server has never seen them.

     Read the store directly rather than through `useFunnel`: the hook's first value
     is the empty server snapshot, which would read as an abandoned quiz and bounce
     someone who answered everything.

     Waits for the definition, and that guard is load-bearing now that the questions
     are fetched: `quizIncomplete` reports true for a null definition, so running this
     before it arrives would bounce EVERY visitor — including one who has answered
     everything — straight back to question one. A definition that fails to load
     leaves `quiz` null and this lets the visitor through: the write on `/calculating`
     re-reads it server-side and is the honest place to refuse. */
  const { quiz } = useQuizDefinition();
  useEffect(() => {
    if (quiz === null) return;
    if (quizIncomplete(quiz, readFunnel())) {
      router.replace(STEP_PATHS["quiz-questions"]);
    }
  }, [quiz, router]);

  /* One lookup feeds both sides of the picker: the code goes into the composed
     number, the flag onto the display drawn over the <select>. */
  const selected = CALLING_CODES.find((c) => c.label === country);
  const callingCode = selected?.code ?? DEFAULT_CALLING_CODE;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    /* The button is already disabled without the tick; this covers anything that
       submits the form some other way. The server refuses it regardless. */
    if (sending || !ageConfirmed) return;
    /* Again at the moment of sending, so the code can't go out in the gap before the
       redirect above lands. */
    if (declaresMinor(readFunnel().answers)) {
      router.replace(NOT_ELIGIBLE_PATH);
      return;
    }

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          ageConfirmed,
          phone: composePhone(callingCode, phone),
        }),
      });
      const body = (await res.json()) as {
        phone?: string;
        resendAfter?: number | null;
        error?: string;
      };

      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }

      /* The server's normalised copy, not ours — it's the string the code was
         actually texted to, and the one the OTP screen should show. `resendAfter`
         is the API's own cooldown, carried through so the OTP screen counts the
         real wait rather than a number this side invented; the API enforces it
         either way, and a shorter local guess just produces a 429. Null when the
         API's timestamp wouldn't parse; it collapses to undefined so the OTP
         screen falls back to its own figure rather than storing a dead value. */
      writeFunnel({
        phone: body.phone,
        resendAfter: body.resendAfter ?? undefined,
        lastStep: "details",
      });
      router.push(nextPath("details") ?? STEP_PATHS.landing);
    } catch {
      setError("We couldn't reach the server. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-7">
      <div className="flex flex-col gap-5">
        {/* Two fields rather than one "Full Name", because `PATCH /v1/me/profile`
            stores `first_name` and `last_name` as separate columns and /v1 keeps no
            combined string beside them. Splitting one field on the first space got
            anyone with a two-word given name wrong and left them nothing to correct
            it from — asking for the two parts the record actually has costs one
            input and removes the guess. Side by side where there is room; a phone
            stacks them like everything else. */}
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex-1">
            <Field icon={<ContactCard />}>
              <label htmlFor={`${ids}-first`} className="sr-only">
                First name
              </label>
              <input
                id={`${ids}-first`}
                name="given-name"
                type="text"
                autoComplete="given-name"
                required
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`${FIELD} ${FIELD_PL} border-line-soft focus:border-brand`}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field icon={<ContactCard />}>
              <label htmlFor={`${ids}-last`} className="sr-only">
                Last name
              </label>
              <input
                id={`${ids}-last`}
                name="family-name"
                type="text"
                autoComplete="family-name"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`${FIELD} ${FIELD_PL} border-line-soft focus:border-brand`}
              />
            </Field>
          </div>
        </div>

        <Field icon={<Envelope />}>
          <label htmlFor={`${ids}-email`} className="sr-only">
            Email address
          </label>
          <input
            id={`${ids}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${FIELD} ${FIELD_PL} border-line-soft focus:border-brand`}
          />
        </Field>

        {/*
         * The design draws the picker inside the field's LEFT edge, with a rule
         * between it and the digits, so the two read as one control rather than a
         * box with a badge parked in it. That is also the order the number is
         * spoken and dialled in — country first, then the digits — so the eye
         * crosses the field once instead of jumping back for the code.
         *
         * It takes the slot the other fields give their icon, so this field carries
         * none: the flag says "phone number" more plainly than a chat bubble would.
         *
         * The three insets are measured off the design — the picker starts 28px in,
         * the rule lands at 108px, the digits at 120px — and the picker is boxed at
         * 80px so the longest code on the list (+971) still clears the rule.
         */}
        <div className="relative">
          <label htmlFor={`${ids}-phone`} className="sr-only">
            Phone number
          </label>
          <input
            id={`${ids}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`${FIELD} border-line-soft pl-[120px] focus:border-brand`}
          />
          <label htmlFor={`${ids}-code`} className="sr-only">
            Country calling code
          </label>
          {/*
           * Still a native <select>, because the OS picker is the kindest thing on a
           * phone: it scrolls, it takes type-ahead, and it needs no outside-tap or
           * arrow-key handling of ours. The one thing it cannot do is show a different
           * string open and closed, and the two pull opposite ways — the open list is
           * only readable with country names on it, while the closed control has to
           * fit inside the phone field next to the digits, where a name will not go.
           * Dial codes alone was the wrong half to keep: a bare column of "+353, +27,
           * +33" asks the reader to know the codes already.
           *
           * So the <select> carries the names and is laid transparent over a display
           * of our own, which shows the flag and the code and takes no taps of its
           * own. `peer` passes the real control's focus and hover through to it, so
           * the thing that looks like the control still reacts like one — in ink
           * rather than a border, which the design does not draw around the picker.
           *
           * Keyed by country, not by calling code: the US and Canada both send +1,
           * and two <option>s sharing a value both come up selected — the browser
           * then shows whichever is last, so picking the US displayed Canada.
           */}
          <div className="absolute top-1/2 left-7 h-8 w-20 -translate-y-1/2">
            <select
              id={`${ids}-code`}
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              /* `text-base`, invisible though it is: iOS zooms the page in on a
                 focused control drawn below 16px. */
              className="peer absolute inset-0 size-full cursor-pointer appearance-none text-base opacity-0"
            >
              {CALLING_CODES.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.flag} {option.label} (+{option.code})
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none flex h-full items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors peer-hover:text-ink peer-focus-visible:text-brand"
            >
              <span className="text-base leading-none">{selected?.flag}</span>+
              {callingCode}
              <ChevronDown className="size-4 text-ink-faint" />
            </span>
          </div>
          {/* The rule between picker and digits. Its own element rather than a
              border on either side: it stops short of the field's top and bottom,
              which a border on a full-height box cannot do. */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-[108px] h-[30px] w-px -translate-y-1/2 bg-line-soft"
          />
        </div>

        {/* In place of the date-of-birth field, which is gone: the funnel no longer
            asks for a birth date at all. The box is the quiz's own "select all
            that apply" checkbox — 20px on a 4px radius, a 1.61px inset outline at
            rest, brand fill and tick when on — so it reads as the same control
            the visitor has just been using. See QuizFlow for why the outline is a
            shadow rather than a border.

            Under the drawing is a real checkbox, hidden but not removed, so the
            keyboard, screen readers and `required` all work without code of ours,
            and the words are its label, so a tap on them toggles it too. It can't
            show focus itself, so `peer` hands the ring to the box. The box sits on
            the first line of the 14/20 copy, which wraps on a narrow phone.

            Last in the column rather than where the date sat, so the four text
            fields still read as one block and the confirmation sits next to the
            button it unlocks. */}
        <label
          htmlFor={`${ids}-adult`}
          className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft"
        >
          <input
            id={`${ids}-adult`}
            name="age-confirmed"
            type="checkbox"
            required
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className={`flex size-5 shrink-0 items-center justify-center rounded-[4px] transition-[background-color,box-shadow] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ${
              ageConfirmed
                ? "bg-brand text-ink-inverse"
                : "shadow-[inset_0_0_0_1.61px_var(--color-line-strong)]"
            }`}
          >
            {ageConfirmed ? <Check className="size-5" /> : null}
          </span>
          I confirm that I am 18 years old or older
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {/*
       * The design centres a 176 + 20 + 317 row inside the 560 column. On a phone
       * there is no room for that, so they go full width and the primary leads.
       */}
      <div className="mt-12 flex flex-col-reverse gap-4 sm:flex-row sm:justify-center sm:gap-5">
        <button
          type="button"
          onClick={() => router.push(backPath("details") ?? STEP_PATHS.quiz)}
          className="flex h-14 items-center justify-center rounded-full bg-canvas text-base font-semibold text-brand-ink transition-colors hover:bg-surface sm:w-44"
        >
          Back
        </button>
        {/*
         * Waiting and unavailable are two different things, and the button has
         * to be able to say which. `disabled` alone can only dim, so a slow
         * network looked exactly like a form that wasn't ready — on the one
         * screen where the request goes out over SMS and can genuinely take a
         * few seconds. So the dim is kept for "can't press this yet" and the
         * sweep carries "pressed, working": full brand purple, with a band of
         * light crossing it for as long as the code is in flight. Until the
         * 18+ box is ticked it is "can't press this yet".
         */}
        <button
          type="submit"
          disabled={sending || !ageConfirmed}
          aria-busy={sending}
          className={`flex h-14 items-center justify-center rounded-full bg-brand text-base font-semibold text-ink-inverse transition-colors hover:bg-cta sm:w-[317px] ${
            sending ? "shimmer" : "disabled:opacity-40"
          }`}
        >
          {sending ? "Sending code…" : "Get my score"}
        </button>
      </div>
    </form>
  );
}
