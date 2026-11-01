import "server-only";

import { getLiveMarket } from "@/lib/ebay/market.server";
import type { LiveMarket } from "@/lib/ebay/aggregate";
import { oxylabsAvailable } from "@/lib/oxylabs/client.server";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import type { MarketObservation, VehicleValuation } from "./types";
import { buildValuation, prepareVehicles, type ValuationRequest } from "./value-vehicles.server";
import { liveMarketForClient, liveToObservation, pickTypesToVerify } from "./verify";

/**
 * Live eBay pass for one vehicle: value from the catalog, pick the part
 * types worth checking, hit eBay for each, then rebuild the report with
 * the live readings merged in.
 */

const DEFAULT_TOP_N = Number(process.env.EBAY_VERIFY_TOP_N ?? 12);
const CONCURRENCY = 8;
const STALE_WARNING_PREFIX = "Cached eBay valuations unavailable";

export function liveVerificationAvailable(): boolean {
  return oxylabsAvailable();
}

export async function verifyVehicle(req: ValuationRequest, topN = DEFAULT_TOP_N): Promise<VehicleValuation> {
  const started = Date.now();
  const [ctx] = await prepareVehicles([req]);
  const base = buildValuation(ctx);
  const typeKeys = pickTypesToVerify(base, topN);
  const vehicle = { year: ctx.resolved.year, make: ctx.resolved.make, model: req.model, generationYears: ctx.generationYears };

  const errors: string[] = [];
  const markets = await mapWithConcurrency(typeKeys, CONCURRENCY, async (typeKey) => {
    try {
      return await getLiveMarket({ ...vehicle, typeKey });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      return null;
    }
  });
  const checked = markets.filter((m): m is LiveMarket => m !== null);
  const liveModel = ctx.resolved.catalogModels[0] ?? req.model;
  const liveObs = checked.map((m) => liveToObservation(m, ctx.resolved.year, liveModel)).filter((o): o is MarketObservation => o !== null);

  const result = buildValuation(ctx, liveObs);
  const byType = new Map(checked.map((m) => [m.typeKey, liveMarketForClient(m)]));
  for (const p of result.parts.parts) p.live = byType.get(p.typeKey) ?? null;

  const soldSearchAvailable = checked.some((m) => m.soldAvailable);
  result.warnings = result.warnings.filter((w) => !w.startsWith(STALE_WARNING_PREFIX));
  if (checked.length && !soldSearchAvailable) {
    result.warnings.push("eBay blocks sold-listing search; live prices are asking × 0.8 and sell-through comes from the catalog.");
  }
  result.verification = {
    requested: typeKeys.length,
    checked: checked.length,
    priced: liveObs.length,
    soldSearchAvailable,
    durationMs: Date.now() - started,
    errors: errors.slice(0, 5),
  };
  return result;
}
