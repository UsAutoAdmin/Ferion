import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Raised surface with an 11% hairline — the Atoms company-card look.
 */
export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-brand-lg border border-line/10 bg-surface-raised p-6 shadow-brand-sm",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn("text-base font-medium text-fg", className)}>{children}</h3>;
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("mt-1 text-sm leading-relaxed text-fg-muted", className)}>{children}</p>;
}
