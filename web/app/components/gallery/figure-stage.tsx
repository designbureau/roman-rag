import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type * as THREE from "three";
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

const BG = "transparent";

function BobbingBust({
  figureId,
  url,
  frontAz,
  speaking,
  textureOffset,
}: {
  figureId: string;
  url: string;
  frontAz: number;
  speaking: boolean;
  textureOffset?: [number, number];
}) {
  const tuning = useBustTuning(figureId, "stage");
  const material = useSharedMaterial();
  const ref = useRef<THREE.Group>(null);
  const parallax = usePointerParallax();
  // frontAz was authored as a model-viewer camera-orbit azimuth (the camera
  // rotates around a fixed model), so rotating the model itself instead
  // needs the opposite sign.
  const baseYaw = (-frontAz * Math.PI) / 180;
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const targetY = speaking ? Math.sin(clock.elapsedTime * 2.4) * 0.035 : 0;
    ref.current.position.y +=
      (targetY - ref.current.position.y) * Math.min(1, delta * 5);
    ref.current.rotation.y = baseYaw + parallax.current.yaw;
    ref.current.rotation.x = parallax.current.pitch;
  });
  return (
    <group ref={ref}>
      <Suspense fallback={null}>
        <BustModel
          url={url}
          scaleAdjust={tuning.scale}
          offset={tuning.offset}
          rotation={tuning.rotation}
          color={material.color}
          roughness={material.roughness}
          metalness={material.metalness}
          textureOffset={textureOffset}
        />
      </Suspense>
    </group>
  );
}

export function FigureStage({
  figure,
  speaking,
}: {
  figure: GalleryFigure;
  speaking: boolean;
}) {
  const lighting = useLighting();
  return (
    <Canvas
      key={figure.id}
      dpr={[1, 2]}
      // Tuned for scaleAdjust ~1 busts; stage.scaleAdjust is now 2x ring's
      // (see gallery-figures.ts), so the camera sits further back with a
      // wider FOV to keep the face — whose vertical position is invariant
      // to scaleAdjust, since BustModel anchors by the crown — fully in
      // frame instead of cropped by the tighter frustum the old numbers gave.
      camera={{ position: [0, 1, 5.4], fov: 36 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: BG }}
    >
      {/* Same rig and dimming as the ring (see tuning-context.tsx's
          SCENE_KEY_DIM/SCENE_FILL_DIM) so the two views read as the same
          scene rather than two different lighting setups. */}
      <hemisphereLight args={["#fff4de", "#0a0906", 0.32]} />
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
      <BobbingBust
        figureId={figure.id}
        url={figure.model}
        frontAz={figure.frontAz}
        speaking={speaking}
        textureOffset={figure.textureOffset}
      />
      <OrbitControls
        makeDefault
        target={[0, 0.85, 0]}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={(55 * Math.PI) / 180}
        maxPolarAngle={(105 * Math.PI) / 180}
        rotateSpeed={0.6}
      />
    </Canvas>
  );
}
