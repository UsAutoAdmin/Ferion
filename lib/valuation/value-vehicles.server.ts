import "server-only";

import { getCatalogIndex, resolveVehicle, type ResolvedVehicle } from "@/lib/vehicles/catalog-index.server";
import type { VehicleInput } from "@/lib/vehicles/normalize";
import { displayModel } from "@/lib/vehicles/normalize";
import { expandGenerations } from "./generations.server";
import { loadObservations, observationsFor } from "./market-data.server";
import { valueParts } from "./parts";
import { getCatMarketOverrides, getScrapPrices, getVehicleProfiles, profileKey } from "./profile.server";
import { computeScrapValuation } from "./scrap";
import type { VehicleValuation } from "./types";

/**
 * Orchestrates a full valuation for N vehicles with batched I/O:
 * resolve → (generations ‖ profiles ‖ scrap prices ‖ cat overrides) →
 * market observations → pure math per vehicle.
 */

export interface ValuationRequest extends VehicleInput {
  lot?: string | null;
  vin?: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function warningsFor(v: ResolvedVehicle, genSource: string, verifiedAvailable: boolean, observationCount: number): string[] {
  const w: string[] = [];
  if (!v.catalogMake) w.push(`No catalog coverage for make "${v.make}".`);
  else if (!v.catalogModels.length) w.push(`Model "${v.model}" not found in the ${v.make} catalog.`);
  else if (observationCount === 0) w.push("Catalog has no part data near this model year.");
  if (v.matchHow === "token") w.push(`Matched catalog model by a secondary token (${v.catalogModels.join(", ")}).`);
  if (genSource === "none") w.push("Generation unknown — only exact and ±3 year data used.");
  if (!verifiedAvailable) w.push("Verified eBay valuations unavailable (no service-role key); using catalog sell-through prices.");
  return w;
}

export async function valueVehicles(requests: readonly ValuationRequest[]): Promise<VehicleValuation[]> {
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
    const req = requests[i];
    const gen = generations[i];
    const profile = { ...profiles[i] };
    const catOverride = catOverrides.get(profileKey(v.year, v.make, v.model));
    if (catOverride !== undefined && profile.catalyticConverterCount) {
      profile.catalyticConverterValueUsd = catOverride * profile.catalyticConverterCount;
    }
    const scrap = computeScrapValuation(profile, scrapPrices);
    const observations = observationsFor(market.index, v);
    const parts = valueParts({ year: v.year, generationYears: gen.years }, observations);
    return {
      input: { year: req.year, make: req.make, model: req.model, lot: req.lot ?? null, vin: req.vin ?? null },
      resolved: {
        make: v.make,
        catalogMake: v.catalogMake,
        catalogModels: v.catalogModels.map(displayModel),
        matchHow: v.matchHow,
        generationYears: gen.years,
      },
      scrap,
      parts,
      totalExpectedUsd: round2(scrap.totalValueUsd + parts.expectedValue),
      totalGrossUsd: round2(scrap.totalValueUsd + parts.grossValue),
      warnings: warningsFor(v, gen.source, market.verifiedAvailable, observations.length),
    };
  });
}
