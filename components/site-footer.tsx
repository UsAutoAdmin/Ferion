import { Container } from "@/components/ui/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/10 py-8">
      <Container className="flex flex-col items-start justify-between gap-4 text-xs text-fg-subtle sm:flex-row sm:items-center">
        <span>{new Date().getFullYear()} © Ferion</span>
        <span>Enterprise parts intelligence for salvage operators.</span>
      </Container>
    </footer>
  );
}
