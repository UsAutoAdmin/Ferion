import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Auction Analysis" };

export default function AuctionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Auctions"
        title="Auction Analysis"
        description="Upload a Copart or IAA sale list. Ferion resolves make codes, expands part-compatible model years, and values every lot against the catalog."
      />
      <ComingSoon feature="Auction Analysis" />
    </>
  );
}
