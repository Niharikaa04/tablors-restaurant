/**
 * TABLE 05 device body geometry (pure data, no three.js dependency).
 *
 * The device is ONE connected closed solid: the side silhouette traced from
 * right.webp is extruded along the long axis (x). Coordinates:
 *   x = long axis (right end = +x, left end = -x)
 *   y = up
 *   z = depth (front keypad panel = +z, back label panel = -z)
 *
 * Surfaces (every edge of the profile belongs to exactly one):
 *   e0-e6    front   -> front.webp  (foot line up the slanted panel to the ridge)
 *   e7-e11   silver  -> back slope + plateau, one continuous silver surface
 *   e12      trim    -> purple accent chamfer
 *   e13-e14  back    -> back.webp   (rear wall only, cropped to the wall)
 *   e15-e17  body    -> dark navy lower rear corner
 *   e18-e26  bottom  -> bottom.webp (planar projection onto the underside)
 *   caps     right/left -> right.webp (+x) / left.webp (-x)
 */

export const DEPTH = 1;
export const LENGTH = 2.25;
export const SIDE_W = 900;
export const SIDE_H = 706;
const S = DEPTH / SIDE_W;
export const MODEL_HEIGHT = (SIDE_H - 10) * S;

/** Outline traced from right.webp (pixels, y down). Index = vertex id. */
export const PROFILE_PX: ReadonlyArray<readonly [number, number]> = [
  [0, 690], [0, 610], [6, 598], [102, 107], [110, 62],
  [130, 42], [210, 10], [292, 2], [339, 27], [417, 115],
  [451, 162], [490, 186], [813, 186], [840, 196], [852, 214],
  [896, 632], [899, 664], [877, 690], [836, 696], [722, 696],
  [700, 662], [684, 640], [657, 609], [294, 605], [269, 614],
  [204, 670], [123, 696],
];

export type PartId =
  | "front" | "back" | "right" | "left" | "bottom"
  | "silver" | "trim" | "body";

export interface Part {
  id: PartId;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

const N = PROFILE_PX.length;
const H = LENGTH / 2;
const Z = PROFILE_PX.map(([px]) => DEPTH / 2 - px * S);
const Y = PROFILE_PX.map(([, py]) => (SIDE_H - py) * S);

// Signed area in (z, y): > 0 means counter-clockwise.
let area = 0;
for (let i = 0; i < N; i++) {
  const j = (i + 1) % N;
  area += Z[i] * Y[j] - Z[j] * Y[i];
}
const SGN = area > 0 ? 1 : -1;

const edgeLen = (e: number) => {
  const j = (e + 1) % N;
  return Math.hypot(Z[j] - Z[e], Y[j] - Y[e]);
};

/** Outward unit normal (ny, nz) of profile edge e. */
const edgeNormal = (e: number): [number, number] => {
  const j = (e + 1) % N;
  const dz = Z[j] - Z[e];
  const dy = Y[j] - Y[e];
  const l = Math.hypot(dz, dy) || 1;
  return [(-dz / l) * SGN, (dy / l) * SGN];
};

const SMOOTH_COS = Math.cos((40 * Math.PI) / 180);

/** Smooth across gentle corners, keep hard corners hard. */
const vertexNormal = (e: number, atEnd: boolean): [number, number] => {
  const n = edgeNormal(e);
  const o = edgeNormal(atEnd ? (e + 1) % N : (e + N - 1) % N);
  if (n[0] * o[0] + n[1] * o[1] < SMOOTH_COS) return n;
  const a = n[0] + o[0];
  const b = n[1] + o[1];
  const l = Math.hypot(a, b) || 1;
  return [a / l, b / l];
};

type UvFn = (edge: number, t: number, s: number) => [number, number];

/** Extrude a chain of profile edges along x. s = 0 at -x, 1 at +x. */
function wall(id: PartId, edges: number[], uv?: UvFn): Part {
  const part: Part = { id, positions: [], normals: [], uvs: [], indices: [] };
  for (const e of edges) {
    const j = (e + 1) % N;
    const base = part.positions.length / 3;
    const corners: Array<[number, number, number]> = [
      [0, 0, e], [1, 0, e], [1, 1, j], [0, 1, j],
    ];
    for (const [s, t, vi] of corners) {
      part.positions.push(-H + s * LENGTH, Y[vi], Z[vi]);
      const [ny, nz] = vertexNormal(e, t === 1);
      part.normals.push(0, ny, nz);
      const [u, v] = uv ? uv(e, t, s) : [0, 0];
      part.uvs.push(u, v);
    }
    if (SGN > 0) part.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else part.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  return part;
}

// ---------- end caps (ear-clipped profile polygon) ----------

function triangulateProfile(): Array<[number, number, number]> {
  const idx = Array.from({ length: N }, (_, i) => i);
  if (SGN < 0) idx.reverse(); // make counter-clockwise in (z, y)
  const cross = (a: number, b: number, c: number) =>
    (Z[b] - Z[a]) * (Y[c] - Y[a]) - (Y[b] - Y[a]) * (Z[c] - Z[a]);
  const inTri = (p: number, a: number, b: number, c: number) =>
    cross(a, b, p) >= -1e-12 && cross(b, c, p) >= -1e-12 && cross(c, a, p) >= -1e-12;

  const tris: Array<[number, number, number]> = [];
  while (idx.length > 3) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[(k + idx.length - 1) % idx.length];
      const b = idx[k];
      const c = idx[(k + 1) % idx.length];
      if (cross(a, b, c) <= 1e-12) continue;
      if (idx.some((p) => p !== a && p !== b && p !== c && inTri(p, a, b, c))) continue;
      tris.push([a, b, c]);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new Error("TABLE 05 profile could not be triangulated");
  }
  tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

/** +x cap shows right.webp, -x cap shows left.webp. Neither is mirrored. */
function cap(id: "right" | "left"): Part {
  const sign = id === "right" ? 1 : -1;
  const part: Part = { id, positions: [], normals: [], uvs: [], indices: [] };
  PROFILE_PX.forEach(([px, py], i) => {
    part.positions.push(sign * H, Y[i], Z[i]);
    part.normals.push(sign, 0, 0);
    // right.webp: image-left = front (+z). left.webp is its mirror image.
    part.uvs.push(sign === 1 ? px / SIDE_W : 1 - px / SIDE_W, 1 - py / SIDE_H);
  });
  for (const [a, b, c] of triangulateProfile()) {
    // CCW in (z, y) gives a -x facing triangle.
    if (sign === -1) part.indices.push(a, b, c);
    else part.indices.push(a, c, b);
  }
  return part;
}

// ---------- photo UV fitting ----------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function table(rows: ReadonlyArray<readonly [number, number]>, y: number): number {
  if (y <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) {
    if (y <= rows[i][0]) {
      const t = (y - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]);
      return lerp(rows[i - 1][1], rows[i][1], t);
    }
  }
  return rows[rows.length - 1][1];
}

function arcTable(edges: number[]) {
  const cum = [0];
  edges.forEach((e) => cum.push(cum[cum.length - 1] + edgeLen(e)));
  const total = cum[cum.length - 1];
  return (e: number, t: number) => (cum[edges.indexOf(e)] + t * edgeLen(e)) / total;
}

// front.webp (1600x637). Opaque outline measured from the photo (4 px inset).
const FRONT_W = 1600;
const FRONT_H = 637;
const FRONT_Y_TOP = 8;    // ridge
const FRONT_Y_BOTTOM = 612; // foot line
const FRONT_X0: ReadonlyArray<readonly [number, number]> = [
  [8, 90], [26, 57], [52, 44], [78, 30], [104, 24], [156, 24],
  [260, 18], [364, 14], [468, 10], [572, 6], [612, 6],
];
const FRONT_X1: ReadonlyArray<readonly [number, number]> = [
  [8, 1510], [26, 1544], [52, 1557], [78, 1569], [104, 1575], [156, 1577],
  [260, 1581], [364, 1585], [468, 1589], [572, 1593], [612, 1593],
];
const FRONT_EDGES = [0, 1, 2, 3, 4, 5, 6];
const frontArc = arcTable(FRONT_EDGES);

const frontUv: UvFn = (e, t, s) => {
  const y = lerp(FRONT_Y_BOTTOM, FRONT_Y_TOP, frontArc(e, t));
  const x0 = table(FRONT_X0, y);
  const x1 = table(FRONT_X1, y);
  // Camera at +z: screen right = +x, so the photo is not mirrored.
  return [lerp(x0, x1, s) / FRONT_W, 1 - y / FRONT_H];
};

// back.webp (1600x554): only the dark rear wall, below the purple line and
// right of the visible end-face corner. Camera at -z: screen right = -x.
const BACK_W = 1600;
const BACK_H = 554;
const BACK_Y_TOP = 152;
const BACK_Y_BOTTOM = 440;
const BACK_X0 = 259;
const BACK_EDGES = [13, 14];
const backArc = arcTable(BACK_EDGES);

const backUv: UvFn = (e, t, s) => {
  const y = lerp(BACK_Y_TOP, BACK_Y_BOTTOM, backArc(e, t));
  const x1 = 1545 + 0.18 * (y - 150) - 6;
  return [lerp(x1, BACK_X0, s) / BACK_W, 1 - y / BACK_H];
};

// bottom.webp (1400x590): planform projection. Viewed from below with the
// front edge at the top of the screen, so text reads upright.
const BOTTOM_W = 1400;
const BOTTOM_H = 590;
const bottomUv: UvFn = (e, t, s) => {
  const j = (e + 1) % N;
  const z = lerp(Z[e], Z[j], t);
  const front = Math.min(1, Math.max(0, (DEPTH / 2 - z) / DEPTH)); // 0 at front
  const y = lerp(8, 578, front);
  return [lerp(14, 1386, s) / BOTTOM_W, 1 - y / BOTTOM_H];
};

const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function buildTable05Parts(): Part[] {
  return [
    wall("front", FRONT_EDGES, frontUv),
    wall("silver", range(7, 11)),
    wall("trim", [12]),
    wall("back", BACK_EDGES, backUv),
    wall("body", range(15, 17)),
    wall("bottom", range(18, 26), bottomUv),
    cap("right"),
    cap("left"),
  ];
}
