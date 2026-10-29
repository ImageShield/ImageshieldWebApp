/**
 * Icons for the landing page, traced from the V1 design export rather than pulled
 * from an icon package - the star in particular is a custom shape that fills its
 * 20px box edge to edge, which no stock star does.
 *
 * All of them inherit `currentColor` / sizing from the caller.
 */

type IconProps = { className?: string };

/** Solid five-point star, 20×20 box, drawn flush to the edges. */
export function Star({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
      <path d="M10 15L4.122 18.09L5.245 11.55L0.489 6.91L7.061 5.96L10 0L12.939 5.96L19.511 6.91L14.755 11.55L15.878 18.09L10 15Z" />
    </svg>
  );
}

/** Outline shield - the trust markers under the store badges. */
export function Shield({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}

/** Shared frame for the social row - 24px outline icons, 2px stroke. */
function SocialIcon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function Facebook({ className }: IconProps) {
  return (
    <SocialIcon className={className}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2Z" />
    </SocialIcon>
  );
}

export function Twitter({ className }: IconProps) {
  return (
    <SocialIcon className={className}>
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2Z" />
    </SocialIcon>
  );
}

export function Instagram({ className }: IconProps) {
  return (
    <SocialIcon className={className}>
      <path d="M17 2H7a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5Z" />
      <path d="M16 11.37a4 4 0 1 1-7.914 1.174A4 4 0 0 1 16 11.37Z" />
      <path d="M17.5 6.5h.01" />
    </SocialIcon>
  );
}

export function LinkedIn({ className }: IconProps) {
  return (
    <SocialIcon className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
      <path d="M6 9H2v12h4V9Z" />
      <path d="M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </SocialIcon>
  );
}

export function YouTube({ className }: IconProps) {
  return (
    <SocialIcon className={className}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17Z" />
      <path d="m10 15 5-3-5-3v6Z" />
    </SocialIcon>
  );
}

/** Hamburger / close for the mobile nav - no equivalent in the desktop design. */
export function Menu({ className }: IconProps) {
  return (
    <SocialIcon className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </SocialIcon>
  );
}

export function Close({ className }: IconProps) {
  return (
    <SocialIcon className={className}>
      <path d="M6 6 18 18M18 6 6 18" />
    </SocialIcon>
  );
}

/** Back control on the quiz screens. */
export function ChevronLeft({ className }: IconProps) {
  return (
    <SocialIcon className={className}>
      <path d="m15 18-6-6 6-6" />
    </SocialIcon>
  );
}

/** The country picker's own affordance, drawn because its <select> is transparent. */
export function ChevronDown({ className }: IconProps) {
  return (
    <SocialIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </SocialIcon>
  );
}

/**
 * Tick for the multi-select checkbox - the export's own geometry, so the box is
 * drawn at its native 20px rather than scaled from a 24 grid. The 1.75 stroke is
 * heavier than `SocialIcon`'s 2px reads at this size, where 2px is a hairline.
 */
export function Check({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M14.664 6.498 8.248 12.914 5.331 9.998" />
    </svg>
  );
}
