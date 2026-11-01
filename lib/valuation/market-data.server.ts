import "server-only";

import { getSupabase, hasServiceRole } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import type { ResolvedVehicle } from "@/lib/vehicles/catalog-index.server";
import { catalogRowToObservation, verifiedRowToObservation, type CatalogPartRow, type VerifiedValuationRow } from "./observations";
import { NEARBY_YEARS } from "./parts";
import type { MarketObservation } from "./types";

/**
 * Fetches market observations for a batch of resolved vehicles, one
 * query group per catalog (make, model-set), covering every requested
 * year ± the widest lookback we might need. Results are keyed by
 * catalog make so vehicles sharing a model reuse the same rows.
 */

const PAGE = 1000;
const GROUP_CONCURRENCY = 6;
/** Generation spans rarely exceed this; bounds the year window we pull. */
const MAX_GENERATION_SPAN = 8;

interface Group { catalogMake: string; models: string[]; minYear: number; maxYear: number }

export type ObservationIndex = Map<string, MarketObservation[]>;

export const groupKey = (catalogMake: string, model: string): string => `${catalogMake}|${model.toUpperCase()}`;

function buildGroups(vehicles: readonly ResolvedVehicle[]): Group[] {
  const byMake = new Map<string, Group>();
  for (const v of vehicles) {
    if (!v.catalogMake || !v.catalogModels.length) continue;
    const g = byMake.get(v.catalogMake) ?? { catalogMake: v.catalogMake, models: [], minYear: v.year, maxYear: v.year };
    for (const m of v.catalogModels) if (!g.models.includes(m)) g.models.push(m);
    g.minYear = Math.min(g.minYear, v.year);
    g.maxYear = Math.max(g.maxYear, v.year);
    byMake.set(v.catalogMake, g);
  }
  return Array.from(byMake.values());
}

function orFilter(column: string, values: readonly string[]): string {
  return values.map((m) => `${column}.ilike.${m.replace(/[^A-Za-z0-9 -]/g, "")}`).join(",");
}

async function fetchCatalogRows(g: Group): Promise<CatalogPartRow[]> {
  const sb = getSupabase();
  const rows: CatalogPartRow[] = [];
  const pad = Math.max(NEARBY_YEARS, MAX_GENERATION_SPAN);
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("catalog_parts")
      .select("year, make, model, part_name, sell_through, active, sold, avg_sell_price, median_sell_price, sold_volume, best_image_url")
      .ilike("make", g.catalogMake)
      .or(orFilter("model", g.models))
      .gte("year", g.minYear - pad).lte("year", g.maxYear + pad)
      .order("year").order("part_name")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`catalog_parts: ${error.message}`);
    rows.push(...((data ?? []) as CatalogPartRow[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function fetchVerifiedRows(g: Group): Promise<VerifiedValuationRow[]> {
  const sb = getSupabase();
  const rows: VerifiedValuationRow[] = [];
  const pad = Math.max(NEARBY_YEARS, MAX_GENERATION_SPAN);
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("part_valuations")
      .select("make, model, year_start, year_end, canonical_type, market_price_usd, sold_n_90d, active_n, sell_through_90d, confidence, status")
      .ilike("make", g.catalogMake)
      .or(orFilter("model", g.models))
      .eq("status", "verified")
      .lte("year_start", g.maxYear + pad).gte("year_end", g.minYear - pad)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`part_valuations: ${error.message}`);
    rows.push(...((data ?? []) as VerifiedValuationRow[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Load observations for all vehicles; index key = `${catalogMake}|${MODEL}`. */
export async function loadObservations(vehicles: readonly ResolvedVehicle[]): Promise<{ index: ObservationIndex; verifiedAvailable: boolean }> {
  const groups = buildGroups(vehicles);
  const index: ObservationIndex = new Map();
  const verifiedAvailable = hasServiceRole();

  await mapWithConcurrency(groups, GROUP_CONCURRENCY, async (g) => {
    const [catalogRows, verifiedRows] = await Promise.all([
      fetchCatalogRows(g).catch((e) => { logger.warn("catalog fetch failed", { make: g.catalogMake, error: String(e) }); return [] as CatalogPartRow[]; }),
      verifiedAvailable
        ? fetchVerifiedRows(g).catch((e) => { logger.warn("verified fetch failed", { make: g.catalogMake, error: String(e) }); return [] as VerifiedValuationRow[]; })
        : Promise.resolve([] as VerifiedValuationRow[]),
    ]);
    const push = (o: MarketObservation | null) => {
      if (!o) return;
      const k = groupKey(g.catalogMake, o.model);
      const list = index.get(k) ?? [];
      list.push(o);
      index.set(k, list);
    };
    for (const r of catalogRows) push(catalogRowToObservation(r));
    for (const r of verifiedRows) push(verifiedRowToObservation(r));
  });

  return { index, verifiedAvailable };
}

/** Observations for one vehicle across all of its matched catalog models. */
export function observationsFor(index: ObservationIndex, v: ResolvedVehicle): MarketObservation[] {
  if (!v.catalogMake) return [];
  return v.catalogModels.flatMap((m) => index.get(groupKey(v.catalogMake as string, m)) ?? []);
}
