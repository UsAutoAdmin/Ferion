import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Catalog" };

export default function CatalogPage() {
  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Parts Catalog"
        description="The canonical parts list: sell-through, sell price, and fitment coverage by year, make, and model."
      />
      <ComingSoon feature="Catalog" />
    </>
  );
}
