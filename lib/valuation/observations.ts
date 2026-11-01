/**
 * Adapters from raw Content Machine rows to `MarketObservation`s.
 * Pure — the fetching lives in `market-data.server.ts`.
 */

import { partType, partTypeOf } from "@/lib/catalog/part-types";
import type { MarketObservation } from "./types";

export interface CatalogPartRow {
  year: number | string | null;
  make: string | null;
  model: string | null;
  part_name: string | null;
  sell_through: number | string | null;
  active: number | string | null;
  sold: number | string | null;
  avg_sell_price: number | string | null;
  median_sell_price: number | string | null;
  sold_volume: number | string | null;
  best_image_url: string | null;
}

export interface VerifiedValuationRow {
  make: string | null;
  model: string | null;
  year_start: number | string | null;
  year_end: number | string | null;
  canonical_type: string | null;
  market_price_usd: number | string | null;
  sold_n_90d: number | string | null;
  active_n: number | string | null;
  sell_through_90d: number | string | null;
  confidence: number | string | null;
  status: string | null;
}

export function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Catalog names are sometimes URL-encoded ("A%2Fc Hose"). */
export function decodePartName(name: string): string {
  try { return decodeURIComponent(name); } catch { return name; }
}

/** Positive price within the type's plausibility ceiling, else null. */
export function sanePrice(typeKey: string, price: number | null): number | null {
  if (price === null || price <= 0) return null;
  const cap = partType(typeKey)?.maxPrice;
  return cap !== undefined && price > cap ? null : price;
}

/**
 * Catalog sell-through rows are per model-year. Rows with no price still
 * contribute sell-through. Rows that don't fold onto a Ferion type are
 * dropped.
 */
export function catalogRowToObservation(row: CatalogPartRow): MarketObservation | null {
  const year = num(row.year);
  if (year === null || !row.part_name) return null;
  const name = decodePartName(row.part_name);
  const typeKey = partTypeOf(name);
  if (!typeKey) return null;
  const price = sanePrice(typeKey, num(row.median_sell_price) ?? num(row.avg_sell_price));
  const soldVolume = num(row.sold_volume);
  // A price backed by more sales is more trustworthy; 5+ sales ≈ full weight.
  const confidence = price === null ? 0 : Math.min(0.9, 0.5 + (soldVolume ?? 1) * 0.08);
  return {
    typeKey,
    yearStart: year,
    yearEnd: year,
    model: (row.model ?? "").toUpperCase(),
    price,
    sellThroughPct: num(row.sell_through),
    sold: num(row.sold),
    active: num(row.active),
    source: "catalog",
    confidence,
    imageUrl: row.best_image_url || null,
    sourceName: name,
  };
}

/** Only verified rows with a price are used; they carry 90-day eBay stats. */
export function verifiedRowToObservation(row: VerifiedValuationRow): MarketObservation | null {
  if (row.status !== "verified" || !row.canonical_type) return null;
  const yearStart = num(row.year_start);
  const yearEnd = num(row.year_end) ?? yearStart;
  if (yearStart === null || yearEnd === null) return null;
  const typeKey = partTypeOf(row.canonical_type);
  if (!typeKey) return null;
  const price = sanePrice(typeKey, num(row.market_price_usd));
  if (price === null) return null;
  return {
    typeKey,
    yearStart,
    yearEnd,
    model: (row.model ?? "").toUpperCase(),
    price,
    sellThroughPct: num(row.sell_through_90d),
    sold: num(row.sold_n_90d),
    active: num(row.active_n),
    source: "verified",
    confidence: Math.max(0.5, Math.min(1, num(row.confidence) ?? 0.7)),
    imageUrl: null,
    sourceName: row.canonical_type,
  };
}
