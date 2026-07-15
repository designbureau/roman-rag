/**
 * Skip-to-content link. Visually hidden until focused, so a keyboard user
 * can bypass the repeated site nav on their first Tab. Point it at the id
 * of the route's primary content region, which should carry tabIndex={-1}
 * so focus actually lands there when the link is followed.
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-[color:var(--border)] focus:bg-[color:var(--background)] focus:px-4 focus:py-2 focus:text-sm focus:text-[color:var(--foreground)]"
    >
      Skip to content
    </a>
  );
}
