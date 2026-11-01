import "server-only";

import { partType } from "@/lib/catalog/part-types";
import { callLlmForJson, parseJsonLoose } from "@/lib/llm/json.server";
import { getAvailableLlmProvider } from "@/lib/llm/provider.server";
import { logger } from "@/lib/logger";
import { oxylabsScrape } from "@/lib/oxylabs/client.server";
import { aggregateLiveMarket, type ClassifiedListing, type LiveMarket } from "./aggregate";
import { buildEbayQuery, ebaySearchUrl, type EbayVehicle } from "./query";
import { classifyListing, type Decision } from "./relevance";
import { isChallengePage, parseEbaySrp, type EbayListing } from "./srp-parser";

/**
 * Live eBay market for one vehicle × part type via Oxylabs:
 * active search (always) + sold search (when enabled and not currently
 * blocked) → relevance gate → aggregate. Results cache in-process for a
 * day; a blocked sold search trips a one-hour breaker so we don't burn
 * 60 s of upstream retries per part.
 */

export interface LiveMarketRequest extends EbayVehicle {
  generationYears: readonly number[];
  typeKey: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SOLD_BREAKER_MS = 60 * 60 * 1000;
const cache = new Map<string, { market: LiveMarket; expires: number }>();
let soldBlockedUntil = 0;

export function soldSearchEnabled(): boolean {
  return process.env.EBAY_SOLD_SEARCH === "1" && Date.now() >= soldBlockedUntil;
}

function cacheKey(r: LiveMarketRequest): string {
  return `${r.year}|${r.make.toUpperCase()}|${r.model.toUpperCase()}|${r.typeKey}`;
}

async function fetchListings(query: string, sold: boolean): Promise<{ listings: EbayListing[]; resultCount: number | null; ok: boolean }> {
  const url = ebaySearchUrl(query, { sold });
  try {
    const res = await oxylabsScrape({ source: "ebay", url, geo_location: "United States" });
    if (res.blocked || isChallengePage(res.content)) return { listings: [], resultCount: null, ok: false };
    const srp = parseEbaySrp(res.content);
    return { ...srp, ok: true };
  } catch (err) {
    logger.warn("ebay.fetch_failed", { query, sold, error: err instanceof Error ? err.message : String(err) });
    return { listings: [], resultCount: null, ok: false };
  }
}

interface Pending { listing: EbayListing; source: "sold" | "active"; decision: Decision; reason: string }

/** One batched LLM call for titles the gate could not decide. Falls back to accept. */
async function resolveAmbiguous(items: Pending[], r: LiveMarketRequest): Promise<void> {
  if (!items.length) return;
  const provider = getAvailableLlmProvider();
  if (!provider) { items.forEach((p) => { p.decision = "accept"; p.reason = `${p.reason}:assumed`; }); return; }
  const label = partType(r.typeKey)?.label ?? r.typeKey;
  const prompt = `You classify eBay listing titles. Vehicle: ${r.year} ${r.make} ${r.model} (interchange years ${Math.min(...r.generationYears)}-${Math.max(...r.generationYears)}). Part: ${label}.
For each title answer whether it is a used OEM "${label}" that fits this vehicle (not aftermarket, not a sub-component, not a different part).
Return JSON {"decisions":[{"i":0,"accept":true}, ...]} covering every index.
Titles:
${items.map((p, i) => `${i}: ${p.listing.title}`).join("\n")}`;
  try {
    const raw = await callLlmForJson(prompt, provider, 1200);
    const parsed = parseJsonLoose<{ decisions?: Array<{ i: number; accept: boolean }> }>(raw);
    const byIdx = new Map((parsed.decisions ?? []).map((d) => [d.i, d.accept]));
    items.forEach((p, i) => {
      const a = byIdx.get(i);
      p.decision = a === false ? "reject" : "accept";
      p.reason = a === undefined ? `${p.reason}:assumed` : `llm_${p.decision}`;
    });
  } catch (err) {
    logger.warn("ebay.llm_classify_failed", { error: err instanceof Error ? err.message : String(err) });
    items.forEach((p) => { p.decision = "accept"; p.reason = `${p.reason}:assumed`; });
  }
}

export async function getLiveMarket(r: LiveMarketRequest): Promise<LiveMarket> {
  const key = cacheKey(r);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.market;

  const query = buildEbayQuery(r, r.typeKey);
  const trySold = soldSearchEnabled();
  const [active, sold] = await Promise.all([
    fetchListings(query, false),
    trySold ? fetchListings(query, true) : Promise.resolve({ listings: [], resultCount: null, ok: false }),
  ]);
  if (trySold && !sold.ok) {
    soldBlockedUntil = Date.now() + SOLD_BREAKER_MS;
    logger.warn("ebay.sold_search_blocked", { until: new Date(soldBlockedUntil).toISOString() });
  }
  if (!active.ok) throw new Error(`eBay search unavailable for "${query}".`);

  const pending: Pending[] = [
    ...active.listings.map((l) => ({ listing: l, source: "active" as const })),
    ...sold.listings.map((l) => ({ listing: l, source: "sold" as const })),
  ].map((p) => {
    const c = classifyListing({ title: p.listing.title, fitsNote: p.listing.fitsNote, make: r.make, model: r.model, year: r.year, generationYears: r.generationYears, typeKey: r.typeKey });
    return { ...p, decision: c.decision, reason: c.reason };
  });
  await resolveAmbiguous(pending.filter((p) => p.decision === "ambiguous"), r);

  const listings: ClassifiedListing[] = pending.map((p) => ({
    itemId: p.listing.itemId, title: p.listing.title, price: p.listing.price, url: p.listing.url, source: p.source, decision: p.decision, reason: p.reason,
  }));
  const market = aggregateLiveMarket({
    typeKey: r.typeKey,
    query,
    searchUrl: ebaySearchUrl(query, { sold: false }),
    resultCount: active.resultCount,
    maxPrice: partType(r.typeKey)?.maxPrice ?? 2000,
    listings,
    soldAvailable: sold.ok,
  });
  cache.set(key, { market, expires: Date.now() + CACHE_TTL_MS });
  logger.info("ebay.live_market", { key, activeN: market.activeN, soldN: market.soldN, price: market.price, basis: market.priceBasis, relevance: market.relevance });
  return market;
}
