import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Yards" };

export default function YardsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Yards"
        title="Monitored Yards"
        description="Scheduled inventory scans across every yard you track, matched against the catalog as vehicles arrive."
      />
      <ComingSoon feature="Monitored Yards" />
    </>
  );
}
