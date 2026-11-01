"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ValuationReport } from "@/components/valuation/valuation-report";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import type { VehicleValuation } from "@/lib/valuation/types";

type SortKey = "lot" | "vehicle" | "scrap" | "parts" | "total" | "covered";

const COLUMNS: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "lot", label: "Lot" },
  { key: "vehicle", label: "Vehicle" },
  { key: "scrap", label: "Scrap", align: "right" },
  { key: "parts", label: "Parts", align: "right" },
  { key: "total", label: "Total", align: "right" },
  { key: "covered", label: "Types", align: "right" },
];

function sortValue(v: VehicleValuation, key: SortKey): string | number {
  switch (key) {
    case "lot": return v.input.lot ?? "";
    case "vehicle": return `${v.input.year} ${v.resolved.make} ${v.input.model}`;
    case "scrap": return v.scrap.totalValueUsd;
    case "parts": return v.parts.expectedValue;
    case "total": return v.totalExpectedUsd;
    case "covered": return v.parts.coveredTypes;
  }
}

/** Sortable per-vehicle table; a row expands into the full report with an on-demand eBay check. */
export function VehicleResultsTable({ results: initial, liveAvailable = false }: { results: VehicleValuation[]; liveAvailable?: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "total", dir: -1 });
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState<Map<number, VehicleValuation>>(new Map());
  const [verifying, setVerifying] = useState<Set<number>>(new Set());

  const results = useMemo(() => initial.map((r, i) => overrides.get(i) ?? r), [initial, overrides]);

  async function verify(i: number) {
    const r = results[i];
    setVerifying((s) => new Set(s).add(i));
    try {
      const res = await fetch("/api/value/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r.input) });
      if (res.ok) {
        const v = (await res.json()) as VehicleValuation;
        setOverrides((m) => new Map(m).set(i, v));
      }
    } finally {
      setVerifying((s) => { const n = new Set(s); n.delete(i); return n; });
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = results.map((r, i) => ({ r, i })).filter(({ r }) =>
      !q || `${r.input.lot ?? ""} ${r.input.vin ?? ""} ${r.input.year} ${r.resolved.make} ${r.input.model}`.toLowerCase().includes(q)
    );
    return filtered.sort((a, b) => {
      const av = sortValue(a.r, sort.key), bv = sortValue(b.r, sort.key);
      const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return c * sort.dir;
    });
  }, [results, sort, query]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "lot" || key === "vehicle" ? 1 : -1 }));
  }
  function toggleOpen(i: number) {
    setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-fg">Vehicles <span className="text-fg-subtle">({rows.length})</span></h3>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by lot, VIN, make, model"
          className="h-9 w-64 rounded-brand-md border border-line/15 bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent/60"
        />
      </div>
      <div className="overflow-x-auto rounded-brand-lg border border-line/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-eyebrow text-fg-subtle">
            <tr>
              <th className="w-8" />
              {COLUMNS.map((c) => (
                <th key={c.key} className={cn("px-3 py-2.5 font-medium", c.align === "right" && "text-right")}>
                  <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 hover:text-fg", sort.key === c.key && "text-fg")}>
                    {c.label}
                    {sort.key === c.key ? <span aria-hidden>{sort.dir === -1 ? "↓" : "↑"}</span> : null}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/10">
            {rows.map(({ r, i }) => {
              const expanded = open.has(i);
              const unmatched = r.parts.coveredTypes === 0;
              return (
                <Fragment key={i}>
                  <tr onClick={() => toggleOpen(i)} className={cn("cursor-pointer transition-colors hover:bg-line/5", expanded && "bg-line/5")}>
                    <td className="pl-3 text-fg-subtle">{expanded ? "−" : "+"}</td>
                    <td className="px-3 py-2.5 tabular-nums text-fg-muted">{r.input.lot ?? "—"}</td>
                    <td className="px-3 py-2.5 text-fg">
                      {r.input.year} {r.resolved.make || r.input.make} {r.input.model}
                      {r.input.vin ? <span className="ml-2 font-mono text-xs text-fg-subtle">{r.input.vin}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-fg-muted">{formatCurrency(r.scrap.totalValueUsd)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-fg-muted">{formatCurrency(r.parts.expectedValue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-accent">{formatCurrency(r.totalExpectedUsd)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-fg-muted">{r.parts.coveredTypes}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {r.verification ? <Badge tone="success">eBay live</Badge> : null}
                        {unmatched ? <Badge tone="warning">No part data</Badge> : r.scrap.profileSource === "heuristic" ? <Badge tone="neutral">Scrap estimated</Badge> : null}
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 2} className="bg-surface px-4 py-5">
                        {liveAvailable && !r.verification ? (
                          <div className="mb-4">
                            <Button variant="secondary" size="sm" disabled={verifying.has(i)} onClick={(e) => { e.stopPropagation(); void verify(i); }}>
                              {verifying.has(i) ? "Checking eBay…" : "Check eBay live"}
                            </Button>
                          </div>
                        ) : null}
                        <ValuationReport valuation={r} compact />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
