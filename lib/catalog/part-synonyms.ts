/**
 * Runtime part-type synonym canonicalizer.
 *
 * The catalog stores the same physical part under many names — "Gauge",
 * "Speedometer", and "Instrument Cluster" are one part on the car — so
 * type-key dedupe (Vehicle Value / VIN lookup) and per-vehicle collapse
 * (Copart Analysis) double-count unless synonyms map to one key.
 *
 * `canonicalizeTypeKey` takes any part name / stripped type key and
 * returns a stable canonical key in three layers:
 *
 *   1. token normalization — compound-word splits, plural folding, and
 *      spelling variants (SUNVISOR → SUN VISOR, LAMP → LIGHT, GAUGES →
 *      GAUGE)
 *   2. bigram merges — two-word forms whose canonical spelling is one
 *      word (HEAD LIGHT → HEADLIGHT, HUB CAP → HUBCAP)
 *   3. synonym groups — full-key mapping to one canonical part type
 *      (GAS PEDAL → ACCELERATOR PEDAL, SPEEDOMETER → INSTRUMENT CLUSTER)
 *
 * Keys are matched in full, never by substring, so component listings
 * ("INSTRUMENT CLUSTER BEZEL", "HEADLIGHT BULB") stay distinct from the
 * assemblies they belong to. Display names are untouched — callers keep
 * showing the winning row's raw catalog name.
 *
 * Pure — no I/O. Seeded from `PART_ALIASES` in
 * scripts/add-database-parts.ts plus observed catalog duplicates.
 */

/**
 * Per-token spelling/plural normalization. Values may contain spaces
 * (compound splits); the result is re-tokenized after mapping.
 */
const TOKEN_MAP: Readonly<Record<string, string>> = {
  // Compound-word splits / joins toward the catalog-majority spelling.
  SUNVISOR: "SUN VISOR",
  SUNVISORS: "SUN VISOR",
  SUNROOF: "SUN ROOF",
  MOONROOF: "SUN ROOF",
  TAILLIGHT: "TAIL LIGHT",
  TAILLIGHTS: "TAIL LIGHT",
  TAILLAMP: "TAIL LIGHT",
  TAILLAMPS: "TAIL LIGHT",
  HEADLAMP: "HEADLIGHT",
  HEADLAMPS: "HEADLIGHT",
  HEADLIGHTS: "HEADLIGHT",
  FOGLIGHT: "FOG LIGHT",
  FOGLIGHTS: "FOG LIGHT",
  FOGLAMP: "FOG LIGHT",
  REARVIEW: "REAR VIEW",
  CUPHOLDER: "CUP HOLDER",
  CUPHOLDERS: "CUP HOLDER",
  KEYFOB: "KEY FOB",
  ANTILOCK: "ANTI LOCK",
  HANDBRAKE: "HAND BRAKE",
  BACKUP: "BACK UP",
  WINDSCREEN: "WINDSHIELD",
  SPEEDO: "SPEEDOMETER",
  // Lamp vs light — the catalog standardizes on LIGHT.
  LAMP: "LIGHT",
  LAMPS: "LIGHT",
  LIGHTS: "LIGHT",
  // Plural folding for tokens that appear both ways in the catalog.
  GAUGES: "GAUGE",
  VISORS: "VISOR",
  MIRRORS: "MIRROR",
  VENTS: "VENT",
  HINGES: "HINGE",
  SWITCHES: "SWITCH",
  NUTS: "NUT",
  PEDALS: "PEDAL",
  EMBLEMS: "EMBLEM",
  SPEAKERS: "SPEAKER",
  HEADRESTS: "HEADREST",
  // Filler tokens that never distinguish part types.
  ASSEMBLY: "",
  ASSY: "",
  // Body-style prefixes baked into some catalog names ("Pickup Tow
  // Hook", "Van Climate Control") — the same part either way.
  PICKUP: "",
  VAN: "",
};

/**
 * Adjacent-token merges applied after TOKEN_MAP, keyed "A B" → merged
 * token(s). Used where the canonical catalog spelling is one word.
 */
const BIGRAM_MAP: Readonly<Record<string, string>> = {
  "HEAD LIGHT": "HEADLIGHT",
  "HUB CAP": "HUBCAP",
  "CLOCK SPRING": "CLOCKSPRING",
};

/**
 * Full-key synonym groups: every physical duplicate maps to one
 * canonical type key. Keys and values are post-normalization (layers 1–2
 * already applied). Values must be fixed points of the whole pipeline so
 * canonicalization is idempotent.
 */
const SYNONYMS: Readonly<Record<string, string>> = {
  // Instrument cluster family (the screenshot dupes).
  GAUGE: "INSTRUMENT CLUSTER",
  "GAUGE CLUSTER": "INSTRUMENT CLUSTER",
  "GAUGE PANEL": "INSTRUMENT CLUSTER",
  SPEEDOMETER: "INSTRUMENT CLUSTER",
  "SPEEDOMETER CLUSTER": "INSTRUMENT CLUSTER",
  "SPEEDOMETER HEAD": "INSTRUMENT CLUSTER",
  "INSTRUMENT PANEL CLUSTER": "INSTRUMENT CLUSTER",
  CLUSTER: "INSTRUMENT CLUSTER",
  "DASH CLUSTER": "INSTRUMENT CLUSTER",
  "GAUGE CLUSTER SPEEDOMETER": "INSTRUMENT CLUSTER",
  "INSTRUMENT CLUSTER SPEEDOMETER": "INSTRUMENT CLUSTER",

  // Pedals.
  "GAS PEDAL": "ACCELERATOR PEDAL",
  "THROTTLE PEDAL": "ACCELERATOR PEDAL",
  "ACCELERATOR GAS PEDAL": "ACCELERATOR PEDAL",

  // Interior trim.
  VISOR: "SUN VISOR",
  "DRINK HOLDER": "CUP HOLDER",
  "FLOOR MAT": "FLOOR MATS",
  "FLOOR MAT SET": "FLOOR MATS",
  BADGE: "EMBLEM",

  // Wheels.
  "WHEEL COVER": "HUBCAP",
  "LUG NUT": "WHEEL LUG NUT",
  "WHEEL CENTER CAP": "CENTER CAP",

  // Fuel.
  "FUEL CAP": "GAS CAP",
  "FUEL FILLER CAP": "GAS CAP",
  "GAS FILLER CAP": "GAS CAP",

  // Brakes.
  "POWER BRAKE BOOSTER": "BRAKE BOOSTER",
  "VACUUM BRAKE BOOSTER": "BRAKE BOOSTER",
  "ABS PUMP": "ANTI LOCK BRAKE PUMP",
  "ABS BRAKE PUMP": "ANTI LOCK BRAKE PUMP",
  "ABS CONTROL MODULE": "ABS MODULE",
  "ANTI LOCK BRAKE MODULE": "ABS MODULE",
  "PARKING BRAKE": "EMERGENCY BRAKE",
  "PARK BRAKE": "EMERGENCY BRAKE",
  "E BRAKE": "EMERGENCY BRAKE",
  "HAND BRAKE": "EMERGENCY BRAKE",

  // Lighting.
  CHMSL: "THIRD BRAKE LIGHT",
  "CENTER HIGH MOUNT STOP LIGHT": "THIRD BRAKE LIGHT",
  "HIGH MOUNT BRAKE LIGHT": "THIRD BRAKE LIGHT",
  "HIGH MOUNT STOP LIGHT": "THIRD BRAKE LIGHT",
  "3RD BRAKE LIGHT": "THIRD BRAKE LIGHT",

  // Modules / electronics.
  "COMPUTER BOX ENGINE": "ENGINE CONTROL MODULE",
  "ENGINE COMPUTER": "ENGINE CONTROL MODULE",
  "ENGINE CONTROL UNIT": "ENGINE CONTROL MODULE",
  "ENGINE BRAIN BOX": "ENGINE CONTROL MODULE",
  ECM: "ENGINE CONTROL MODULE",
  ECU: "ENGINE CONTROL MODULE",
  PCM: "ENGINE CONTROL MODULE",
  "POWERTRAIN CONTROL MODULE": "ENGINE CONTROL MODULE",
  "TRANSMISSION CONTROL MODULE": "TRANSMISSION COMPUTER",
  "TRANSMISSION CONTROL UNIT": "TRANSMISSION COMPUTER",
  "COMPUTER BOX TRANSMISSION": "TRANSMISSION COMPUTER",
  TCM: "TRANSMISSION COMPUTER",
  ALTERNATOR: "GENERATOR",
  AMPLIFIER: "AUDIO AMPLIFIER",
  "RADIO AMPLIFIER": "AUDIO AMPLIFIER",
  "SOUND AMPLIFIER": "AUDIO AMPLIFIER",
  "STEREO AMPLIFIER": "AUDIO AMPLIFIER",
  "KEY FOB": "KEY REMOTE FOB",
  "REMOTE FOB": "KEY REMOTE FOB",
  "KEY REMOTE": "KEY REMOTE FOB",
  "REMOTE KEY FOB": "KEY REMOTE FOB",
  "KEY FOB REMOTE": "KEY REMOTE FOB",
  "SMART KEY": "KEY REMOTE FOB",
  "INFORMATION SCREEN": "INFO SCREEN",
  "INFO DISPLAY SCREEN": "INFO SCREEN",
  "DISPLAY SCREEN": "INFO SCREEN",
  "REAR CAMERA": "BACK UP CAMERA",
  "REVERSE CAMERA": "BACK UP CAMERA",
  "REAR VIEW CAMERA": "BACK UP CAMERA",

  // HVAC.
  "HVAC CONTROL": "CLIMATE CONTROL",
  "AC CONTROL": "CLIMATE CONTROL",
  "A C CONTROL": "CLIMATE CONTROL",
  "HEATER CONTROL": "CLIMATE CONTROL",
  "HEATER AC CONTROL": "CLIMATE CONTROL",
  "AC HEATER CONTROL": "CLIMATE CONTROL",
  "CLIMATE CONTROL PANEL": "CLIMATE CONTROL",
  "TEMPERATURE CONTROL": "CLIMATE CONTROL",

  // Mirrors.
  "INTERIOR MIRROR": "REAR VIEW MIRROR",
  "INTERIOR REAR VIEW MIRROR": "REAR VIEW MIRROR",
  "SIDE MIRROR": "DOOR MIRROR",
  "SIDE VIEW MIRROR": "DOOR MIRROR",
  "EXTERIOR MIRROR": "DOOR MIRROR",
  "WING MIRROR": "DOOR MIRROR",

  // Steering — one steering gear per car (rack or box, never both).
  "STEERING GEAR BOX": "STEERING RACK",
  "STEERING GEAR": "STEERING RACK",
  "STEERING BOX": "STEERING RACK",
  "RACK AND PINION": "STEERING RACK",
  "POWER STEERING RACK": "STEERING RACK",

  // Cooling.
  "RADIATOR FAN": "COOLING FAN",
  "RADIATOR COOLING FAN": "COOLING FAN",
  "ENGINE COOLING FAN": "COOLING FAN",
  "ELECTRIC COOLING FAN": "COOLING FAN",

  // Washer system.
  "WASHER RESERVOIR": "WINDSHIELD WASHER RESERVOIR",
  "WASHER BOTTLE": "WINDSHIELD WASHER RESERVOIR",
  "WASHER FLUID RESERVOIR": "WINDSHIELD WASHER RESERVOIR",
  "WINDSHIELD WASHER BOTTLE": "WINDSHIELD WASHER RESERVOIR",
  "WINDSHIELD WASHER TANK": "WINDSHIELD WASHER RESERVOIR",

  // Misc body / storage.
  "SPARE TIRE HOIST": "SPARE TIRE CARRIER",
  "SPARE TIRE HOLDER": "SPARE TIRE CARRIER",
  "LUGGAGE RACK": "ROOF RACK",
  "OWNER MANUAL": "OWNERS MANUAL",
};

function tokenize(input: string): string[] {
  return input
    .trim()
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function applyTokenMap(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    const mapped = TOKEN_MAP[t];
    if (mapped === undefined) {
      out.push(t);
    } else if (mapped !== "") {
      out.push(...mapped.split(" "));
    }
    // mapped === "" drops the token (filler like ASSEMBLY).
  }
  return out;
}

function applyBigrams(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (i + 1 < tokens.length) {
      const merged = BIGRAM_MAP[`${tokens[i]} ${tokens[i + 1]}`];
      if (merged !== undefined) {
        out.push(merged);
        i += 2;
        continue;
      }
    }
    out.push(tokens[i]);
    i += 1;
  }
  return out;
}

/**
 * Map a part name or stripped type key to its canonical type key.
 * Accepts any casing/punctuation; unknown keys pass through normalized.
 */
export function canonicalizeTypeKey(key: string): string {
  const tokens = applyBigrams(applyTokenMap(tokenize(key)));
  if (tokens.length === 0) return key.trim().toUpperCase();
  const joined = tokens.join(" ");
  return SYNONYMS[joined] ?? joined;
}

/**
 * Layers 1–2 only (token + bigram normalization, no synonym fold) for a
 * free-text string such as an eBay listing title. Lets callers test
 * whether a type's tokens appear in a title using the same spelling
 * normalization the type keys use ("Headlamp" and "HEADLIGHT" agree).
 */
export function normalizeTypeTokens(text: string): string[] {
  return applyBigrams(applyTokenMap(tokenize(text)));
}

/**
 * Every spelling that canonicalizes to `canonicalKey`, including the key
 * itself (post-normalization). Used to recognise a type in listing
 * titles ("SPEEDOMETER", "GAUGE CLUSTER" all mean INSTRUMENT CLUSTER).
 */
export function synonymVariants(canonicalKey: string): string[] {
  const target = canonicalizeTypeKey(canonicalKey);
  const out = new Set<string>([target]);
  for (const [variant, canonical] of Object.entries(SYNONYMS)) {
    if (canonical === target) out.add(variant);
  }
  return [...out];
}

/** Exposed for tests: verifies every synonym target is a fixed point. */
export function synonymTargets(): string[] {
  return [...new Set(Object.values(SYNONYMS))];
}
