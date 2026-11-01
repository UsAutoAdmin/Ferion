/**
 * Scrap valuation: pure math from a vehicle profile and the scrap price
 * board, LLM profile-response parsing, and a class-based heuristic
 * profile for when no cache row or LLM is available. No I/O.
 */

import type { EngineBlockMaterial, ProfileSource, ScrapLineItem, ScrapMaterial, ScrapPriceMap, ScrapValuation, VehicleProfile, WheelMaterial } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ScrapPriceRow { material: string; price_per_lb: number | string | null }

export function toPriceMap(rows: readonly ScrapPriceRow[]): ScrapPriceMap {
  const map: ScrapPriceMap = {};
  for (const r of rows) {
    if (r.price_per_lb === null || r.price_per_lb === "") continue;
    const n = Number(r.price_per_lb);
    if (Number.isFinite(n)) map[r.material as ScrapMaterial] = n;
  }
  return map;
}

/** Defaults used when the price board can't be read. */
export const DEFAULT_SCRAP_PRICES: Required<ScrapPriceMap> = {
  steel_shred: 0.1, iron_engine: 0.14, cast_aluminum: 0.5, aluminum_wheels: 0.8, copper: 3.5,
};

const materialDisplay = (m: string): string =>
  m === "aluminum" ? "Aluminum" : m === "steel" ? "Steel" : m === "iron" ? "Cast Iron" : "Unknown";

function lineValue(weight: number | null, price: number | null | undefined): number | null {
  if (weight === null || price === null || price === undefined) return null;
  return round2(weight * price);
}

/**
 * Engine, wheels and copper are carved out of the curb weight at their
 * material prices; the remainder (body, frame, glass, interior) is shred
 * steel. Catalytic converters are a direct dollar line.
 */
export function computeScrapValuation(profile: VehicleProfile, priceMap: ScrapPriceMap): ScrapValuation {
  const items: ScrapLineItem[] = [];

  const engineKey: ScrapMaterial | null =
    profile.engineBlockMaterial === "aluminum" ? "cast_aluminum" : profile.engineBlockMaterial === "iron" ? "iron_engine" : null;
  const enginePrice = engineKey ? (priceMap[engineKey] ?? null) : null;
  items.push({
    key: "engine",
    label: profile.engineName ? `Engine (${profile.engineName})` : "Engine",
    materialLabel: materialDisplay(profile.engineBlockMaterial),
    weightLbs: profile.engineWeightLbs,
    pricePerLb: enginePrice,
    valueUsd: lineValue(profile.engineWeightLbs, enginePrice),
  });

  const wheelKey: ScrapMaterial | null =
    profile.wheelMaterial === "aluminum" ? "aluminum_wheels" : profile.wheelMaterial === "steel" ? "steel_shred" : null;
  const wheelPrice = wheelKey ? (priceMap[wheelKey] ?? null) : null;
  items.push({
    key: "wheels",
    label: "Wheels (set of 4, no tires)",
    materialLabel: materialDisplay(profile.wheelMaterial),
    weightLbs: profile.wheelsWeightLbs,
    pricePerLb: wheelPrice,
    valueUsd: lineValue(profile.wheelsWeightLbs, wheelPrice),
  });

  items.push({
    key: "copper",
    label: "Copper (harness, starter, alternator, motors)",
    materialLabel: "Copper",
    weightLbs: profile.copperLbs,
    pricePerLb: priceMap.copper ?? null,
    valueUsd: lineValue(profile.copperLbs, priceMap.copper),
  });

  let remainderLbs: number | null = null;
  if (profile.curbWeightLbs !== null) {
    const carved = (profile.engineWeightLbs ?? 0) + (profile.wheelsWeightLbs ?? 0) + (profile.copperLbs ?? 0);
    remainderLbs = Math.max(0, profile.curbWeightLbs - carved);
  }
  items.push({
    key: "remainder",
    label: "Body / frame / everything else (shred)",
    materialLabel: "Mixed steel",
    weightLbs: remainderLbs,
    pricePerLb: priceMap.steel_shred ?? null,
    valueUsd: lineValue(remainderLbs, priceMap.steel_shred),
  });

  const catCount = profile.catalyticConverterCount;
  items.push({
    key: "catalytic_converters",
    label: catCount !== null ? `Catalytic converter${catCount === 1 ? "" : "s"} (×${catCount})` : "Catalytic converters",
    materialLabel: "PGM (Pt/Pd/Rh)",
    weightLbs: null,
    pricePerLb: null,
    valueUsd: profile.catalyticConverterValueUsd !== null ? round2(profile.catalyticConverterValueUsd) : null,
  });

  return {
    lineItems: items,
    totalValueUsd: round2(items.reduce((s, i) => s + (i.valueUsd ?? 0), 0)),
    remainderLbs,
    profileSource: profile.source,
    profileConfidence: profile.confidence,
  };
}

// ── LLM profile parsing ───────────────────────────────────────────────

export type ParsedProfile = Omit<VehicleProfile, "year" | "make" | "model" | "source">;

interface ProfilePayload {
  curb_weight_lbs?: number; engine_name?: string; engine_block_material?: string; engine_weight_lbs?: number;
  wheel_material?: string; wheels_weight_lbs?: number; copper_lbs?: number; catalytic_converter_count?: number;
  catalytic_converter_value_usd?: number; confidence?: number;
}

const boundedNum = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;

/** Plausibility windows keep one hallucinated digit from poisoning the cache. */
export function parseProfilePayload(parsed: ProfilePayload): ParsedProfile {
  const wheel = parsed.wheel_material?.toLowerCase();
  const block = parsed.engine_block_material?.toLowerCase();
  const catValue = parsed.catalytic_converter_value_usd;
  return {
    curbWeightLbs: boundedNum(parsed.curb_weight_lbs, 1000, 10000),
    engineName: typeof parsed.engine_name === "string" && parsed.engine_name.trim() ? parsed.engine_name.trim() : null,
    engineBlockMaterial: (block === "aluminum" || block === "iron" ? block : "unknown") as EngineBlockMaterial,
    engineWeightLbs: boundedNum(parsed.engine_weight_lbs, 100, 2500),
    wheelMaterial: (wheel === "aluminum" || wheel === "steel" ? wheel : "unknown") as WheelMaterial,
    wheelsWeightLbs: boundedNum(parsed.wheels_weight_lbs, 40, 400),
    copperLbs: boundedNum(parsed.copper_lbs, 0, 200),
    catalyticConverterCount: boundedNum(parsed.catalytic_converter_count, 0, 6),
    catalyticConverterValueUsd:
      typeof catValue === "number" && Number.isFinite(catValue) && catValue >= 0 && catValue <= 5000 ? round2(catValue) : null,
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : null,
  };
}

export function buildProfilePrompt(year: number, make: string, model: string): string {
  return `You are an automotive recycling expert profiling a US-market vehicle for scrap/dismantling valuation. Answer for the MOST COMMON configuration of this vehicle as sold in the US.

Vehicle: ${year} ${make} ${model}

Return these fields:

1. curb_weight_lbs — typical curb weight in pounds.
2. engine_name — the most common engine, short form (e.g. "2.5L I4", "5.3L V8").
3. engine_block_material — cylinder BLOCK casting of that engine: "aluminum" or "iron" (cast iron or compacted graphite iron, CGI — CGI counts as iron). Block only, not heads.
4. engine_weight_lbs — complete engine assembly weight (block, heads, intake, accessories), pounds.
5. wheel_material — factory road wheels on the most common trim: "aluminum" (any alloy) or "steel".
6. wheels_weight_lbs — total weight of the set of 4 rims (no tires), pounds.
7. copper_lbs — estimated recoverable copper in the whole vehicle (wiring harness copper content, starter, alternator, small motors), pounds. Typical range: 40-80 lbs for a modern car, more for luxury/EV.
8. catalytic_converter_count — number of catalytic converters on the most common configuration.
9. catalytic_converter_value_usd — estimated TOTAL current recycler buy price in USD for all converters combined (economy cars ~$50-150 each, trucks/SUVs ~$150-500 each, some imports higher).

Calibration examples for engine_block_material:
- Honda J-series V6, Toyota 2GR V6, Chrysler 3.6 Pentastar → aluminum
- GM 5.3L Vortec (pre-Gen V), Ford 4.6L 2V truck V8, Ford 2.7L EcoBoost (CGI) → iron

Confidence 0.0-1.0 over the whole profile: 1.0 = common vehicle you know exactly; 0.5 = estimates. If you don't recognize the vehicle at all, use null for numeric fields, "unknown" for materials, and confidence 0.

Output JSON ONLY, no markdown, no commentary.

Reply format:
{"curb_weight_lbs":3300,"engine_name":"2.4L I4","engine_block_material":"aluminum","engine_weight_lbs":350,"wheel_material":"aluminum","wheels_weight_lbs":80,"copper_lbs":55,"catalytic_converter_count":1,"catalytic_converter_value_usd":120,"confidence":0.9}`;
}

// ── Heuristic fallback ────────────────────────────────────────────────

export type VehicleClass = "compact" | "midsize" | "fullsize" | "suv" | "truck" | "van" | "luxury";

const CLASS_TOKENS: Array<[RegExp, VehicleClass]> = [
  [/\b(F150|F250|F350|F\d{3}SD|SILVERADO|SIERRA|1500|2500|3500|RAM|TUNDRA|TITAN|TACOMA|RANGER|COLORADO|CANYON|FRONTIER|RIDGELINE|GLADIATOR|DAKOTA|S10|AVALANCHE)\b/, "truck"],
  [/\b(EXPRESS|SAVANA|E150|E250|E350|TRANSIT|SPRINTER|ODYSSEY|SIENNA|CARAVAN|PACIFICA|TOWN|QUEST|SEDONA|CARNIVAL|PROMASTER|NV\d*)\b/, "van"],
  [/\b(TAHOE|SUBURBAN|YUKON|EXPEDITION|SEQUOIA|ARMADA|ESCALADE|NAVIGATOR|LAND|4|4RUNNER|EXPLORER|DURANGO|GRAND|PILOT|HIGHLANDER|TRAVERSE|ACADIA|ENCLAVE|PATHFINDER|TELLURIDE|PALISADE|ATLAS|ASCENT|WRANGLER|BRONCO|RANGE|DISCOVERY|LX|GX|QX\d*|MDX|X5|X7|GL\w*|Q7|Q8|XC90|CX9|CX90)\b/, "suv"],
  [/\b(ESCAPE|RAV4|CRV|CR V|ROGUE|EQUINOX|TUCSON|SPORTAGE|FORESTER|OUTBACK|CX5|CX30|EDGE|MURANO|SANTA|SORENTO|CHEROKEE|COMPASS|RENEGADE|TERRAIN|BLAZER|VENZA|HRV|HR V|KONA|SELTOS|ECOSPORT|TRAX|ENCORE|NX|RX|RDX|X3|X1|Q5|Q3|XC60|XC40|EVOQUE|MACAN|CAYENNE|GLC|GLA|GLE)\b/, "suv"],
  [/\b(IMPALA|TAURUS|CHARGER|300|AVALON|MAXIMA|CADENZA|AZERA|LACROSSE|CROWN|MARQUIS|CAPRICE|CONTINENTAL|TOWN CAR|DTS|CTS|STS|LS|GS|ES|M\d{2}|Q\d{2}|E\d{3}|S\d{3}|7 SERIES|5 SERIES|A6|A8|S80|S90|XF|XJ|MUSTANG|CAMARO|CHALLENGER|CORVETTE)\b/, "fullsize"],
  [/\b(CAMRY|ACCORD|ALTIMA|FUSION|MALIBU|SONATA|OPTIMA|K5|LEGACY|MAZDA6|6|PASSAT|JETTA|200|OPTIMA|REGAL|CIVIC SI|TLX|IS|3 SERIES|C\d{3}|A4|S60|XE|G\d{2}|Q50|Q60)\b/, "midsize"],
  [/\b(CIVIC|COROLLA|SENTRA|FOCUS|CRUZE|ELANTRA|FORTE|RIO|ACCENT|VERSA|FIESTA|FIT|YARIS|PRIUS|SPARK|SONIC|MAZDA3|3|2|GOLF|BEETLE|MINI|COOPER|SOUL|VELOSTER|IMPREZA|CROSSTREK|MIRAGE|LANCER|ECLIPSE|TC|XB|XD|IA|IM|A3|1 SERIES|2 SERIES|CLA)\b/, "compact"],
];

const LUXURY_MAKES = new Set(["BMW", "MERCEDES-BENZ", "AUDI", "LEXUS", "INFINITI", "ACURA", "CADILLAC", "LINCOLN", "PORSCHE", "JAGUAR", "LAND ROVER", "GENESIS", "VOLVO", "TESLA", "MASERATI", "BENTLEY", "ROLLS-ROYCE"]);

export function classifyVehicle(make: string, model: string): VehicleClass {
  // Try both "F 150" and "F150" so hyphenated and joined spellings match.
  const upper = model.toUpperCase();
  const variants = [upper.replace(/-/g, " "), upper.replace(/-/g, "")];
  for (const [re, cls] of CLASS_TOKENS) if (variants.some((m) => re.test(m))) return cls;
  return LUXURY_MAKES.has(make.toUpperCase()) ? "luxury" : "midsize";
}

interface ClassProfile { curb: number; engine: number; block: EngineBlockMaterial; wheels: number; copper: number; cats: number; catValue: number }

const CLASS_PROFILES: Record<VehicleClass, ClassProfile> = {
  compact:  { curb: 2900, engine: 300, block: "aluminum", wheels: 70,  copper: 45, cats: 1, catValue: 110 },
  midsize:  { curb: 3400, engine: 350, block: "aluminum", wheels: 80,  copper: 55, cats: 1, catValue: 150 },
  fullsize: { curb: 4000, engine: 450, block: "aluminum", wheels: 95,  copper: 65, cats: 2, catValue: 280 },
  luxury:   { curb: 4100, engine: 450, block: "aluminum", wheels: 100, copper: 75, cats: 2, catValue: 320 },
  suv:      { curb: 4500, engine: 500, block: "aluminum", wheels: 100, copper: 65, cats: 2, catValue: 350 },
  truck:    { curb: 5200, engine: 600, block: "iron",     wheels: 110, copper: 70, cats: 2, catValue: 400 },
  van:      { curb: 4600, engine: 500, block: "iron",     wheels: 90,  copper: 65, cats: 2, catValue: 300 },
};

/**
 * Low-confidence profile from the vehicle's class. Pre-2000 vehicles are
 * assumed to have steel wheels and iron blocks; newer ones aluminum.
 */
export function heuristicProfile(year: number, make: string, model: string): VehicleProfile {
  const cls = classifyVehicle(make, model);
  const p = CLASS_PROFILES[cls];
  const old = year < 2000;
  return {
    year, make, model,
    curbWeightLbs: p.curb,
    engineName: null,
    engineBlockMaterial: old && cls !== "luxury" ? "iron" : p.block,
    engineWeightLbs: p.engine,
    wheelMaterial: old && (cls === "compact" || cls === "van" || cls === "truck") ? "steel" : "aluminum",
    wheelsWeightLbs: p.wheels,
    copperLbs: p.copper,
    catalyticConverterCount: p.cats,
    catalyticConverterValueUsd: p.catValue,
    confidence: 0.3,
    source: "heuristic" as ProfileSource,
  };
}

export function emptyProfile(year: number, make: string, model: string): VehicleProfile {
  return {
    year, make, model, curbWeightLbs: null, engineName: null, engineBlockMaterial: "unknown", engineWeightLbs: null,
    wheelMaterial: "unknown", wheelsWeightLbs: null, copperLbs: null, catalyticConverterCount: null,
    catalyticConverterValueUsd: null, confidence: null, source: "unavailable",
  };
}
