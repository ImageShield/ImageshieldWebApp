/**
 * The FAQ's "Install the App" block — the one page that still carries both badges
 * with the landing page parked. The nav's Download link and `/get-app`'s desktop
 * fallback both land here, so the id and the path share one constant rather than
 * drifting apart. Declared above `SITE_NAV`, which reads it while the module loads.
 */
export const FAQ_INSTALL_ID = "install";
export const FAQ_INSTALL_PATH = `/faq#${FAQ_INSTALL_ID}`;

/**
 * Marketing nav, in the order the V1 design lists it.
 *
 * Only Download, `/quiz` and `/faq` resolve today — the rest are placeholders
 * pointing at the anchors those sections will claim, so wiring them up later is a
 * matter of rendering the section with the matching `id`.
 */
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
  /* Not `#download`: that anchor lives on the parked landing page, and this bar is
     only drawn on pages that don't have it, so the link went nowhere. */
  { label: "Download", href: FAQ_INSTALL_PATH, bright: true },
  {
    /* Still points at the quiz intro, which is the only route to a score — the
       label names the destination's payoff rather than its first screen. */
    label: "Likeness Health Score",
    href: "/quiz",
    bright: true,
    mark: "SM",
  },
  { label: "FAQ", href: "/faq" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Privacy", href: "#privacy" },
  { label: "Patents", href: "#patents" },
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
  { label: "FAQ", href: "/faq" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Privacy", href: "#privacy" },
  { label: "Patents", href: "#patents" },
];

/** Social accounts, in the order the footer row shows them. */
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

/**
 * The old site's footer links. These four pages have not been rebuilt here yet, so
 * they point back at imageshield.com rather than at routes that would 404 — swap
 * each href for a local path as its page lands.
 */
export const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "https://imageshield.com/privacy-policy" },
  {
    label: "Terms of Service",
    href: "https://imageshield.com/terms-and-conditions",
  },
  { label: "Patent Notice", href: "https://imageshield.com/patent-notice" },
  {
    label: "Biometric Consent Agreement",
    href: "https://imageshield.com/biometric-consent-agreement",
  },
  { label: "Contact Us", href: "mailto:support@imageshield.com" },
] as const;

/** Where existing subscribers on the pre-app product still sign in. */
export const LEGACY_PLATFORM_URL = "https://app.imageshield.com/guest/login";

/**
 * TrustArc's certification seal, under the registration id the old site uses. The
 * image is served from TrustArc and has to stay on their host — the seal is only
 * valid while it resolves against their validation page.
 */
export const TRUSTE_SEAL = {
  validation:
    "https://privacy.truste.com/privacy-seal/validation?rid=87419b93-285d-4d77-946b-bcd0ae23b547",
  image:
    "https://privacy-policy.truste.com/privacy-seal/seal?rid=87419b93-285d-4d77-946b-bcd0ae23b547",
} as const;
