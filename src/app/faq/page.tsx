import type { Metadata } from "next";
import { FaqSections } from "@/components/faq/FaqSections";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ShimmerImage } from "@/components/ShimmerImage";
import { FAQ_BREADCRUMB_JSON_LD, FAQ_JSON_LD, SITE_URL } from "@/lib/faq";
import { FAQ_INSTALL_ID, STORE_LINKS } from "@/lib/site-nav";

export const metadata: Metadata = {
  title: "ImageShield FAQ — Likeness Monitoring Questions",
  description:
    "Answers to common questions about ImageShield: how likeness monitoring works, which photos to upload, privacy protections, pricing and abuse reporting.",
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: "ImageShield FAQ — Likeness Monitoring Questions",
    description:
      "Answers to common questions about ImageShield: how likeness monitoring works, which photos to upload, privacy protections, pricing and abuse reporting.",
    url: `${SITE_URL}/faq`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ImageShield FAQ — Likeness Monitoring Questions",
    description:
      "Answers to common questions about ImageShield: how likeness monitoring works, which photos to upload, privacy protections, pricing and abuse reporting.",
  },
};

/**
 * /faq — a copy of imageshield.com/faq.
 *
 * There is no V3 design for this page, so it is reproduced from the old site
 * rather than invented: the same copy, the same four sections, the same 56rem
 * column, and the same light ground and violet ink, which the `*-legacy` tokens
 * carry. The two things it takes from the new site instead are the chrome —
 * `SiteHeader`, so the nav matches every other page here — and the store links,
 * which point at the current listings.
 *
 * The old page's nav is a fixed 64px bar and it clears it with `pt-24`, i.e. 32px
 * of air under the bar. `SiteHeader` is 65px and sits absolute, so the column
 * pays for the bar itself and then adds the same 32.
 */
export default function FaqPage() {
  return (
    <div className="relative min-h-[100dvh] bg-canvas-tint font-site text-ink-legacy">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FAQ_JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FAQ_BREADCRUMB_JSON_LD).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />

      <SiteHeader />

      <main className="pt-[65px] pb-16">
        <div className="mx-auto w-full max-w-4xl px-4 pt-8">
          <h1 className="mb-4 text-center text-4xl font-bold md:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mb-12 text-center text-ink-muted">
            Find answers to common questions about ImageShield
          </p>

          <FaqSections />

          <div id={FAQ_INSTALL_ID} className="mt-20 text-center">
            <h2 className="mb-6 text-2xl font-bold">Install the App</h2>
            {/* Sized in em off the surrounding 16px, the way the old page did.
                It pins the HEIGHT, not the width: the two artworks are 3.10:1
                against 3.33:1, so equal widths leave the App Store badge the
                taller of the pair. 3em is the height 10em of Google Play was
                already giving it, so only the App Store badge moves. */}
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href={STORE_LINKS.appStore}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-105"
              >
                {/* Pinned by HEIGHT here, unlike every other badge on the
                    site — so the frame is too, and its width is left to the
                    plate's own ratio. */}
                <ShimmerImage
                  src="/media/badge-app-store.png"
                  alt="Download on the App Store"
                  width={1692}
                  height={546}
                  frameClassName="h-[3em] rounded-[7px]"
                  className="h-full w-auto"
                />
              </a>
              <a
                href={STORE_LINKS.googlePlay}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-105"
              >
                <ShimmerImage
                  src="/media/badge-google-play.png"
                  alt="Get it on Google Play"
                  width={640}
                  height={192}
                  frameClassName="h-[3em] rounded-[7px]"
                  className="h-full w-auto"
                />
              </a>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
