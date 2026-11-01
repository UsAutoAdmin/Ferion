"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ValuationReport } from "@/components/valuation/valuation-report";
import { VehicleForm, type VehicleFormValue } from "@/components/valuation/vehicle-form";
import type { VehicleValuation } from "@/lib/valuation/types";

/** Form + report for one vehicle; owns the fetch state. */
export function SingleValuation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VehicleValuation | null>(null);

  async function run(v: VehicleFormValue) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/value", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data as VehicleValuation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Valuation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <VehicleForm onSubmit={run} busy={busy} />
        {error ? <p className="mt-3 text-sm text-accent-rust">{error}</p> : null}
      </Card>
      {result ? <ValuationReport valuation={result} /> : <EmptyState />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-brand-lg border border-dashed border-line/15 p-10 text-center">
      <p className="text-sm text-fg-muted">Pick a year, make and model to see scrap value and the resellable parts worth pulling.</p>
      <p className="mt-2 text-xs text-fg-subtle">Prices and sell-through come from the Content Machine catalog; weights from the vehicle profile.</p>
    </div>
  );
}
