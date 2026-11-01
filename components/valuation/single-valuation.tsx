"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { ValuationReport } from "@/components/valuation/valuation-report";
import { VehicleForm, type VehicleFormValue } from "@/components/valuation/vehicle-form";
import type { VehicleValuation } from "@/lib/valuation/types";

type LiveState = "idle" | "running" | "done" | "failed" | "unavailable";

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/**
 * Form + report for one vehicle. Catalog valuation renders first; a live
 * eBay pass then replaces it when Oxylabs is configured.
 */
export function SingleValuation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VehicleValuation | null>(null);
  const [live, setLive] = useState<LiveState>("idle");
  const [liveAvailable, setLiveAvailable] = useState<boolean | null>(null);
  const liveCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/value/verify").then((r) => r.json()).then((d) => setLiveAvailable(Boolean(d.available))).catch(() => setLiveAvailable(false));
  }, []);

  async function run(v: VehicleFormValue) {
    liveCtrl.current?.abort();
    setBusy(true); setError(null); setLive("idle");
    try {
      setResult(await postJson<VehicleValuation>("/api/value", v));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Valuation failed.");
      setBusy(false);
      return;
    }
    setBusy(false);
    if (!liveAvailable) { setLive("unavailable"); return; }
    const ctrl = new AbortController();
    liveCtrl.current = ctrl;
    setLive("running");
    try {
      const verified = await postJson<VehicleValuation>("/api/value/verify", v, ctrl.signal);
      if (!ctrl.signal.aborted) { setResult(verified); setLive("done"); }
    } catch (e) {
      if (!ctrl.signal.aborted) setLive(e instanceof Error && e.name === "AbortError" ? "idle" : "failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <VehicleForm onSubmit={run} busy={busy} />
        {error ? <p className="mt-3 text-sm text-accent-rust">{error}</p> : null}
      </Card>
      {result ? (
        <>
          <LiveStatus state={live} summary={result.verification} />
          <ValuationReport valuation={result} />
        </>
      ) : null}
    </div>
  );
}

function LiveStatus({ state, summary }: { state: LiveState; summary: VehicleValuation["verification"] }) {
  if (state === "idle" || state === "unavailable") return null;
  const tone = state === "failed" ? "text-accent-rust" : state === "running" ? "text-accent" : "text-fg-subtle";
  let text = "";
  if (state === "running") text = "eBay live check running…";
  else if (state === "failed") text = "eBay live check failed; showing catalog values.";
  else if (summary) text = `eBay live: ${summary.priced}/${summary.requested} types priced in ${(summary.durationMs / 1000).toFixed(0)}s${summary.soldSearchAvailable ? "" : " · sold search blocked"}`;
  return (
    <p className={`flex items-center gap-2 text-xs ${tone}`}>
      {state === "running" ? <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden /> : null}
      {text}
    </p>
  );
}
