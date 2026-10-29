import { ShimmerImage } from "@/components/ShimmerImage";

const STEPS = [
  {
    number: "01",
    title: "Upload Your Photos",
    body: "Securely upload photos of yourself and your family that you've shared on social media. Your images are encrypted and completely private.",
    shot: "/media/step-upload.jpg",
    alt: "The app's upload screen, with a grid of family photos selected for monitoring.",
  },
  {
    number: "02",
    title: "We Monitor Continuously",
    body: "Our advanced technology scans the internet 24/7, searching websites, social media platforms, and other online spaces for the use of your likeness.",
    shot: "/media/step-monitor.jpg",
    alt: "The app's monitoring screen, showing four household members under watch.",
  },
  {
    number: "03",
    title: "Get Alerts & Take Action",
    body: "Receive detailed reports when your likeness is found. Use our built-in tools to report abuse on 20+ popular platforms including Facebook, Instagram, and TikTok.",
    shot: "/media/step-alerts.jpg",
    alt: "The app's report screen, listing the sites where a registered face was found.",
  },
] as const;

/**
 * The three steps, each under a screen from the app it is describing.
 *
 * Off the 1440 frame: three 190×318 phone frames on 357px centres - a 1072-wide
 * column centred on the page - outlined 4px in `navbar` at 30%, with the step
 * number set 48px in the same purple at 20% under each.
 *
 * The rule between two frames is drawn from inside the left-hand phone: it starts
 * 127px in from that frame's left edge, on its vertical centre, and fades out to
 * nothing 15px inside the next one. So it belongs to the phone it leaves, not to
 * the gap - which is also what makes the paint order right without any z-index:
 * each rule sits over its own screenshot and under the next phone, because that is
 * the order the three list items are already in.
 *
 * The screenshots are 552×980 against a 184×312 opening, so they are set to cover
 * and left centred. Centred is the export's own answer, not a default fallen back
 * on: each pattern scales its shot to fill the width and then translates it up by
 * 7.3, 8.4 and 8.2px against overflows of 14.6, 16.7 and 16.5 - 50.0% in all three
 * cases. Pinning them to the top instead shows 8px more of each status bar and
 * eats 8px more of each tab bar.
 *
 * Under `lg` the three stack and the rules go, since a rule that fades to the right
 * says nothing about a step that is now underneath.
 */
export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-canvas-mist px-6 pt-16 pb-20 lg:pt-[95px] lg:pb-[95px]"
    >
      <h2 className="text-center text-[2rem] leading-none font-bold text-navbar lg:text-5xl">
        How It Works
      </h2>
      <p className="mt-3 text-center text-lg text-ink-muted lg:mt-[16px] lg:text-xl">
        Three simple steps to protect your likeness online
      </p>

      <ol className="mx-auto mt-14 grid max-w-[1072px] grid-cols-1 justify-items-center gap-14 lg:mt-[65px] lg:grid-cols-3 lg:gap-0">
        {STEPS.map((step, i) => (
          <li key={step.number} className="flex flex-col items-center">
            <div className="relative">
              {/* The frame is already the right size and outline, so the
                  placeholder fills it rather than replacing it - three empty
                  phone outlines on a slow line still read as three phones.
                  `relative` on the outer box is what the frame inside it
                  measures against. */}
              <div className="relative h-[320px] w-[192px] overflow-hidden rounded-2xl border-4 border-navbar/30">
                <ShimmerImage
                  src={step.shot}
                  alt={step.alt}
                  width={552}
                  height={980}
                  frameClassName="h-full w-full"
                  className="h-full w-full object-cover"
                />
              </div>

              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-[160px] left-[127px] hidden h-0.5 w-[247px] bg-linear-to-r from-navbar/50 to-transparent lg:block"
                />
              ) : null}
            </div>

            <p
              aria-hidden
              className="mt-[23px] text-5xl leading-none font-bold text-navbar/20"
            >
              {step.number}
            </p>

            <h3 className="mt-[17px] max-w-[280px] text-center text-2xl leading-8 font-semibold text-navbar">
              {step.title}
            </h3>

            <p className="mt-[13px] max-w-[280px] text-center text-base leading-6 text-ink-muted">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
