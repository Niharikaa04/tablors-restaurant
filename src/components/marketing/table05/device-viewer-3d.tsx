"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lazy shell for the TABLE 05 3D viewer.
 *
 * - Three.js is only downloaded when the viewer is near the viewport.
 * - Until the model is ready (and if WebGL is missing or loading fails) the
 *   real front photograph is shown instead, so the page never has a hole.
 */
const Canvas = dynamic(() => import("./device-viewer-canvas"), { ssr: false });

const FRONT_SRC = "/images/device-views/front.webp";
const FRONT_W = 1600;
const FRONT_H = 637;

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// `aspect` is kept for compatibility with existing callers; this viewer sizes itself (see canvas).
export function DeviceViewer3D({ className = "" }: { className?: string; aspect?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (en) => {
        if (en.some((e) => e.isIntersecting)) {
          // Decide only once the viewer is about to be seen (not in the effect body).
          setState((s) => (s === "idle" ? (webglAvailable() ? "loading" : "fallback") : s));
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onReady = useCallback(() => setState("ready"), []);
  const onError = useCallback(() => setState("fallback"), []);

  return (
    <div ref={rootRef} className={`relative w-full min-h-[24rem] sm:min-h-[32rem] lg:min-h-[40rem] ${className}`} >
      {(state === "loading" || state === "ready") && (
        <div className="relative h-full w-full"><Canvas onReady={onReady} onError={onError} /></div>
      )}
      {state !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FRONT_SRC}
            width={FRONT_W}
            height={FRONT_H}
            alt="Tablor TABLE 05 ordering terminal, front view"
            className="h-auto w-[92%] object-contain"
            draggable={false}
          />
        </div>
      )}
      <p className="sr-only" role="status">
        {state === "loading" ? "Loading 3D viewer" : state === "fallback" ? "3D viewer unavailable, showing a photograph instead" : ""}
      </p>
    </div>
  );
}
