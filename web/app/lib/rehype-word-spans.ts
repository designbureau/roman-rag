/**
 * Rehype plugin: walk all visible text nodes and wrap each whitespace-
 * separated word in a `<span data-w="N">` carrying a global word index.
 *
 * Used to enable the karaoke-style follow-dot on assistant replies. The
 * server-side speak function returns audio + per-word timing keyed to the
 * same word indices (split on the same whitespace pattern), so word i in
 * the rendered DOM lines up with word i in the audio alignment.
 *
 * Skipped: text inside <code>/<pre>/<style> nodes — non-prose.
 */
import type { Plugin } from "unified";
import type { Element, Root, Text } from "hast";
import { visit } from "unist-util-visit";

const SKIP_PARENTS = new Set(["code", "pre", "style", "script"]);

export const rehypeWordSpans: Plugin<[], Root> = () => {
  return (tree) => {
    let counter = 0;
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (parent.type === "element" && SKIP_PARENTS.has((parent as Element).tagName)) {
        return;
      }
      const value = node.value;
      if (!value) return;

      // Split preserving whitespace: ['Hello', ' ', 'world', '\n', '!']
      const tokens = value.split(/(\s+)/).filter((t) => t.length > 0);
      if (tokens.length === 0) return;

      const replacement: Array<Text | Element> = tokens.map((t) => {
        if (/^\s+$/.test(t)) {
          return { type: "text", value: t } as Text;
        }
        const i = counter++;
        return {
          type: "element",
          tagName: "span",
          properties: { dataW: i },
          children: [{ type: "text", value: t } as Text],
        } as Element;
      });

      (parent.children as Array<Text | Element>).splice(index, 1, ...replacement);
      return index + replacement.length;
    });
  };
};
