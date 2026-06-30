import * as React from "react";
import { cn } from "~/lib/utils";

export function Badge({
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--muted)] px-2 py-0.5 text-xs font-medium text-[color:var(--muted-foreground)]",
        className,
      )}
      {...rest}
    />
  );
}
