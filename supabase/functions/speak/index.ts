/**
 * /functions/speak — text-to-speech for assistant messages, via ElevenLabs.
 *
 * POST { text, persona }
 *   - text: the assistant's reply (markdown-stripped client-side; we strip
 *     again here as defence-in-depth)
 *   - persona: any persona key (built-in or admin-authored)
 *
 * Calls ElevenLabs `eleven_flash_v2_5` with a per-persona voice ID + voice
 * settings, streams the audio response straight back to the browser as
 * `audio/mpeg`.
 *
 * Required Edge Function secret: ELEVENLABS_API_KEY.
 *
 * Voice resolution (see resolveVoice): an ELEVENLABS_VOICE_<PERSONA> env
 * override wins, then the persona_config row's voice_id/voice_settings
 * (admin-authored, incl. new personas), then the code built-in default,
 * then a global fallback voice.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

let _supa: SupabaseClient | null = null;
const supa = () =>
  (_supa ??= createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  ));

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Personas are data-driven (authored in /admin). The runtime key is an
// open string; the code ships default voices only for the built-ins.
type Persona = string;
type BuiltinPersona =
  | "classicist"
  | "cicero"
  | "tiro"
  | "atticus"
  | "caesar"
  | "marcus-aurelius"
  | "augustus";

type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
  /** ElevenLabs v3 / multilingual_v2 — default 1.0; <1 slows down, >1 speeds up. */
  speed?: number;
};

type PersonaConfig = {
  /** ElevenLabs default-library IDs unless overridden by env. */
  defaultVoiceId: string;
  envOverride: string;
  settings: VoiceSettings;
};

/**
 * ElevenLabs default-library voice IDs as of 2026. These are well-known
 * publicly-listed voices; users can swap them for cloned/custom voices
 * via the ELEVENLABS_VOICE_<PERSONA> env vars.
 */
// Per-persona TTS defaults for the Roman ensemble. The settings encode each
// voice's temperament (see the ElevenLabs voice-design notes); the
// defaultVoiceId is a safe, known-accessible placeholder (George) so playback
// works out of the box. The real per-persona voices are set as
// persona_config.voice_id (via /admin) or as ELEVENLABS_VOICE_<PERSONA> Edge
// secrets — either wins over this default (see resolveVoice).
const PLACEHOLDER_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George — warm British male

const PERSONA_VOICES: Record<BuiltinPersona, PersonaConfig> = {
  classicist: {
    defaultVoiceId: PLACEHOLDER_VOICE_ID,
    envOverride: "ELEVENLABS_VOICE_CLASSICIST",
    settings: { stability: 0.5, similarity_boost: 0.7, style: 0.35, use_speaker_boost: true, speed: 1.0 },
  },
  cicero: {
    defaultVoiceId: PLACEHOLDER_VOICE_ID,
    envOverride: "ELEVENLABS_VOICE_CICERO",
    settings: { stability: 0.45, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true, speed: 0.98 },
  },
  tiro: {
    defaultVoiceId: PLACEHOLDER_VOICE_ID,
    envOverride: "ELEVENLABS_VOICE_TIRO",
    settings: { stability: 0.68, similarity_boost: 0.72, style: 0.15, use_speaker_boost: true, speed: 0.96 },
  },
  atticus: {
    defaultVoiceId: PLACEHOLDER_VOICE_ID,
    envOverride: "ELEVENLABS_VOICE_ATTICUS",
    settings: { stability: 0.6, similarity_boost: 0.72, style: 0.3, use_speaker_boost: true, speed: 0.98 },
  },
  caesar: {
    defaultVoiceId: PLACEHOLDER_VOICE_ID,
    envOverride: "ELEVENLABS_VOICE_CAESAR",
    settings: { stability: 0.65, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true, speed: 1.0 },
  },
  "marcus-aurelius": {
    defaultVoiceId: PLACEHOLDER_VOICE_ID,
    envOverride: "ELEVENLABS_VOICE_MARCUS_AURELIUS",
    settings: { stability: 0.6, similarity_boost: 0.7, style: 0.2, use_speaker_boost: true, speed: 0.9 },
  },
  augustus: {
    defaultVoiceId: PLACEHOLDER_VOICE_ID,
    envOverride: "ELEVENLABS_VOICE_AUGUSTUS",
    settings: { stability: 0.72, similarity_boost: 0.7, style: 0.15, use_speaker_boost: true, speed: 0.9 },
  },
};

const MODEL_ID = "eleven_flash_v2_5";
const MAX_INPUT_CHARS = 4000;

/**
 * Trim the trailing "would you like to hear..." prompt + suggestion
 * links the Storyteller emits at the end of a turn. We look for the
 * first `(<story:...>)` markdown-link target, then walk backwards to
 * the most recent sentence/paragraph boundary so the lead-in question
 * goes too. Returns the original string unchanged if no story links
 * are present.
 */
function trimStorySuggestions(s: string): string {
  const m = s.match(/\(<story:[^>]+>\)/);
  if (!m || m.index === undefined) return s;
  const linkStart = m.index;
  // Walk back to the start of the markdown link text `[…]` so we don't
  // strand a half-link on screen.
  let bracketStart = s.lastIndexOf("[", linkStart);
  if (bracketStart < 0) bracketStart = linkStart;
  // From there, walk back over whitespace/list-marker chars to the end
  // of the previous sentence or paragraph.
  let cut = bracketStart;
  while (cut > 0 && /[\s\-*+>]/.test(s.charAt(cut - 1))) cut--;
  // Find the boundary that ends the previous sentence / paragraph.
  const boundary = Math.max(
    s.lastIndexOf("\n\n", cut),
    s.lastIndexOf(".", cut - 1),
    s.lastIndexOf("!", cut - 1),
    s.lastIndexOf("?", cut - 1),
  );
  if (boundary > 0) cut = boundary + 1;
  return s.slice(0, cut).trimEnd();
}

function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Strip the |xam click consonants (ǀ ǁ ǃ ǂ) before TTS. The voices in
 * ElevenLabs's general library can't articulate clicks, and leaving them
 * in produces stutter or mispronounced names. Reading "ǁkabbo" without
 * the click as "kabbo" is the right call.
 */
function stripClicks(s: string): string {
  return s.replace(/[ǀǁǃǂ]/g, "");
}

/**
 * Tokenize the markdown-stripped text and identify which whitespace-
 * separated tokens fall inside bracketed regions ([], (), {}). Returns
 * the (kept, non-bracketed) text to send to TTS plus the per-spoken-word
 * mapping back to original-token index. The frontend wraps every visible
 * word in <span data-w="N">; bracketed words still get a span (so they
 * remain visible) but no audio entry, which is exactly the "show but
 * don't voice" behaviour recitations want.
 *
 * Partial-bracket tokens (e.g. "[note]:") have their bracket characters
 * stripped from the kept text but the token is still spoken.
 */
function bracketRegions(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "[" || c === "(" || c === "{") {
      stack.push(i);
    } else if (c === "]" || c === ")" || c === "}") {
      const start = stack.pop();
      if (start !== undefined && stack.length === 0) {
        out.push([start, i]);
      }
    }
  }
  return out;
}

function buildSpokenText(stripped: string): {
  spoken: string;
  /** index in original whitespace-tokenisation, per surviving word */
  spokenToOrig: number[];
} {
  const tokens: Array<{ text: string; start: number; end: number }> = [];
  for (const m of stripped.matchAll(/\S+/g)) {
    tokens.push({ text: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  const regions = bracketRegions(stripped);

  const kept: string[] = [];
  const spokenToOrig: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const { text, start, end } = tokens[i]!;
    const fullyBracketed = regions.some(([s, e]) => start >= s && end <= e + 1);
    if (fullyBracketed) continue;
    // Strip stray bracket characters from kept tokens (e.g. "[note]:" → "note:")
    const cleaned = text.replace(/[[\](){}]/g, "");
    if (!cleaned) continue;
    kept.push(cleaned);
    spokenToOrig.push(i);
  }
  return { spoken: kept.join(" "), spokenToOrig };
}

/**
 * Phonetic respellings for South African / Afrikaans / Khoesan words that
 * an English-trained voice mangles. The reference pronunciation is
 * Standard Afrikaans / South African English — e.g. the "g" in `gemsbok`
 * is the voiceless velar fricative /x/ (like the "ch" in "loch"), which
 * we approximate with "kh" because English-trained voices pronounce "g"
 * as a hard /g/. "v" in Afrikaans loanwords is /f/, so `veld` → "felt".
 *
 * Applied AFTER stripClicks, so keys are the de-clicked forms.
 *
 * Add new entries here when you hear the model fluff a word. Keep keys
 * lowercase; the substitution preserves leading capitalisation.
 */
const PRONUNCIATIONS: Record<string, string> = {
  // Afrikaans-derived fauna. /x/ → "kh", /œi/ ≈ "ay", /v/ → "f",
  // word-final /d/ devoices to /t/ in Afrikaans (eland → "ealandt").
  eland: "earlandt",
  gemsbok: "khems-bok",
  duiker: "day-ker",
  hartebeest: "hart-uh-beest",
  wildebeest: "vil-de-beest",
  steenbok: "steen-bok",
  rietbok: "reet-bok",

  // Afrikaans cultural / material terms.
  veld: "felt",
  kraal: "krahl",
  karoo: "kuh-roo",
  kaross: "kuh-ross",
  assegai: "ass-uh-guy",
  biltong: "bill-tong",
  boer: "boor",
  boers: "boors",

  // Place names that crop up in the corpus.
  katkop: "kat-kop",
  kenhardt: "ken-hart",
  bitterputs: "bitter-puts",
  vaalpens: "fahl-pens",
  calvinia: "kal-vin-ee-uh",
  kakamas: "kah-kah-mas",
  kuruman: "koo-roo-mun",
  strandberg: "strand-berg",

  // San / Khoesan terms (clicks already stripped). |xam → xam → khahm
  // catches the throat-fricative onset that an English voice flattens to
  // "ksam" or "zam".
  xam: "khahm",
  khoekhoe: "kway-kway",
  bushman: "bush-man",
};

const PRONUNCIATION_REGEX = new RegExp(
  `\\b(${Object.keys(PRONUNCIATIONS).join("|")})\\b`,
  "gi",
);

function applyPronunciations(s: string): string {
  return s.replace(PRONUNCIATION_REGEX, (match) => {
    const replacement = PRONUNCIATIONS[match.toLowerCase()];
    if (!replacement) return match;
    if (match[0] !== match[0].toLowerCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

// Fallback voice for admin-authored personas that haven't been given a
// voice_id — George, a warm neutral narrator.
const DEFAULT_VOICE: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.15,
  use_speaker_boost: true,
  speed: 1.0,
};
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

function isVoiceSettings(v: unknown): v is VoiceSettings {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as VoiceSettings).stability === "number" &&
    typeof (v as VoiceSettings).similarity_boost === "number"
  );
}

/**
 * Resolve a persona's TTS voice. Precedence:
 *   1. ELEVENLABS_VOICE_<PERSONA> env override (operator's explicit choice)
 *   2. persona_config.voice_id / voice_settings (admin-authored, incl. new personas)
 *   3. code built-in default (PERSONA_VOICES)
 *   4. global default voice
 * The DB read is best-effort; on failure we fall back to code/default.
 */
async function resolveVoice(
  persona: Persona,
): Promise<{ voiceId: string; settings: VoiceSettings }> {
  const code = PERSONA_VOICES[persona as BuiltinPersona] as PersonaConfig | undefined;
  const envOverride = code ? Deno.env.get(code.envOverride) : undefined;

  let rowVoiceId: string | null = null;
  let rowSettings: VoiceSettings | null = null;
  try {
    const { data } = await supa()
      .from("persona_config")
      .select("voice_id, voice_settings")
      .eq("persona", persona)
      .maybeSingle();
    const row = data as { voice_id: string | null; voice_settings: unknown } | null;
    rowVoiceId = row?.voice_id?.trim() ? row.voice_id : null;
    rowSettings = isVoiceSettings(row?.voice_settings) ? row!.voice_settings as VoiceSettings : null;
  } catch (err) {
    console.error("resolveVoice fetch:", (err as Error).message);
  }

  const voiceId = envOverride || rowVoiceId || code?.defaultVoiceId || DEFAULT_VOICE_ID;
  const settings = rowSettings || code?.settings || DEFAULT_VOICE;
  return { voiceId, settings };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return jsonErr("ELEVENLABS_API_KEY is not set on the function", 500);
  }

  // GET — diagnostic. Returns which env-var overrides are set (without
  // exposing values) plus, if accessible, the user's voice library.
  if (req.method === "GET") {
    const overrides: Record<string, string | null> = {};
    for (const [persona, cfg] of Object.entries(PERSONA_VOICES)) {
      const v = Deno.env.get(cfg.envOverride);
      overrides[persona] = v ? `…${v.slice(-6)}` : null;
    }
    let voicesPayload: unknown = null;
    try {
      const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey, Accept: "application/json" },
      });
      const body = await upstream.text();
      try { voicesPayload = JSON.parse(body); } catch { voicesPayload = body; }
    } catch (err) {
      voicesPayload = { error: (err as Error).message };
    }
    return new Response(JSON.stringify({ overrides, voices: voicesPayload }, null, 2), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  let body: { text?: unknown; persona?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON", 400);
  }

  const rawText = typeof body.text === "string" ? body.text : "";
  if (!rawText.trim()) return jsonErr("text is required", 400);

  const persona: Persona =
    typeof body.persona === "string" && body.persona ? body.persona : "classicist";

  // The Storyteller persona ends a turn with clickable
  // `[Title](<story:Title>)` suggestion links, usually preceded by a
  // sentence like "Would you like to hear one of these stories?". The
  // buttons are visual UI — speaking them aloud is noise. Cut the tail
  // starting from the sentence boundary just before the first story
  // link, so neither the prompt nor the labels reach TTS. The rendered
  // word-spans still index across the full message; the karaoke just
  // stops where the spoken text stops.
  const trimmedForSpeech = trimStorySuggestions(rawText);
  // Strip markdown first so bracket detection sees the same text the
  // frontend will display. Click-stripping and pronunciation respelling
  // are per-token transforms that don't add or remove tokens, so the
  // original-word indices remain valid through both.
  const stripped = stripMarkdown(trimmedForSpeech);
  const { spoken, spokenToOrig } = buildSpokenText(stripped);
  let input = applyPronunciations(stripClicks(spoken));
  let activeSpokenToOrig = spokenToOrig;
  if (input.length > MAX_INPUT_CHARS) {
    const slice = input.slice(0, MAX_INPUT_CHARS);
    const lastEnd = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
    input = lastEnd > MAX_INPUT_CHARS * 0.6 ? slice.slice(0, lastEnd + 1) : slice;
    // After truncation, drop any spoken-to-orig entries beyond the
    // surviving word count so word indices don't dangle.
    const truncatedWordCount = (input.match(/\S+/g) ?? []).length;
    activeSpokenToOrig = spokenToOrig.slice(0, truncatedWordCount);
  }

  const { voiceId, settings } = await resolveVoice(persona);
  // Use the with-timestamps endpoint so the response carries character-
  // level alignment data alongside the audio. We convert that into
  // word-level timing for the karaoke-style follow-dot in the UI.
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        text: input,
        model_id: MODEL_ID,
        voice_settings: settings,
      }),
    });
  } catch (err) {
    console.error("elevenlabs fetch failed:", err);
    return jsonErr((err as Error).message, 502);
  }

  if (!upstream.ok) {
    let parsedDetail: { status?: string; code?: string; message?: string } = {};
    let rawDetail = `${upstream.status} ${upstream.statusText}`;
    try {
      const txt = await upstream.text();
      rawDetail = `${rawDetail}: ${txt.slice(0, 400)}`;
      const j = JSON.parse(txt) as { detail?: typeof parsedDetail | string };
      if (typeof j.detail === "object" && j.detail) parsedDetail = j.detail;
    } catch {}

    // Translate the most common free-tier failure modes into clear messages
    // the UI can show.
    let userMsg = rawDetail;
    let status = 502;
    if (parsedDetail.status === "quota_exceeded" || parsedDetail.code === "quota_exceeded") {
      userMsg = `ElevenLabs credits exhausted on this account. ${parsedDetail.message ?? ""}`;
      status = 429;
    } else if (parsedDetail.code === "paid_plan_required") {
      userMsg = `This voice requires a paid ElevenLabs plan. Add a voice to "My Voices" in the ElevenLabs dashboard (free) and override via the ELEVENLABS_VOICE_${persona.toUpperCase()} secret.`;
      status = 402;
    } else if (parsedDetail.code === "voice_not_found") {
      userMsg = `Voice ID ${voiceId} is not accessible. Add a voice to "My Voices" in the ElevenLabs dashboard and override via the ELEVENLABS_VOICE_${persona.toUpperCase()} secret.`;
      status = 404;
    }
    console.error("elevenlabs error:", rawDetail);
    return jsonErr(userMsg, status);
  }

  // Parse the with-timestamps payload, convert character timings into
  // word-level timings against the SENT text (the same text we display
  // word-spans for on the client), and return JSON with the audio
  // base64-encoded. The response is small enough (<100KB for typical
  // chat replies) that a single roundtrip is fine.
  type Alignment = {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
  type WithTimestampsPayload = {
    audio_base64: string;
    alignment: Alignment;
    normalized_alignment?: Alignment;
  };

  let payload: WithTimestampsPayload;
  try {
    payload = (await upstream.json()) as WithTimestampsPayload;
  } catch (err) {
    console.error("elevenlabs json parse failed:", err);
    return jsonErr((err as Error).message, 502);
  }
  if (!payload.audio_base64 || !payload.alignment) {
    return jsonErr("elevenlabs: missing audio or alignment in response", 502);
  }

  const rawWords = wordsFromAlignment(payload.alignment);
  // Re-key each spoken word to its index in the original (markdown-
  // stripped) tokenisation, which is what the frontend's word spans use.
  // Bracketed words have no entry here at all — the dot will skip past
  // them as audio time advances.
  const words = rawWords.map((w, i) => ({
    index: activeSpokenToOrig[i] ?? i,
    start: w.start,
    end: w.end,
    text: w.text,
  }));

  return new Response(
    JSON.stringify({
      audio: payload.audio_base64,
      mime: "audio/mpeg",
      words,
      sent_text: input,
    }),
    {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
});

/**
 * Group ElevenLabs's per-character timing into per-word entries by
 * splitting on whitespace. Each word's start = first character's start,
 * end = last character's end. Whitespace characters are not emitted.
 */
function wordsFromAlignment(a: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  let inWord = false;
  let wordStart = 0;
  let wordChars = "";
  for (let i = 0; i < a.characters.length; i++) {
    const c = a.characters[i] ?? "";
    const isSpace = /\s/.test(c);
    if (!inWord && !isSpace && c !== "") {
      inWord = true;
      wordStart = a.character_start_times_seconds[i] ?? 0;
      wordChars = c;
    } else if (inWord && isSpace) {
      inWord = false;
      out.push({
        start: wordStart,
        end: a.character_end_times_seconds[i - 1] ?? wordStart,
        text: wordChars,
      });
      wordChars = "";
    } else if (inWord) {
      wordChars += c;
    }
  }
  if (inWord && wordChars) {
    out.push({
      start: wordStart,
      end: a.character_end_times_seconds[a.characters.length - 1] ?? wordStart,
      text: wordChars,
    });
  }
  return out;
}

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
