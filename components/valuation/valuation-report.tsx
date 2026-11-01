import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { PartsTable } from "@/components/valuation/parts-table";
import { ScrapBreakdown } from "@/components/valuation/scrap-breakdown";
import { formatCurrency } from "@/lib/utils/format";
import type { VehicleValuation } from "@/lib/valuation/types";

function yearRange(years: number[]): string {
  if (!years.length) return "—";
  const min = Math.min(...years), max = Math.max(...years);
  return min === max ? String(min) : `${min}–${max}`;
}

/** Full single-vehicle report: headline numbers, provenance, scrap and parts. */
export function ValuationReport({ valuation: v, compact = false }: { valuation: VehicleValuation; compact?: boolean }) {
  const title = `${v.input.year} ${v.resolved.make || v.input.make} ${v.input.model}`;
  return (
    <div className="flex flex-col gap-6">
      {!compact ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-medium tracking-tight text-fg">{title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              {v.resolved.catalogModels.length ? (
                <span>Catalog: {v.resolved.catalogMake} · {v.resolved.catalogModels.join(", ")}</span>
              ) : (
                <span>Not matched to the catalog</span>
              )}
              <span aria-hidden>·</span>
              <span>Generation {yearRange(v.resolved.generationYears)}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Total recoverable" value={formatCurrency(v.totalExpectedUsd)} hint={`Ceiling ${formatCurrency(v.totalGrossUsd)}`} />
        <Stat label="Scrap metal" value={formatCurrency(v.scrap.totalValueUsd)} tone="fg" />
        <Stat label="Parts (expected)" value={formatCurrency(v.parts.expectedValue)} tone="fg" hint="Price × sell-through" />
        <Stat label="Types priced" value={`${v.parts.coveredTypes}/${v.parts.totalTypes}`} tone="fg" />
      </div>

      {v.warnings.length ? (
        <ul className="flex flex-wrap gap-2">
          {v.warnings.map((w) => <li key={w}><Badge tone="warning">{w}</Badge></li>)}
        </ul>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card><ScrapBreakdown scrap={v.scrap} compact={compact} /></Card>
        <Card><PartsTable parts={v.parts} compact={compact} /></Card>
      </div>
    </div>
  );
}
