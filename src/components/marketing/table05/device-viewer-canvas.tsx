
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { buildTable05Model } from "./table05-model";
import { FOV_DEG, TARGET, fitDistance } from "./viewer-framing";

/** zoom 1 = the whole device fills the frame (see viewer-framing.ts). */
const FRONT_3Q = { yaw: 0, pitch: 24, zoom: 1 };
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.6;
const AUTO_DEG_PER_S = 18;
/** Start rotating on load. Dragging pauses it; it resumes after RESUME_MS. */
const AUTO_START = true;
const RESUME_MS = 2500;

type ViewKey = "front" | "back" | "right" | "left" | "top" | "bottom";

const VIEW_PRESETS: Record<ViewKey, { yaw: number; pitch: number; label: string }> = {
  // x = long axis (right end +x), z = depth (front panel +z).
  // Camera sits at (sin(yaw), cos(yaw)) in the x/z plane.
  front: { yaw: 0, pitch: 10, label: "Front" },
  back: { yaw: 180, pitch: 8, label: "Back" },
  right: { yaw: 90, pitch: 6, label: "Right" },
  left: { yaw: -90, pitch: 6, label: "Left" },
  top: { yaw: 0, pitch: 88, label: "Top" },
  bottom: { yaw: 0, pitch: -88, label: "Bottom" },
};

const VIEW_ORDER: ViewKey[] = ["front", "back", "right", "left", "top", "bottom"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const shortest = (from: number, to: number) =>
  from + ((((to - from) % 360) + 540) % 360) - 180;

/** Render above 1x even on standard screens so edges and text stay crisp. */
const pixelRatio = () => clamp(window.devicePixelRatio || 1, 1.5, 2.5);

export interface ViewerHooks {
  onReady: () => void;
  onError: (message: string) => void;
}

export default function DeviceViewerCanvas({ onReady, onError }: ViewerHooks) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [announce, setAnnounce] = useState("");

  const api = useRef<{
    goTo: (yaw: number, pitch: number, zoom?: number) => void;
    zoom: (factor: number) => void;
    reset: () => void;
    setAuto: (on: boolean) => void;
  } | null>(null);

  const autoRef = useRef(AUTO_START);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced-motion users do not get automatic rotation on load, but the
    // Spin button still works because they asked for it explicitly.
    if (reduce) autoRef.current = false;

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      onError("WebGL is not available");
      return;
    }

    renderer.setPixelRatio(pixelRatio());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // No filmic tone mapping: it desaturates and dims the product photographs.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);

    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.45;

    // World lights: depth cues and the purple edge accent.
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2.5, 4, 3.5);

    const rim = new THREE.DirectionalLight(0x8f7bff, 0.9);
    rim.position.set(-3.5, 2, -3);

    scene.add(key, rim, new THREE.HemisphereLight(0xe6ebff, 0x2a2540, 0.55));

    // Camera-mounted lights: every view (front, back, ends, top, underside)
    // is lit the same way, so no face is ever left dark and muddy.
    const headLight = new THREE.DirectionalLight(0xffffff, 1.5);
    headLight.position.set(1.2, 1.6, 2);
    headLight.target.position.set(0, 0, -1);
    const fillLight = new THREE.DirectionalLight(0xdfe6ff, 0.6);
    fillLight.position.set(-1.8, -0.6, 1.5);
    fillLight.target.position.set(0, 0, -1);

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;

    const ctx = shadowCanvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, "rgba(0,0,0,0.75)");
    gradient.addColorStop(0.55, "rgba(0,0,0,0.35)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    shadowTex.colorSpace = THREE.SRGBColorSpace;

    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });

    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);

    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(3.6, 2.1, 1);
    shadow.position.y = -0.003;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.05, 60);
    camera.add(headLight, headLight.target, fillLight, fillLight.target);
    scene.add(camera);

    const target = new THREE.Vector3(...TARGET);

    const cur = { ...FRONT_3Q };
    const goal = { ...FRONT_3Q };

    let dirty = true;
    let lastInteract = -Infinity;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let model: Awaited<ReturnType<typeof buildTable05Model>> | null = null;

    const place = () => {
      const yaw = THREE.MathUtils.degToRad(cur.yaw);
      const pitch = THREE.MathUtils.degToRad(cur.pitch);
      // Distance that keeps the whole device in frame for this angle and aspect.
      const dist = fitDistance(cur.yaw, cur.pitch, camera.aspect) * cur.zoom;

      camera.position.set(
        target.x + dist * Math.sin(yaw) * Math.cos(pitch),
        target.y + dist * Math.sin(pitch),
        target.z + dist * Math.cos(yaw) * Math.cos(pitch),
      );

      camera.up.set(0, 1, 0);
      camera.lookAt(target);
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;

      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const describe = () => {
      const yaw = ((cur.yaw % 360) + 360) % 360;
      return `Rotation ${Math.round(yaw)} degrees, tilt ${Math.round(cur.pitch)} degrees`;
    };

    api.current = {
      goTo: (yaw, pitch, zoom) => {
        goal.yaw = shortest(cur.yaw, yaw);
        goal.pitch = clamp(pitch, -89, 89);

        if (zoom !== undefined) {
          goal.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
        }

        lastInteract = performance.now();

        if (reduce) {
          cur.yaw = goal.yaw;
          cur.pitch = goal.pitch;
          cur.zoom = goal.zoom;
        }

        dirty = true;
      },

      zoom: (factor) => {
        goal.zoom = clamp(goal.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        lastInteract = performance.now();

        if (reduce) cur.zoom = goal.zoom;

        dirty = true;
        setAnnounce(describe());
      },

      reset: () => {
        goal.yaw = shortest(cur.yaw, FRONT_3Q.yaw);
        goal.pitch = FRONT_3Q.pitch;
        goal.zoom = FRONT_3Q.zoom;

        lastInteract = performance.now();

        if (reduce) {
          Object.assign(cur, {
            yaw: goal.yaw,
            pitch: goal.pitch,
            zoom: goal.zoom,
          });
        }

        dirty = true;
        setAnnounce("View reset to front");
      },

      setAuto: (on) => {
        autoRef.current = on;
        if (on) lastInteract = -Infinity;
      },
    };

    const pointers = new Map<number, { x: number; y: number; type: string }>();

    let pinchStart = 0;
    let pinchZoom0 = 0;

    const onDown = (e: PointerEvent) => {
      host.setPointerCapture(e.pointerId);

      pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        type: e.pointerType,
      });

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        pinchZoom0 = goal.zoom;
      }

      lastInteract = performance.now();
    };

    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;

      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;

      p.x = e.clientX;
      p.y = e.clientY;
      lastInteract = performance.now();

      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);

        if (pinchStart > 0 && d > 0) {
          goal.zoom = clamp(pinchZoom0 * (pinchStart / d), MIN_ZOOM, MAX_ZOOM);
          cur.zoom = goal.zoom;
        }
      } else {
        goal.yaw -= dx * 0.45;
        cur.yaw = goal.yaw;

        if (p.type !== "touch") {
          goal.pitch = clamp(goal.pitch + dy * 0.35, -89, 89);
          cur.pitch = goal.pitch;
        }
      }

      dirty = true;
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);

      if (host.hasPointerCapture(e.pointerId)) {
        host.releasePointerCapture(e.pointerId);
      }

      pinchStart = 0;
      lastInteract = performance.now();
      setAnnounce(describe());
    };

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      e.preventDefault();
      goal.zoom = clamp(goal.zoom * Math.exp(e.deltaY * 0.0025), MIN_ZOOM, MAX_ZOOM);

      cur.zoom = goal.zoom;
      lastInteract = performance.now();
      dirty = true;
    };

    const onKey = (e: KeyboardEvent) => {
      let used = true;

      switch (e.key) {
        case "ArrowLeft":
          api.current?.goTo(goal.yaw - 15, goal.pitch);
          break;
        case "ArrowRight":
          api.current?.goTo(goal.yaw + 15, goal.pitch);
          break;
        case "ArrowUp":
          api.current?.goTo(goal.yaw, goal.pitch + 10);
          break;
        case "ArrowDown":
          api.current?.goTo(goal.yaw, goal.pitch - 10);
          break;
        case "+":
        case "=":
          api.current?.zoom(0.85);
          break;
        case "-":
        case "_":
          api.current?.zoom(1 / 0.85);
          break;
        case "0":
        case "Home":
          api.current?.reset();
          break;
        case " ":
          api.current?.setAuto(!autoRef.current);
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6": {
          // 1-6 jump to Front, Back, Right, Left, Top, Bottom.
          const v = VIEW_PRESETS[VIEW_ORDER[Number(e.key) - 1]];
          api.current?.setAuto(false);
          api.current?.goTo(v.yaw, v.pitch, 1);
          setAnnounce(`${v.label} view`);
          break;
        }
        default:
          used = false;
      }

      if (used) {
        e.preventDefault();
        setAnnounce(describe());
      }
    };

    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    host.addEventListener("wheel", onWheel, { passive: false });
    host.addEventListener("keydown", onKey);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) dirty = true;
    });

    io.observe(host);

    const onVis = () => {
      if (document.visibilityState === "visible") dirty = true;
    };

    document.addEventListener("visibilitychange", onVis);

    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (!visible || document.visibilityState !== "visible" || !model) {
        return;
      }

      if (
        autoRef.current &&
        pointers.size === 0 &&
        now - lastInteract > RESUME_MS
      ) {
        goal.yaw += AUTO_DEG_PER_S * dt;
        cur.yaw = goal.yaw;
        dirty = true;
      }

      if (!reduce && pointers.size === 0) {
        const k = 1 - Math.exp(-dt * 9);
        const dy = goal.yaw - cur.yaw;
        const dp = goal.pitch - cur.pitch;
        const dz = goal.zoom - cur.zoom;

        if (Math.abs(dy) > 0.01 || Math.abs(dp) > 0.01 || Math.abs(dz) > 0.0005) {
          cur.yaw += dy * k;
          cur.pitch += dp * k;
          cur.zoom += dz * k;
          dirty = true;
        }
      }

      if (dirty) {
        dirty = false;
        place();
        renderer.render(scene, camera);
      }
    };

    const loader = new THREE.TextureLoader();

    buildTable05Model(loader, renderer.capabilities.getMaxAnisotropy())
      .then((built) => {
        if (disposed) {
          built.dispose();
          return;
        }

        model = built;
        scene.add(model.group);
        dirty = true;
        place();
        renderer.render(scene, camera);
        onReady();
      })
      .catch((err: unknown) => {
        if (!disposed) {
          onError(err instanceof Error ? err.message : "Model failed to load");
        }
      });

    raf = requestAnimationFrame(tick);

    (host as HTMLDivElement & { __viewer?: unknown }).__viewer = {
      cur,
      goal,
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();

      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("keydown", onKey);

      model?.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // The viewer fills its parent; the minimum heights keep it large even when
    // the parent does not define a height. There is no control bar: the whole
    // area is the 3D view (drag, pinch, Ctrl+wheel, keyboard).
    <div className="relative h-full min-h-[24rem] w-full sm:min-h-[32rem] lg:min-h-[40rem]">
      <div
        ref={hostRef}
        role="group"
        aria-roledescription="3D product viewer"
        aria-label="Interactive 3D TABLE 05 terminal. Drag to rotate. Arrow keys rotate, plus and minus zoom, 1 to 6 jump to front, back, right, left, top and bottom, space toggles spin, zero resets."
        tabIndex={0}
        className="absolute inset-0 cursor-grab select-none outline-none [touch-action:pan-y] focus-visible:ring-2 focus-visible:ring-[var(--mkt-lime)] active:cursor-grabbing"
      />

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
