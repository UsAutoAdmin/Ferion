import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Ferion wordmark. Uppercase, wide tracking, cream — mirrors the Atoms
 * "ATOMS" lockup. Swap for an SVG asset in `public/` when one exists.
 */
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Ferion home"
      className={cn(
        "inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-fg",
        className
      )}
    >
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px] bg-accent" />
      Ferion
    </Link>
  );
}
