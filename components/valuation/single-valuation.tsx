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
    <div className="flex flex-col gap-6">
      <Card>
        <VehicleForm onSubmit={run} busy={busy} />
        {error ? <p className="mt-3 text-sm text-accent-rust">{error}</p> : null}
      </Card>
      {result ? <ValuationReport valuation={result} /> : null}
    </div>
  );
}
