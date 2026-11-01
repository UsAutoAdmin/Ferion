import { Container } from "@/components/ui/container";

export function ComingSoon({ feature }: { feature: string }) {
  return (
    <Container className="py-8">
      <p className="text-sm text-fg-subtle">{feature}: not implemented.</p>
    </Container>
  );
}
