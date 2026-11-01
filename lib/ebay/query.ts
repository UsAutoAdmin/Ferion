/**
 * eBay search construction for one vehicle × part type. Pure.
 *
 * Query shape follows Part Scout: "<year> <Make> <Model> <type words>",
 * where the type words are what sellers actually title the part, not our
 * canonical key ("ANTI LOCK BRAKE PUMP" → "ABS Pump Module").
 */

import { partType } from "@/lib/catalog/part-types";
import { modelTokens } from "@/lib/vehicles/normalize";

export interface EbayVehicle { year: number; make: string; model: string }

/** Canonical key → seller wording. Types not listed use their label. */
const SEARCH_TERMS: Readonly<Record<string, string>> = {
  RADIO: "Radio Receiver",
  "DASH BEZEL": "Radio Dash Bezel Trim",
  "INSTRUMENT CLUSTER BEZEL": "Cluster Bezel",
  "INSTRUMENT CLUSTER": "Instrument Cluster Speedometer",
  "CLIMATE CONTROL": "Climate Control Unit",
  "INFO SCREEN": "Display Screen",
  "OVERHEAD CONSOLE": "Overhead Console",
  "CENTER CONSOLE": "Center Console",
  "CONSOLE LID": "Console Lid Armrest",
  ARMREST: "Armrest",
  "SHIFTER TRIM": "Shifter Bezel Trim",
  "STEERING COLUMN COVER": "Steering Column Cover",
  "AIR VENT": "Dash Air Vent",
  "SILL PLATE": "Door Sill Plate",
  "DOME LIGHT": "Dome Light",
  "STEERING WHEEL": "Steering Wheel",
  "AIR BAG": "Airbag",
  CLOCKSPRING: "Clock Spring",
  "GLOVE BOX": "Glove Box",
  "SUN VISOR": "Sun Visor",
  HEADREST: "Headrest",
  "DOOR PANEL": "Door Panel",
  "SEAT SWITCH": "Power Seat Switch",
  "WINDOW SWITCH": "Master Window Switch",
  "CUP HOLDER": "Cup Holder",
  "FLOOR MATS": "Floor Mats",
  "REAR VIEW MIRROR": "Rear View Mirror",
  "KEY REMOTE FOB": "Key Fob Remote",
  "ENGINE CONTROL MODULE": "ECM ECU Engine Computer",
  "TRANSMISSION COMPUTER": "TCM Transmission Control Module",
  "ANTI LOCK BRAKE PUMP": "ABS Pump Module",
  "BRAKE BOOSTER": "Brake Booster",
  "FUSE BOX": "Fuse Box BCM",
  "AUDIO AMPLIFIER": "Amplifier",
  "BACK UP CAMERA": "Backup Camera",
  "IGNITION SWITCH": "Ignition Switch",
  "HEADLIGHT SWITCH": "Headlight Switch",
  "SUN ROOF MOTOR": "Sunroof Motor",
  "TRANSFER CASE SWITCH": "Transfer Case Switch",
  HEADLIGHT: "Headlight Assembly",
  "TAIL LIGHT": "Tail Light",
  "THIRD BRAKE LIGHT": "Third Brake Light",
  "FOG LIGHT": "Fog Light",
  "DOOR MIRROR": "Side Mirror",
  GRILLE: "Grille",
  EMBLEM: "Emblem",
  "FUEL FILLER DOOR": "Fuel Door",
  "ROOF RACK": "Roof Rack",
  "TONNEAU COVER": "Tonneau Cover",
  "SPARE TIRE CARRIER": "Spare Tire Carrier",
  "ROOF GLASS": "Sunroof Glass",
  "QUARTER WINDOW GLASS": "Quarter Glass",
  "TAILGATE LATCH": "Tailgate Latch",
  "TRUNK LATCH": "Trunk Latch",
  "CENTER CAP": "Wheel Center Cap",
  HUBCAP: "Hubcap Wheel Cover",
  GENERATOR: "Alternator",
  STARTER: "Starter Motor",
  "AC COMPRESSOR": "A/C Compressor",
  "STEERING RACK": "Steering Rack",
  "POWER STEERING MOTOR": "Power Steering Motor",
  "THROTTLE BODY": "Throttle Body",
  "INTAKE MANIFOLD": "Intake Manifold",
  "COOLING FAN": "Radiator Cooling Fan",
  "VAPOR CANISTER": "Vapor Canister",
};

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());
}

/** Seller wording for a type. */
export function searchTermForType(typeKey: string): string {
  return SEARCH_TERMS[typeKey] ?? partType(typeKey)?.label.replace(/\s*\(.*?\)\s*/g, "").split("/")[0].trim() ?? titleCase(typeKey);
}

/** First words that need the next word to name the model ("Grand Cherokee", "Range Rover"). */
const MULTIWORD_PREFIXES = new Set(["GRAND", "RANGE", "LAND", "CROWN", "TOWN", "SANTA", "MODEL", "SERIES", "MONTE", "PARK"]);

/**
 * "Silverado 1500" from "SILVERADO 1500 LT"; "F150" from "F-150"; "1500"
 * from "1500 BIG HORN". At most two words: the model and a numeric
 * series or the second half of a two-word name.
 */
export function ebayModel(rawModel: string): string {
  const tokens = modelTokens(rawModel.replace(/\b\d\.\d+L?\b/gi, " ")); // "2.5" engine size is not a series
  const keep = tokens.filter((t, i) => i === 0 || (i === 1 && (/^\d/.test(t) || MULTIWORD_PREFIXES.has(tokens[0]))));
  return keep.map((t) => (/\d/.test(t) || t.length <= 3 ? t : titleCase(t))).join(" ");
}

export function buildEbayQuery(v: EbayVehicle, typeKey: string): string {
  return `${v.year} ${titleCase(v.make)} ${ebayModel(v.model)} ${searchTermForType(typeKey)}`.replace(/\s+/g, " ").trim();
}

export const EBAY_PAGE_SIZE = 60;

/** Search URL; used-condition only, sold+completed when `sold`. */
export function ebaySearchUrl(query: string, opts: { sold: boolean }): string {
  const p = new URLSearchParams({ _nkw: query, _ipg: String(EBAY_PAGE_SIZE), LH_ItemCondition: "3000" });
  if (opts.sold) { p.set("LH_Sold", "1"); p.set("LH_Complete", "1"); }
  return `https://www.ebay.com/sch/i.html?${p.toString()}`;
}
