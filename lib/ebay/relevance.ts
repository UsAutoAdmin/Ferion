/**
 * Deterministic per-listing relevance gate, ported from Part Scout.
 *
 * Decides from the title whether an eBay listing is the part we are
 * valuing for the vehicle we are valuing it for:
 *   accept    vehicle + type named, no aftermarket / component markers
 *   reject    wrong vehicle or years, aftermarket, a piece OF the part,
 *             a whole engine under a small-part search, service listing
 *   ambiguous plausible but undecidable from the title (no year, soft
 *             component words); callers may send these to an LLM
 *
 * eBay's own fitment annotation ("(For: 2015 Ford F-150)") is trusted as
 * a vehicle + year match. Pure — no I/O.
 */

import { normalizeTypeTokens, synonymVariants } from "@/lib/catalog/part-synonyms";
import { partType } from "@/lib/catalog/part-types";

export type Decision = "accept" | "reject" | "ambiguous";

export interface RelevanceInput {
  title: string;
  fitsNote: string | null;
  make: string;
  model: string;
  year: number;
  /** Years the part is interchangeable across (includes `year`). */
  generationYears: readonly number[];
  typeKey: string;
}

export interface RelevanceResult { decision: Decision; reason: string }

const AFTERMARKET_RE =
  /\b(AFTERMARKET|REPLACEMENT|UNIVERSAL|BRAND NEW|NEW IN BOX|NIB|REMANUFACTURED|REMAN|REBUILT|REBUILD|UPGRADE|PERFORMANCE|RACING|CUSTOM|CARBON FIBER|CARBON FIBRE|STAINLESS STEEL|HALO|LED STRIP|SMOKED|CHROME DELETE|SET OF \d+|PACK OF \d+|\d+\s?PCS?|\d+\s?PACK|QTY \d+)\b/;
const AFTERMARKET_BRAND_RE =
  /\b(A-?PREMIUM|GEARZAAR|DORMAN|TYC|DEPO|SPECTRA|AUTOSHACK|EVAN-?FISCHER|KOOL\s?VUE|GARAGE-?PRO|MISHIMOTO|CXRACING|GODSPEED|ANZO|SPYDER|AKKON|VIPMOTOZ|TORCHBEAM|LASFIT|AUXITO|SEALIGHT|FAHREN|MAXPEEDINGRODS|ECCPP|SCITOO|MOSTPLUS|LABWORK|YITAMOTOR|TRQ|DETROIT AXLE|DURAGO|CARDONE|SKP|URO|APDTY)\b/;
const SERVICE_RE =
  /\b(REPAIR SERVICE|CORRECTION SERVICE|REBUILD SERVICE|REPROGRAM(MING)? SERVICE|PROGRAMMING SERVICE|MILEAGE (CORRECTION|PROGRAMMING)|CLONING SERVICE|WE REPAIR|MAIL[- ]IN|SERVICE ONLY|LABOR ONLY|CORE CHARGE|CORE ONLY|FOR PARTS ONLY|PARTS (ONLY|OR REPAIR)|AS IS FOR PARTS|NOT WORKING|BROKEN|DAMAGED|CRACKED)\b/;
const WHOLE_ENGINE_RE = /\b(LONG BLOCK|SHORT BLOCK|CRATE (ENGINE|MOTOR)|COMPLETE (ENGINE|MOTOR)|ENGINE (MOTOR )?ASSEMBLY|MOTOR ASSEMBLY|RUNS (GREAT|GOOD|PERFECT)|TESTED RUNS)\b/;
const WHEEL_SET_RE = /\b(\d{2}"|\d{2} INCH|FORGED|CONCAVE|WHEEL SET|RIM SET|SET OF 4 (WHEELS|RIMS)|RIMS? AND TIRES?)\b/;

const HARD_COMPONENT_WORDS = ["BEZEL", "TRIM", "SURROUND", "SHIELD", "LENS", "BULB", "BULBS", "GASKET", "GASKETS", "SEAL", "SEALS", "BOLT", "BOLTS", "SCREW", "SCREWS", "CLIP", "CLIPS", "DECAL", "STICKER", "EMBLEM", "BADGE", "COVER", "CAP", "BRACKET", "MOUNT", "MOUNTS", "HINGE", "HINGES", "FILTER", "FUSE", "RELAY", "KNOB", "BUTTON", "FACEPLATE", "OVERLAY", "PULLEY", "BELT", "HOSE", "LINE", "TUBE", "PIPE", "CABLE", "SPRING", "KIT", "PAIR"];
const SOFT_COMPONENT_WORDS = ["PANEL", "HOUSING", "FRAME", "SHELL", "CASE", "TRAY", "INSERT", "SPEAKER", "ANTENNA", "GLASS", "LIGHT", "WIRE", "HARNESS", "PIGTAIL", "CONNECTOR", "PLUG", "SENSOR", "SWITCH", "MOTOR", "PUMP", "ACTUATOR", "HANDLE", "LATCH", "LOCK", "CYLINDER", "GEAR"];
const FITMENT_RE = /\b(FOR|FITS?|COMPATIBLE WITH|REPLACES?)\b/;
const SALVAGE_INVENTORY_RE = /\bFITS:? \d{2}(?:-\d{2})? [A-Z0-9 -]+? \d{6,8}$/;

const MAKE_ALIASES: Readonly<Record<string, string[]>> = {
  CHEVROLET: ["CHEVY", "CHEV"], "MERCEDES-BENZ": ["MERCEDES", "MB", "BENZ"], VOLKSWAGEN: ["VW"],
  "LAND ROVER": ["LANDROVER", "RANGE ROVER"], "ALFA ROMEO": ["ALFA"], GMC: ["GM"], INFINITI: ["INFINITY"], RAM: ["DODGE"],
};

// ── Years ──────────────────────────────────────────────────────────────

function expandTwoDigit(yy: number, hint: number): number {
  return [1900 + yy, 2000 + yy].reduce((best, c) => (Math.abs(c - hint) < Math.abs(best - hint) ? c : best));
}

/** All model years mentioned: "2003-2007", "03-07", "03 04 05", "2015". */
export function yearsInTitle(title: string, hintYear: number): number[] {
  const t = title.toUpperCase().replace(/[–—]/g, "-");
  const out = new Set<number>();
  const consumed: Array<[number, number]> = [];
  const rangeRe = /(?<![\d.$#])(\d{4}|\d{2})\s?-\s?(\d{4}|\d{2})(?![\d.])/g;
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(t)) !== null) {
    let a = Number(m[1]), b = Number(m[2]);
    if (m[1].length === 2) a = expandTwoDigit(a, hintYear);
    if (m[2].length === 2) b = expandTwoDigit(b, m[1].length === 4 ? a : hintYear);
    if (a < 1960 || a > 2035 || b < 1960 || b > 2035 || b < a || b - a > 25) continue;
    for (let y = a; y <= b; y++) out.add(y);
    consumed.push([m.index, m.index + m[0].length]);
  }
  const inConsumed = (i: number) => consumed.some(([s, e]) => i >= s && i < e);
  const yearRe = /(?<![\dA-Z.$#-])(19[6-9]\d|20[0-3]\d)(?![\dA-Z.-])/g;
  while ((m = yearRe.exec(t)) !== null) if (!inConsumed(m.index)) out.add(Number(m[1]));
  const runRe = /(?<![\dA-Z.$#-])((?:\d{2}\s+){1,}\d{2})(?![\dA-Z.-])/g;
  while ((m = runRe.exec(t)) !== null) {
    if (inConsumed(m.index)) continue;
    const yrs = m[1].trim().split(/\s+/).map((n) => expandTwoDigit(Number(n), hintYear));
    if (yrs.every((y, k) => k === 0 || (y > yrs[k - 1] && y - yrs[k - 1] <= 3))) yrs.forEach((y) => out.add(y));
  }
  return [...out].sort((a, b) => a - b);
}

// ── Vehicle / type ─────────────────────────────────────────────────────

function vehicleMentioned(title: string, make: string, model: string): { make: boolean; model: boolean } {
  const T = ` ${title.toUpperCase().replace(/[^A-Z0-9]+/g, " ")} `;
  const mk = make.toUpperCase().trim();
  const makeHit = [mk, ...(MAKE_ALIASES[mk] ?? [])].some((f) => T.includes(` ${f.replace(/[^A-Z0-9]+/g, " ")} `));
  const md = model.toUpperCase().trim().replace(/[^A-Z0-9]+/g, " ");
  const compactM = md.replace(/ /g, "");
  const split = compactM.replace(/([A-Z])(\d)/g, "$1 $2").replace(/(\d)([A-Z])/g, "$1 $2");
  const firstTok = md.split(" ")[0];
  const forms = [md, compactM, split, firstTok].filter((f) => f.length >= 2);
  return { make: makeHit, model: forms.some((f) => T.includes(` ${f} `)) };
}

/** Every phrase that means this type: key, label fragments, aliases, synonyms. */
export function typePhrases(typeKey: string): string[] {
  const t = partType(typeKey);
  const phrases = new Set<string>([typeKey, ...synonymVariants(typeKey)]);
  if (t) {
    t.aliases.forEach((a) => phrases.add(a));
    t.label.replace(/\(.*?\)/g, "").split("/").map((s) => s.trim()).filter(Boolean).forEach((s) => phrases.add(s));
  }
  return [...phrases];
}

export function titleNamesType(title: string, typeKey: string): boolean {
  const titleTokens = new Set(normalizeTypeTokens(title));
  if (!titleTokens.size) return false;
  return typePhrases(typeKey).some((p) => {
    const pt = normalizeTypeTokens(p);
    return pt.length > 0 && pt.every((tok) => titleTokens.has(tok));
  });
}

function componentIssue(titleTokens: Set<string>, typeTokens: Set<string>): { hard: string | null; soft: string | null } {
  const hard = HARD_COMPONENT_WORDS.find((w) => !typeTokens.has(w) && titleTokens.has(w)) ?? null;
  const soft = SOFT_COMPONENT_WORDS.find((w) => !typeTokens.has(w) && titleTokens.has(w)) ?? null;
  return { hard, soft };
}

// ── Gate ───────────────────────────────────────────────────────────────

export function classifyListing(input: RelevanceInput): RelevanceResult {
  const title = input.title.trim();
  if (!title) return { decision: "reject", reason: "empty_title" };
  const T = title.toUpperCase();
  const typeTokens = new Set(typePhrases(input.typeKey).flatMap((p) => normalizeTypeTokens(p)));
  const titleTokens = new Set(normalizeTypeTokens(title));

  if (SERVICE_RE.test(T)) return { decision: "reject", reason: "service_or_broken" };
  if (AFTERMARKET_BRAND_RE.test(T)) return { decision: "reject", reason: "aftermarket_brand" };
  if (AFTERMARKET_RE.test(T)) return { decision: "reject", reason: "aftermarket" };

  const isEngineType = /\b(ENGINE|MOTOR|LONG BLOCK|SHORT BLOCK)\b/.test(input.typeKey);
  if (!isEngineType && WHOLE_ENGINE_RE.test(T)) return { decision: "reject", reason: "whole_engine" };
  const isWheelType = /\b(WHEEL|RIM|TIRE|HUBCAP|CENTER CAP)\b/.test(input.typeKey);
  if (!isWheelType && WHEEL_SET_RE.test(T)) return { decision: "reject", reason: "wheel_set" };

  if (!titleNamesType(title, input.typeKey)) return { decision: "reject", reason: "type_not_named" };

  const comp = componentIssue(titleTokens, typeTokens);
  if (comp.hard) return { decision: "reject", reason: `component:${comp.hard.toLowerCase()}` };

  // eBay's fitment note already asserts this vehicle + year.
  const fits = input.fitsNote ? vehicleMentioned(input.fitsNote, input.make, input.model) : { make: false, model: false };
  const veh = vehicleMentioned(title, input.make, input.model);
  if (!veh.make && !veh.model && !fits.make && !fits.model) return { decision: "reject", reason: "no_vehicle" };

  const years = yearsInTitle(title, input.year);
  const gen = new Set(input.generationYears.length ? input.generationYears : [input.year]);
  if (years.length && !years.some((y) => gen.has(y))) return { decision: "reject", reason: "year_mismatch" };

  if (comp.soft) return { decision: "ambiguous", reason: `component_soft:${comp.soft.toLowerCase()}` };
  if (fits.make || fits.model) return { decision: "accept", reason: "ebay_fitment" };
  if (SALVAGE_INVENTORY_RE.test(T)) return { decision: "accept", reason: "salvage_inventory" };
  if (FITMENT_RE.test(T)) return { decision: "ambiguous", reason: "fitment_wording" };
  if (!years.length) return { decision: "ambiguous", reason: "no_year" };
  if (!veh.model) return { decision: "ambiguous", reason: "make_only" };
  return { decision: "accept", reason: "ok" };
}
