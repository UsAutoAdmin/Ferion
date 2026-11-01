"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/format";
import type { LivePartMarket } from "@/lib/valuation/types";

/** Compact live-eBay basis: badge, counts, basis, toggles. */
export function LiveMarketCell({ live, open, onToggle }: { live: LivePartMarket; open: boolean; onToggle: () => void }) {
  const basis = live.priceBasis === "sold" ? "sold median" : live.priceBasis === "asking" ? "asking × 0.8" : "no price";
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      <Badge tone={live.priceBasis === "none" ? "warning" : "success"}>Live</Badge>
      <span className="whitespace-nowrap text-fg-muted">{live.activeN} active{live.soldAvailable ? ` · ${live.soldN} sold` : ""}</span>
      <span className="whitespace-nowrap text-fg-subtle">· {basis}</span>
      <button type="button" onClick={onToggle} className="text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
        {open ? "hide" : "listings"}
      </button>
    </div>
  );
}

/** Full-width evidence row under a part: query, counts, accepted listings. */
export function LiveEvidenceRow({ live, colSpan }: { live: LivePartMarket; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-surface px-3 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
          <span>“{live.query}”</span>
          <span>{live.resultCount ?? "?"} results</span>
          <span>{Math.round((live.relevance ?? 0) * 100)}% relevant</span>
          {live.askingMedian !== null ? <span>asking median {formatCurrency(live.askingMedian)}</span> : null}
          <a href={live.searchUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-fg hover:underline">open on eBay ↗</a>
        </div>
        <ul className="grid gap-1 text-xs sm:grid-cols-2">
          {live.evidence.map((e) => (
            <li key={e.itemId} className="flex justify-between gap-3">
              <a href={e.url} target="_blank" rel="noreferrer" className="truncate text-fg-muted hover:text-fg">{e.title}</a>
              <span className="shrink-0 tabular-nums text-fg">{e.price === null ? "—" : formatCurrency(e.price)}</span>
            </li>
          ))}
          {live.evidence.length === 0 ? <li className="text-fg-subtle">No relevant listings.</li> : null}
        </ul>
      </td>
    </tr>
  );
}
