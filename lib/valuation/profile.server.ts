import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { callLlmForJson, parseJsonLoose } from "@/lib/llm/json.server";
import { getAvailableLlmProvider } from "@/lib/llm/provider.server";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { buildProfilePrompt, DEFAULT_SCRAP_PRICES, heuristicProfile, parseProfilePayload, toPriceMap } from "./scrap";
import type { ScrapPriceMap, VehicleProfile } from "./types";

/**
 * Vehicle material profiles for scrap valuation, resolved in batch:
 *   1. `enterprise_vehicle_profiles` cache (manual rows always win)
 *   2. LLM (concurrency-limited), result cached
 *   3. class heuristic (low confidence, not cached)
 */

const LLM_MAX_TOKENS = 600;
const LLM_CONCURRENCY = 5;
const norm = (s: string) => s.trim().toUpperCase();
const keyOf = (y: number, mk: string, md: string) => `${y}|${norm(mk)}|${norm(md)}`;

interface ProfileRow {
  make: string; model: string; year: number;
  curb_weight_lbs: number | null; engine_name: string | null; engine_block_material: "aluminum" | "iron" | "unknown";
  engine_weight_lbs: number | null; wheel_material: "aluminum" | "steel" | "unknown"; wheels_weight_lbs: number | null;
  copper_lbs: number | null; catalytic_converter_count: number | null; catalytic_converter_value_usd: number | string | null;
  confidence: number | string | null; source: string;
}

export interface ProfileRequest { year: number; make: string; model: string }

function rowToProfile(req: ProfileRequest, r: ProfileRow): VehicleProfile {
  return {
    year: req.year, make: req.make, model: req.model,
    curbWeightLbs: r.curb_weight_lbs, engineName: r.engine_name, engineBlockMaterial: r.engine_block_material ?? "unknown",
    engineWeightLbs: r.engine_weight_lbs, wheelMaterial: r.wheel_material ?? "unknown", wheelsWeightLbs: r.wheels_weight_lbs,
    copperLbs: r.copper_lbs, catalyticConverterCount: r.catalytic_converter_count,
    catalyticConverterValueUsd: r.catalytic_converter_value_usd === null ? null : Number(r.catalytic_converter_value_usd),
    confidence: r.confidence === null ? null : Number(r.confidence), source: "cache",
  };
}

async function readCache(reqs: readonly ProfileRequest[]): Promise<Map<string, ProfileRow>> {
  const out = new Map<string, ProfileRow>();
  const makes = Array.from(new Set(reqs.map((r) => norm(r.make))));
  const years = Array.from(new Set(reqs.map((r) => r.year)));
  if (!makes.length) return out;
  const { data, error } = await getSupabase()
    .from("enterprise_vehicle_profiles")
    .select("make, model, year, curb_weight_lbs, engine_name, engine_block_material, engine_weight_lbs, wheel_material, wheels_weight_lbs, copper_lbs, catalytic_converter_count, catalytic_converter_value_usd, confidence, source")
    .in("make", makes).in("year", years).limit(5000);
  if (error) { logger.warn("profile cache read failed", { error: error.message }); return out; }
  for (const r of (data ?? []) as ProfileRow[]) out.set(keyOf(r.year, r.make, r.model), r);
  return out;
}

async function resolveViaLlm(req: ProfileRequest, provider: "openai" | "anthropic"): Promise<VehicleProfile | null> {
  try {
    const text = await callLlmForJson(buildProfilePrompt(req.year, req.make, req.model), provider, LLM_MAX_TOKENS);
    const answer = parseProfilePayload(parseJsonLoose(text));
    if (answer.curbWeightLbs === null && answer.confidence !== null && answer.confidence <= 0) return null;
    const { error } = await getSupabase().from("enterprise_vehicle_profiles").upsert({
      make: norm(req.make), model: norm(req.model), year: req.year,
      curb_weight_lbs: answer.curbWeightLbs, engine_name: answer.engineName, engine_block_material: answer.engineBlockMaterial,
      engine_weight_lbs: answer.engineWeightLbs, wheel_material: answer.wheelMaterial, wheels_weight_lbs: answer.wheelsWeightLbs,
      copper_lbs: answer.copperLbs, catalytic_converter_count: answer.catalyticConverterCount,
      catalytic_converter_value_usd: answer.catalyticConverterValueUsd, confidence: answer.confidence, source: "llm",
    }, { onConflict: "make,model,year" });
    if (error) logger.warn("profile cache upsert failed", { error: error.message });
    return { ...answer, year: req.year, make: req.make, model: req.model, source: "llm" };
  } catch (err) {
    logger.warn("profile LLM lookup failed", { vehicle: `${req.year} ${req.make} ${req.model}`, error: String(err) });
    return null;
  }
}

/** Resolve profiles for many vehicles; result is keyed like the input order. */
export async function getVehicleProfiles(reqs: readonly ProfileRequest[]): Promise<VehicleProfile[]> {
  const unique = new Map<string, ProfileRequest>();
  for (const r of reqs) unique.set(keyOf(r.year, r.make, r.model), r);
  const cache = await readCache(Array.from(unique.values()));
  const resolved = new Map<string, VehicleProfile>();
  const misses: Array<[string, ProfileRequest]> = [];
  for (const [k, r] of unique) {
    const row = cache.get(k);
    if (row) resolved.set(k, rowToProfile(r, row));
    else misses.push([k, r]);
  }
  const provider = getAvailableLlmProvider();
  if (provider && misses.length) {
    const fromLlm = await mapWithConcurrency(misses, LLM_CONCURRENCY, ([, r]) => resolveViaLlm(r, provider));
    fromLlm.forEach((p, i) => { if (p) resolved.set(misses[i][0], p); });
  }
  return reqs.map((r) => resolved.get(keyOf(r.year, r.make, r.model)) ?? heuristicProfile(r.year, r.make, r.model));
}

export async function getScrapPrices(): Promise<ScrapPriceMap> {
  const { data, error } = await getSupabase().from("enterprise_scrap_prices").select("material, price_per_lb");
  if (error || !data?.length) {
    if (error) logger.warn("scrap price read failed", { error: error.message });
    return { ...DEFAULT_SCRAP_PRICES };
  }
  return { ...DEFAULT_SCRAP_PRICES, ...toPriceMap(data) };
}

interface CatRow { make: string; model: string; year: number; found: boolean; ranges: Array<{ type: string; min_usd: number; max_usd: number }> | null }

/**
 * Cached catalytic-converter market ranges (autocatalystmarket). Returns
 * a per-vehicle override for the converter line when a row exists.
 */
export async function getCatMarketOverrides(reqs: readonly ProfileRequest[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const makes = Array.from(new Set(reqs.map((r) => norm(r.make))));
  if (!makes.length) return out;
  const { data, error } = await getSupabase().from("enterprise_cat_market_prices").select("make, model, year, found, ranges").in("make", makes).limit(5000);
  if (error) { logger.warn("cat market read failed", { error: error.message }); return out; }
  for (const r of (data ?? []) as CatRow[]) {
    if (!r.found || !r.ranges?.length) continue;
    const primary = r.ranges.find((x) => /gasoline/i.test(x.type)) ?? r.ranges[0];
    if (!primary) continue;
    out.set(keyOf(r.year, r.make, r.model), Math.round((primary.min_usd + primary.max_usd) / 2));
  }
  return out;
}

export const profileKey = keyOf;
