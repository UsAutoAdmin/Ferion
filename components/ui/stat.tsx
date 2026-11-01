import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Large-numeral stat block. Numbers are first-class in Ferion — this is the
 * primary way we show valuation, coverage, and counts.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "accent",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "accent" | "fg" | "bright";
  className?: string;
}) {
  const valueTone = {
    accent: "text-accent",
    fg: "text-fg",
    bright: "text-accent-bright",
  }[tone];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium uppercase tracking-eyebrow text-fg-subtle">{label}</span>
      <span className={cn("text-3xl font-medium tracking-tight sm:text-4xl", valueTone)}>{value}</span>
      {hint ? <span className="text-sm text-fg-muted">{hint}</span> : null}
    </div>
  );
}
