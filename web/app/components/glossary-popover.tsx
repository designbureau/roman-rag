/**
 * GlossaryPopover — click-driven popover that shows a term's gloss.
 * Replaces the previous native-`title` tooltip, which was OK on desktop
 * hover but unusable on touch.
 *
 * Built on Radix Popover so we get:
 *   - keyboard activation (Enter / Space on the trigger, Esc to close)
 *   - click-outside-to-dismiss
 *   - focus management
 *   - portal rendering (escapes overflow:hidden parents like the chat
 *     scroll container)
 *
 * Trigger is `asChild` so the single span passed in becomes the
 * Radix trigger directly — Radix attaches the click + a11y handlers
 * to that element without wrapping it in a button (which would
 * break the inline reading flow).
 *
 * Visuals match the rest of the surface: ivory card, hairline border,
 * serif body, slate text. No shadow.
 */
import * as Popover from "@radix-ui/react-popover";

export function GlossaryPopover({
  gloss,
  term,
  children,
}: {
  gloss: string;
  /** The canonical term — shown as a small mono caption above the gloss. */
  term?: string;
  children: React.ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-xs rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-3 text-sm leading-snug text-[color:var(--foreground)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {term && (
            <div className="label-mono mb-1 text-[color:var(--accent)]">
              {term}
            </div>
          )}
          <div className="font-corpus">{gloss}</div>
          <Popover.Arrow
            className="fill-[color:var(--background)] stroke-[color:var(--border)]"
            width={11}
            height={6}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
