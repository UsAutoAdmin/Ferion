"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CsvDropzone } from "@/components/valuation/csv-dropzone";
import { FleetSummaryView } from "@/components/valuation/fleet-summary";
import { VehicleResultsTable } from "@/components/valuation/vehicle-results-table";
import type { ParsedCsv } from "@/lib/csv/vehicle-csv";
import { partsCsv, summarizeFleet, vehiclesCsv } from "@/lib/valuation/summary";
import type { VehicleValuation } from "@/lib/valuation/types";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/** Upload → value → summary + per-vehicle table + exports. */
export function BulkValuation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<VehicleValuation[] | null>(null);
  const [fileName, setFileName] = useState("upload");
  const [rejected, setRejected] = useState<Array<{ index: number; error: string }>>([]);
  const [liveAvailable, setLiveAvailable] = useState(false);

  useEffect(() => {
    fetch("/api/value/verify").then((r) => r.json()).then((d) => setLiveAvailable(Boolean(d.available))).catch(() => {});
  }, []);

  const summary = useMemo(() => (results ? summarizeFleet(results) : null), [results]);

  async function run(parsed: ParsedCsv, name: string) {
    setBusy(true); setError(null); setFileName(name.replace(/\.csv$/i, ""));
    try {
      const res = await fetch("/api/value/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicles: parsed.vehicles }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResults(data.results as VehicleValuation[]);
      setRejected(data.rejected ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Valuation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CsvDropzone onReady={run} busy={busy} />
        {error ? <p className="mt-3 text-sm text-accent-rust">{error}</p> : null}
        {rejected.length ? <p className="mt-3 text-xs text-fg-subtle">{rejected.length} row{rejected.length === 1 ? "" : "s"} rejected by the server: {rejected.slice(0, 3).map((r) => r.error).join("; ")}</p> : null}
      </Card>

      {results && summary ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-medium tracking-tight text-fg">Summary</h2>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => download(`${fileName}-vehicles.csv`, vehiclesCsv(results))}>Vehicles CSV</Button>
              <Button variant="secondary" size="sm" onClick={() => download(`${fileName}-parts.csv`, partsCsv(results))}>Parts CSV</Button>
            </div>
          </div>
          <FleetSummaryView summary={summary} />
          <VehicleResultsTable results={results} liveAvailable={liveAvailable} />
        </>
      ) : null}
    </div>
  );
}
