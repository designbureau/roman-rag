import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF, useTexture } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";

// Target bust height (world units) that every model — regardless of the
// scale/units baked into its own scan — gets normalized to, so the ring and
// the figure stage don't need per-model tuning.
const TARGET_HEIGHT = 1.55;

// Shared stone surface ("Aged Roman Marble - More Aged" PBR set, resized/
// recompressed from the source PNGs in
// public/textures/Aged_Roman_Marble_More_Aged_PBR/ — heavier iron-stain
// weathering than the first "Aged Roman Marble" pass) applied to every bust
// in place of a flat color — see applySharedMaterial. Each scan's UV atlas
// is stitched from multiple photogrammetry charts, so tiling the texture
// (repeat > 1) makes those chart seams read as hard lines across the face;
// repeat=1 (one full texture stretched over the 0-1 UV range) avoids that.
const STONE_DIFF_URL = "/textures/aged_marble_more_aged_basecolor_2k.jpg";
const STONE_ROUGH_URL = "/textures/aged_marble_more_aged_roughness_2k.jpg";
const STONE_REPEAT = 1;

// Some scans arrive effectively unlit — either via the glTF
// KHR_materials_unlit extension (three.js builds a MeshBasicMaterial for
// this, which ignores every scene light) or via a same-effect hack of a
// black base color plus the real look routed through `emissive` (also
// lighting-immune, since emissive is added on top regardless of light).
// Rebuild/patch these into normal lit materials using the same texture
// pixels, so every bust shades consistently under the gallery's lights.
function relitMaterial(material: THREE.Material): THREE.Material {
  if (material instanceof THREE.MeshBasicMaterial) {
    return new THREE.MeshStandardMaterial({
      map: material.map,
      color: material.color.clone(),
      roughness: 1,
      metalness: 0,
      transparent: material.transparent,
      side: material.side,
    });
  }
  if (
    material instanceof THREE.MeshStandardMaterial &&
    !material.map &&
    material.emissiveMap &&
    material.color.getHex() === 0x000000
  ) {
    material.map = material.emissiveMap;
    material.color.setRGB(1, 1, 1);
    material.emissiveMap = null;
    material.emissive.setRGB(0, 0, 0);
    material.needsUpdate = true;
  }
  return material;
}

// Mutates/replaces materials on the given root in place. Called on the
// cached, never-mounted `scene` template (see the box3-measurement note
// below) rather than a clone — clone() shares material references with its
// source, so fixing the template once means every clone (ring, stage, any
// future remount) picks up the fix for free. Each check above is already
// false once applied, so re-running this on an already-fixed scene is a
// cheap no-op — safe to call from every BustModel instance that loads it.
function relitScene(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.material = Array.isArray(obj.material)
      ? obj.material.map(relitMaterial)
      : relitMaterial(obj.material);
  });
}

// Replaces every mesh's surface with the ONE shared material the whole
// gallery uses: no diffuse map (each scan's photogrammetry texture, with
// its own white balance, staining and patina, is what made the group read
// as five different stones), one shared color, one shared
// roughness/metalness, and no per-pixel roughness/metalness maps (some
// scans pack one — Caesar's left shiny patches whatever the factor said).
// Each model's own NORMAL map is deliberately kept: that's where the
// sculptural surface detail lives, and it carries no color to un-match.
// The result is the plaster-cast look — five busts cut from one idealized
// material, consistent by construction.
// Mutates the shared `scene` template like relitScene, for the same
// reason: every clone picks up the change without redoing the traversal.
// Unlike relitScene this re-runs whenever these props change (see the
// effect below), so it stays a plain, always-safe-to-repeat assignment
// rather than a one-time guarded fix.
function applySharedMaterial(
  root: THREE.Object3D,
  color: string,
  roughness: number,
  metalness: number,
  stoneMap: THREE.Texture,
  stoneRoughnessMap: THREE.Texture,
) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material)
      ? obj.material
      : [obj.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.map = stoneMap;
      material.color.set(color);
      material.roughness = roughness;
      material.metalness = metalness;
      material.roughnessMap = stoneRoughnessMap;
      material.metalnessMap = null;
      material.needsUpdate = true;
    }
  });
}

type BustModelProps = {
  url: string;
  /** Corrects for scans whose raw mesh doesn't span head-to-chest like the
   *  others (e.g. a head-only scan with just a small base fragment below
   *  the chin) — normalizing purely by total mesh height then inflates the
   *  head, since the same TARGET_HEIGHT represents a much smaller anatomical
   *  range. 1 = no correction; see GalleryFigure.scaleAdjust for values. */
  scaleAdjust?: number;
  /** World-unit nudge applied after normalizing/centering. See
   *  GalleryFigure.offset. */
  offset?: [number, number, number];
  /** Extra rotation (degrees) applied on top of frontAz. See
   *  GalleryFigure.rotation. */
  rotation?: [number, number, number];
  /** The one shared surface color every bust renders with — the diffuse
   *  maps are stripped (see applySharedMaterial). */
  color?: string;
  /** Shared reflectivity. 1 = fully matte, 0 = fully glossy. */
  roughness?: number;
  /** See `roughness`. 0 = dielectric (stone, skin, cloth — everything
   *  here), 1 = metallic. */
  metalness?: number;
  /** UV offset into the shared stone texture. See GalleryFigure.textureOffset. */
  textureOffset?: [number, number];
} & ThreeElements["group"];

// Loads a bust GLB, centers it on X/Z, sits it on the y=0 plinth line, and
// scales it to a consistent height. Each scan comes from a different source
// (museum photogrammetry vs. generated), so raw scale/origin varies a lot —
// normalizing here means the ring and stage layouts stay simple.
export function BustModel({
  url,
  scaleAdjust = 1,
  offset = [0, 0, 0],
  rotation = [0, 0, 0],
  color = "#c3b6a1",
  roughness = 1,
  metalness = 0,
  textureOffset = [0, 0],
  ...groupProps
}: BustModelProps) {
  const { scene } = useGLTF(url);
  const [sharedStoneMap, sharedStoneRoughnessMap] = useTexture([
    STONE_DIFF_URL,
    STONE_ROUGH_URL,
  ]);
  // drei's useTexture cache keys purely on URL, so every BustModel instance
  // gets back the exact same THREE.Texture objects — mutating their
  // offset/repeat in place would move the marble pattern for every bust at
  // once. Clone per-instance so a figure-specific textureOffset only shifts
  // that one bust's UV sampling of the (still shared, still one-copy-in-
  // memory) image.
  const [stoneMap, stoneRoughnessMap] = useMemo(() => {
    const diff = sharedStoneMap.clone();
    const rough = sharedStoneRoughnessMap.clone();
    // Only the diffuse map carries color data — roughness stays linear.
    diff.colorSpace = THREE.SRGBColorSpace;
    for (const tex of [diff, rough]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(STONE_REPEAT, STONE_REPEAT);
      tex.offset.set(textureOffset[0], textureOffset[1]);
      tex.needsUpdate = true;
    }
    return [diff, rough];
  }, [sharedStoneMap, sharedStoneRoughnessMap, textureOffset]);
  const cloned = useMemo(() => {
    relitScene(scene);
    return scene.clone(true);
  }, [scene]);

  useEffect(() => {
    applySharedMaterial(
      scene,
      color,
      roughness,
      metalness,
      stoneMap,
      stoneRoughnessMap,
    );
  }, [scene, color, roughness, metalness, stoneMap, stoneRoughnessMap]);
  const rotationRad: [number, number, number] = [
    (rotation[0] * Math.PI) / 180,
    (rotation[1] * Math.PI) / 180,
    (rotation[2] * Math.PI) / 180,
  ];

  const { position, scale } = useMemo(() => {
    // Measure the cached, never-mounted `scene` template — not `cloned`.
    // Box3.setFromObject walks matrixWorld up through an object's live
    // parent chain; once `cloned` is actually mounted in the ring (rotated
    // and scaled by its parents), re-measuring it here — which this memo
    // does on every offset/scaleAdjust change — reads back its own
    // already-applied transform and compounds on top of it, blowing the
    // scale up. `scene` is the untouched, never-parented source, so it's
    // always safe to measure however many times this recomputes.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = (TARGET_HEIGHT / Math.max(size.y, 0.001)) * scaleAdjust;
    // Anchor by the TOP of the mesh (crown), not the bottom: every camera in
    // the gallery is aimed based on where a full-height bust's head sits
    // near TARGET_HEIGHT, so keeping the crown pinned there is what keeps a
    // scaleAdjust'd (head-dominant) scan's face level with its neighbors'.
    // For scaleAdjust=1 this is algebraically identical to bottom-anchoring
    // (box.max.y * s == TARGET_HEIGHT), so every unadjusted figure is
    // unaffected — only a shrunk model's base floats above y=0 instead of
    // sinking its head below the others.
    return {
      scale: s,
      position: new THREE.Vector3(
        -center.x * s + offset[0],
        TARGET_HEIGHT - box.max.y * s + offset[1],
        -center.z * s + offset[2],
      ),
    };
  }, [scene, scaleAdjust, offset]);

  return (
    <group {...groupProps}>
      <group scale={scale} position={position} rotation={rotationRad}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

export function preloadBust(url: string) {
  useGLTF.preload(url);
}
