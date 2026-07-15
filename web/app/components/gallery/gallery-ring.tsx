import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import { BustModel } from "./bust-model";
import {
  SCENE_FILL_DIM,
  SCENE_KEY_DIM,
  useBustTuning,
  useLighting,
  useSharedMaterial,
} from "./tuning-context";
import { usePointerParallax } from "./use-pointer-parallax";
import type { GalleryFigure } from "~/data/gallery-figures";

// Small enough that even the flanking (off=1) busts stay fully inside the
// frame at typical widescreen aspects — a bigger radius pushes their outer
// edges past the screen edge, which reads as faces falling off-screen once
// the ring went full-bleed (no side padding left to absorb the overflow).
const RADIUS = 1.4;
// True black — the ring reads as busts emerging out of darkness rather than
// the warm dark-brown the rest of the gallery (page background, stage view)
// uses. Scoped to just this component's fog/vignette; the shared page
// background behind the transparent canvas is overridden separately (see
// the black backdrop div in gallery.tsx's gallery-mode branch).
const BG = "#000000";
// Vertical FOV is fixed regardless of canvas size, so the camera's
// position/target — not the container's height — determines how much of a
// bust (base at y=0 to head-top at y≈1.55, see BustModel's TARGET_HEIGHT) is
// actually visible. Aimed a touch lower than the bust's true vertical center
// (was 0.88) — tilts the camera down slightly, which pushes the busts up a
// touch in the frame.
const LOOK_AT = new THREE.Vector3(0, 0.82, 0);

// The Canvas's base fov (below) is a *vertical* FOV — three.js derives the
// horizontal FOV from it using the canvas's own aspect ratio, so the same
// vertical fov shows LESS horizontal width on a narrower/taller aspect. The
// flanking busts already sit close to the frame edge at the aspect this was
// tuned at (RADIUS's own comment above), so entering true OS fullscreen —
// narrower than a windowed browser, which loses some height to its own
// tabs/toolbar rather than width — was cropping them. BASE_ASPECT is that
// windowed aspect (measured, not a round number, so the fix engages even for
// the modest narrowing fullscreen actually produces — a rounder/narrower
// reference like 16:9 wouldn't); CameraAim widens the vertical fov
// (preserving the horizontal fov it implies) whenever the canvas gets
// narrower than it, and leaves it alone otherwise so the windowed framing
// this was tuned against stays untouched.
const BASE_FOV = 26;
const BASE_ASPECT = 1728 / 843;
// How far the horizontal-FOV preservation is allowed to go. Below this
// aspect the compensation stops: preserving the full five-bust span on a
// portrait phone (aspect ≈ 0.46) shrinks the centred face to a sliver, and
// on a screen that narrow the right trade is the opposite one — let the
// flanking busts crop at the edges and keep the centred face large. The
// clamp computes the fov as if the canvas were this wide, so anything
// between BASE_ASPECT and here degrades gracefully (fullscreen desktop,
// tablets), and anything narrower crops the flanks instead of shrinking
// the centre.
const MIN_COMPENSATED_ASPECT = 1.0;

function CameraAim() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.lookAt(LOOK_AT);
  }, [camera]);
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = Math.max(size.width / size.height, MIN_COMPENSATED_ASPECT);
    const fov =
      aspect < BASE_ASPECT
        ? (2 *
            Math.atan(
              Math.tan((BASE_FOV * Math.PI) / 180 / 2) * (BASE_ASPECT / aspect),
            ) *
            180) /
          Math.PI
        : BASE_FOV;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);
  return null;
}

// Each bust eases its own angular offset from the centered slot (rather than
// the whole ring rotating as a rigid body around the world origin — the
// circle isn't centered on the origin, so that would swing the wrong point
// to the front). offset === 0 means "centered, facing camera".
function RingFigure({
  figure,
  index,
  carousel,
  n,
  onClick,
  revealed,
  skipReveal,
}: {
  figure: GalleryFigure;
  index: number;
  carousel: number;
  n: number;
  onClick: () => void;
  /** Part of the ring's intro sequence (gallery.tsx) — this bust fades in
   *  once its turn comes up, alongside its numeral in the nav above. */
  revealed: boolean;
  /** Bypasses the fade entirely once the intro has already played once —
   *  RingFigure remounts fresh every time the user leaves and returns to
   *  gallery mode (see mode toggling in gallery.tsx), and without this every
   *  return trip would re-hide and re-fade the bust from scratch. */
  skipReveal: boolean;
}) {
  const tuning = useBustTuning(figure.id, "ring");
  const material = useSharedMaterial();
  const step = (2 * Math.PI) / n;
  const groupRef = useRef<THREE.Group>(null);
  const offsetRef = useRef(index * step);
  const parallax = usePointerParallax();
  const materialsRef = useRef<THREE.Material[]>([]);
  const initializedRef = useRef(false);
  const hasRevealedRef = useRef(false);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // BustModel's GLTF loads behind a Suspense boundary — even preloaded
    // (cached) assets can take an extra React commit or two before the
    // actual mesh lands in this group, so a one-shot mount effect can run
    // before there's anything to traverse and never find it again. Doing
    // it here instead retries every frame (cheap once `initializedRef`
    // latches) until the mesh genuinely exists, then zeroes its materials'
    // opacity so the bust starts invisible rather than popping in before
    // the reveal tween below gets a chance to run.
    if (!initializedRef.current) {
      const materials: THREE.Material[] = [];
      g.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.push(...mats);
        }
      });
      if (materials.length) {
        initializedRef.current = true;
        materialsRef.current = materials;
        if (!skipReveal) {
          for (const m of materials) {
            m.transparent = true;
            m.opacity = 0;
          }
        }
      }
    }

    // Intro sequence (gallery.tsx): fades this bust's materials in once its
    // turn comes up, in step with its numeral in the nav above. Checked
    // here (rather than a separate effect keyed on `revealed`) so it can
    // never fire before the materials above are actually found.
    if (!hasRevealedRef.current && !skipReveal && revealed && materialsRef.current.length) {
      hasRevealedRef.current = true;
      const materials = materialsRef.current;
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: 0.85,
        ease: "power2.out",
        onUpdate: () => {
          for (const m of materials) m.opacity = proxy.t;
        },
        onComplete: () => {
          for (const m of materials) {
            m.opacity = 1;
            m.transparent = false;
            m.needsUpdate = true;
          }
        },
      });
    }

    let diff = (index - carousel) * step - offsetRef.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    offsetRef.current += diff * Math.min(1, delta * 4.2);
    const off = offsetRef.current;
    g.position.set(Math.sin(off) * RADIUS, 0, Math.cos(off) * RADIUS - RADIUS);
    // Parallax only on the centered bust — applying it to the flanking
    // busts too made the whole ring shiver in unison, which read as noise
    // rather than the centered figure "looking back" at the cursor.
    const active = index === carousel;
    g.rotation.y =
      off - (figure.frontAz * Math.PI) / 180 + (active ? parallax.current.yaw : 0);
    g.rotation.x = active ? parallax.current.pitch : 0;
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Suspense fallback={null}>
        <BustModel
          url={figure.model}
          scaleAdjust={tuning.scale}
          offset={tuning.offset}
          rotation={tuning.rotation}
          color={material.color}
          roughness={material.roughness}
          metalness={material.metalness}
          textureOffset={figure.textureOffset}
        />
      </Suspense>
    </group>
  );
}

// Drag threshold (px) before the ring steps to the next/prev figure — the
// carousel is stepped, not a free spin, matching the design's feel of
// flipping through discrete portraits rather than orbiting a continuous ring.
const DRAG_STEP_PX = 60;

export function GalleryRing({
  figures,
  carousel,
  onSetCarousel,
  onEnter,
  enterDisabled,
  sfxOn = true,
  revealedCount,
  skipReveal = false,
}: {
  figures: GalleryFigure[];
  carousel: number;
  onSetCarousel: (i: number) => void;
  onEnter: (i: number) => void;
  /** Speech now lives on the ring itself (see RingChat in gallery.tsx), so
   *  clicking the centered bust to drop into the single-figure Stage is
   *  turned off for now — the Stage view/route stays intact for later. */
  enterDisabled?: boolean;
  /** Gates the rotation clunk below — see AudioControls in gallery.tsx. */
  sfxOn?: boolean;
  /** Intro sequence (gallery.tsx): busts at index < revealedCount fade in,
   *  in step with their numeral in the nav above. */
  revealedCount: number;
  /** See RingFigure's own doc — bypasses the fade on remounts after the
   *  intro has already played once. */
  skipReveal?: boolean;
}) {
  const dragActive = useRef(false);
  const dragMoved = useRef(false);
  const dragX0 = useRef(0);
  const n = figures.length;
  const lighting = useLighting();

  // Stone-on-stone clunk on every step of the ring, not just on mount — a
  // fresh Audio() per step (rather than one shared, rewound instance) so a
  // fast drag through several figures layers overlapping clunks instead of
  // cutting the previous one off. Guarded by the previous carousel value
  // (not a "have we mounted yet" flag) since navigating away from and back
  // to this route reconnects it — React re-runs its passive effects without
  // resetting refs/state, so a boolean guard replays the clunk on return
  // even though the carousel never actually moved.
  const prevCarouselRef = useRef(carousel);
  useEffect(() => {
    if (prevCarouselRef.current === carousel) return;
    prevCarouselRef.current = carousel;
    if (!sfxOn) return;
    const audio = new Audio("/sounds/stone.mp3");
    audio.volume = 0.6;
    void audio.play().catch(() => {});
    // sfxOn deliberately excluded: toggling it shouldn't itself fire a
    // clunk, only an actual carousel step while it happens to be on should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carousel]);

  const cardClick = (i: number) => {
    if (dragMoved.current) return;
    if (i === carousel) {
      if (!enterDisabled) onEnter(i);
    } else onSetCarousel(i);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        cursor: "grab",
        touchAction: "pan-y",
      }}
      onPointerDown={(e) => {
        dragActive.current = true;
        dragMoved.current = false;
        dragX0.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (!dragActive.current) return;
        const dx = e.clientX - dragX0.current;
        if (Math.abs(dx) > DRAG_STEP_PX) {
          dragMoved.current = true;
          onSetCarousel(dx > 0 ? (carousel - 1 + n) % n : (carousel + 1) % n);
          dragX0.current = e.clientX;
        }
      }}
      onPointerUp={() => {
        dragActive.current = false;
        setTimeout(() => {
          dragMoved.current = false;
        }, 50);
      }}
      onPointerLeave={() => {
        dragActive.current = false;
      }}
    >
      {/* Spotlight vignette — dims the flanking busts without touching their
          materials (which are shared with the figure-stage view via
          useGLTF's cache, so mutating them here would leak). */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "linear-gradient(90deg, #000000 0%, transparent 26%, transparent 74%, #000000 100%)",
          opacity: 0.75,
        }}
      />
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.9, RADIUS + 2.35], fov: 26 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* No opaque scene background — an opaque fill here renders through
            WebGL's own colour management and never quite matches the page's
            CSS gradient behind it, leaving a visible seam where the canvas
            ends. Transparent lets the page gradient show through underneath,
            so fog is the only thing fading the flanking busts to black. Range
            tightened (was 3.4-9) so the falloff into black reads sooner —
            more depth between the centered and flanking busts. */}
        <fog attach="fog" args={[BG, 2.6, 7.5]} />
        <hemisphereLight args={["#fff4de", "#0a0906", 0.32]} />
        {/* Dimmed by the same SCENE_*_DIM factors as the stage (see
            tuning-context.tsx) — the raw rig reads as harsh, blown-out
            specular highlights at either view's scale otherwise. */}
        <directionalLight
          position={lighting.keyPosition}
          intensity={lighting.keyIntensity * SCENE_KEY_DIM}
          color={lighting.keyColor}
        />
        <directionalLight
          position={lighting.fillPosition}
          intensity={lighting.fillIntensity * SCENE_FILL_DIM}
          color={lighting.fillColor}
        />
        <CameraAim />
        {figures.map((f, i) => (
          <RingFigure
            key={f.id}
            figure={f}
            index={i}
            carousel={carousel}
            n={n}
            onClick={() => cardClick(i)}
            revealed={i < revealedCount}
            skipReveal={skipReveal}
          />
        ))}
      </Canvas>
    </div>
  );
}
