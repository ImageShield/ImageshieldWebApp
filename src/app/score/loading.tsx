import { SiteHeader } from "@/components/landing/SiteHeader";
import { AppHandoffSection } from "@/components/score/AppHandoffSection";
import { WARM_CARD } from "@/components/score/ScoreResult";
import { Skeleton } from "@/components/Skeleton";

/**
 * What stands in for the result screen while the server fetches the score.
 *
 * `/score` renders on the server off the session cookie, and reading the score
 * means a round trip to the API before a single byte of the page can be sent.
 * Without this the browser sits on the previous screen for the whole of that
 * trip - on a slow connection, several seconds in which tapping the button did
 * nothing visible. Next wraps the page in a Suspense boundary for us and
 * streams this immediately in its place.
 *
 * Laid out against `ScoreResult`, block for block and gap for gap, because a
 * skeleton whose shape is a guess is worse than none: the real screen then
 * lands with everything a few dozen pixels off where the eye had already put
 * it. The two files have to be changed together - the comments there carry the
 * reasoning behind every measurement repeated here.
 *
 * One state this cannot help: a visitor with no session at all is redirected to
 * `/details`, and a redirect decided on the server arrives after this has
 * already painted, so they see a beat of skeleton on the way past. That is the
 * price of streaming, and it is worth paying - the visitors who DO have a score
 * are the ones this page is for, and they are the ones waiting on the API.
 *
 * `SiteHeader` is the real one, not a placeholder. It needs no data, and a bar
 * that is already the right purple with the logo in it is the difference
 * between a page loading and a page missing.
 */
export default function ScoreLoading() {
  return (
    <main
      aria-busy="true"
      className="relative min-h-[100dvh] bg-canvas font-sans"
    >
      <SiteHeader />

      {/* One announcement for the whole screen. Every block below is
          `aria-hidden`, so a reader hears this sentence once rather than
          walking two dozen empty boxes - and it is a `<p>` inside the landmark
          rather than a role on the `<main>` itself, which would take the
          landmark away from anyone navigating by them. */}
      <p role="status" className="sr-only">
        Loading your Likeness Health Score
      </p>

      <div className="mx-auto w-full max-w-[958px] px-5 pt-[65px] sm:px-6">
        {/* "Your Likeness Health Report" - centred on a phone, flush left from
            `sm`, which is what the real label does. */}
        <Skeleton className="mt-[29px] h-6 w-[210px] rounded-md max-sm:mx-auto sm:mt-12 sm:h-8 sm:w-[300px] lg:mt-[79px]" />

        <section className="mt-[15px] flex flex-col sm:mt-10 lg:mt-[37px] lg:grid lg:grid-cols-[1fr_333px] lg:items-start lg:gap-x-10">
          {/* The headline, which runs to three lines at every width the design
              draws - two of them full measure and a short one under. */}
          <div className="order-1 flex flex-col gap-3 max-sm:items-center lg:col-start-1 lg:row-start-1 lg:max-w-[440px] lg:pt-2">
            <Skeleton className="h-8 w-full rounded-md lg:h-12" />
            <Skeleton className="h-8 w-[85%] rounded-md lg:h-12" />
            <Skeleton className="h-8 w-[55%] rounded-md lg:h-12" />
          </div>

          <div className="order-2 mx-auto mt-9 w-full max-w-[333px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
            {/* The arc's caption, which only the phone draws. */}
            <Skeleton className="mx-auto h-6 w-[220px] rounded-md sm:hidden" />

            {/*
             * The gauge. 191px wide by the 153 its 300×240 viewBox scales to,
             * and a dome rather than a disc - the thing it is holding a space
             * for is a 228° arc with a numeral under it, so a full circle would
             * be the wrong silhouette by a third of its height.
             *
             * The radius is half the width, which is what turns the top edge
             * into a semicircle; anything less draws a rounded rectangle.
             */}
            <div className="mx-auto mt-6 w-[191px] lg:mt-0">
              <Skeleton className="h-[153px] w-full rounded-t-[96px] rounded-b-2xl" />
            </div>

            {/* The three-band scale: a rule, its label and its range, each in
                its own column. Same grid as `ScoreScale`, so the columns land
                on the same thirds. */}
            <div className="mt-5 sm:mt-8">
              <div className="mx-auto grid max-w-[310px] grid-cols-3 gap-x-[5px] sm:max-w-none sm:gap-x-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-[3px] w-full rounded-full sm:h-1" />
                    <Skeleton className="mx-auto mt-1.5 h-4 w-[72%] rounded sm:mt-2.5" />
                    <Skeleton className="mx-auto mt-1.5 h-4 w-[48%] rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* The sentence explaining the number - four lines on a phone, three
              at the desktop measure. */}
          <div className="order-3 mt-[41px] flex flex-col gap-2 max-sm:items-center lg:col-start-1 lg:row-start-2 lg:mt-5 lg:max-w-[520px]">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[90%] rounded" />
            <Skeleton className="h-4 w-[45%] rounded sm:hidden" />
          </div>
        </section>

        {/* The two warm download cards. Their ground is a gradient rather than a
            flat fill and needs no data to draw, so it is painted for real and
            only the contents are stood in for - the card is most of what the
            eye registers here, and a grey rectangle in its place would be a
            bigger change than the copy it holds. */}
        <div className={`mt-7 flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between sm:gap-10 lg:mt-[62px] ${WARM_CARD}`}>
          <div className="flex w-full flex-col gap-3 sm:max-w-[510px]">
            <Skeleton className="h-5 w-full rounded sm:h-7" />
            <Skeleton className="h-5 w-full rounded sm:h-7" />
            <Skeleton className="h-5 w-[70%] rounded sm:h-7" />
          </div>
          <DownloadCodes />
        </div>

        {/* The two lavender cards. Same reasoning as the warm one: the ground
            is the card, so it is drawn and its rows are stood in for. */}
        <div className="mt-6 flex flex-col gap-9 sm:mt-9 sm:gap-10">
          <InsightCardSkeleton rows={4} />
          <InsightCardSkeleton rows={3} />
        </div>

        <div className={`mt-10 lg:mt-[59px] ${WARM_CARD}`}>
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between sm:gap-10">
            <div className="flex w-full flex-col gap-3 sm:max-w-[610px]">
              <Skeleton className="h-5 w-full rounded sm:h-7" />
              <Skeleton className="h-5 w-full rounded sm:h-7" />
              <Skeleton className="h-5 w-[80%] rounded sm:h-7" />
            </div>
            <DownloadCodes />
          </div>

          {/* The scope note, which sits inside this card. */}
          <div className="mt-8 flex flex-col gap-2 sm:mt-10">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[65%] rounded" />
          </div>
        </div>
      </div>

      {/* The real section, not a stand-in. "Benefits of the app" takes no data
          - it is a static pitch with a mockup beside it - so there is nothing
          here to wait for, and drawing a grey copy of content we already have
          would be the one piece of this file that made the page slower to read
          rather than faster. Its own mockup shimmers on its own account, via
          `ShimmerImage`. */}
      <AppHandoffSection />
    </main>
  );
}

/**
 * The QR-and-badges block, which `DownloadPrompt` draws in both warm cards.
 *
 * The sizes are that component's - see the notes there.
 */
function DownloadCodes() {
  return (
    <div className="flex w-full max-w-[318px] shrink-0 items-center gap-[8.8%] sm:w-auto sm:max-w-none sm:gap-4">
      <Skeleton className="aspect-square w-[38%] shrink-0 rounded-2xl sm:size-[120px]" />
      <div className="flex w-[53.2%] flex-col gap-3 sm:w-[169px]">
        {/* The two badges are matched on width and differ in height, which is
            the export's own arrangement and not a slip. Heights by aspect ratio
            (640×192 and 1692×546), so they scale with the row on a narrow phone. */}
        <Skeleton className="aspect-[640/192] w-full rounded-[7px]" />
        <Skeleton className="aspect-[1692/546] w-[98.8%] rounded-[7px]" />
      </div>
    </div>
  );
}

/**
 * One lavender card: a heading over `rows` rows, each a disc beside two lines.
 *
 * The row count is passed in rather than fixed because the two cards hold
 * different numbers of them - four risk factors and three recommendations is
 * the usual shape, so that is what each reserves.
 */
function InsightCardSkeleton({ rows }: { rows: number }) {
  return (
    <section className="rounded-2xl bg-[#F4F2FA] px-5 pt-8 pb-8 sm:rounded-3xl sm:bg-gradient-to-b sm:from-[#F4F2FA] sm:via-[#F4F2FA] sm:via-95% sm:to-transparent sm:px-[92px] sm:pt-11 sm:pb-12">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-full rounded-md sm:h-8 sm:w-[80%]" />
        <Skeleton className="h-6 w-[60%] rounded-md sm:hidden" />
      </div>

      <ul className="mt-6 flex flex-col gap-[18px] sm:mt-8 sm:gap-9">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-start gap-3 sm:gap-6">
            {/* The disc is white on the real card, and the one piece of it that
                is already correct - so it is drawn rather than stood in for,
                and only the glyph inside it is missing. */}
            <span className="flex size-[59px] shrink-0 items-center justify-center rounded-full bg-canvas sm:size-[84px]">
              <Skeleton className="size-6 rounded-md sm:size-8" />
            </span>
            <div className="min-w-0 flex-1 sm:pt-1">
              <Skeleton className="h-5 w-[55%] rounded sm:h-7 sm:w-[45%]" />
              <Skeleton className="mt-2 h-4 w-full rounded sm:mt-2.5 sm:max-w-[600px]" />
              <Skeleton className="mt-1.5 h-4 w-[75%] rounded sm:max-w-[600px]" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
