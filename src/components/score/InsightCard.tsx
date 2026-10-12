/**
 * The lavender card the export uses twice: "Your risk factors" and "Immediate
 * Recommendations".
 *
 * Both are the same object — a heading over a list of rows, each row an outlined
 * glyph in a white disc beside a title and a paragraph — so they are one component
 * taking different rows rather than two that have to be kept in step.
 *
 * The two differ in exactly one way, and it is deliberate: a risk factor's title is
 * a noun the eye can land on ("Age", "Gender"), so it is set large; a recommendation's
 * title is a whole instruction ("Sign up for YouTube's free likeness detection
 * service"), so it is set at body size in bold. Setting the sentence at the noun's
 * size would make the card read as three competing headlines. `emphasis` picks which.
 *
 * On a phone that distinction is dropped, because the export drops it: at 403px the
 * column is too narrow for a 20px noun to sit on one line beside an 84px disc, so
 * both cards set their titles at 15px bold and the whole card shrinks with them —
 * 59px discs, a 16px radius and a flat ground.
 *
 * That flat ground is the other phone-only change. The card's ground fades out over
 * its last 5% — the export's own gradient, which stops the block ending on a hard
 * edge against the white page — but a 24px fade eats the bottom corners of a 16px
 * radius, so below `sm` the fill is flat and the corners survive.
 */
export type InsightRow = {
  id: string;
  icon: (props: { className?: string }) => React.ReactElement;
  title: string;
  body: string;
  /** A page to read more on, opened in a new tab. Only recommendations carry one. */
  link?: { href: string; label: string } | null;
};

export function InsightCard({
  heading,
  rows,
  variant = "factors",
}: {
  heading: string;
  rows: readonly InsightRow[];
  /**
   * Which of the two cards this is. It used to switch the row titles as well — a
   * factor's title is a noun ("Age") and a recommendation's is a whole instruction,
   * so the latter was set smaller — but the desktop export gives both the same 20px
   * SemiBold, so the rows are now one treatment and this selects only the heading's
   * tracking and shade. See the note on the heading.
   */
  variant?: "factors" | "recommendations";
}) {
  return (
    <section className="rounded-2xl bg-[#F4F2FA] px-5 pt-8 pb-8 sm:rounded-3xl sm:bg-gradient-to-b sm:from-[#F4F2FA] sm:via-[#F4F2FA] sm:via-95% sm:to-transparent sm:px-[92px] sm:pt-11 sm:pb-12">
      {/* The two cards' headings are the same size, weight and leading, and differ
          in the desktop export by a hair of tracking and an imperceptible shade —
          -1.2px and #212121 on "General recommendations" against 0 and #1A1C1D on
          the risk factors. Both are reproduced rather than averaged, but see the
          note on `emphasis`: this is the likelier of the two to be drift. */}
      <h2
        className={`text-[17px] leading-6 font-bold text-ink-report sm:text-2xl sm:leading-[48px] ${
          variant === "factors" ? "sm:text-ink-card" : "sm:tracking-[-1.2px]"
        }`}
      >
        {heading}
      </h2>

      <ul className="mt-6 flex flex-col gap-[18px] sm:mt-8 sm:gap-9">
        {rows.map(({ id, icon: Icon, title, body, link }) => (
          <li key={id} className="flex items-start gap-3 sm:gap-6">
            {/* The disc is a fixed size and the glyphs inside it are several
                different sizes, drawn at their own — centring rather than sizing
                them is what keeps a column of discs identical. */}
            <span className="flex size-[59px] shrink-0 items-center justify-center rounded-full bg-canvas text-ink sm:size-[84px]">
              <Icon />
            </span>
            <div className="sm:pt-1">
              {/* One treatment for both cards. The desktop export sets "Keep your
                  social media private" at the same 20px/28px SemiBold #1A1C1D as the
                  risk factors' own titles, and only "Sign up for YouTube's free
                  likeness detection service" — the longest title on the screen — at
                  15px on that same 28px leading. A 1.87 line-height ratio against
                  1.4 everywhere else is what a title shrunk to fit looks like, not a
                  second style, so 20px is taken as the rule. */}
              <h3 className="text-[15px] leading-5 font-bold text-ink sm:text-xl sm:leading-7 sm:font-semibold sm:text-ink-card">
                {title}
              </h3>
              <p className="mt-1 max-w-[600px] text-[14px] leading-[19px] text-ink-body sm:mt-1.5 sm:text-base sm:leading-6">
                {body}
              </p>
              {/* The export draws no link, so this takes the body's size and the
                  brand ink, underlined so it reads as a link without relying on
                  colour alone. `noopener` stops the cited page reaching back into
                  this tab through `window.opener`; `noreferrer` keeps a visitor's
                  arrival from a score page out of a third party's logs.

                  `wrap-anywhere`, not `wrap-break-word`: a host label is one long
                  word (blueoceanglobaltech.com is 181px), and only `anywhere` lets
                  it narrow the column instead of pushing the row 12px into the
                  card's padding on a 320px screen. Where it fits, nothing wraps. */}
              {link && (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[14px] leading-[19px] font-semibold wrap-anywhere text-brand underline underline-offset-2 hover:text-cta sm:mt-1.5 sm:text-base sm:leading-6"
                >
                  {link.label}{" "}
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
