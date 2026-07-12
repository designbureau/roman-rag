import { useEffect, useRef } from "react";

// Two-circle cursor: a small dot pinned exactly to the pointer, and a
// larger ring that eases toward it every frame — the ring's lag behind the
// dot is what reads as "two circles" rather than a single custom pointer.
// Original implementation of a well-known, generic interaction pattern (a
// dot + trailing ring), built fresh for this component — not copied from
// any particular reference. Scoped to the gallery route (see gallery.tsx),
// which hides the native cursor for its whole tree — the wrong trade for
// ordinary content/reading pages, but a good fit for this one full-bleed,
// game-like view.
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });
  const hovering = useRef(false);
  const visible = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Touch devices have no hovering pointer to track — leave the native
    // (touch) interaction model alone rather than drawing a cursor that
    // can never move on its own.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      if (!visible.current) {
        visible.current = true;
        // First-move snap: without this the ring would ease in all the way
        // from its off-screen start position instead of appearing already
        // at the pointer.
        ring.current.x = e.clientX;
        ring.current.y = e.clientY;
      }
      const target = e.target as HTMLElement | null;
      hovering.current = !!target?.closest("button, a, input, textarea, [role='button']");
    };
    const onLeave = () => {
      visible.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    let raf = 0;
    const tick = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.18;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.18;
      const opacity = visible.current ? 1 : 0;
      if (dotRef.current) {
        dotRef.current.style.opacity = String(opacity);
        dotRef.current.style.transform = `translate3d(${mouse.current.x}px, ${mouse.current.y}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        const scale = hovering.current ? 1.6 : 1;
        ringRef.current.style.opacity = String(opacity);
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] opacity-0"
      />
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] h-8 w-8 rounded-full border border-[color:var(--accent)] opacity-0 transition-[width,height] duration-150 ease-out"
      />
    </>
  );
}
