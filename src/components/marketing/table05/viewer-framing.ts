import { LENGTH, MODEL_HEIGHT, DEPTH } from "./table05-geometry";

/** Vertical field of view in degrees. */
export const FOV_DEG = 28;

/** Fraction of the frame left empty around the device (1.03 = ~3% breathing room). */
export const FIT_MARGIN = 1.03;

/** Orbit centre: the middle of the device's bounding box. */
export const TARGET: readonly [number, number, number] = [0, MODEL_HEIGHT / 2, 0];

const HX = LENGTH / 2;
const HZ = DEPTH / 2;

const CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [-HX, 0, -HZ], [HX, 0, -HZ], [-HX, 0, HZ], [HX, 0, HZ],
  [-HX, MODEL_HEIGHT, -HZ], [HX, MODEL_HEIGHT, -HZ],
  [-HX, MODEL_HEIGHT, HZ], [HX, MODEL_HEIGHT, HZ],
];

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: readonly number[], b: readonly number[]): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const norm = (a: readonly number[]): [number, number, number] => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Smallest camera distance (from TARGET) at which all eight corners of the
 * device's bounding box are inside the frame, for the given orbit angles and
 * canvas aspect ratio. Works for portrait and landscape canvases alike.
 */
export function fitDistance(yawDeg: number, pitchDeg: number, aspect: number): number {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  // Camera-to-target direction.
  const f = norm([
    -Math.sin(yaw) * Math.cos(pitch),
    -Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);

  const tanV = Math.tan((FOV_DEG * Math.PI) / 360);
  const tanH = tanV * Math.max(aspect, 0.2);

  let need = 0;
  for (const c of CORNERS) {
    const rel: [number, number, number] = [
      c[0] - TARGET[0],
      c[1] - TARGET[1],
      c[2] - TARGET[2],
    ];
    const x = dot(rel, r);
    const y = dot(rel, u);
    const z = dot(rel, f); // positive = farther from the camera than the target
    need = Math.max(need, Math.abs(x) / tanH - z, Math.abs(y) / tanV - z);
  }
  return need * FIT_MARGIN;
}
