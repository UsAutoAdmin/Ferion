/**
 * Classified eBay listings → one live market reading for a part type.
 *
 *   soldN          accepted sold listings (90-day window on eBay's side)
 *   activeN        accepted active listings — current competition
 *   sellThrough    sold / (sold + active), as Part Scout computed it
 *   price          median accepted SOLD price when ≥ MIN_SOLD sales;
 *                  otherwise asking median × ASK_TO_SOLD_RATIO (a listing
 *                  that hasn't sold is priced above what it will fetch)
 *
 * Prices outside [MIN_PRICE, type ceiling] are data errors. Pure.
 */

import { median, round2 } from "@/lib/valuation/parts";

export const MIN_SOLD_FOR_SOLD_PRICE = 3;
export const MIN_ACTIVE_FOR_ASKING_PRICE = 3;
export const ASK_TO_SOLD_RATIO = 0.8;
export const MIN_PRICE_USD = 5;

export interface ClassifiedListing {
  itemId: string;
  title: string;
  price: number | null;
  url: string;
  source: "sold" | "active";
  decision: "accept" | "reject" | "ambiguous";
  reason: string;
}

export type LivePriceBasis = "sold" | "asking" | "none";

export interface LiveMarket {
  typeKey: string;
  query: string;
  searchUrl: string;
  /** Total tiles eBay reported for the search, before relevance. */
  resultCount: number | null;
  soldN: number;
  activeN: number;
  /** Fraction 0..1; null when sold data was unavailable. */
  sellThrough: number | null;
  /** Whether a sold search was attempted and answered. */
  soldAvailable: boolean;
  price: number | null;
  priceBasis: LivePriceBasis;
  priceP25: number | null;
  priceP75: number | null;
  askingMedian: number | null;
  /** accepted / classified — how clean the search was. */
  relevance: number | null;
  rejectedN: number;
  /** Accepted listings, for the evidence drawer. */
  evidence: ClassifiedListing[];
  checkedAt: string;
}

export interface AggregateInput {
  typeKey: string;
  query: string;
  searchUrl: string;
  resultCount: number | null;
  maxPrice: number;
  listings: readonly ClassifiedListing[];
  soldAvailable: boolean;
  now?: Date;
}

function percentile(sorted: readonly number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function plausible(listings: readonly ClassifiedListing[], ceiling: number): number[] {
  return listings
    .map((l) => l.price)
    .filter((p): p is number => p !== null && Number.isFinite(p) && p >= MIN_PRICE_USD && p <= ceiling)
    .sort((a, b) => a - b);
}

export function aggregateLiveMarket(input: AggregateInput): LiveMarket {
  const classified = input.listings.filter((l) => l.decision !== "ambiguous");
  const accepted = input.listings.filter((l) => l.decision === "accept");
  const sold = accepted.filter((l) => l.source === "sold");
  const active = accepted.filter((l) => l.source === "active");
  const soldPrices = plausible(sold, input.maxPrice);
  const activePrices = plausible(active, input.maxPrice);
  const soldN = sold.length, activeN = active.length;

  const base = {
    typeKey: input.typeKey,
    query: input.query,
    searchUrl: input.searchUrl,
    resultCount: input.resultCount,
    soldN,
    activeN,
    sellThrough: input.soldAvailable && soldN + activeN > 0 ? round2(soldN / (soldN + activeN)) : null,
    soldAvailable: input.soldAvailable,
    askingMedian: activePrices.length ? round2(median(activePrices)) : null,
    relevance: classified.length ? round2(accepted.length / classified.length) : null,
    rejectedN: classified.length - accepted.length,
    evidence: accepted.slice(0, 40),
    checkedAt: (input.now ?? new Date()).toISOString(),
  };

  if (soldPrices.length >= MIN_SOLD_FOR_SOLD_PRICE) {
    return { ...base, price: round2(median(soldPrices)), priceBasis: "sold", priceP25: round2(percentile(soldPrices, 0.25) as number), priceP75: round2(percentile(soldPrices, 0.75) as number) };
  }
  if (activePrices.length >= MIN_ACTIVE_FOR_ASKING_PRICE) {
    const r = ASK_TO_SOLD_RATIO;
    return { ...base, price: round2(median(activePrices) * r), priceBasis: "asking", priceP25: round2((percentile(activePrices, 0.25) as number) * r), priceP75: round2((percentile(activePrices, 0.75) as number) * r) };
  }
  return { ...base, price: null, priceBasis: "none", priceP25: null, priceP75: null };
}
