/**
 * Fleet-level summary over many vehicle valuations, and a flat CSV
 * export. Pure — used by the bulk results UI.
 */

import type { VehicleValuation } from "./types";

export interface TypeTotal { typeKey: string; label: string; vehicles: number; expectedValue: number; avgUnitPrice: number }

export interface FleetSummary {
  vehicles: number;
  matched: number;
  totalExpected: number;
  totalGross: number;
  scrapTotal: number;
  partsExpected: number;
  avgExpectedPerVehicle: number;
  medianExpectedPerVehicle: number;
  /** Part types ranked by summed expected value across the fleet. */
  topTypes: TypeTotal[];
  /** Vehicles by age bucket with their summed expected value. */
  byAge: Array<{ bucket: string; vehicles: number; expectedValue: number }>;
  byMake: Array<{ make: string; vehicles: number; expectedValue: number; avgExpected: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function ageBucket(year: number, now = new Date().getFullYear()): string {
  const age = now - year;
  if (age <= 5) return "0–5 yrs";
  if (age <= 10) return "6–10 yrs";
  if (age <= 15) return "11–15 yrs";
  if (age <= 20) return "16–20 yrs";
  return "20+ yrs";
}

const AGE_ORDER = ["0–5 yrs", "6–10 yrs", "11–15 yrs", "16–20 yrs", "20+ yrs"];

export function summarizeFleet(results: readonly VehicleValuation[], topN = 12): FleetSummary {
  const totals = results.map((r) => r.totalExpectedUsd);
  const typeAgg = new Map<string, { label: string; vehicles: number; expectedValue: number; priceSum: number }>();
  const ageAgg = new Map<string, { vehicles: number; expectedValue: number }>();
  const makeAgg = new Map<string, { vehicles: number; expectedValue: number }>();

  for (const r of results) {
    for (const p of r.parts.parts) {
      if (!p.countedInTotal) continue;
      const t = typeAgg.get(p.typeKey) ?? { label: p.label, vehicles: 0, expectedValue: 0, priceSum: 0 };
      t.vehicles++; t.expectedValue += p.expectedValue; t.priceSum += p.unitPrice;
      typeAgg.set(p.typeKey, t);
    }
    const b = ageBucket(r.input.year);
    const a = ageAgg.get(b) ?? { vehicles: 0, expectedValue: 0 };
    a.vehicles++; a.expectedValue += r.totalExpectedUsd; ageAgg.set(b, a);
    const mk = r.resolved.make || r.input.make;
    const m = makeAgg.get(mk) ?? { vehicles: 0, expectedValue: 0 };
    m.vehicles++; m.expectedValue += r.totalExpectedUsd; makeAgg.set(mk, m);
  }

  const totalExpected = round2(totals.reduce((s, n) => s + n, 0));
  return {
    vehicles: results.length,
    matched: results.filter((r) => r.parts.coveredTypes > 0).length,
    totalExpected,
    totalGross: round2(results.reduce((s, r) => s + r.totalGrossUsd, 0)),
    scrapTotal: round2(results.reduce((s, r) => s + r.scrap.totalValueUsd, 0)),
    partsExpected: round2(results.reduce((s, r) => s + r.parts.expectedValue, 0)),
    avgExpectedPerVehicle: results.length ? round2(totalExpected / results.length) : 0,
    medianExpectedPerVehicle: round2(median(totals)),
    topTypes: Array.from(typeAgg.entries())
      .map(([typeKey, t]) => ({ typeKey, label: t.label, vehicles: t.vehicles, expectedValue: round2(t.expectedValue), avgUnitPrice: round2(t.priceSum / t.vehicles) }))
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, topN),
    byAge: AGE_ORDER.filter((b) => ageAgg.has(b)).map((bucket) => ({ bucket, ...ageAgg.get(bucket)!, expectedValue: round2(ageAgg.get(bucket)!.expectedValue) })),
    byMake: Array.from(makeAgg.entries())
      .map(([make, m]) => ({ make, vehicles: m.vehicles, expectedValue: round2(m.expectedValue), avgExpected: round2(m.expectedValue / m.vehicles) }))
      .sort((a, b) => b.expectedValue - a.expectedValue),
  };
}

// ── CSV export ────────────────────────────────────────────────────────

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/** One row per vehicle with the top parts inline. */
export function vehiclesCsv(results: readonly VehicleValuation[], topParts = 10): string {
  const header = ["Lot", "VIN", "Year", "Make", "Model", "Catalog Match", "Scrap $", "Parts Expected $", "Parts Ceiling $", "Total Expected $", "Types Covered", "Warnings",
    ...Array.from({ length: topParts }, (_, i) => [`Part ${i + 1}`, `Part ${i + 1} Price`, `Part ${i + 1} ST%`, `Part ${i + 1} Expected`]).flat()];
  const rows = results.map((r) => {
    const counted = r.parts.parts.filter((p) => p.countedInTotal).slice(0, topParts);
    return [
      r.input.lot, r.input.vin, r.input.year, r.resolved.make || r.input.make, r.input.model, r.resolved.catalogModels.join(" / "),
      r.scrap.totalValueUsd, r.parts.expectedValue, r.parts.grossValue, r.totalExpectedUsd, r.parts.coveredTypes, r.warnings.join(" | "),
      ...Array.from({ length: topParts }, (_, i) => {
        const p = counted[i];
        return p ? [p.label, p.unitPrice, Math.round(p.sellThrough * 100), p.expectedValue] : ["", "", "", ""];
      }).flat(),
    ];
  });
  return toCsv([header, ...rows]);
}

/** One row per (vehicle, part) — for pull lists. */
export function partsCsv(results: readonly VehicleValuation[]): string {
  const header = ["Lot", "Year", "Make", "Model", "Part", "Category", "Qty", "Unit Price $", "Sell-Through %", "Expected $", "Price Basis", "Verified", "Counted"];
  const rows = results.flatMap((r) => r.parts.parts.map((p) => [
    r.input.lot, r.input.year, r.resolved.make || r.input.make, r.input.model, p.label, p.category, p.perVehicle, p.unitPrice,
    Math.round(p.sellThrough * 100), p.expectedValue, p.priceTier, p.verified ? "yes" : "no", p.countedInTotal ? "yes" : "alt",
  ]));
  return toCsv([header, ...rows]);
}
