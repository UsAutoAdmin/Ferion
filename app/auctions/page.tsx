import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Container } from "@/components/ui/container";
import { BulkValuation } from "@/components/valuation/bulk-valuation";

export const metadata: Metadata = { title: "Auction Analysis" };

export default function AuctionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Auctions"
        title="Auction Analysis"
        description="Upload a Copart or IAA sale list. Ferion resolves make codes, expands part-compatible model years, and values every lot for scrap and resellable parts."
      />
      <Container className="py-8 sm:py-10">
        <BulkValuation />
      </Container>
    </>
  );
}
