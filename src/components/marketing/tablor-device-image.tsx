import Image from "next/image";

/*
 * Single source of truth for the Tablor's countertop ordering terminal photo.
 * width/height are the real pixel size of public/images/tablor-ordering-device.webp
 * (the cropped file). If you swap in a higher-resolution original, update them.
 */
export const DEVICE_IMAGE = {
  src: "/images/tablor-ordering-device.webp",
  width: 787,
  height: 399,
  alt: "Tablor's countertop ordering terminal with a numeric keypad, dedicated order buttons, a built-in LCD order display and a telephone-style handset",
} as const;

export const DEVICE_ASPECT = DEVICE_IMAGE.width / DEVICE_IMAGE.height;

export function TablorDeviceImage({
  className = "",
  sizes,
  priority = false,
}: {
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={DEVICE_IMAGE.src}
      width={DEVICE_IMAGE.width}
      height={DEVICE_IMAGE.height}
      alt={DEVICE_IMAGE.alt}
      sizes={sizes}
      priority={priority}
      className={`block h-auto w-full ${className}`}
    />
  );
}