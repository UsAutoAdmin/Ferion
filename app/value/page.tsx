import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Container } from "@/components/ui/container";
import { SingleValuation } from "@/components/valuation/single-valuation";

export const metadata: Metadata = { title: "Vehicle Value" };

export default function ValuePage() {
  return (
    <>
      <PageHeader title="Vehicle Value" />
      <Container className="py-6">
        <SingleValuation />
      </Container>
    </>
  );
}
