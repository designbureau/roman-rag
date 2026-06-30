import * as React from "react";
import { cn } from "~/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "md";
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "default", size = "md", ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent)] disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        variant === "default" &&
          "bg-[color:var(--foreground)] text-[color:var(--background)] hover:opacity-90",
        variant === "ghost" &&
          "bg-transparent hover:bg-[color:var(--muted)]",
        variant === "outline" &&
          "border border-[color:var(--border)] bg-transparent hover:bg-[color:var(--muted)]",
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
