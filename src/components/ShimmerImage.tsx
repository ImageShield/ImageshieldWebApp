"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/**
 * A `next/image` with a shimmering block behind it until the file has decoded.
 *
 * The site is photograph-heavy - the hero plate alone is 1.1MB, and the three
 * How It Works screenshots and the app mockup are a further half a megabyte -
 * and `next/image` reserves the box but paints nothing in it. On a fast
 * connection that is invisible; on a slow one the page arrives as its type with
 * rectangular holes where its pictures go, which reads as a broken page rather
 * than a loading one.
 *
 * BEHIND, not over, and that is the whole design of this component.
 *
 * The obvious way to write it is to hold the image at `opacity-0` and fade it
 * in when `onLoad` fires. Don't: that makes every picture on the site depend on
 * React hydrating. A bundle that fails to load, a browser that blocks it, a
 * device that is still parsing it - any of those and the hero is a permanently
 * invisible element with a placeholder sitting on top of it. It is the page's
 * LCP image; it cannot be the thing that JavaScript is allowed to lose.
 *
 * So the placeholder is laid under the picture and the picture is left alone.
 * An image element paints nothing until it has pixels, so the shimmer shows
 * through on its own, and the moment the picture decodes it covers it - no
 * state, no hydration, no fade to mistime. `onLoad` then unmounts the
 * placeholder, which is only about stopping an animation nobody can see; if it
 * never fires, the page still looks exactly right.
 *
 * That ordering is load-bearing in the markup below. Both elements are
 * positioned with an automatic z-index, so which one is on top is decided by
 * which comes second - the placeholder is rendered FIRST in both branches.
 *
 * `onLoad` fires for a cached image too, so returning to a page does not leave
 * a placeholder animating behind a picture the browser already had:
 * `next/image` checks `img.complete` in a layout effect and calls the handler
 * itself.
 */
export function ShimmerImage({
  frameClassName = "",
  className = "",
  night = false,
  /* Pulled out of the spread purely so `jsx-a11y/alt-text` can see it on the
     element below. It is required by `ImageProps` either way - the rule reads
     the JSX, not the types, and a spread tells it nothing. */
  alt,
  ...image
}: ImageProps & {
  /**
   * The box the placeholder fills, which is the box the picture will occupy.
   *
   * Sizing belongs here rather than on `className` for the non-`fill` case:
   * the frame is what the placeholder is measured against, so an image sized
   * only by its own class would leave a placeholder of the wrong shape.
   */
  frameClassName?: string;
  /** The black-canvas ground, for the landing page's hero. */
  night?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  const placeholder = loaded ? null : (
    <span
      aria-hidden
      className={`absolute inset-0 ${night ? "skeleton-night" : "skeleton"}`}
    />
  );

  /*
   * A `fill` image is absolutely positioned against a box the CALLER owns and
   * has already made `relative`, so there is nothing to wrap: the placeholder
   * is laid in that same box. Wrapping one would break it - the wrapper would
   * become the containing block and collapse to nothing, taking the picture
   * with it.
   */
  if (image.fill) {
    return (
      <>
        {placeholder}
        <Image
          {...image}
          alt={alt}
          onLoad={() => setLoaded(true)}
          className={className}
        />
      </>
    );
  }

  /*
   * `inline-block`, not `block`. A block frame with no width of its own runs to
   * the full width of whatever contains it, and the placeholder inside it would
   * then be a band across the page rather than a stand-in for a 167px badge.
   * `align-top` kills the descender gap inline-block otherwise leaves under it.
   */
  return (
    <span
      className={`relative inline-block overflow-hidden align-top ${frameClassName}`}
    >
      {placeholder}
      {/* `relative` for the paint order and nothing else: an in-flow image
          would sit UNDER the absolutely positioned placeholder however the two
          are ordered, and the whole arrangement depends on it being over. */}
      <Image
        {...image}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`relative ${className}`}
      />
    </span>
  );
}
