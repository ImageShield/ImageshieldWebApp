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
/** Where the logo goes: `/` here is the quiz intro, not the brand's home page. */
export const HOME_URL = "https://imageshield.com/";
const FAQ_URL = "https://imageshield.com/faq";
const HOW_IT_WORKS_URL = "https://imageshield.com/#how-it-works";
const PRICING_URL = "https://imageshield.com/pricing";
const PRIVACY_URL = "https://imageshield.com/#privacy";
const PATENTS_URL = "https://imageshield.com/patent-notice";

/** Marketing nav, in the order the V1 design lists it. */
export const SITE_NAV: ReadonlyArray<{
  label: string;
  href: string;
  /** Download is set in plain white; the rest in the dimmer nav ink. */
  bright?: boolean;
}> = [
  /* Not the bare `#download`: that anchor lives on the parked landing page, and this
     bar is only drawn on pages that don't have it, so the link went nowhere. */
  { label: "Download", href: DOWNLOAD_URL, bright: true },
  /* No Likeness Health Score link: every page this bar is drawn on is already in
     the quiz funnel, so it only sent people back to its start. */
  { label: "FAQ", href: FAQ_URL },
  { label: "How It Works", href: HOW_IT_WORKS_URL },
  { label: "Pricing", href: PRICING_URL },
  { label: "Privacy", href: PRIVACY_URL },
  { label: "Patents", href: PATENTS_URL },
];

/**
 * The same nav as Concept 1 draws it over the landing hero.
 *
 * Kept apart from `SITE_NAV` rather than derived from it: Download is not missing
 * here, it has been promoted to one of the pair of pills the bar ends with, next to
 * the quiz. Every label here is set in one ink, so there is no emphasis flag to
 * carry.
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
