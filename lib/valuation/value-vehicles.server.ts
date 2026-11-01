import "server-only";

import { getCatalogIndex, resolveVehicle, type ResolvedVehicle } from "@/lib/vehicles/catalog-index.server";
import type { VehicleInput } from "@/lib/vehicles/normalize";
import { displayModel } from "@/lib/vehicles/normalize";
import { expandGenerations } from "./generations.server";
import { loadObservations, observationsFor } from "./market-data.server";
import { valueParts } from "./parts";
import { getCatMarketOverrides, getScrapPrices, getVehicleProfiles, profileKey } from "./profile.server";
import { computeScrapValuation } from "./scrap";
import type { MarketObservation, ScrapPriceMap, VehicleProfile, VehicleValuation } from "./types";

/**
 * Orchestrates a full valuation for N vehicles with batched I/O:
 * resolve → (generations ‖ profiles ‖ scrap prices ‖ cat overrides) →
 * market observations → pure math per vehicle.
 *
 * Split into `prepareVehicles` (all I/O) and `buildValuation` (pure) so
 * the live eBay pass can recompute a vehicle with extra observations
 * without re-querying the catalog.
 */

export interface ValuationRequest extends VehicleInput {
  lot?: string | null;
  vin?: string | null;
}

export interface VehicleContext {
  req: ValuationRequest;
  resolved: ResolvedVehicle;
  generationYears: number[];
  generationSource: string;
  profile: VehicleProfile;
  scrapPrices: ScrapPriceMap;
  observations: MarketObservation[];
  verifiedAvailable: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function warningsFor(ctx: VehicleContext): string[] {
  const v = ctx.resolved;
  const w: string[] = [];
  if (!v.catalogMake) w.push(`No catalog coverage for make "${v.make}".`);
  else if (!v.catalogModels.length) w.push(`Model "${v.model}" not found in the ${v.make} catalog.`);
  else if (ctx.observations.length === 0) w.push("Catalog has no part data near this model year.");
  if (v.matchHow === "token") w.push(`Matched catalog model by a secondary token (${v.catalogModels.join(", ")}).`);
  if (ctx.generationSource === "none") w.push("Generation unknown — only exact and ±3 year data used.");
  if (!ctx.verifiedAvailable) w.push("Cached eBay valuations unavailable (no service-role key); catalog prices until live check runs.");
  return w;
}

export async function prepareVehicles(requests: readonly ValuationRequest[]): Promise<VehicleContext[]> {
  if (!requests.length) return [];
  const index = await getCatalogIndex();
  const resolved = requests.map((r) => resolveVehicle(index, r));
  const profileReqs = resolved.map((v) => ({ year: v.year, make: v.make, model: v.model }));
  const [generations, profiles, scrapPrices, catOverrides, market] = await Promise.all([
    expandGenerations(resolved.map((v) => ({ year: v.year, make: v.make, model: v.model, catalogMake: v.catalogMake, catalogModels: v.catalogModels }))),
    getVehicleProfiles(profileReqs),
    getScrapPrices(),
    getCatMarketOverrides(profileReqs),
    loadObservations(resolved),
  ]);

  return resolved.map((v, i) => {
    const profile = { ...profiles[i] };
    const catOverride = catOverrides.get(profileKey(v.year, v.make, v.model));
    if (catOverride !== undefined && profile.catalyticConverterCount) {
      profile.catalyticConverterValueUsd = catOverride * profile.catalyticConverterCount;
    }
    return {
      req: requests[i],
      resolved: v,
      generationYears: generations[i].years,
      generationSource: generations[i].source,
      profile,
      scrapPrices,
      observations: observationsFor(market.index, v),
      verifiedAvailable: market.verifiedAvailable,
    };
  });
}

/** Pure: context (+ optional live observations) → report. */
export function buildValuation(ctx: VehicleContext, extraObservations: readonly MarketObservation[] = []): VehicleValuation {
  const { req, resolved: v } = ctx;
  const scrap = computeScrapValuation(ctx.profile, ctx.scrapPrices);
  const parts = valueParts({ year: v.year, generationYears: ctx.generationYears }, [...ctx.observations, ...extraObservations]);
  return {
    input: { year: req.year, make: req.make, model: req.model, lot: req.lot ?? null, vin: req.vin ?? null },
    resolved: {
      make: v.make,
      catalogMake: v.catalogMake,
      catalogModels: v.catalogModels.map(displayModel),
      matchHow: v.matchHow,
      generationYears: ctx.generationYears,
    },
    scrap,
    parts,
    totalExpectedUsd: round2(scrap.totalValueUsd + parts.expectedValue),
    totalGrossUsd: round2(scrap.totalValueUsd + parts.grossValue),
    warnings: warningsFor(ctx),
  };
}

export async function valueVehicles(requests: readonly ValuationRequest[]): Promise<VehicleValuation[]> {
  const contexts = await prepareVehicles(requests);
  return contexts.map((ctx) => buildValuation(ctx));
}
