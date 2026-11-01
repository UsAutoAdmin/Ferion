/**
 * Pure helpers for generation expansion: the LLM prompt, response
 * parsing, and deriving a generation from cross-compat rows.
 */

export interface YmmKey { year: number; make: string; model: string }

export const genKey = (y: number, mk: string, md: string): string => `${y}|${mk.trim().toUpperCase()}|${md.trim().toUpperCase()}`;

export interface GenerationAnswer { years: number[]; confidence: number | null }

export function buildExpansionPrompt(ymms: readonly YmmKey[]): string {
  return `You are listing the model-years that are mechanically parts-compatible with each given US-market vehicle. Two years are "compatible" if they share the same generation/platform such that >50% of interior, exterior, drivetrain, and electrical parts interchange between them.

For each input vehicle, return the FULL list of compatible model years (including the input year itself). Be conservative — do not span across major redesigns. Examples:

- 2011 Honda Accord (8th gen, 2008-2012) → [2008, 2009, 2010, 2011, 2012]
- 2007 Toyota Camry (XV40, 2007-2011) → [2007, 2008, 2009, 2010, 2011]
- 2014 Ford F-150 (12th gen, 2009-2014) → [2009, 2010, 2011, 2012, 2013, 2014]
- 2015 Ford F-150 (13th gen, 2015-2020) → [2015, 2016, 2017, 2018, 2019, 2020]
- 2003 Jeep Wrangler (TJ, 1997-2006) → [1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006]

Vehicles to expand:
${ymms.map((y) => `- ${y.year} ${y.make} ${y.model}`).join("\n")}

Rules:
- If you don't recognize a vehicle, return just the input year alone (do not guess).
- Confidence 0.0-1.0: 1.0 = you know this model's generations exactly; 0.5 = ambiguous (e.g. truck submodels); 0.0 = wild guess (use input year only and 0.0).
- Echo make and model exactly as given.
- Output JSON ONLY, no markdown, no commentary.

Reply format:
{"expansions":[{"year":2011,"make":"Honda","model":"Accord","compatible_years":[2008,2009,2010,2011,2012],"confidence":0.95}]}`;
}

interface ExpansionPayload {
  expansions?: Array<{ year?: number; make?: string; model?: string; compatible_years?: number[]; confidence?: number }>;
}

export function parseExpansionPayload(parsed: ExpansionPayload): Map<string, GenerationAnswer> {
  const out = new Map<string, GenerationAnswer>();
  for (const e of parsed.expansions ?? []) {
    if (e.year == null || !e.make || !e.model) continue;
    const years = Array.isArray(e.compatible_years)
      ? e.compatible_years.map(Number).filter((y) => Number.isFinite(y) && y >= 1900 && y <= 2100)
      : [];
    if (!years.includes(e.year)) years.push(e.year);
    years.sort((a, b) => a - b);
    const confidence = typeof e.confidence === "number" ? Math.max(0, Math.min(1, e.confidence)) : null;
    out.set(genKey(e.year, e.make, e.model), { years: Array.from(new Set(years)), confidence });
  }
  return out;
}

export interface CrossCompatRange { compatible_year_start: number | null; compatible_year_end: number | null }

/** Cross-compat ranges are per-part and often span redesigns; clamp to ±this. */
export const CROSS_COMPAT_MAX_REACH = 5;

/**
 * Most common compatible year range that covers `year` across a model's
 * cross-compat rows, clamped to ±CROSS_COMPAT_MAX_REACH and expanded to
 * a year list. Null when nothing covers.
 */
export function generationFromCrossCompat(year: number, rows: readonly CrossCompatRange[]): number[] | null {
  const counts = new Map<string, { n: number; start: number; end: number }>();
  for (const r of rows) {
    const s = r.compatible_year_start, e = r.compatible_year_end;
    if (s === null || e === null || s > year || e < year || e - s > 15) continue;
    const k = `${s}-${e}`;
    const cur = counts.get(k);
    if (cur) cur.n++; else counts.set(k, { n: 1, start: s, end: e });
  }
  let best: { n: number; start: number; end: number } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  if (!best) return null;
  const start = Math.max(best.start, year - CROSS_COMPAT_MAX_REACH);
  const end = Math.min(best.end, year + CROSS_COMPAT_MAX_REACH);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
