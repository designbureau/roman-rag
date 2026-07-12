import * as React from "react";
import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "~/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSwitch.Root>
>(({ className, ...rest }, ref) => (
  <RadixSwitch.Root
    ref={ref}
    className={cn(
      "relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full border border-[color:var(--border)] bg-[color:var(--muted)] transition-colors data-[state=checked]:bg-[color:var(--accent)]",
      className,
    )}
    {...rest}
  >
    <RadixSwitch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-[color:var(--foreground)] shadow transition-transform data-[state=checked]:translate-x-4" />
  </RadixSwitch.Root>
));
Switch.displayName = "Switch";
