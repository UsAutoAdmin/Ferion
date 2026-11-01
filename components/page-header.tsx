import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/**
 * Standard page intro: eyebrow, title, description, optional right-side actions.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="border-b border-line/10 py-10 sm:py-14">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? (
            <span className="mb-3 block text-xs font-medium uppercase tracking-eyebrow text-accent">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-3xl font-medium tracking-tight text-fg sm:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
      </Container>
    </section>
  );
}
