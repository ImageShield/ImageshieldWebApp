/**
 * Nav links that go to the old site rather than to pages here: Download and How It
 * Works because their sections here are on the parked landing page, which `/` no
 * longer reaches, and the rest because nothing here has them. Both navs read
 * these, so they can't drift apart.
 *
 * Download is also where `/get-app` sends anything that isn't a phone, since it is
 * the one place left that carries both store badges.
 */
export const DOWNLOAD_URL = "https://imageshield.com/#download";
const FAQ_URL = "https://imageshield.com/faq";
const HOW_IT_WORKS_URL = "https://imageshield.com/#how-it-works";
const PRICING_URL = "https://imageshield.com/pricing";
const PRIVACY_URL = "https://imageshield.com/#privacy";
const PATENTS_URL = "https://imageshield.com/patent-notice";

/** Marketing nav, in the order the V1 design lists it. */
export const SITE_NAV: ReadonlyArray<{
  label: string;
  href: string;
  /** The first two links are set in plain white; the rest in the dimmer nav ink. */
  bright?: boolean;
  /**
   * Raised after the label.
   *
   * The LHS Results V1 export draws this link as "Likeness Health Score™", and only
   * the label is taken from it: the mark stays ℠ across the site, because what is
   * being marked is a service ImageShield performs rather than a product it sells.
   * The type keeps both so a genuine ™ elsewhere doesn't need a second flag.
   */
  mark?: "SM" | "TM";
}> = [
  /* Not the bare `#download`: that anchor lives on the parked landing page, and this
     bar is only drawn on pages that don't have it, so the link went nowhere. */
  { label: "Download", href: DOWNLOAD_URL, bright: true },
  {
    /* Still points at the quiz intro, which is the only route to a score — the
       label names the destination's payoff rather than its first screen. */
    label: "Likeness Health Score",
    href: "/quiz",
    bright: true,
    mark: "SM",
  },
  { label: "FAQ", href: FAQ_URL },
  { label: "How It Works", href: HOW_IT_WORKS_URL },
  { label: "Pricing", href: PRICING_URL },
  { label: "Privacy", href: PRIVACY_URL },
  { label: "Patents", href: PATENTS_URL },
];

/**
 * The same nav as Concept 1 draws it over the landing hero.
 *
 * Kept apart from `SITE_NAV` rather than derived from it: the two links this bar
 * drops — Download and the quiz — are not missing, they have been promoted to the
 * pair of pills the bar ends with, so a derived list would have to subtract them
 * again. Every label here is set in one ink, so there is no emphasis flag and no
 * service mark to carry. The funnel screens are still on the V1 bar and still need
 * all seven, so the two lists genuinely differ.
 */
export const HERO_NAV: ReadonlyArray<{ label: string; href: string }> = [
  { label: "FAQ", href: FAQ_URL },
  { label: "How It Works", href: HOW_IT_WORKS_URL },
  { label: "Pricing", href: PRICING_URL },
  { label: "Privacy", href: PRIVACY_URL },
  { label: "Patents", href: PATENTS_URL },
];

/** Social accounts, in the order the download section's row shows them. */
export const SOCIAL_LINKS = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/people/ImageShield/100064076020962/",
  },
  { label: "X", href: "https://x.com/image_shield" },
  { label: "Instagram", href: "https://www.instagram.com/image_shield/" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/imageshield-protection/",
  },
  { label: "YouTube", href: "https://www.youtube.com/@UseImageShield" },
] as const;

/** The live store listings the design's download badges point at. */
export const STORE_LINKS = {
  appStore:
    "https://apps.apple.com/us/app/imageshield-ai-image-security/id6746722108",
  googlePlay:
    "https://play.google.com/store/apps/details?id=com.imageshieldmobile",
} as const;
