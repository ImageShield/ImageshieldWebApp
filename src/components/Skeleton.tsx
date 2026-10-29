/**
 * A block standing in for something that hasn't arrived yet.
 *
 * Everything it is - the ground, the travelling sheen, and the way it behaves
 * under `prefers-reduced-motion` - lives in the `.skeleton` rules in
 * `globals.css`. This is only the element, so a screen can reserve space in
 * Tailwind rather than reaching for the class name by hand and getting the
 * light/dark pair wrong on the one page with a black canvas.
 *
 * A `<span>` set to `block` rather than a `<div>`: several of these stand in
 * for lines of copy inside a `<p>`, and a `<div>` there is invalid markup the
 * browser silently reparents - which moves the placeholder out of the block it
 * is meant to be measuring.
 *
 * `aria-hidden` throughout. A skeleton is the absence of content, and the
 * screen that owns it is what says so: every one of them sits inside a region
 * marked `aria-busy`, so a reader hears "loading" once rather than a dozen
 * empty group boundaries.
 *
 * No `role="presentation"` and no width of its own - the caller sizes it,
 * because the whole point is reserving the box the real thing will occupy.
 */
export function Skeleton({
  className = "",
  night = false,
}: {
  className?: string;
  /** The black-canvas ground, for the landing page's hero. */
  night?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`block ${night ? "skeleton-night" : "skeleton"} ${className}`}
    />
  );
}
