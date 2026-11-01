/**
 * Pure helpers for the live eBay verification pass: which types to check
 * and how a live reading becomes a market observation. No I/O.
 */

import { PART_TYPES } from "@/lib/catalog/part-types";
import type { LiveMarket } from "@/lib/ebay/aggregate";
import type { LivePartMarket, MarketObservation, VehicleValuation } from "./types";

export const LIVE_EVIDENCE_ROWS = 10;

/** Top-N counted parts by expected value, padded with tracked types that had no catalog data. */
export function pickTypesToVerify(v: VehicleValuation, topN: number): string[] {
  const fromParts = v.parts.parts.filter((p) => p.countedInTotal).slice(0, topN).map((p) => p.typeKey);
  const room = Math.max(0, topN - fromParts.length);
  const noData = v.parts.noData
    .filter((n) => !PART_TYPES.find((t) => t.key === n.typeKey)?.conditional)
    .slice(0, room)
    .map((n) => n.typeKey);
  return [...fromParts, ...noData];
}

/**
 * Live reading → exact-year "verified" observation, which wins the price
 * tier outright. Sell-through / counts are only carried when the sold
 * search answered; otherwise the catalog's sell-through stays in force.
 */
export function liveToObservation(m: LiveMarket, year: number, model: string): MarketObservation | null {
  if (m.price === null) return null;
  const countFactor = Math.min(1, 0.5 + (m.soldN + m.activeN) * 0.05);
  const basisFactor = m.priceBasis === "sold" ? 1 : 0.8;
  return {
    typeKey: m.typeKey,
    yearStart: year,
    yearEnd: year,
    model: model.toUpperCase(),
    price: m.price,
    sellThroughPct: m.sellThrough === null ? null : Math.round(m.sellThrough * 100),
    sold: m.soldAvailable ? m.soldN : null,
    active: m.soldAvailable ? m.activeN : null,
    source: "verified",
    confidence: Math.round((m.relevance ?? 0.7) * countFactor * basisFactor * 100) / 100,
    imageUrl: null,
    sourceName: `ebay live: ${m.query}`,
  };
}

export function liveMarketForClient(m: LiveMarket): LivePartMarket {
  return {
    query: m.query,
    searchUrl: m.searchUrl,
    resultCount: m.resultCount,
    soldN: m.soldN,
    activeN: m.activeN,
    sellThrough: m.sellThrough,
    soldAvailable: m.soldAvailable,
    price: m.price,
    priceBasis: m.priceBasis,
    askingMedian: m.askingMedian,
    relevance: m.relevance,
    evidence: m.evidence.slice(0, LIVE_EVIDENCE_ROWS).map((e) => ({ itemId: e.itemId, title: e.title, price: e.price, url: e.url, source: e.source })),
    checkedAt: m.checkedAt,
  };
}
