import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useControls, folder, button, Leva } from "leva";
import type { BustPlacement, GalleryFigure } from "~/data/gallery-figures";

export type BustTuning = {
  scale: number;
  offset: [number, number, number];
  /** Degrees, matching BustPlacement.rotation's convention. */
  rotation: [number, number, number];
};

// The ONE surface every bust renders with (diffuse maps are stripped —
// see bust-model.tsx's applySharedMaterial). Shared across all figures
// and both views: consistency by construction, nothing to calibrate
// per scan.
export type SharedMaterialTuning = {
  color: string;
  roughness: number;
  metalness: number;
};

// Shared by the ring and the single-figure stage — one light rig for both,
// so tuning it once keeps the two views' shading consistent instead of
// hand-syncing two hardcoded copies.
export type LightingTuning = {
  keyIntensity: number;
  keyPosition: [number, number, number];
  keyColor: string;
  fillIntensity: number;
  fillPosition: [number, number, number];
  fillColor: string;
};

export type View = "ring" | "stage";

const DEFAULT_TUNING: BustTuning = {
  scale: 1,
  offset: [0, 0, 0],
  rotation: [0, 0, 0],
};

// White tint leaves the aged-marble texture's own color untouched; lower
// roughness gives the stone a slight sheen instead of a fully matte finish.
const DEFAULT_MATERIAL: SharedMaterialTuning = {
  color: "#ffffff",
  roughness: 0.65,
  metalness: 0,
};

const DEFAULT_LIGHTING: LightingTuning = {
  keyIntensity: 2.8,
  keyPosition: [-2.9, -6.1, 1.1],
  keyColor: "#ffffff",
  fillIntensity: 0.8,
  fillPosition: [-2.9, 0.2, -2],
  fillColor: "#ffffff",
};

// Both the ring and the single-figure stage dim this shared rig by the same
// amount before applying it to their own directional lights — the raw
// values above read as blown-out, harsh specular highlights at either
// view's distance/scale otherwise. Multiply rather than lower the values
// above so the Leva panel's sliders still show the "true" rig strength.
export const SCENE_KEY_DIM = 0.35;
export const SCENE_FILL_DIM = 0.6;

type FigureTuning = {
  ring: BustTuning;
  stage: BustTuning;
};

type TuningValue = {
  figures: Record<string, FigureTuning>;
  material: SharedMaterialTuning;
  lighting: LightingTuning;
};

const TuningContext = createContext<TuningValue>({
  figures: {},
  material: DEFAULT_MATERIAL,
  lighting: DEFAULT_LIGHTING,
});

// Ring and stage are tuned independently — the two views use different
// camera distances/framing, so a scale/offset that reads right in one
// won't necessarily read right in the other (see BustPlacement).
export function useBustTuning(id: string, view: View): BustTuning {
  const { figures } = useContext(TuningContext);
  return figures[id]?.[view] ?? DEFAULT_TUNING;
}

// The one shared bust surface (see SharedMaterialTuning).
export function useSharedMaterial(): SharedMaterialTuning {
  return useContext(TuningContext).material;
}

// The key/fill directional lights, shared by both views (see LightingTuning).
export function useLighting(): LightingTuning {
  return useContext(TuningContext).lighting;
}

// Keeps the same array reference across renders when its values haven't
// changed — each vector is a BustModel prop/memo dependency downstream, and
// a fresh literal every render would make that memo recompute needlessly on
// every unrelated Leva tick (see bust-model.tsx's box3-measurement note).
function stabilizeVec3(
  cache: Record<string, [number, number, number]>,
  key: string,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const prev = cache[key];
  const next: [number, number, number] =
    prev && prev[0] === x && prev[1] === y && prev[2] === z ? prev : [x, y, z];
  cache[key] = next;
  return next;
}

function placementSchema(prefix: string, placement: BustPlacement | undefined) {
  return {
    [`${prefix}_scale`]: {
      value: placement?.scaleAdjust ?? 1,
      min: 0.2,
      // Stage scaleAdjust is already up to 1.78 (see gallery-figures.ts —
      // stage is tuned to 2x ring's), which the old max: 1.5 couldn't even
      // represent on the slider. Raised well past that for headroom to
      // push stage scale larger still.
      max: 3,
      step: 0.01,
      label: "scale",
    },
    [`${prefix}_x`]: {
      value: placement?.offset?.[0] ?? 0,
      min: -1,
      max: 1,
      step: 0.01,
      label: "move x",
    },
    [`${prefix}_y`]: {
      value: placement?.offset?.[1] ?? 0,
      min: -1,
      max: 1,
      step: 0.01,
      label: "move y",
    },
    [`${prefix}_z`]: {
      value: placement?.offset?.[2] ?? 0,
      min: -1,
      max: 1,
      step: 0.01,
      label: "move z",
    },
    [`${prefix}_rx`]: {
      value: placement?.rotation?.[0] ?? 0,
      min: -180,
      max: 180,
      step: 1,
      label: "rotate x",
    },
    [`${prefix}_ry`]: {
      value: placement?.rotation?.[1] ?? 0,
      min: -180,
      max: 180,
      step: 1,
      label: "rotate y",
    },
    [`${prefix}_rz`]: {
      value: placement?.rotation?.[2] ?? 0,
      min: -180,
      max: 180,
      step: 1,
      label: "rotate z",
    },
  };
}

function materialSchema() {
  return {
    material_color: { value: DEFAULT_MATERIAL.color, label: "color" },
    material_roughness: {
      value: DEFAULT_MATERIAL.roughness,
      min: 0,
      max: 1,
      step: 0.01,
      label: "roughness",
    },
    material_metalness: {
      value: DEFAULT_MATERIAL.metalness,
      min: 0,
      max: 1,
      step: 0.01,
      label: "metalness",
    },
  };
}

function lightingSchema() {
  return {
    key_intensity: {
      value: DEFAULT_LIGHTING.keyIntensity,
      min: 0,
      max: 5,
      step: 0.05,
      label: "key intensity",
    },
    key_x: {
      value: DEFAULT_LIGHTING.keyPosition[0],
      min: -10,
      max: 10,
      step: 0.1,
      label: "key x",
    },
    key_y: {
      value: DEFAULT_LIGHTING.keyPosition[1],
      min: -10,
      max: 10,
      step: 0.1,
      label: "key y",
    },
    key_z: {
      value: DEFAULT_LIGHTING.keyPosition[2],
      min: -10,
      max: 10,
      step: 0.1,
      label: "key z",
    },
    key_color: { value: DEFAULT_LIGHTING.keyColor, label: "key color" },
    fill_intensity: {
      value: DEFAULT_LIGHTING.fillIntensity,
      min: 0,
      max: 5,
      step: 0.05,
      label: "fill intensity",
    },
    fill_x: {
      value: DEFAULT_LIGHTING.fillPosition[0],
      min: -10,
      max: 10,
      step: 0.1,
      label: "fill x",
    },
    fill_y: {
      value: DEFAULT_LIGHTING.fillPosition[1],
      min: -10,
      max: 10,
      step: 0.1,
      label: "fill y",
    },
    fill_z: {
      value: DEFAULT_LIGHTING.fillPosition[2],
      min: -10,
      max: 10,
      step: 0.1,
      label: "fill z",
    },
    fill_color: { value: DEFAULT_LIGHTING.fillColor, label: "fill color" },
  };
}

function readPlacement(
  values: Record<string, number>,
  offsetCache: Record<string, [number, number, number]>,
  rotationCache: Record<string, [number, number, number]>,
  prefix: string,
  fallback: BustPlacement | undefined,
): BustTuning {
  const offset = stabilizeVec3(
    offsetCache,
    prefix,
    values[`${prefix}_x`] ?? fallback?.offset?.[0] ?? 0,
    values[`${prefix}_y`] ?? fallback?.offset?.[1] ?? 0,
    values[`${prefix}_z`] ?? fallback?.offset?.[2] ?? 0,
  );
  const rotation = stabilizeVec3(
    rotationCache,
    prefix,
    values[`${prefix}_rx`] ?? fallback?.rotation?.[0] ?? 0,
    values[`${prefix}_ry`] ?? fallback?.rotation?.[1] ?? 0,
    values[`${prefix}_rz`] ?? fallback?.rotation?.[2] ?? 0,
  );
  return {
    scale: values[`${prefix}_scale`] ?? fallback?.scaleAdjust ?? 1,
    offset,
    rotation,
  };
}

function readMaterial(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: Record<string, any>,
): SharedMaterialTuning {
  return {
    color: values.material_color ?? DEFAULT_MATERIAL.color,
    roughness: values.material_roughness ?? DEFAULT_MATERIAL.roughness,
    metalness: values.material_metalness ?? DEFAULT_MATERIAL.metalness,
  };
}

function readLighting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: Record<string, any>,
  keyPositionCache: { current: [number, number, number] | null },
  fillPositionCache: { current: [number, number, number] | null },
): LightingTuning {
  const keyX = values.key_x ?? DEFAULT_LIGHTING.keyPosition[0];
  const keyY = values.key_y ?? DEFAULT_LIGHTING.keyPosition[1];
  const keyZ = values.key_z ?? DEFAULT_LIGHTING.keyPosition[2];
  const prevKey = keyPositionCache.current;
  const keyPosition: [number, number, number] =
    prevKey && prevKey[0] === keyX && prevKey[1] === keyY && prevKey[2] === keyZ
      ? prevKey
      : [keyX, keyY, keyZ];
  keyPositionCache.current = keyPosition;

  const fillX = values.fill_x ?? DEFAULT_LIGHTING.fillPosition[0];
  const fillY = values.fill_y ?? DEFAULT_LIGHTING.fillPosition[1];
  const fillZ = values.fill_z ?? DEFAULT_LIGHTING.fillPosition[2];
  const prevFill = fillPositionCache.current;
  const fillPosition: [number, number, number] =
    prevFill &&
    prevFill[0] === fillX &&
    prevFill[1] === fillY &&
    prevFill[2] === fillZ
      ? prevFill
      : [fillX, fillY, fillZ];
  fillPositionCache.current = fillPosition;

  return {
    keyIntensity: values.key_intensity ?? DEFAULT_LIGHTING.keyIntensity,
    keyPosition,
    keyColor: values.key_color ?? DEFAULT_LIGHTING.keyColor,
    fillIntensity: values.fill_intensity ?? DEFAULT_LIGHTING.fillIntensity,
    fillPosition,
    fillColor: values.fill_color ?? DEFAULT_LIGHTING.fillColor,
  };
}

function formatPlacement(t: BustTuning): string {
  return (
    `{ scaleAdjust: ${t.scale}, offset: [${t.offset.join(", ")}], ` +
    `rotation: [${t.rotation.join(", ")}] }`
  );
}

function formatMaterial(m: SharedMaterialTuning): string {
  return (
    `color: "${m.color}", roughness: ${m.roughness}, ` +
    `metalness: ${m.metalness}`
  );
}

function formatLighting(l: LightingTuning): string {
  return (
    `<directionalLight position={[${l.keyPosition.join(", ")}]} intensity={${l.keyIntensity}} color="${l.keyColor}" />\n` +
    `<directionalLight position={[${l.fillPosition.join(", ")}]} intensity={${l.fillIntensity}} color="${l.fillColor}" />`
  );
}

// Dev-only sliders — scale, x/y/z move, x/y/z rotate (for the ring AND the
// single-figure stage independently) per figure, plus one shared bust
// material (color/roughness/metalness) and one shared key/fill directional
// light rig — for calibrating without editing source and reloading for
// every try. The Leva panel is hidden outside dev; values here are NOT
// persisted anywhere — hit a "log to console" button once you're happy and
// paste the printed blocks into gallery-figures.ts / the components.
export function GalleryTuningProvider({
  figures,
  children,
}: {
  figures: GalleryFigure[];
  children: ReactNode;
}) {
  const latest = useRef<TuningValue>({
    figures: {},
    material: DEFAULT_MATERIAL,
    lighting: DEFAULT_LIGHTING,
  });
  const offsetCache = useRef<Record<string, [number, number, number]>>({});
  const rotationCache = useRef<Record<string, [number, number, number]>>({});
  const keyPositionCache = useRef<[number, number, number] | null>(null);
  const fillPositionCache = useRef<[number, number, number] | null>(null);

  // figures is the static GALLERY_FIGURES import — the schema's shape never
  // changes across renders, so it only needs to be built once.
  // Leva's Schema type isn't exported from the package root, and its
  // generic useControls() overloads can't infer a schema built with
  // computed `${id}_x` keys — the runtime shape is exactly what Leva
  // expects, so this stays untyped rather than fighting the inference.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schema = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: Record<string, any> = {};
    for (const f of figures) {
      s[f.name] = folder({
        Ring: folder(placementSchema(`${f.id}_ring`, f.ring)),
        Stage: folder(placementSchema(`${f.id}_stage`, f.stage)),
        [`${f.id}_log_to_console`]: button(() => {
          const t = latest.current.figures[f.id];
          console.log(
            `${f.name} — paste into gallery-figures.ts:\n` +
              `  ring: ${formatPlacement(t?.ring ?? DEFAULT_TUNING)},\n` +
              `  stage: ${formatPlacement(t?.stage ?? DEFAULT_TUNING)},`,
          );
        }),
      });
    }
    s["All figures"] = folder({
      log_all_to_console: button(() => {
        const lines = figures.map((f) => {
          const t = latest.current.figures[f.id];
          return (
            `  ${f.id}:\n` +
            `    ring: ${formatPlacement(t?.ring ?? DEFAULT_TUNING)}\n` +
            `    stage: ${formatPlacement(t?.stage ?? DEFAULT_TUNING)}`
          );
        });
        console.log("Bust tuning snapshot:\n" + lines.join("\n"));
      }),
    });
    s["Material"] = folder({
      ...materialSchema(),
      material_log_to_console: button(() => {
        console.log(
          "Shared material — paste into tuning-context.tsx DEFAULT_MATERIAL:\n" +
            formatMaterial(latest.current.material),
        );
      }),
    });
    s["Lighting"] = folder({
      ...lightingSchema(),
      lighting_log_to_console: button(() => {
        console.log(
          "Lighting — paste into gallery-ring.tsx and figure-stage.tsx:\n" +
            formatLighting(latest.current.lighting),
        );
      }),
    });
    return s;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const values = useControls(schema as any) as Record<string, any>;

  const figureMap: Record<string, FigureTuning> = {};
  for (const f of figures) {
    figureMap[f.id] = {
      ring: readPlacement(
        values,
        offsetCache.current,
        rotationCache.current,
        `${f.id}_ring`,
        f.ring,
      ),
      stage: readPlacement(
        values,
        offsetCache.current,
        rotationCache.current,
        `${f.id}_stage`,
        f.stage,
      ),
    };
  }
  const material = readMaterial(values);
  const lighting = readLighting(values, keyPositionCache, fillPositionCache);
  const map: TuningValue = { figures: figureMap, material, lighting };
  latest.current = map;

  return (
    <TuningContext.Provider value={map}>
      {/* Hidden for now regardless of DEV. Flip back to
        `!import.meta.env.DEV` to bring the tuning panel back in dev. */}
      <Leva hidden collapsed titleBar={{ title: "Bust tuning" }} />
      {children}
    </TuningContext.Provider>
  );
}
