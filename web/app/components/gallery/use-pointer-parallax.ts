import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// Subtle "looking back at the viewer" tilt: the bust yaws/pitches slightly
// opposite the cursor position rather than tracking it directly (cursor
// right -> bust turns left), eased toward the target each frame so the
// motion reads as a gentle drift rather than a snap-to-cursor track.
const MAX_YAW = 0.08; // radians, ~4.6°
const MAX_PITCH = 0.045; // radians, ~2.6°
const EASE = 3.5;

export function usePointerParallax() {
  const ref = useRef({ yaw: 0, pitch: 0 });
  useFrame((state, delta) => {
    const { pointer } = state;
    const t = Math.min(1, delta * EASE);
    const targetYaw = -pointer.x * MAX_YAW;
    const targetPitch = pointer.y * MAX_PITCH;
    ref.current.yaw += (targetYaw - ref.current.yaw) * t;
    ref.current.pitch += (targetPitch - ref.current.pitch) * t;
  });
  return ref;
}
