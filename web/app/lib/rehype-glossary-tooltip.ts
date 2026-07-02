/**
 * Rehype plugin: add `.glossary-term` + `title=<gloss>` to any
 * <span data-w="N"> whose text content matches a glossary entry.
 *
 * Runs AFTER rehype-word-spans (which has already wrapped each
 * whitespace-separated token in a <span data-w="N">). We don't need
 * to walk text nodes — just iterate the already-wrapped spans.
 *
 * Matching: lowercase the token and strip trailing punctuation before
 * looking it up. The glossary-lookup.json keys are built with the same
 * normalisation, so we get hits regardless of casing. (A legacy
 * canonicalisation step also folds a few stray ASCII marks to Unicode;
 * it is inert for Latin text and left in place harmlessly.)
 *
 * The lookup is built from terms mined from the corpus itself, so it only
 * tags vocabulary the glossary actually carries. The glossary is not yet
 * populated for the Cicero corpus — it will light up once the wider
 * corpus is ingested and lemma-tagged.
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
