import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { callLlmForJson, parseJsonLoose } from "@/lib/llm/json.server";
import { getAvailableLlmProvider } from "@/lib/llm/provider.server";
import { chunk, mapWithConcurrency } from "@/lib/utils/concurrency";
import { buildExpansionPrompt, generationFromCrossCompat, genKey, parseExpansionPayload, type GenerationAnswer, type YmmKey } from "./generations";

/**
 * Generation (compatible model-years) expansion, in batch:
 *   1. `enterprise_vehicle_generations` cache
 *   2. LLM, 40 vehicles per prompt, 5 prompts in flight; cached
 *   3. `catalog_cross_compat` majority range for the catalog model
 *   4. the input year alone
 */

const YMMS_PER_PROMPT = 40;
const PROMPT_CONCURRENCY = 5;
const LLM_MAX_TOKENS = 4000;

export interface GenerationRequest extends YmmKey {
  /** Catalog make/model keys for the cross-compat fallback. */
  catalogMake: string | null;
  catalogModels: readonly string[];
}

export interface GenerationResult { years: number[]; source: "cache" | "llm" | "cross_compat" | "none"; confidence: number | null }

async function readCache(reqs: readonly YmmKey[]): Promise<Map<string, GenerationAnswer>> {
  const out = new Map<string, GenerationAnswer>();
  const makes = Array.from(new Set(reqs.map((r) => r.make.toUpperCase())));
  const years = Array.from(new Set(reqs.map((r) => r.year)));
  if (!makes.length) return out;
  const { data, error } = await getSupabase()
    .from("enterprise_vehicle_generations")
    .select("make, model, reference_year, compatible_years, confidence")
    .in("make", makes).in("reference_year", years).limit(5000);
  if (error) { logger.warn("generation cache read failed", { error: error.message }); return out; }
  for (const r of data ?? []) {
    const years = (r.compatible_years as number[] | null) ?? [];
    if (years.length) out.set(genKey(r.reference_year, r.make, r.model), { years, confidence: r.confidence === null ? null : Number(r.confidence) });
  }
  return out;
}

async function expandViaLlm(reqs: readonly YmmKey[], provider: "openai" | "anthropic"): Promise<Map<string, GenerationAnswer>> {
  const results = await mapWithConcurrency(chunk(reqs, YMMS_PER_PROMPT), PROMPT_CONCURRENCY, async (batch) => {
    try {
      const text = await callLlmForJson(buildExpansionPrompt(batch), provider, LLM_MAX_TOKENS);
      return parseExpansionPayload(parseJsonLoose(text));
    } catch (err) {
      logger.warn("generation LLM batch failed", { size: batch.length, error: String(err) });
      return new Map<string, GenerationAnswer>();
    }
  });
  const merged = new Map<string, GenerationAnswer>();
  for (const m of results) for (const [k, v] of m) merged.set(k, v);
  if (merged.size) {
    const rows = Array.from(merged.entries()).map(([k, v]) => {
      const [year, make, model] = k.split("|");
      return { make, model, reference_year: Number(year), compatible_years: v.years, source: "llm", confidence: v.confidence };
    });
    const { error } = await getSupabase().from("enterprise_vehicle_generations").upsert(rows, { onConflict: "make,model,reference_year" });
    if (error) logger.warn("generation cache upsert failed", { error: error.message });
  }
  return merged;
}

async function crossCompatYears(req: GenerationRequest): Promise<number[] | null> {
  if (!req.catalogMake || !req.catalogModels.length) return null;
  const { data, error } = await getSupabase()
    .from("catalog_cross_compat")
    .select("compatible_year_start, compatible_year_end")
    .ilike("base_make", req.catalogMake)
    .or(modelFilter(req.catalogModels))
    .eq("status", "ok")
    .lte("compatible_year_start", req.year).gte("compatible_year_end", req.year)
    .limit(2000);
  if (error) { logger.warn("cross compat read failed", { error: error.message }); return null; }
  return generationFromCrossCompat(req.year, data ?? []);
}

/** PostgREST `or` filter matching any of the models case-insensitively. */
export function modelFilter(models: readonly string[], column = "base_model"): string {
  return models.map((m) => `${column}.ilike.${m.replace(/[^A-Za-z0-9 -]/g, "")}`).join(",");
}

export async function expandGenerations(reqs: readonly GenerationRequest[]): Promise<GenerationResult[]> {
  const unique = new Map<string, GenerationRequest>();
  for (const r of reqs) unique.set(genKey(r.year, r.make, r.model), r);
  const list = Array.from(unique.values());
  const results = new Map<string, GenerationResult>();

  const cached = await readCache(list);
  for (const [k, v] of cached) results.set(k, { years: v.years, source: "cache", confidence: v.confidence });

  const misses = list.filter((r) => !results.has(genKey(r.year, r.make, r.model)));
  const provider = getAvailableLlmProvider();
  if (provider && misses.length) {
    const fromLlm = await expandViaLlm(misses, provider);
    for (const [k, v] of fromLlm) if (unique.has(k)) results.set(k, { years: v.years, source: "llm", confidence: v.confidence });
  }

  const stillMissing = list.filter((r) => !results.has(genKey(r.year, r.make, r.model)));
  const fromCompat = await mapWithConcurrency(stillMissing, 6, crossCompatYears);
  stillMissing.forEach((r, i) => {
    const years = fromCompat[i];
    results.set(genKey(r.year, r.make, r.model), years ? { years, source: "cross_compat", confidence: 0.5 } : { years: [r.year], source: "none", confidence: null });
  });

  return reqs.map((r) => results.get(genKey(r.year, r.make, r.model)) ?? { years: [r.year], source: "none", confidence: null });
}
