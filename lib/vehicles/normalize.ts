/**
 * Make / model normalization and catalog model matching.
 *
 * The catalog stores models as the first token of the original name
 * ("F150", "4" for 4Runner, "RANGE" for Range Rover, "GRAND" for Grand
 * Cherokee) and spells some makes its own way ("Rover" for Land Rover,
 * "1500" under Dodge for Ram). These helpers turn whatever a user or an
 * auction CSV gives us into the catalog's keys. Pure — no I/O.
 */

import { lookupMakeCode } from "./make-codes";

export interface VehicleInput {
  year: number;
  make: string;
  model: string;
}

/** Upper-case, punctuation → space, collapsed whitespace. */
export function normalizeToken(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Alphanumerics only, upper-case: "F-150" → "F150". */
export function compact(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Canonical display make from a code or free-text spelling.
 * "TOYT" → "Toyota", "chevy" → "Chevrolet", "Mercedes Benz" → "Mercedes-Benz".
 */
export function canonicalMake(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const fromCode = lookupMakeCode(trimmed);
  if (fromCode) return fromCode;
  const norm = normalizeToken(trimmed);
  const special: Record<string, string> = {
    "MERCEDES BENZ": "Mercedes-Benz", MERCEDES: "Mercedes-Benz", "ALFA ROMEO": "Alfa Romeo",
    "LAND ROVER": "Land Rover", "RANGE ROVER": "Land Rover", "ROLLS ROYCE": "Rolls-Royce",
    "ASTON MARTIN": "Aston Martin", VOLKSWAGON: "Volkswagen", CHEVY: "Chevrolet",
  };
  if (special[norm]) return special[norm];
  if (/^[A-Z]{2,3}$/.test(norm)) return norm; // BMW, GMC, AMC, KIA → keep caps
  return norm.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/**
 * Catalog `make_norm` keys to search for a canonical make, most specific
 * first. Ram trucks live under Dodge in the catalog; Land Rover under
 * "ROVER" and "LAND ROVER" both.
 */
export function catalogMakeKeys(canonical: string): string[] {
  const upper = canonical.toUpperCase();
  const extra: Record<string, string[]> = {
    RAM: ["RAM", "DODGE"],
    "LAND ROVER": ["LAND ROVER", "ROVER", "LAND-ROVER"],
    "MERCEDES-BENZ": ["MERCEDES-BENZ", "MERCEDES", "MERCEDES BENZ"],
    "ALFA ROMEO": ["ALFA ROMEO", "ALFA-ROMEO"],
    FIAT: ["FIAT", "FIAT-LANCIA"],
    "ROLLS-ROYCE": ["ROLLS-ROYCE", "ROLLS ROYCE"],
  };
  return extra[upper] ?? [upper];
}

/** Trim / body words that never identify a model. */
const NOISE_TOKENS = new Set([
  "4X4", "4WD", "AWD", "2WD", "FWD", "RWD", "4DR", "2DR", "SEDAN", "COUPE", "WAGON", "HATCHBACK", "CONVERTIBLE",
  "PICKUP", "TRUCK", "VAN", "SUV", "CREW", "CAB", "EXTENDED", "EXT", "REGULAR", "REG", "SUPERCREW", "SUPERCAB",
  "QUAD", "MEGA", "LONG", "SHORT", "BED", "BASE", "LIMITED", "LTD", "PREMIUM", "TOURING", "LX", "EX",
  "EXL", "SEL", "LE", "XLE", "XLT", "XL", "LT", "LS", "LTZ", "SLT", "SLE", "SR5", "TRD", "LARIAT",
  "PLATINUM", "DENALI", "LAREDO", "SAHARA", "RUBICON", "HYBRID", "PLUG", "IN", "TURBO", "DIESEL", "V6", "V8",
  "L4", "I4", "HD", "SD", "SUPER", "DUTY", "NEW", "SPORTBACK", "SI", "SL", "SR", "PRO", "ST", "RS", "SS", "Z71", "RST",
  "TRAIL", "BOSS", "KING", "RANCH", "TREMOR", "RAPTOR",
]);

/**
 * Model tokens: joining punctuation removed ("F-150" → "F150", "CR-V" →
 * "CRV"), trailing trim/body noise dropped, a leading "RAM" brand token
 * dropped ("Ram 1500" → "1500", matching the catalog's Dodge filing).
 */
export function modelTokens(rawModel: string): string[] {
  const tokens = normalizeToken(rawModel.replace(/[-./'’]/g, "")).split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens[0] === "RAM") tokens.shift();
  if (tokens.length <= 1) return tokens;
  return tokens.filter((t, i) => i === 0 || !NOISE_TOKENS.has(t));
}

export interface ModelMatch {
  /** Catalog models (upper-case) to query, best first. */
  models: string[];
  /** How the match was made. */
  how: "exact" | "prefix" | "token" | "none";
}

/**
 * Pick catalog models that mean the same vehicle as `rawModel`.
 *
 * Priority:
 *  1. exact (compact) — "F-150" ↔ "F150", "CR-V" ↔ "CR-V"
 *  2. prefix — the catalog's first-token models: "4RUNNER"/"4 Runner" ↔ "4",
 *     "RANGE ROVER SPORT" ↔ "RANGE", "GRAND CHEROKEE" ↔ "GRAND"
 *  3. token — any remaining meaningful token equals a catalog model:
 *     "SIERRA 1500" ↔ "1500"
 *
 * Catalog models equal to the make name ("FORD"/"FORD") are ignored.
 */
export function matchCatalogModels(rawModel: string, catalogModels: readonly string[], makeNorm?: string): ModelMatch {
  const tokens = modelTokens(rawModel);
  if (tokens.length === 0) return { models: [], how: "none" };
  const inputCompact = compact(tokens.join(""));
  const firstToken = tokens[0];

  const candidates = catalogModels.map((m) => ({ raw: m.toUpperCase(), compact: compact(m) }))
    .filter((c) => c.compact && c.raw !== makeNorm?.toUpperCase());

  // Exact, plus the catalog's heavy-duty suffix variants ("F250" ↔ "F250SD")
  // which are the same truck filed under two names across model years.
  const exact = candidates.filter((c) => c.compact === inputCompact).map((c) => c.raw);
  if (exact.length) {
    const variants = candidates.filter((c) => /^(SD|HD)$/.test(c.compact.slice(inputCompact.length)) && c.compact.startsWith(inputCompact)).map((c) => c.raw);
    return { models: dedupe([...exact, ...variants]), how: "exact" };
  }

  // "F150 XLT" → F150 ; "4RUNNER" → 4 ; "F250SD" ↔ "F250 SUPER DUTY"
  const prefix = candidates.filter((c) => {
    if (c.compact === compact(firstToken)) return true;
    if (inputCompact.startsWith(c.compact)) {
      const remainder = inputCompact.slice(c.compact.length);
      // A numeric catalog model ("4", "1500") only extends into letters
      // ("4RUNNER"), never into more digits ("150" vs "1500 BIG HORN").
      return /^\d+$/.test(c.compact) ? /^[A-Z]/.test(remainder) : c.compact.length >= 3;
    }
    if (c.compact.startsWith(compact(firstToken)) && compact(firstToken).length >= 3) {
      // input "F250" ↔ catalog "F250SD": only when the remainder is a known suffix
      return /^(SD|HD|SUPERDUTY)$/.test(c.compact.slice(compact(firstToken).length));
    }
    return false;
  }).map((c) => c.raw);
  if (prefix.length) return { models: rankLongest(dedupe(prefix)), how: "prefix" };

  const rest = new Set(tokens.slice(1).map(compact));
  const token = candidates.filter((c) => rest.has(c.compact)).map((c) => c.raw);
  if (token.length) return { models: rankLongest(dedupe(token)), how: "token" };

  return { models: [], how: "none" };
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

function rankLongest(list: string[]): string[] {
  return [...list].sort((a, b) => b.length - a.length);
}

/** Title-case a catalog model for display: "F150" → "F150", "CROWN" → "Crown", "CR-V" → "CR-V". */
export function displayModel(model: string): string {
  const upper = model.toUpperCase();
  const shortSegment = upper.split(/[\s-]/).some((seg) => seg.length <= 2);
  if (/\d/.test(upper) || upper.length <= 3 || shortSegment) return upper;
  return upper.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());
}

export function vehicleLabel(v: VehicleInput): string {
  return `${v.year} ${v.make} ${v.model}`.trim();
}
