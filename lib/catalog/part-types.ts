/**
 * The resellable part types Ferion values — the parts a yard actually
 * pulls, photographs, and ships: radios, bezels, consoles, trim, modules,
 * lights, mirrors, and bolt-on mechanical units with strong eBay
 * sell-through. Engine internals (pistons, rods, cranks) and the catalog's
 * ~12k-name long tail are out of scope: sell-through data there is too
 * thin to trust.
 *
 * Keys are canonical type keys (post `canonicalizeTypeKey`), so catalog
 * rows and cached valuations fold onto them. `partTypeOf` maps any
 * catalog spelling onto a type ("Pickup Radio Bezel Trim" → DASH BEZEL)
 * but never a *piece* of one ("HEADLIGHT BULB" → null). Pure — no I/O.
 */

import { canonicalizeTypeKey } from "./part-synonyms";

export type PartCategory = "Interior" | "Electronics" | "Exterior" | "Mechanical";

export interface PartType {
  /** Canonical type key. */
  key: string;
  /** Display name. */
  label: string;
  category: PartCategory;
  /** Units a single vehicle carries (paired lights, mirrors, bags). */
  perVehicle: 1 | 2;
  /**
   * Max plausible used price, USD. Catalog price columns were averaged
   * from unvalidated eBay results, so whole assemblies titled as a small
   * part leak in ($1,600 jump seats). Prices above the ceiling are
   * treated as pollution and ignored.
   */
  maxPrice: number;
  /** Catalog / canonical spellings that mean this type (besides `key`). */
  aliases: readonly string[];
  /**
   * Only list when the catalog has data for this vehicle — the part is
   * body-style specific (jump seats, tonneau covers, roof racks) and
   * would be noise on vehicles that never had one.
   */
  conditional?: boolean;
  /**
   * Parts in the same group are alternate ways to sell one physical
   * assembly (console vs. its lid vs. its armrest). Totals count only the
   * highest expected value per group; the rest are shown as alternatives.
   */
  exclusiveGroup?: string;
}

export const PART_TYPES: readonly PartType[] = [
  // ── Interior ────────────────────────────────────────────────────────
  { key: "RADIO", label: "Radio / Head Unit", category: "Interior", perVehicle: 1, maxPrice: 900,
    aliases: ["RADIO RECEIVER", "STEREO", "HEAD UNIT", "RADIO HEAD UNIT", "CD PLAYER", "AM FM RADIO", "NAVIGATION UNIT", "NAVIGATION RADIO", "RADIO NAVIGATION", "RADIO CD PLAYER", "RADIO RECEIVER CD"] },
  { key: "DASH BEZEL", label: "Radio / Dash Bezel", category: "Interior", perVehicle: 1, maxPrice: 400,
    aliases: ["RADIO BEZEL", "RADIO BEZEL TRIM", "RADIO TRIM BEZEL", "DASH TRIM BEZEL", "CENTER DASH BEZEL", "RADIO DASH BEZEL", "CENTER DASH TRIM", "DASH TRIM", "DASH TRIM PANEL", "CENTER DASH PANEL", "RADIO TRIM", "DASH BEZEL TRIM", "DASH CENTER PANEL", "RADIO CLIMATE BEZEL"] },
  { key: "INSTRUMENT CLUSTER BEZEL", label: "Cluster Bezel", category: "Interior", perVehicle: 1, maxPrice: 300,
    aliases: ["CLUSTER BEZEL", "GAUGE BEZEL", "DASH CLUSTER BEZEL", "SPEEDOMETER BEZEL", "INSTRUMENT PANEL BEZEL", "CLUSTER TRIM BEZEL", "INSTRUMENT BEZEL"] },
  { key: "INSTRUMENT CLUSTER", label: "Instrument Cluster", category: "Interior", perVehicle: 1, maxPrice: 700, aliases: [] },
  { key: "CLIMATE CONTROL", label: "Climate Control", category: "Interior", perVehicle: 1, maxPrice: 500, aliases: [] },
  { key: "INFO SCREEN", label: "Info / Display Screen", category: "Interior", perVehicle: 1, maxPrice: 1200,
    aliases: ["DISPLAY", "NAVIGATION SCREEN", "NAVIGATION DISPLAY", "HEADS UP DISPLAY", "INFOTAINMENT SCREEN", "TOUCH SCREEN"] },
  { key: "OVERHEAD CONSOLE", label: "Overhead Console", category: "Interior", perVehicle: 1, maxPrice: 400,
    aliases: ["ROOF CONSOLE", "OVERHEAD ROOF CONSOLE", "DOME LIGHT CONSOLE", "OVERHEAD CONSOLE LIGHT"] },
  { key: "CENTER CONSOLE", label: "Center Console", category: "Interior", perVehicle: 1, maxPrice: 900, exclusiveGroup: "console",
    aliases: ["FLOOR CONSOLE", "CONSOLE", "CENTER FLOOR CONSOLE", "FRONT CONSOLE", "JUMP SEAT CONSOLE", "CONSOLE JUMP SEAT"] },
  { key: "CONSOLE LID", label: "Console Lid / Armrest", category: "Interior", perVehicle: 1, maxPrice: 350, exclusiveGroup: "console",
    aliases: ["CONSOLE ARMREST LID", "ARMREST LID", "CENTER CONSOLE LID", "CONSOLE LID ARMREST", "CONSOLE ARMREST", "CONSOLE TOP", "JUMP SEAT LID"] },
  { key: "ARMREST", label: "Armrest", category: "Interior", perVehicle: 1, maxPrice: 300, exclusiveGroup: "console",
    aliases: ["CENTER ARMREST", "REAR ARMREST", "FRONT ARMREST"] },
  { key: "JUMP SEAT", label: "Jump Seat", category: "Interior", perVehicle: 1, maxPrice: 900, conditional: true,
    aliases: ["CENTER JUMP SEAT", "FRONT JUMP SEAT", "MIDDLE SEAT"] },
  { key: "SHIFTER TRIM", label: "Shifter Trim / Bezel", category: "Interior", perVehicle: 1, maxPrice: 300,
    aliases: ["SHIFTER BEZEL", "SHIFT BEZEL", "GEAR SHIFT TRIM", "SHIFTER TRIM BEZEL", "SHIFT TRIM", "SHIFTER PLATE", "SHIFT INDICATOR TRIM", "CONSOLE SHIFTER TRIM", "SHIFTER CONSOLE TRIM", "GEAR SHIFT INDICATOR", "SHIFT INDICATOR"] },
  { key: "STEERING COLUMN COVER", label: "Steering Column Cover", category: "Interior", perVehicle: 1, maxPrice: 200,
    aliases: ["COLUMN COVER", "STEERING COLUMN SHROUD", "COLUMN SHROUD", "STEERING COLUMN TRIM"] },
  { key: "AIR VENT", label: "Dash Air Vent", category: "Interior", perVehicle: 1, maxPrice: 250,
    aliases: ["AIR VENTS", "DASH VENT", "DASH AIR VENT", "AC VENT", "A C VENT", "HEATER VENT", "DASH VENTS", "CENTER AIR VENT"] },
  { key: "SILL PLATE", label: "Door Sill Plates (set)", category: "Interior", perVehicle: 1, maxPrice: 300,
    aliases: ["SILL PLATES", "DOOR SILL PLATE", "SCUFF PLATE", "DOOR SILL", "KICK PLATE"] },
  { key: "DOME LIGHT", label: "Dome / Interior Light", category: "Interior", perVehicle: 1, maxPrice: 200,
    aliases: ["INTERIOR LIGHT", "DOME LAMP", "MAP LIGHT", "INTERIOR LAMP", "COURTESY LIGHT"] },
  { key: "STEERING WHEEL", label: "Steering Wheel", category: "Interior", perVehicle: 1, maxPrice: 700, aliases: ["LEATHER STEERING WHEEL"] },
  { key: "AIR BAG", label: "Air Bag", category: "Interior", perVehicle: 2, maxPrice: 700,
    aliases: ["AIRBAG", "AIRBAGS", "SRS AIR BAG", "STEERING WHEEL AIR BAG", "DRIVER AIR BAG", "PASSENGER AIR BAG", "DASH AIR BAG", "DRIVER AIRBAG", "PASSENGER AIRBAG"] },
  { key: "CLOCKSPRING", label: "Clockspring", category: "Interior", perVehicle: 1, maxPrice: 250, aliases: ["CLOCK SPRING", "SPIRAL CABLE"] },
  { key: "GLOVE BOX", label: "Glove Box", category: "Interior", perVehicle: 1, maxPrice: 350,
    aliases: ["GLOVE BOX DOOR", "GLOVEBOX", "GLOVE COMPARTMENT", "GLOVE BOX LID"] },
  { key: "SUN VISOR", label: "Sun Visor", category: "Interior", perVehicle: 2, maxPrice: 250, aliases: [] },
  { key: "HEADREST", label: "Headrest (set)", category: "Interior", perVehicle: 1, maxPrice: 400,
    aliases: ["REAR HEADREST", "FRONT HEADREST", "HEAD REST", "HEADREST SET"] },
  { key: "DOOR PANEL", label: "Door Panel", category: "Interior", perVehicle: 2, maxPrice: 600,
    aliases: ["DOOR TRIM PANEL", "INTERIOR DOOR PANEL", "FRONT DOOR PANEL", "DRIVER DOOR PANEL", "DOOR CARD"] },
  { key: "SEAT SWITCH", label: "Power Seat Switch", category: "Interior", perVehicle: 1, maxPrice: 250,
    aliases: ["POWER SEAT SWITCH", "SEAT CONTROL SWITCH", "SEAT ADJUSTER SWITCH"] },
  { key: "WINDOW SWITCH", label: "Master Window Switch", category: "Interior", perVehicle: 1, maxPrice: 250,
    aliases: ["MASTER WINDOW SWITCH", "POWER WINDOW SWITCH", "DRIVER WINDOW SWITCH", "WINDOW MASTER SWITCH", "MASTER POWER WINDOW SWITCH"] },
  { key: "CUP HOLDER", label: "Cup Holder", category: "Interior", perVehicle: 1, maxPrice: 250, aliases: ["CONSOLE CUP HOLDER", "DASH CUP HOLDER", "REAR CUP HOLDER"] },
  { key: "FLOOR MATS", label: "Floor Mats (set)", category: "Interior", perVehicle: 1, maxPrice: 300, aliases: ["ALL WEATHER FLOOR MATS", "RUBBER FLOOR MATS"] },
  { key: "CARGO COVER", label: "Cargo Cover", category: "Interior", perVehicle: 1, maxPrice: 400, conditional: true,
    aliases: ["RETRACTABLE CARGO COVER", "TRUNK CARGO COVER", "CARGO SHADE", "PRIVACY COVER"] },
  { key: "PARCEL SHELF", label: "Parcel Shelf", category: "Interior", perVehicle: 1, maxPrice: 400, conditional: true, aliases: ["REAR DECK", "REAR SHELF", "PACKAGE TRAY"] },
  { key: "REAR VIEW MIRROR", label: "Rear View Mirror", category: "Interior", perVehicle: 1, maxPrice: 400, aliases: ["AUTO DIM MIRROR", "INSIDE MIRROR"] },
  { key: "KEY REMOTE FOB", label: "Key Fob", category: "Interior", perVehicle: 1, maxPrice: 250, aliases: [] },

  // ── Electronics / modules ───────────────────────────────────────────
  { key: "ENGINE CONTROL MODULE", label: "Engine Control Module (ECM)", category: "Electronics", perVehicle: 1, maxPrice: 800,
    aliases: ["ENGINE COMPUTER", "POWERTRAIN CONTROL MODULE", "PCM", "COMPUTER BOX ENGINE"] },
  { key: "TRANSMISSION COMPUTER", label: "Transmission Control Module", category: "Electronics", perVehicle: 1, maxPrice: 600,
    aliases: ["TRANSMISSION CONTROL MODULE", "TCM"] },
  { key: "ANTI LOCK BRAKE PUMP", label: "ABS Pump / Module", category: "Electronics", perVehicle: 1, maxPrice: 900,
    aliases: ["ABS MODULE", "ANTI LOCK BRAKE COMPUTER", "ANTI LOCK BRAKE MODULE", "ABS PUMP MODULE", "ABS HYDRAULIC UNIT", "ABS MODULATOR", "ANTI LOCK BRAKE PUMP MODULE"] },
  { key: "BRAKE BOOSTER", label: "Brake Booster / Master Cylinder", category: "Electronics", perVehicle: 1, maxPrice: 500,
    aliases: ["MASTER CYLINDER", "BRAKE MASTER CYLINDER", "POWER BRAKE BOOSTER", "BRAKE BOOSTER MASTER CYLINDER", "HYDRO BOOST"] },
  { key: "FUSE BOX", label: "Fuse Box / BCM", category: "Electronics", perVehicle: 1, maxPrice: 700,
    aliases: ["CABIN FUSE BOX", "ENGINE FUSE BOX", "BODY CONTROL MODULE", "JUNCTION BOX", "FUSE RELAY BOX", "BCM", "SMART JUNCTION BOX", "FUSE PANEL"] },
  { key: "AUDIO AMPLIFIER", label: "Audio Amplifier", category: "Electronics", perVehicle: 1, maxPrice: 700, aliases: [] },
  { key: "BACK UP CAMERA", label: "Backup Camera", category: "Electronics", perVehicle: 1, maxPrice: 400, aliases: [] },
  { key: "IGNITION SWITCH", label: "Ignition Switch", category: "Electronics", perVehicle: 1, maxPrice: 300, aliases: ["IGNITION LOCK CYLINDER", "IGNITION SWITCH KEY"] },
  { key: "HEADLIGHT SWITCH", label: "Headlight Switch", category: "Electronics", perVehicle: 1, maxPrice: 200, aliases: ["HEAD LIGHT SWITCH", "DIMMER SWITCH"] },
  { key: "SUN ROOF MOTOR", label: "Sunroof Motor", category: "Electronics", perVehicle: 1, maxPrice: 400, conditional: true, aliases: ["SUNROOF MOTOR", "MOONROOF MOTOR"] },
  { key: "TRANSFER CASE SWITCH", label: "4WD / Transfer Case Switch", category: "Electronics", perVehicle: 1, maxPrice: 300, conditional: true,
    aliases: ["4WD SWITCH", "FOUR WHEEL DRIVE SWITCH", "4X4 SWITCH", "TRANSFER CASE SELECTOR SWITCH"] },

  // ── Exterior ────────────────────────────────────────────────────────
  { key: "HEADLIGHT", label: "Headlight", category: "Exterior", perVehicle: 2, maxPrice: 1500,
    aliases: ["HEADLIGHT HOUSING", "HEADLIGHT ASSEMBLY", "HEADLAMP ASSEMBLY"] },
  { key: "TAIL LIGHT", label: "Tail Light", category: "Exterior", perVehicle: 2, maxPrice: 900,
    aliases: ["TAIL LIGHT ASSEMBLY", "TAIL LAMP", "REAR LIGHT", "TAIL LIGHT HOUSING"] },
  { key: "THIRD BRAKE LIGHT", label: "Third Brake Light", category: "Exterior", perVehicle: 1, maxPrice: 400, aliases: [] },
  { key: "FOG LIGHT", label: "Fog Light", category: "Exterior", perVehicle: 2, maxPrice: 400, aliases: ["FOG LIGHT ASSEMBLY", "FOG LAMP", "DRIVING LIGHT"] },
  { key: "DOOR MIRROR", label: "Door Mirror", category: "Exterior", perVehicle: 2, maxPrice: 800, aliases: ["POWER MIRROR", "SIDE MIRROR", "HEATED MIRROR"] },
  { key: "GRILLE", label: "Grille", category: "Exterior", perVehicle: 1, maxPrice: 900, aliases: ["FRONT GRILLE", "UPPER GRILLE", "RADIATOR GRILLE"] },
  { key: "EMBLEM", label: "Emblem (set)", category: "Exterior", perVehicle: 1, maxPrice: 200, aliases: ["BADGE", "NAMEPLATE", "HOOD EMBLEM", "GRILLE EMBLEM", "TAILGATE EMBLEM"] },
  { key: "FUEL FILLER DOOR", label: "Fuel Door", category: "Exterior", perVehicle: 1, maxPrice: 250, aliases: ["FUEL DOOR", "GAS DOOR", "GAS CAP DOOR", "FUEL FILLER LID"] },
  { key: "ROOF RACK", label: "Roof Rack", category: "Exterior", perVehicle: 1, maxPrice: 600, conditional: true, aliases: ["ROOF RAILS", "LUGGAGE RACK", "ROOF RACK CROSS BARS", "CROSSBARS"] },
  { key: "TONNEAU COVER", label: "Tonneau Cover", category: "Exterior", perVehicle: 1, maxPrice: 1200, conditional: true, aliases: ["BED COVER", "TRUCK BED COVER"] },
  { key: "SPARE TIRE CARRIER", label: "Spare Tire Carrier", category: "Exterior", perVehicle: 1, maxPrice: 400, conditional: true, aliases: ["SPARE TIRE HOIST", "SPARE TIRE COVER", "SPARE TIRE HARD COVER"] },
  { key: "ROOF GLASS", label: "Sunroof Glass", category: "Exterior", perVehicle: 1, maxPrice: 800, conditional: true,
    aliases: ["SUN ROOF", "SUNROOF GLASS", "MOONROOF GLASS", "SUN ROOF GLASS", "SUNROOF PANEL", "MOON ROOF"] },
  { key: "QUARTER WINDOW GLASS", label: "Quarter Window Glass", category: "Exterior", perVehicle: 2, maxPrice: 400, conditional: true,
    aliases: ["QUARTER GLASS", "VENT WINDOW", "QUARTER VENT WINDOW", "REAR QUARTER GLASS"] },
  { key: "TAILGATE LATCH", label: "Tailgate Latch / Handle", category: "Exterior", perVehicle: 1, maxPrice: 300, conditional: true,
    aliases: ["TAILGATE HANDLE", "TAILGATE LOCK", "LIFTGATE LATCH", "TAILGATE LATCH HANDLE"] },
  { key: "TRUNK LATCH", label: "Trunk Latch / Actuator", category: "Exterior", perVehicle: 1, maxPrice: 250, conditional: true,
    aliases: ["TRUNK LOCK", "TRUNK LID LATCH", "TRUNK LOCK ACTUATOR", "DECK LID LATCH"] },
  { key: "CENTER CAP", label: "Wheel Center Caps (set)", category: "Exterior", perVehicle: 1, maxPrice: 200,
    aliases: ["CENTER CAPS", "WHEEL CENTER CAP", "WHEEL CAP", "HUB CENTER CAP"] },
  { key: "HUBCAP", label: "Hubcaps (set)", category: "Exterior", perVehicle: 1, maxPrice: 200, conditional: true, aliases: ["HUB CAP", "HUBCAPS"] },

  // ── Mechanical (bolt-on, ships easily) ──────────────────────────────
  { key: "GENERATOR", label: "Alternator", category: "Mechanical", perVehicle: 1, maxPrice: 500, aliases: ["ALTERNATOR"] },
  { key: "STARTER", label: "Starter", category: "Mechanical", perVehicle: 1, maxPrice: 400, aliases: ["STARTER MOTOR"] },
  { key: "AC COMPRESSOR", label: "A/C Compressor", category: "Mechanical", perVehicle: 1, maxPrice: 600,
    aliases: ["A C COMPRESSOR", "AIR CONDITIONING COMPRESSOR", "AIR COMPRESSOR", "AC COMPRESSOR CLUTCH"] },
  { key: "STEERING RACK", label: "Steering Rack / Gear", category: "Mechanical", perVehicle: 1, maxPrice: 900,
    aliases: ["POWER STEERING RACK", "RACK AND PINION", "STEERING GEAR BOX", "STEERING GEAR"] },
  { key: "POWER STEERING MOTOR", label: "Electric Power Steering Motor", category: "Mechanical", perVehicle: 1, maxPrice: 600,
    aliases: ["ELECTRIC POWER STEERING MOTOR", "EPS MOTOR", "POWER STEERING PUMP"] },
  { key: "THROTTLE BODY", label: "Throttle Body", category: "Mechanical", perVehicle: 1, maxPrice: 400, aliases: ["ELECTRONIC THROTTLE BODY"] },
  { key: "INTAKE MANIFOLD", label: "Intake Manifold", category: "Mechanical", perVehicle: 1, maxPrice: 600, aliases: ["UPPER INTAKE MANIFOLD", "INTAKE PLENUM"] },
  { key: "COOLING FAN", label: "Radiator Cooling Fan", category: "Mechanical", perVehicle: 1, maxPrice: 400, aliases: ["RADIATOR FAN", "FAN ASSEMBLY", "COOLING FAN MOTOR"] },
  { key: "VAPOR CANISTER", label: "EVAP Vapor Canister", category: "Mechanical", perVehicle: 1, maxPrice: 300, aliases: ["EVAP CANISTER", "CHARCOAL CANISTER", "FUEL VAPOR CANISTER"] },
];

export const PART_TYPE_KEYS: readonly string[] = PART_TYPES.map((p) => p.key);

export const PART_CATEGORIES: readonly PartCategory[] = ["Interior", "Electronics", "Exterior", "Mechanical"];

/**
 * Words that turn a type into a piece or accessory of it. A key containing
 * any of these is never a valued type, even if it ends with one
 * ("HEADLIGHT BULB", "RADIO KNOB", "GRILLE MOULDING").
 */
const PIECE_WORDS: ReadonlySet<string> = new Set([
  "BULB", "BULBS", "BALLAST", "BRACKET", "MOTOR", "COVER", "MOULDING", "MOLDING",
  "LENS", "GASKET", "SEAL", "SENSOR", "RELAY", "HARNESS", "WIRING", "CABLE", "KNOB", "BUTTON",
  "CLIP", "CLIPS", "SCREW", "BOLT", "ACTUATOR", "PULLEY", "CLUTCH", "BELT",
  "HOSE", "LINE", "LINES", "TUBE", "FILTER", "BRUSH", "SOLENOID", "PEDAL", "COLUMN", "SHAFT",
  "BOOT", "TIE", "ROD", "END", "LINK", "ARM", "SHROUD", "GUARD", "DEFLECTOR",
  "WASHER", "NOZZLE", "ANTENNA", "SPEAKER", "SPEAKERS", "FACEPLATE", "KIT", "PAIR",
  "HINGE", "HINGES", "STRIKER", "CYLINDER", "HANDLE", "BRACKETS", "MOUNT", "MOUNTS",
]);

interface AliasIndex {
  exact: Map<string, string>;
  /** Longest alias first so "RADIO BEZEL TRIM" beats "RADIO". */
  suffixes: Array<{ phrase: string; key: string }>;
}

function buildIndex(): AliasIndex {
  const exact = new Map<string, string>();
  const suffixes: Array<{ phrase: string; key: string }> = [];
  for (const p of PART_TYPES) {
    for (const spelling of [p.key, ...p.aliases]) {
      const canon = canonicalizeTypeKey(spelling);
      exact.set(canon, p.key);
      exact.set(spelling, p.key);
      suffixes.push({ phrase: canon, key: p.key });
      if (spelling !== canon) suffixes.push({ phrase: spelling, key: p.key });
    }
  }
  suffixes.sort((a, b) => b.phrase.length - a.phrase.length);
  return { exact, suffixes };
}

const INDEX = buildIndex();

/** Catalog names that would suffix-match a type but are a different part. */
const EXCLUDED_NAMES: ReadonlySet<string> = new Set(["DOOR ARMREST", "FLOOR MATS FRONT", "FLOOR MATS REAR"]);
const BY_KEY = new Map(PART_TYPES.map((p) => [p.key, p] as const));

/** Max leading tokens of model/trim residue tolerated before the type phrase. */
const MAX_RESIDUE_TOKENS = 3;

function hasPieceWord(tokens: readonly string[]): boolean {
  return tokens.some((t) => PIECE_WORDS.has(t));
}

/**
 * Map a canonical type key (or raw catalog spelling) to a Ferion part
 * type key, or null when out of scope.
 */
export function partTypeOf(typeKey: string): string | null {
  const canon = canonicalizeTypeKey(typeKey);
  if (!canon) return null;
  const stripped = canon.replace(/^(PICKUP|VAN|\d{4}) /, "");
  if (EXCLUDED_NAMES.has(stripped)) return null;
  const direct = INDEX.exact.get(canon);
  if (direct) return direct;

  // Trailing-phrase match: "<residue> TAIL LIGHT" where residue is a
  // short body/trim leftover ("PICKUP", "RAPTOR", "WOODGRAIN"). Alias
  // phrases are matched whole, so a piece word can only appear in the
  // residue — and there it means a component, not the part.
  for (const s of INDEX.suffixes) {
    if (!canon.endsWith(` ${s.phrase}`)) continue;
    const residueTokens = canon.slice(0, canon.length - s.phrase.length).trim().split(" ").filter(Boolean);
    if (residueTokens.length > MAX_RESIDUE_TOKENS) return null;
    if (hasPieceWord(residueTokens)) return null;
    return s.key;
  }
  return null;
}

export function partType(key: string): PartType | undefined {
  return BY_KEY.get(key);
}

/** Sum of per-vehicle units across non-conditional types. */
export const BASE_UNITS_PER_VEHICLE = PART_TYPES.filter((p) => !p.conditional).reduce((n, p) => n + p.perVehicle, 0);
