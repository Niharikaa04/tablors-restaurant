
"use client";

import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import Image from "next/image";

const FRONT = "/images/tablor-ordering-device-front.webp";
const BACK = "/images/tablor-ordering-device-back.webp";

export function DevicePhotoFlip({
  className = "",
}: {
  className?: string;
}) {
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ x: number; angle: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    drag.current = { x: e.clientX, angle };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;

    const dx = e.clientX - drag.current.x;
    setAngle(drag.current.angle + dx * 0.8);
  }

  function onPointerUp() {
    drag.current = null;
  }


  return (
    <div
      role="img"
      aria-label="Tablor TBL-01 device. Drag horizontally to rotate the view."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative w-full cursor-grab select-none active:cursor-grabbing ${className}`}
      style={{ perspective: "1200px", touchAction: "pan-y" }}
    >
      <div
        className="relative w-full"
        style={{
          transform: `rotateY(${angle}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <Image
          src={FRONT}
          alt=""
          width={1648}
          height={928}
          priority
          draggable={false}
          className="block h-auto w-full"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        />

        <Image
          src={BACK}
          alt=""
          width={1648}
          height={928}
          draggable={false}
          className="absolute inset-0 block h-auto w-full"
          style={{
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        />
      </div>
    </div>
  );
}
