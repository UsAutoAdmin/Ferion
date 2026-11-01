import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { canonicalMake, catalogMakeKeys, displayModel, matchCatalogModels, type VehicleInput } from "./normalize";

/**
 * In-memory index of `catalog_vehicles` (≈8.5k year/make/model rows).
 * Loaded once per server instance and refreshed in the background, it
 * answers "which catalog make/model keys mean this vehicle?" without a
 * round-trip, and feeds the make/model pickers.
 */

interface MakeEntry {
  /** Catalog make_norm, e.g. "FORD". */
  makeNorm: string;
  /** Display spelling (most common `make` value). */
  display: string;
  /** Upper-case model → years seen, plus the most common display spelling. */
  models: Map<string, { years: Set<number>; display: string; spellings: Map<string, number> }>;
}

export interface CatalogIndex {
  makes: Map<string, MakeEntry>;
  loadedAt: number;
}

export interface ResolvedVehicle extends VehicleInput {
  /** Canonical display make ("Ford"). */
  make: string;
  /** Catalog make_norm actually matched ("DODGE" for a Ram). */
  catalogMake: string | null;
  /** Catalog models to query, best first. */
  catalogModels: string[];
  matchHow: "exact" | "prefix" | "token" | "none";
  /** Years the catalog has any row for the matched models. */
  catalogYears: number[];
}

const TTL_MS = 10 * 60 * 1000;
const PAGE = 1000;

let indexPromise: Promise<CatalogIndex> | null = null;

async function fetchAllRows(): Promise<Array<{ year: number; make: string; make_norm: string; model: string }>> {
  const sb = getSupabase();
  const rows: Array<{ year: number; make: string; make_norm: string; model: string }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("catalog_vehicles")
      .select("year, make, make_norm, model")
      .order("make_norm").order("model").order("year")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`catalog_vehicles: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mostCommon(map: Map<string, number>): string {
  let best = ""; let n = -1;
  for (const [k, v] of map) if (v > n) { best = k; n = v; }
  return best;
}

function buildIndex(rows: Awaited<ReturnType<typeof fetchAllRows>>): CatalogIndex {
  const makes = new Map<string, MakeEntry & { spellings: Map<string, number> }>();
  for (const r of rows) {
    const makeNorm = (r.make_norm || r.make || "").toUpperCase().trim();
    const modelUpper = (r.model || "").toUpperCase().trim();
    if (!makeNorm || !modelUpper) continue;
    let m = makes.get(makeNorm);
    if (!m) { m = { makeNorm, display: "", models: new Map(), spellings: new Map() }; makes.set(makeNorm, m); }
    bump(m.spellings, r.make);
    let md = m.models.get(modelUpper);
    if (!md) { md = { years: new Set(), display: "", spellings: new Map() }; m.models.set(modelUpper, md); }
    if (Number.isFinite(r.year)) md.years.add(Number(r.year));
    bump(md.spellings, r.model);
  }
  for (const m of makes.values()) {
    m.display = canonicalMake(mostCommon(m.spellings)) || m.makeNorm;
    for (const [upper, md] of m.models) {
      const spelled = mostCommon(md.spellings);
      md.display = /[a-z]/.test(spelled) ? spelled : displayModel(upper);
    }
  }
  return { makes, loadedAt: Date.now() };
}

/** Load (or reuse) the catalog index. Refreshes after TTL without blocking callers. */
export async function getCatalogIndex(): Promise<CatalogIndex> {
  if (!indexPromise) {
    indexPromise = fetchAllRows().then(buildIndex);
    return indexPromise;
  }
  const current = await indexPromise;
  if (Date.now() - current.loadedAt > TTL_MS) {
    const refresh = fetchAllRows().then(buildIndex);
    refresh.then((next) => { indexPromise = Promise.resolve(next); }).catch((e) => logger.warn("catalog index refresh failed", { error: String(e) }));
  }
  return current;
}

/** Resolve a user/CSV vehicle to the catalog's make/model keys. */
export function resolveVehicle(index: CatalogIndex, input: VehicleInput): ResolvedVehicle {
  const make = canonicalMake(input.make);
  const base: ResolvedVehicle = { year: input.year, make, model: input.model.trim(), catalogMake: null, catalogModels: [], matchHow: "none", catalogYears: [] };
  for (const key of catalogMakeKeys(make)) {
    const entry = index.makes.get(key);
    if (!entry) continue;
    base.catalogMake ??= key; // make exists even if the model doesn't match
    const match = matchCatalogModels(input.model, Array.from(entry.models.keys()), key);
    if (match.models.length === 0) continue;
    const years = new Set<number>();
    for (const m of match.models) for (const y of entry.models.get(m)?.years ?? []) years.add(y);
    return { ...base, catalogMake: key, catalogModels: match.models, matchHow: match.how, catalogYears: Array.from(years).sort((a, b) => a - b) };
  }
  return base;
}

export interface MakeOption { value: string; label: string }
export interface ModelOption { value: string; label: string; years: [number, number] }

export function listMakes(index: CatalogIndex): MakeOption[] {
  return Array.from(index.makes.values())
    .filter((m) => m.models.size > 0)
    .map((m) => ({ value: m.makeNorm, label: m.display }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function listModels(index: CatalogIndex, makeNorm: string): ModelOption[] {
  const entry = index.makes.get(makeNorm.toUpperCase());
  if (!entry) return [];
  return Array.from(entry.models.entries())
    .filter(([upper]) => upper !== entry.makeNorm)
    .map(([upper, md]) => {
      const ys = Array.from(md.years);
      return { value: upper, label: md.display, years: [Math.min(...ys), Math.max(...ys)] as [number, number] };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
