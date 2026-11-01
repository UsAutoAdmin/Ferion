import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Catalog" };

export default function CatalogPage() {
  return (
    <>
      <PageHeader title="Catalog" />
      <ComingSoon feature="Catalog" />
    </>
  );
}
