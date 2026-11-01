import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Container } from "@/components/ui/container";
import { SingleValuation } from "@/components/valuation/single-valuation";

export const metadata: Metadata = { title: "Vehicle Value" };

export default function ValuePage() {
  return (
    <>
      <PageHeader
        eyebrow="Vehicle Value"
        title="What is this car worth, pulled apart?"
        description="Scrap metal by material plus the resellable eBay parts a yard should pull — radios, bezels, consoles, modules, lights — priced from catalog sell-through."
      />
      <Container className="py-8 sm:py-10">
        <SingleValuation />
      </Container>
    </>
  );
}
