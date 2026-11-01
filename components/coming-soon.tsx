import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

export function ComingSoon({ feature }: { feature: string }) {
  return (
    <Container className="py-12">
      <Card className="border-dashed">
        <CardTitle>{feature} is not wired up yet</CardTitle>
        <CardDescription>
          This route is a placeholder so navigation resolves. The feature module will land here.
        </CardDescription>
      </Card>
    </Container>
  );
}
