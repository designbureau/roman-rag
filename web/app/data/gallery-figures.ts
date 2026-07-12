// Data for the Living Gallery — a 3D bust carousel where each Roman figure
// greets the visitor and answers questions in the first person. Ported from
// the Claude Design handoff (Living Gallery.dc.html). Figures with a
// `personaKey` are wired to the site's real RAG chat backend (see
// live-ask-panel.tsx); the `qa[].a` answers below are only used as canned
// fallback copy for a figure with no backend persona (none currently — all
// five gallery figures have an ingested corpus and a persona_config row —
// but the fallback stays wired up in gallery.tsx for the next figure added
// ahead of its corpus).
//
// Array order is chronological by birth year, oldest first — Cicero (106
// BC) predates Caesar (100 BC) despite the two often being grouped together
// — matching the ring's Roman-numeral labels (see gallery-ring.tsx's
// CHRONOLOGICAL_NUMERAL, which must stay in sync with this order).

export type QA = { q: string; a: string };

export type BustPlacement = {
  /** Corrects scans whose raw mesh doesn't span head-to-chest like the
   *  others (e.g. head-only with a small base fragment) — see BustModel.
   *  1 (default, omit) = no correction; <1 shrinks a model that renders
   *  oversized after normalizing purely by total mesh height. */
  scaleAdjust?: number;
  /** World-unit nudge applied after normalizing/centering, for scans whose
   *  geometry isn't quite centered the way the others are. [x, y, z],
   *  default [0, 0, 0]. */
  offset?: [number, number, number];
  /** Extra rotation (degrees) applied on top of frontAz, for scans that
   *  need a small tilt/lean correction rather than just a yaw. [x, y, z],
   *  default [0, 0, 0]. */
  rotation?: [number, number, number];
};

export type GalleryFigure = {
  id: string;
  name: string;
  first: string;
  title: string;
  years: string;
  model: string;
  /** Azimuthal offset (degrees) at which this model's face points toward camera. */
  frontAz: number;
  epithet: string;
  greeting: string;
  qa: QA[];
  /** Key in the server's persona_config table. Omitted where no persona exists yet. */
  personaKey?: string;
  /** Attribution for scans sourced from a museum, shown under the name. */
  credit?: string;
  /** Placement in the ring carousel. Tuned independently of `stage` — the
   *  two views use different camera distances/framing, so a scale/offset
   *  that reads right in one won't necessarily read right in the other.
   *  Tune live via the gallery's dev tuning panel (see tuning-context.tsx)
   *  and paste the logged values here. */
  ring?: BustPlacement;
  /** Placement in the single-figure detail view. See `ring`. */
  stage?: BustPlacement;
  /** UV offset [u, v] for the shared stone texture (see bust-model.tsx).
   *  Every bust samples the same marble image across its own UV 0-1 range,
   *  so a distinctive mark in the texture (a vein, a rust fleck) can land
   *  in an unlucky spot on one scan's face — shift it off-frame here rather
   *  than change the shared texture for everyone. Same value for both ring
   *  and stage: it moves where the SAME image lands on the SAME UVs, which
   *  doesn't depend on scale/position, so there's nothing to differ. */
  textureOffset?: [number, number];
};

export const GALLERY_FIGURES: GalleryFigure[] = [
  {
    id: "cicero",
    name: "Cicero",
    first: "Cicero",
    title: "Orator & Statesman",
    years: "106 BC – 43 BC",
    model: "/models/cicero/cicero.glb",
    frontAz: 0,
    personaKey: "cicero",
    // New PBR re-export (2026-07-06). See Caesar's comment — face width
    // already matches Augustus's (within 1%).
    ring: { scaleAdjust: 0.67, offset: [0, -0.19, 0], rotation: [14, 0, 0] },
    stage: { scaleAdjust: 1.93, offset: [0, 0.84, 0], rotation: [14, 0, 0] },
    epithet: "The voice that was Rome’s conscience.",
    greeting:
      "Marcus Tullius Cicero, at your service. Come — let us reason together, as free men should.",
    qa: [
      {
        q: "What makes a great speech?",
        a: "Know your listener, love your cause, and never let a fine phrase outrun the truth beneath it.",
      },
      {
        q: "Who was Catiline?",
        a: "A traitor to the Republic. How long, I asked him, will you abuse our patience? The Senate heard me that day.",
      },
      {
        q: "Why defend the Republic?",
        a: "Because law is the silent magistrate, and without it the strong will always devour the weak.",
      },
    ],
  },
  {
    id: "caesar",
    name: "Julius Caesar",
    first: "Caesar",
    title: "Dictator of Rome",
    years: "100 BC – 44 BC",
    model: "/models/caesar/caesar.glb",
    frontAz: 0,
    personaKey: "caesar",
    // New PBR re-export (2026-07-08). Size normalization: every figure's
    // scaleAdjust equalizes its measured face width (55-85% height band,
    // front half) against AUGUSTUS's — Caesar's already matches at scale
    // 1. Color needs no per-figure handling at all: every bust renders
    // with the ONE shared material (diffuse maps stripped, normal maps
    // kept — see bust-model.tsx's applySharedMaterial and the tuning
    // panel's Material folder).
    ring: { scaleAdjust: 0.69, offset: [0, -0.15, -0.14], rotation: [20, 0, 0] },
    stage: { scaleAdjust: 2.01, offset: [0, 0.89, -0.35], rotation: [20, 0, 0] },
    epithet: "The general who crossed the Rubicon and remade the Republic.",
    greeting:
      "I am Gaius Julius Caesar. Veni, vidi — and now, it seems, you have come to me.",
    qa: [
      {
        q: "Why cross the Rubicon?",
        a: "To turn back was to die a traitor. I chose Rome or ruin — and fortune, as ever, favoured the bold.",
      },
      {
        q: "Were you a tyrant?",
        a: "I seized power to end a century of chaos. Call it tyranny if you wish; the people called it peace.",
      },
      {
        q: "What of the Ides of March?",
        a: "Sixty men, and friends among them. A coward dies a thousand deaths; I resolved to die but once.",
      },
    ],
  },
  {
    id: "augustus",
    name: "Augustus",
    first: "Augustus",
    title: "First Emperor of Rome",
    years: "63 BC – AD 14",
    model: "/models/augustus/augustus.glb",
    frontAz: -90,
    personaKey: "augustus",
    // Retuned for the new higher-detail scan (2026-07-11) — different base
    // orientation than the old model, hence the near-90° yaw here on top of
    // frontAz, unlike the old scan's small corrective nudge.
    ring: {
      scaleAdjust: 0.78,
      offset: [-0.01, -0.16, 0],
      rotation: [0, -87, 0],
    },
    stage: {
      scaleAdjust: 2.15,
      offset: [0.67, 0.75, 0.04],
      rotation: [0, -84, 0],
    },
    epithet: "Restorer of the Republic, architect of an empire.",
    greeting:
      "Welcome. I am Augustus. Sit, and I shall speak with you as I once did before the Senate of Rome.",
    qa: [
      {
        q: "What is your greatest legacy?",
        a: "I found Rome a city of brick and left it a city of marble — and to her I gave forty years of peace.",
      },
      {
        q: "How did you hold such power?",
        a: "By never seeming to want it. I called myself first citizen, not king, and let the old forms stand.",
      },
      {
        q: "What did the Pax Romana mean?",
        a: "For a generation the roads ran safe and the temple of Janus stayed shut. Trade reached every province.",
      },
    ],
  },
  {
    id: "seneca",
    name: "Seneca",
    first: "Seneca",
    title: "Stoic Philosopher & Playwright",
    years: "4 BC – AD 65",
    model: "/models/seneca/seneca.glb",
    frontAz: 0,
    personaKey: "seneca",
    // New PBR re-export (2026-07-06). See Caesar's comment — Seneca's
    // face measured narrower than Augustus's, scaled up to match.
    ring: { scaleAdjust: 0.75, offset: [0, -0.19, 0.05], rotation: [0, 0, 0] },
    stage: { scaleAdjust: 2.08, offset: [-0.02, 0.93, 0], rotation: [0, 0, 0] },
    epithet:
      "Tutor to an emperor, and a philosopher of the plain life he never quite lived.",
    greeting:
      "I am Lucius Annaeus Seneca. Sit, if you have an hour to spare — I have spent my life urging others to spend theirs more wisely.",
    qa: [
      {
        q: "What is the good life?",
        a: "Not the long life, but the well-used one. A man may cross the whole sea of years and never once have lived.",
      },
      {
        q: "Why write to Lucilius?",
        a: "To think aloud with a friend is to think twice as clearly. I taught him, and in teaching I found my own instruction.",
      },
      {
        q: "Can a rich man be a Stoic?",
        a: "Uneasily, and I should know it better than most. Wealth is not forbidden — only the fear of losing it.",
      },
    ],
  },
  {
    id: "marcus",
    name: "Marcus Aurelius",
    first: "Marcus",
    title: "The Philosopher Emperor",
    years: "AD 121 – 180",
    model: "/models/marcus/marcus.glb",
    frontAz: 0,
    personaKey: "marcus-aurelius",
    credit:
      "3D scan: “Marcus Aurelius” by The British Museum · CC BY-NC-SA 4.0",
    // New PBR re-export (2026-07-08); faces the camera at 0, unlike the
    // old scan's -90. See Caesar's comment — Marcus is the color
    // reference (no tint), and his voluminous curls make the whole head
    // much wider than his face, so pure height normalization left the
    // face oversized; shrunk to match Augustus's.
    ring: { scaleAdjust: 0.67, offset: [0, -0.17, 0], rotation: [0, 0, 0] },
    stage: { scaleAdjust: 1.85, offset: [-0.07, 0.95, 0], rotation: [0, 0, 0] },
    // Shifts the shared marble texture off a dark iron-stain fleck that
    // otherwise lands squarely between his eyebrows.
    textureOffset: [0.5, 0.35],
    epithet: "A philosopher who wore the purple unwillingly.",
    greeting:
      "I am Marcus. Speak plainly with me — the truth has no need of ornament, and neither do we.",
    qa: [
      {
        q: "What is Stoicism, truly?",
        a: "To know what lies in your power and what does not. Praise, pain, and fortune — let them pass through you unshaken.",
      },
      {
        q: "How do you stay calm?",
        a: "Each night I write to myself, that I may govern my own mind before I presume to govern Rome.",
      },
      {
        q: "Do you fear death?",
        a: "Death smiles at us all; a man can only smile back. It is the way of nature, and never a misfortune.",
      },
    ],
  },
];
