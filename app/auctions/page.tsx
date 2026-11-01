import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Container } from "@/components/ui/container";
import { BulkValuation } from "@/components/valuation/bulk-valuation";

export const metadata: Metadata = { title: "Auction Analysis" };

export default function AuctionsPage() {
  return (
    <>
      <PageHeader title="Auction Analysis" />
      <Container className="py-6">
        <BulkValuation />
      </Container>
    </>
  );
}
