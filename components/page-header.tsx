import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/** Page title bar with optional right-side actions. */
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <section className="border-b border-line/10 py-5">
      <Container className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-medium tracking-tight text-fg">{title}</h1>
        {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
      </Container>
    </section>
  );
}
