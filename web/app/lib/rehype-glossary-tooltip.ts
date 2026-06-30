/**
 * Rehype plugin: add `.glossary-term` + `title=<gloss>` to any
 * <span data-w="N"> whose text content matches a glossary entry.
 *
 * Runs AFTER rehype-word-spans (which has already wrapped each
 * whitespace-separated token in a <span data-w="N">). We don't need
 * to walk text nodes — just iterate the already-wrapped spans.
 *
 * Matching: lowercase the token + canonicalise ASCII click renderings
 * (`|`, `||`, `!`, `≠`) to Unicode (ǀ ǁ ǃ ǂ), strip trailing
 * punctuation. The glossary-lookup.json keys are built with the same
 * canonicalisation, so we get hits regardless of whether the source
 * text uses ASCII or Unicode click consonants.
 *
 * The lookup is restricted to click-bearing terms mined from the |xam
 * texts themselves (corpus glosses, the 1924 Mantis & Friends appendix,
 * the DBLC indexed-under structure). Clickless entries would false-match
 * common English words; Dorothea Bleek's 1956 multi-language dictionary
 * is excluded entirely — it spans 27 languages with no per-entry tag and
 * its OCR mangles the clicks, so it can't be trusted as |xam (Skotnes
 * feedback, June 2026). See docs/skotnes-feedback-remediation.md.
 */
import type { Plugin } from "unified";
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import glossaryLookup from "~/data/glossary-lookup.json";

const LOOKUP = glossaryLookup as Record<string, string>;

function canonicaliseToken(s: string): string {
  // Strip trailing punctuation (period, comma, semicolon, quote) but
  // keep leading `!`/`|` because they're click markers, not punctuation.
  let t = s.replace(/[.,;:?"']+$/, "").trim();
  t = t
    .replace(/\|\|/g, "ǁ")
    .replace(/\|/g, "ǀ")
    .replace(/!/g, "ǃ")
    .replace(/≠/g, "ǂ");
  return t.toLowerCase();
}

export const rehypeGlossaryTooltip: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node: Element) => {
      // Only span elements with our word-span data-w marker.
      if (node.tagName !== "span") return;
      const props = node.properties ?? {};
      if (props.dataW === undefined && (props as Record<string, unknown>)["data-w"] === undefined) {
        return;
      }
      // Read the text content — should be exactly one text child for
      // word-spans produced by rehype-word-spans.
      const child = node.children?.[0];
      if (!child || child.type !== "text") return;
      const raw = (child.value as string) ?? "";
      const key = canonicaliseToken(raw);
      const gloss = LOOKUP[key];
      if (!gloss) return;
      // Merge with any existing className on the span.
      const existing = (props.className as string[] | string | undefined) ?? [];
      const classNames = Array.isArray(existing)
        ? [...existing, "glossary-term"]
        : existing
          ? [existing, "glossary-term"]
          : ["glossary-term"];
      node.properties = { ...props, className: classNames, title: gloss };
    });
  };
};
