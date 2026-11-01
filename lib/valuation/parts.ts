/**
 * Pure parts valuation: turns market observations for a vehicle into a
 * per-type valuation with tiers, aggregation and exclusive groups.
 *
 * Tiering — for each type we use the closest data that exists:
 *   exact      observation covers the vehicle's model year
 *   generation observation overlaps the vehicle's generation years
 *   nearby     observation within ±NEARBY_YEARS
 * Price and sell-through are tiered independently (a 2016 may have a
 * verified price but only generation-level sell-through).
 *
 * Expected value = price × min(1, sell-through) × units per vehicle.
 * No I/O.
 */

import { PART_TYPES, type PartType } from "@/lib/catalog/part-types";
import type { MarketObservation, MatchTier, PartValuation, PartsValuation } from "./types";

export const NEARBY_YEARS = 3;
/** Assumed sell-through when no source reports one. */
export const DEFAULT_SELL_THROUGH = 0.4;
/** Below this many priced samples in a tier, the next tier is pooled in. */
export const MIN_PRICE_SAMPLES = 3;

const TIER_WEIGHT: Record<MatchTier, number> = { exact: 1, generation: 0.85, nearby: 0.6 };
const TIER_ORDER: MatchTier[] = ["exact", "generation", "nearby"];

export interface VehicleYears {
  year: number;
  /** Generation years including `year` (may be just [year]). */
  generationYears: readonly number[];
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function covers(o: MarketObservation, year: number): boolean {
  return o.yearStart <= year && year <= o.yearEnd;
}

export function tierOf(o: MarketObservation, v: VehicleYears): MatchTier | null {
  if (covers(o, v.year)) return "exact";
  if (v.generationYears.some((y) => covers(o, y))) return "generation";
  if (o.yearEnd >= v.year - NEARBY_YEARS && o.yearStart <= v.year + NEARBY_YEARS) return "nearby";
  return null;
}

function bestTier<T>(byTier: Map<MatchTier, T[]>): { tier: MatchTier; items: T[] } | null {
  for (const t of TIER_ORDER) {
    const items = byTier.get(t);
    if (items && items.length) return { tier: t, items };
  }
  return null;
}

/**
 * Exact-year rows, pooled with the generation's when there are too few
 * to trust (one $450 console lid shouldn't set the price). Nearby rows
 * are only used when exact and generation have nothing.
 */
function pooledTier<T>(byTier: Map<MatchTier, T[]>): { tier: MatchTier; items: T[] } | null {
  const exact = byTier.get("exact") ?? [];
  const generation = byTier.get("generation") ?? [];
  if (exact.length >= MIN_PRICE_SAMPLES) return { tier: "exact", items: exact };
  if (exact.length + generation.length > 0) {
    return { tier: generation.length ? "generation" : "exact", items: [...exact, ...generation] };
  }
  const nearby = byTier.get("nearby") ?? [];
  return nearby.length ? { tier: "nearby", items: nearby } : null;
}

function groupByTier(obs: readonly MarketObservation[], v: VehicleYears, keep: (o: MarketObservation) => boolean): Map<MatchTier, MarketObservation[]> {
  const map = new Map<MatchTier, MarketObservation[]>();
  for (const o of obs) {
    if (!keep(o)) continue;
    const t = tierOf(o, v);
    if (!t) continue;
    const list = map.get(t) ?? [];
    list.push(o);
    map.set(t, list);
  }
  return map;
}

interface PriceEstimate { price: number; tier: MatchTier; samples: number; verified: boolean; confidence: number; imageUrl: string | null }

/**
 * Price: within the best tier, verified observations win outright;
 * otherwise the median of catalog prices.
 */
function estimatePrice(obs: readonly MarketObservation[], v: VehicleYears): PriceEstimate | null {
  const best = pooledTier(groupByTier(obs, v, (o) => o.price !== null && o.price > 0));
  if (!best) return null;
  const verified = best.items.filter((o) => o.source === "verified");
  const pool = verified.length ? verified : best.items;
  const prices = pool.map((o) => o.price as number);
  const price = round2(median(prices));
  const srcConf = median(pool.map((o) => o.confidence));
  const countFactor = Math.min(1, 0.5 + pool.length * 0.25);
  const confidence = round2(TIER_WEIGHT[best.tier] * srcConf * countFactor);
  const imageUrl = pool.find((o) => o.imageUrl)?.imageUrl ?? best.items.find((o) => o.imageUrl)?.imageUrl ?? null;
  return { price, tier: best.tier, samples: pool.length, verified: verified.length > 0, confidence, imageUrl };
}

function sellThroughOf(o: MarketObservation): number | null {
  if (o.sellThroughPct !== null && Number.isFinite(o.sellThroughPct)) return o.sellThroughPct / 100;
  if (o.sold !== null && o.active !== null && o.sold + o.active > 0) return o.sold / (o.sold + o.active);
  return null;
}

/** Sell-through fraction (uncapped median) from the best tier that reports one. */
function estimateSellThrough(obs: readonly MarketObservation[], v: VehicleYears): { value: number; tier: MatchTier } | null {
  const best = bestTier(groupByTier(obs, v, (o) => sellThroughOf(o) !== null));
  if (!best) return null;
  return { value: median(best.items.map((o) => sellThroughOf(o) as number)), tier: best.tier };
}

function hasCloseData(obs: readonly MarketObservation[], v: VehicleYears): boolean {
  return obs.some((o) => { const t = tierOf(o, v); return t === "exact" || t === "generation"; });
}

function valueType(type: PartType, obs: readonly MarketObservation[], v: VehicleYears): PartValuation | null {
  if (type.conditional && !hasCloseData(obs, v)) return null;
  const price = estimatePrice(obs, v);
  if (!price) return null;
  const st = estimateSellThrough(obs, v);
  const sellThrough = Math.min(1, Math.max(0, st?.value ?? DEFAULT_SELL_THROUGH));
  const grossValue = round2(price.price * type.perVehicle);
  return {
    typeKey: type.key,
    label: type.label,
    category: type.category,
    perVehicle: type.perVehicle,
    unitPrice: price.price,
    sellThrough: round2(sellThrough),
    sellThroughAssumed: st === null,
    grossValue,
    expectedValue: round2(grossValue * sellThrough),
    priceTier: price.tier,
    sellThroughTier: st?.tier ?? null,
    priceSamples: price.samples,
    verified: price.verified,
    confidence: price.confidence,
    imageUrl: price.imageUrl,
    exclusiveGroup: type.exclusiveGroup ?? null,
    countedInTotal: true,
  };
}

/** Within each exclusive group only the highest expected value counts. */
function applyExclusiveGroups(parts: PartValuation[]): void {
  const bestByGroup = new Map<string, PartValuation>();
  for (const p of parts) {
    if (!p.exclusiveGroup) continue;
    const cur = bestByGroup.get(p.exclusiveGroup);
    if (!cur || p.expectedValue > cur.expectedValue) bestByGroup.set(p.exclusiveGroup, p);
  }
  for (const p of parts) {
    if (p.exclusiveGroup) p.countedInTotal = bestByGroup.get(p.exclusiveGroup) === p;
  }
}

export function groupObservationsByType(obs: readonly MarketObservation[]): Map<string, MarketObservation[]> {
  const map = new Map<string, MarketObservation[]>();
  for (const o of obs) {
    const list = map.get(o.typeKey) ?? [];
    list.push(o);
    map.set(o.typeKey, list);
  }
  return map;
}

export function valueParts(v: VehicleYears, observations: readonly MarketObservation[], types: readonly PartType[] = PART_TYPES): PartsValuation {
  const byType = groupObservationsByType(observations);
  const parts: PartValuation[] = [];
  const noData: PartsValuation["noData"] = [];
  for (const type of types) {
    const valued = valueType(type, byType.get(type.key) ?? [], v);
    if (valued) parts.push(valued);
    else if (!type.conditional) noData.push({ typeKey: type.key, label: type.label, category: type.category });
  }
  applyExclusiveGroups(parts);
  parts.sort((a, b) => b.expectedValue - a.expectedValue);
  const counted = parts.filter((p) => p.countedInTotal);
  return {
    parts,
    noData,
    grossValue: round2(counted.reduce((s, p) => s + p.grossValue, 0)),
    expectedValue: round2(counted.reduce((s, p) => s + p.expectedValue, 0)),
    coveredTypes: counted.length,
    totalTypes: types.filter((t) => !t.conditional).length,
  };
}
