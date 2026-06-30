/**
 * A plain markdown text input — a styled, resizable textarea. Content is
 * stored and rendered as markdown elsewhere; this is just the entry
 * field. (No preview tab: the inputs are short blurbs and prompt text,
 * where a live preview adds nothing.)
 */
export function MarkdownEditor({
  value,
  onChange,
  rows = 6,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="block w-full resize-y rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]"
    />
  );
}
