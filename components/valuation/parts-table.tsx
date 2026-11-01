"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TierBadge } from "@/components/valuation/tier-badge";
import { PART_CATEGORIES } from "@/lib/catalog/part-types";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import type { PartValuation, PartsValuation } from "@/lib/valuation/types";

type Filter = "All" | (typeof PART_CATEGORIES)[number];

/**
 * Ranked resellable parts for one vehicle with category filter, the
 * exclusive-group alternates muted, and the untracked types collapsed.
 */
export function PartsTable({ parts, compact = false }: { parts: PartsValuation; compact?: boolean }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [showNoData, setShowNoData] = useState(false);
  const visible = parts.parts.filter((p) => filter === "All" || p.category === filter);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-fg">Resellable parts</h3>
          <Badge tone="neutral">{parts.coveredTypes} of {parts.totalTypes} types priced</Badge>
        </div>
        <div className="flex items-baseline gap-3 text-sm">
          <span className="text-fg-subtle">Ceiling {formatCurrency(parts.grossValue)}</span>
          <span className="text-lg font-medium text-accent">{formatCurrency(parts.expectedValue)}</span>
        </div>
      </div>

      {!compact ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["All", ...PART_CATEGORIES] as Filter[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition-colors",
                filter === c ? "bg-fg text-surface" : "bg-line/10 text-fg-muted hover:text-fg"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-brand-md border border-dashed border-line/15 p-4 text-sm text-fg-subtle">No priced parts in this view.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-eyebrow text-fg-subtle">
              <tr>
                <th className="py-2 font-medium">Part</th>
                <th className="py-2 font-medium">Basis</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit price</th>
                <th className="py-2 text-right font-medium">Sell-through</th>
                <th className="py-2 text-right font-medium">Expected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/10">
              {visible.map((p) => <PartRow key={p.typeKey} part={p} compact={compact} />)}
            </tbody>
          </table>
        </div>
      )}

      {parts.noData.length > 0 ? (
        <div className="mt-3">
          <button type="button" onClick={() => setShowNoData((v) => !v)} className="text-xs text-fg-subtle underline-offset-4 hover:text-fg hover:underline">
            {showNoData ? "Hide" : "Show"} {parts.noData.length} tracked types with no market data for this vehicle
          </button>
          {showNoData ? (
            <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{parts.noData.map((n) => n.label).join(" · ")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PartRow({ part: p, compact }: { part: PartValuation; compact: boolean }) {
  return (
    <tr className={cn(!p.countedInTotal && "opacity-50")}>
      <td className="py-2.5">
        <div className="flex items-center gap-3">
          {!compact && p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-brand-sm object-cover" loading="lazy" />
          ) : null}
          <div>
            <div className="text-fg">{p.label}</div>
            <div className="text-xs text-fg-subtle">
              {p.category}
              {!p.countedInTotal ? " · alternate (not in total)" : ""}
              {p.verified ? " · verified eBay" : ""}
            </div>
          </div>
        </div>
      </td>
      <td className="py-2.5"><TierBadge tier={p.priceTier} /></td>
      <td className="py-2.5 text-right tabular-nums text-fg-muted">{p.perVehicle}</td>
      <td className="py-2.5 text-right tabular-nums text-fg">{formatCurrency(p.unitPrice)}</td>
      <td className="py-2.5 text-right tabular-nums text-fg-muted">
        {formatPercent(p.sellThrough, { digits: 0 })}
        {p.sellThroughAssumed ? <span title="No sell-through reported; default assumed"> *</span> : null}
      </td>
      <td className="py-2.5 text-right tabular-nums font-medium text-fg">{formatCurrency(p.expectedValue)}</td>
    </tr>
  );
}
