import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  // Atoms' category pill: pale cream at ~11% on black.
  neutral: "bg-line/10 text-fg-muted",
  accent: "bg-accent/15 text-accent",
  success: "bg-success/20 text-sage",
  warning: "bg-warning/15 text-accent-bright",
  danger: "bg-danger/20 text-accent-rust",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-5",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
