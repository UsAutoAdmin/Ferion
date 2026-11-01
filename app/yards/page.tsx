import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Yards" };

export default function YardsPage() {
  return (
    <>
      <PageHeader title="Yards" />
      <ComingSoon feature="Yards" />
    </>
  );
}
