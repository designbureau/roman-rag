/**
 * /functions/transcribe — speech-to-text for the chat input, via ElevenLabs
 * Scribe v2.
 *
 * POST multipart/form-data with one file field named "audio".
 * Returns { text: string } on success — shape unchanged from the previous
 * Whisper implementation, so the chat panel needs no changes.
 *
 * Required Edge Function secret: ELEVENLABS_API_KEY (already set for /speak;
 * reused here, so dictation and TTS share one provider).
 *
 * Scribe accepts common audio/video containers; the browser MediaRecorder
 * produces audio/webm by default on Chrome/Firefox, which is the path this
 * function is built for.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Cap the upload at 25MB — roughly 25 minutes of dictation, far beyond any
// realistic chat input. (Scribe itself accepts much larger files.)
const MAX_BYTES = 25 * 1024 * 1024;

// Scribe v2 batch model (the most accurate transcription model as of 2026).
const MODEL_ID = "scribe_v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return jsonErr("ELEVENLABS_API_KEY is not set", 500);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonErr("expected multipart/form-data with an 'audio' field", 400);
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return jsonErr("missing 'audio' file field", 400);
  }
  if (audio.size === 0) return jsonErr("empty audio", 400);
  if (audio.size > MAX_BYTES) return jsonErr("audio too large (>25MB)", 413);

  const upstreamForm = new FormData();
  upstreamForm.append("file", audio, audio.name || "input.webm");
  upstreamForm.append("model_id", MODEL_ID);
  // Hint English: dictation here is English chat queries, and pinning the
  // language stops the model drifting on the |xam click names in the corpus.
  upstreamForm.append("language_code", "en");

  let upstream: Response;
  try {
    upstream = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstreamForm,
    });
  } catch (err) {
    console.error("elevenlabs fetch failed:", err);
    return jsonErr((err as Error).message, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error("elevenlabs scribe error:", upstream.status, detail.slice(0, 400));
    return jsonErr(
      `scribe ${upstream.status}: ${detail.slice(0, 200)}`,
      upstream.status,
    );
  }

  const json = (await upstream.json()) as { text?: string };
  return new Response(JSON.stringify({ text: json.text ?? "" }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
