import Image from "next/image";
import Link from "next/link";

/**
 * The one and only Tablor's logo. Renders the client-supplied artwork
 * untouched: no recolor, no filters, no text substitute. Size variants
 * change width only; height follows the asset's own aspect ratio.
 */

// Set these to the real pixel dimensions of public/brand/tablor-logo.svg
// (used only to reserve layout space; rendering keeps the true ratio).
const INTRINSIC = { width: 600, height: 200 };

const WIDTHS = {
  sm: 96,
  md: 128,
  lg: 176,
  hero: 280,
} as const;

export type TablorLogoSize = keyof typeof WIDTHS;

export function TablorLogo({
  size = "md",
  href,
  priority = false,
  plate = false,
  className = "",
}: {
  size?: TablorLogoSize;
  href?: string;
  priority?: boolean;
  /**
   * Only for a logo file that has an opaque white background. Seats the
   * unmodified artwork on an off-white plate so it reads cleanly on dark
   * surfaces. Remove once a transparent official asset is in place.
   */
  plate?: boolean;
  className?: string;
}) {
  const img = (
    <Image
      src="/brand/tablor-logo.png"
      alt="Tablor's — Smart Table Ordering System"
      width={INTRINSIC.width}
      height={INTRINSIC.height}
      priority={priority}
      style={{ width: WIDTHS[size], height: "auto" }}
    />
  );

  const body = plate ? (
    <span className="inline-block rounded-lg bg-[#f2f3ec] p-2">{img}</span>
  ) : (
    img
  );

  return href ? (
    <Link
      href={href}
      aria-label="Tablor's home"
      className={`inline-block leading-none ${className}`}
    >
      {body}
    </Link>
  ) : (
    <span className={`inline-block leading-none ${className}`}>{body}</span>
  );
}