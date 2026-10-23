import * as THREE from "three";

import {
  buildTable05Parts,
  DEPTH as GEOMETRY_DEPTH,
  MODEL_HEIGHT as GEOMETRY_MODEL_HEIGHT,
  type Part,
  type PartId,
} from "./table05-geometry";

/** Images are served from public/images/device-views. */
export const VIEW_BASE = "/images/device-views";
export const DEPTH = GEOMETRY_DEPTH;
export const MODEL_HEIGHT = GEOMETRY_MODEL_HEIGHT;

const COL_BODY = 0x2a3042;
const COL_SILVER = 0xb3b9cc;
const COL_TRIM = 0x6a2de0;

type Disposable = { dispose: () => void };

export interface Table05Model {
  group: THREE.Group;
  dispose: () => void;
}

type PhotoId = "front" | "back" | "right" | "left" | "bottom";
const PHOTO_IDS: PhotoId[] = ["front", "back", "right", "left", "bottom"];

/**
 * The device is a single closed solid (see table05-geometry.ts). Each surface
 * is a slice of that solid with its own material; photographs are applied
 * only through UVs, never through extra planes.
 */
export async function buildTable05Model(
  loader: THREE.TextureLoader,
  maxAnisotropy: number,
): Promise<Table05Model> {
  const resources: Disposable[] = [];
  const track = <T extends Disposable>(value: T): T => {
    resources.push(value);
    return value;
  };

  const load = (name: PhotoId) =>
    new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        `${VIEW_BASE}/${name}.webp`,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, maxAnisotropy);
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          resolve(track(texture));
        },
        undefined,
        () => reject(new Error(`Could not load ${name}.webp`)),
      );
    });

  const loaded = await Promise.all(PHOTO_IDS.map(load));
  const textures = Object.fromEntries(
    PHOTO_IDS.map((id, i) => [id, loaded[i]]),
  ) as Record<PhotoId, THREE.Texture>;

  // The photographs have transparent corners/edges. Composite them over the
  // dark body colour so transparent texels never render as black patches.
  const fill = new THREE.Color(COL_BODY);
  const fillGlsl = `vec3(${fill.r.toFixed(5)}, ${fill.g.toFixed(5)}, ${fill.b.toFixed(5)})`;

  const solid = (color: number, roughness: number, metalness: number) =>
    track(
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        side: THREE.FrontSide,
      }),
    );

  // Photographs are shown UNLIT. They already contain their own lighting, so
  // running them through scene lights, environment and tone mapping made them
  // look grey and washed out. toneMapped:false keeps the exact photo colours.
  const photo = (map: THREE.Texture) => {
    const mat = track(
      new THREE.MeshBasicMaterial({
        map,
        toneMapped: false,
        side: THREE.FrontSide,
      }),
    );
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          vec4 photoTexel = texture2D( map, vMapUv );
          diffuseColor.rgb *= mix( ${fillGlsl}, photoTexel.rgb, photoTexel.a );
        #endif`,
      );
    };
    mat.customProgramCacheKey = () => "table05-photo-unlit-over-body";
    return mat;
  };

  const materials: Record<PartId, THREE.Material> = {
    front: photo(textures.front),
    back: photo(textures.back),
    right: photo(textures.right),
    left: photo(textures.left),
    bottom: photo(textures.bottom),
    silver: solid(COL_SILVER, 0.34, 0.3),
    trim: solid(COL_TRIM, 0.4, 0.1),
    body: solid(COL_BODY, 0.62, 0.05),
  };

  const group = new THREE.Group();
  const toGeometry = (part: Part) => {
    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(part.normals, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(part.uvs, 2));
    geometry.setIndex(part.indices);
    return geometry;
  };

  for (const part of buildTable05Parts()) {
    const mesh = new THREE.Mesh(toGeometry(part), materials[part.id]);
    mesh.name = `table05-${part.id}`;
    group.add(mesh);
  }

  const dispose = () => {
    resources.forEach((resource) => resource.dispose());
  };

  return { group, dispose };
}
