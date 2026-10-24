import Image from "next/image";

/*
 * Single source of truth for the Tablor's countertop ordering terminal photo.
 * width/height are the real pixel size of public/images/device-views/front.webp
 * (the supplied front view). If you swap in a different original, update them.
 */
export const DEVICE_IMAGE = {
  src: "/images/device-views/front.webp",
  width: 1600,
  height: 637,
  alt: "Tablor TABLE 05 countertop ordering terminal, front view: silver panel with a numeric keypad, order buttons and a built-in LCD order display",
} as const;

export const DEVICE_ASPECT = DEVICE_IMAGE.width / DEVICE_IMAGE.height;

export function TablorDeviceImage({
  className = "",
  sizes,
  priority = false,
  alt = DEVICE_IMAGE.alt,
}: {
  className?: string;
  sizes: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <Image
      src={DEVICE_IMAGE.src}
      width={DEVICE_IMAGE.width}
      height={DEVICE_IMAGE.height}
      alt={alt}
      sizes={sizes}
      priority={priority}
      className={`block h-auto w-full ${className}`}
    />
  );
}