/**
 * Voice-profile builder.
 *
 * Reads the prose framing of the three Bleek-Lloyd reports — the parts
 * Lucy and Wilhelm wrote in their own voice rather than transcribing
 * |xam content — and emits a per-person reference document with:
 *
 *   - Distinctive vocabulary (TF-IDF vs the other person's prose)
 *   - Sentence-length distribution
 *   - Common sentence-opening tokens
 *   - A handful of representative verbatim passages (medium-length,
 *     diverse content) for the persona prompts to anchor on.
 *
 * Output: `data/voice-profiles/{lloyd,bleek}.md`. The persona prompts
 * read these as REFERENCE PASSAGES blocks so the LLM can mimic genuine
 * cadence rather than synthesising from generic "Victorian English".
 *
 * Run via: pnpm voice-profiles
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

type Story = {
  id: string;
  source: string;
  category: string | null;
  english_text: string | null;
};

const ROOT = resolve(import.meta.dirname, "../../../..");
const STORIES_PATH = resolve(ROOT, "data/stories.json");
const OUT_DIR = resolve(ROOT, "data/voice-profiles");

const STOPWORDS = new Set([
  "the","of","and","to","a","in","that","is","for","it","as","with","on","by",
  "this","be","are","at","an","or","from","was","not","but","have","had","has",
  "we","i","you","he","she","they","him","her","them","his","their","its","our",
  "which","who","when","where","what","there","these","those","been","were","being",
  "would","could","should","may","might","can","will","shall","do","does","did",
  "said","also","one","two","three","other","some","any","all","very","more","most",
  "such","than","then","so","also","only","up","out","into","upon","about","over",
  "if","because","while","whose","each","both","same","own","etc","ever","yet",
  "after","before","during","through","between","without","within","under","above",
  "no","nor","just","still","again","also","much","many","few","several","first",
  "second","third","new","old","year","years","time","day","place","way","case",
  "thus","hence","viz","cf","ie","eg","note","p","pp","vol","fig","table","mr","dr",
]);

function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z|ǀǁǃǂ"])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10);
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zǀǁǃǂ' -]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function distinctiveWords(
  tf: Map<string, number>,
  baseline: Map<string, number>,
  totalSelf: number,
  totalBaseline: number,
  topN: number,
): Array<{ word: string; selfRate: number; baselineRate: number; ratio: number }> {
  const out: Array<{ word: string; selfRate: number; baselineRate: number; ratio: number }> = [];
  for (const [w, c] of tf) {
    if (c < 4) continue;
    const baseC = baseline.get(w) ?? 0;
    const selfRate = c / totalSelf;
    const baselineRate = (baseC + 1) / (totalBaseline + 1); // additive smoothing
    out.push({ word: w, selfRate, baselineRate, ratio: selfRate / baselineRate });
  }
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, topN);
}

function commonOpeners(sentences: string[], topN: number): Array<{ phrase: string; count: number }> {
  const m = new Map<string, number>();
  for (const s of sentences) {
    const head = s
      .split(/\s+/)
      .slice(0, 3)
      .join(" ")
      .replace(/[,.;:!?]+$/, "")
      .toLowerCase();
    if (head.length < 4) continue;
    m.set(head, (m.get(head) ?? 0) + 1);
  }
  return [...m.entries()]
    .filter(([, c]) => c >= 2)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

function pickPassages(sentences: string[], wantLengthChars: [number, number], n: number): string[] {
  const [min, max] = wantLengthChars;
  const pool = sentences.filter((s) => s.length >= min && s.length <= max);
  // Pick across the prose evenly so we don't draw all from the opening.
  const picks: string[] = [];
  if (!pool.length) return picks;
  const step = Math.max(1, Math.floor(pool.length / n));
  for (let i = 0; i < pool.length && picks.length < n; i += step) {
    picks.push(pool[i]!);
  }
  return picks;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function main() {
  const stories = JSON.parse(await readFile(STORIES_PATH, "utf8")) as Story[];

  const lucyProse = stories
    .filter((s) => s.source === "third-report-1889" && s.category === "report-prose")
    .map((s) => s.english_text ?? "")
    .join("\n\n");
  const wilhelmProse = stories
    .filter(
      (s) =>
        (s.source === "second-report-1875" || s.source === "first-report-1873") &&
        s.category === "report-prose",
    )
    .map((s) => s.english_text ?? "")
    .join("\n\n");

  if (!lucyProse.length || !wilhelmProse.length) {
    throw new Error("Missing prose corpus for one of the writers.");
  }

  const profiles = [
    { name: "lloyd", who: "Lucy C. Lloyd", source: "Third Report (1889)", prose: lucyProse, baseline: wilhelmProse },
    { name: "bleek", who: "Wilhelm H. I. Bleek", source: "First & Second Reports (1873/1875)", prose: wilhelmProse, baseline: lucyProse },
  ];

  await mkdir(OUT_DIR, { recursive: true });

  for (const p of profiles) {
    const sentences = sentencesOf(p.prose);
    const baselineSentences = sentencesOf(p.baseline);
    const tokens = tokenise(p.prose);
    const baselineTokens = tokenise(p.baseline);
    const tf = termFreq(tokens);
    const baselineTf = termFreq(baselineTokens);

    const distinct = distinctiveWords(tf, baselineTf, tokens.length, baselineTokens.length, 30);
    const openers = commonOpeners(sentences, 12);

    const lengths = sentences.map((s) => s.length);
    const wordsPerSentence = sentences.map((s) => s.split(/\s+/).length);

    const passagesShort = pickPassages(sentences, [80, 160], 4);
    const passagesMedium = pickPassages(sentences, [160, 320], 4);
    const passagesLong = pickPassages(sentences, [320, 600], 3);

    const lines: string[] = [];
    lines.push(`# Voice profile — ${p.who}`);
    lines.push("");
    lines.push(`Source: ${p.source}.`);
    lines.push(`Generated: ${new Date().toISOString().slice(0, 10)} via \`pnpm voice-profiles\`.`);
    lines.push("");
    lines.push("## Cadence");
    lines.push("");
    lines.push(`- **Sentences**: ${sentences.length}`);
    lines.push(`- **Average length**: ${avg(lengths).toFixed(0)} characters / ${avg(wordsPerSentence).toFixed(1)} words`);
    lines.push(`- **Longest sentence**: ${Math.max(...lengths)} characters`);
    lines.push(`- **Median word count**: ${[...wordsPerSentence].sort((a,b)=>a-b)[Math.floor(wordsPerSentence.length/2)]}`);
    lines.push("");
    lines.push("## Distinctive vocabulary");
    lines.push("");
    lines.push(`Words appearing disproportionately in ${p.who.split(" ")[0]}'s prose (vs the other writer):`);
    lines.push("");
    for (const d of distinct.slice(0, 20)) {
      lines.push(`- \`${d.word}\` (×${(d.ratio).toFixed(1)} more frequent)`);
    }
    lines.push("");
    lines.push("## Common sentence openers");
    lines.push("");
    for (const o of openers) {
      lines.push(`- "${o.phrase}…" (${o.count}×)`);
    }
    lines.push("");
    lines.push("## Reference passages");
    lines.push("");
    lines.push("Verbatim from the reports — the LLM should mimic this cadence and register, not paraphrase or modernise it.");
    lines.push("");
    if (passagesShort.length) {
      lines.push("### Short");
      lines.push("");
      for (const s of passagesShort) lines.push(`> ${s}`);
      lines.push("");
    }
    if (passagesMedium.length) {
      lines.push("### Medium");
      lines.push("");
      for (const s of passagesMedium) lines.push(`> ${s}`);
      lines.push("");
    }
    if (passagesLong.length) {
      lines.push("### Long");
      lines.push("");
      for (const s of passagesLong) lines.push(`> ${s}`);
      lines.push("");
    }

    const out = lines.join("\n");
    await writeFile(resolve(OUT_DIR, `${p.name}.md`), out, "utf8");
    console.log(`wrote ${out.length} chars → data/voice-profiles/${p.name}.md`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
