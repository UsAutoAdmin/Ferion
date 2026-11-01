import { describe, expect, it } from "vitest";
import type { PartType } from "@/lib/catalog/part-types";
import { catalogRowToObservation, verifiedRowToObservation } from "./observations";
import { DEFAULT_SELL_THROUGH, median, tierOf, valueParts } from "./parts";
import type { MarketObservation } from "./types";

const TYPES: readonly PartType[] = [
  { key: "RADIO", label: "Radio", category: "Interior", perVehicle: 1, maxPrice: 900, aliases: [] },
  { key: "TAIL LIGHT", label: "Tail Light", category: "Exterior", perVehicle: 2, maxPrice: 900, aliases: [] },
  { key: "CENTER CONSOLE", label: "Center Console", category: "Interior", perVehicle: 1, maxPrice: 900, aliases: [], exclusiveGroup: "console" },
  { key: "CONSOLE LID", label: "Console Lid", category: "Interior", perVehicle: 1, maxPrice: 350, aliases: [], exclusiveGroup: "console" },
  { key: "JUMP SEAT", label: "Jump Seat", category: "Interior", perVehicle: 1, maxPrice: 900, aliases: [], conditional: true },
];

function obs(partial: Partial<MarketObservation> & { typeKey: string; year: number }): MarketObservation {
  const { year, ...rest } = partial;
  return {
    yearStart: year, yearEnd: year, model: "F150", price: null, sellThroughPct: null, sold: null, active: null,
    source: "catalog", confidence: 0.7, imageUrl: null, sourceName: partial.typeKey, ...rest,
  };
}

const v = { year: 2015, generationYears: [2015, 2016, 2017, 2018, 2019, 2020] };

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("tierOf", () => {
  it("classifies by year distance", () => {
    expect(tierOf(obs({ typeKey: "RADIO", year: 2015 }), v)).toBe("exact");
    expect(tierOf(obs({ typeKey: "RADIO", year: 2018 }), v)).toBe("generation");
    expect(tierOf(obs({ typeKey: "RADIO", year: 2013 }), v)).toBe("nearby");
    expect(tierOf(obs({ typeKey: "RADIO", year: 2009 }), v)).toBeNull();
    expect(tierOf({ ...obs({ typeKey: "RADIO", year: 2010 }), yearEnd: 2016 }, v)).toBe("exact");
  });
});

describe("valueParts", () => {
  it("uses exact-year data when it has enough samples and computes expected value", () => {
    const r = valueParts(v, [
      obs({ typeKey: "RADIO", year: 2015, price: 180, sellThroughPct: 50 }),
      obs({ typeKey: "RADIO", year: 2015, price: 200, sellThroughPct: 50 }),
      obs({ typeKey: "RADIO", year: 2015, price: 220, sellThroughPct: 50 }),
      obs({ typeKey: "RADIO", year: 2018, price: 400, sellThroughPct: 90 }),
    ], TYPES);
    const radio = r.parts.find((p) => p.typeKey === "RADIO")!;
    expect(radio.unitPrice).toBe(200);
    expect(radio.priceTier).toBe("exact");
    expect(radio.priceSamples).toBe(3);
    expect(radio.sellThrough).toBe(0.5);
    expect(radio.expectedValue).toBe(100);
  });

  it("pools the generation in when the exact year is thin", () => {
    const r = valueParts(v, [
      obs({ typeKey: "RADIO", year: 2015, price: 450 }),
      obs({ typeKey: "RADIO", year: 2017, price: 100 }),
      obs({ typeKey: "RADIO", year: 2018, price: 120 }),
    ], TYPES);
    const radio = r.parts[0];
    expect(radio.unitPrice).toBe(120);
    expect(radio.priceTier).toBe("generation");
    expect(radio.priceSamples).toBe(3);
  });

  it("falls back to nearby, and tiers price and sell-through separately", () => {
    const r = valueParts(v, [
      obs({ typeKey: "RADIO", year: 2015, sellThroughPct: 80 }), // ST only
      obs({ typeKey: "RADIO", year: 2013, price: 100 }), // nearby price
    ], TYPES);
    const radio = r.parts.find((p) => p.typeKey === "RADIO")!;
    expect(radio.priceTier).toBe("nearby");
    expect(radio.sellThroughTier).toBe("exact");
    expect(radio.expectedValue).toBe(80);
  });

  it("prefers verified prices inside a tier and medians catalog prices", () => {
    const r = valueParts(v, [
      obs({ typeKey: "RADIO", year: 2015, price: 100 }),
      obs({ typeKey: "RADIO", year: 2015, price: 300 }),
      obs({ typeKey: "RADIO", year: 2015, price: 900 }),
    ], TYPES);
    expect(r.parts[0].unitPrice).toBe(300);
    const r2 = valueParts(v, [
      obs({ typeKey: "RADIO", year: 2015, price: 100 }),
      obs({ typeKey: "RADIO", year: 2015, price: 180, source: "verified" }),
    ], TYPES);
    expect(r2.parts[0].unitPrice).toBe(180);
    expect(r2.parts[0].verified).toBe(true);
  });

  it("caps sell-through at 100% and assumes a default when none is reported", () => {
    const r = valueParts(v, [
      obs({ typeKey: "RADIO", year: 2015, price: 100, sellThroughPct: 250 }),
      obs({ typeKey: "TAIL LIGHT", year: 2015, price: 50 }),
    ], TYPES);
    const radio = r.parts.find((p) => p.typeKey === "RADIO")!;
    expect(radio.sellThrough).toBe(1);
    expect(radio.expectedValue).toBe(100);
    const tail = r.parts.find((p) => p.typeKey === "TAIL LIGHT")!;
    expect(tail.sellThroughAssumed).toBe(true);
    expect(tail.grossValue).toBe(100); // 2 per vehicle
    expect(tail.expectedValue).toBe(100 * DEFAULT_SELL_THROUGH);
  });

  it("derives sell-through from sold/active when the percentage is missing", () => {
    const r = valueParts(v, [obs({ typeKey: "RADIO", year: 2015, price: 100, sold: 1, active: 3 })], TYPES);
    expect(r.parts[0].sellThrough).toBe(0.25);
  });

  it("counts only the best member of an exclusive group in totals", () => {
    const r = valueParts(v, [
      obs({ typeKey: "CENTER CONSOLE", year: 2015, price: 300, sellThroughPct: 50 }),
      obs({ typeKey: "CONSOLE LID", year: 2015, price: 100, sellThroughPct: 100 }),
    ], TYPES);
    const console = r.parts.find((p) => p.typeKey === "CENTER CONSOLE")!;
    const lid = r.parts.find((p) => p.typeKey === "CONSOLE LID")!;
    expect(console.countedInTotal).toBe(true);
    expect(lid.countedInTotal).toBe(false);
    expect(r.expectedValue).toBe(150);
    expect(r.grossValue).toBe(300);
  });

  it("lists conditional types only with close data, and reports noData for the rest", () => {
    const nearbyOnly = valueParts(v, [obs({ typeKey: "JUMP SEAT", year: 2012, price: 200 })], TYPES);
    expect(nearbyOnly.parts.find((p) => p.typeKey === "JUMP SEAT")).toBeUndefined();
    expect(nearbyOnly.noData.map((n) => n.typeKey)).not.toContain("JUMP SEAT");
    expect(nearbyOnly.noData.map((n) => n.typeKey)).toContain("RADIO");
    const gen = valueParts(v, [obs({ typeKey: "JUMP SEAT", year: 2017, price: 200 })], TYPES);
    expect(gen.parts.find((p) => p.typeKey === "JUMP SEAT")?.priceTier).toBe("generation");
    expect(gen.totalTypes).toBe(4);
  });

  it("sorts by expected value", () => {
    const r = valueParts(v, [
      obs({ typeKey: "RADIO", year: 2015, price: 100, sellThroughPct: 10 }),
      obs({ typeKey: "TAIL LIGHT", year: 2015, price: 100, sellThroughPct: 90 }),
    ], TYPES);
    expect(r.parts.map((p) => p.typeKey)).toEqual(["TAIL LIGHT", "RADIO"]);
  });
});

describe("observation adapters", () => {
  it("maps catalog rows, decoding names and folding onto types", () => {
    const o = catalogRowToObservation({
      year: "2014", make: "Ford", model: "F150", part_name: "Pickup Anti-Lock Brake Pump", sell_through: "42.67",
      active: "88", sold: "32", avg_sell_price: "715.46", median_sell_price: "719.99", sold_volume: 17, best_image_url: "https://x/y.jpg",
    })!;
    expect(o.typeKey).toBe("ANTI LOCK BRAKE PUMP");
    expect(o.price).toBe(719.99);
    expect(o.sellThroughPct).toBe(42.67);
    expect(o.yearStart).toBe(2014);
    expect(o.confidence).toBeCloseTo(0.9);
    const ac = catalogRowToObservation({ year: 2016, make: "Ford", model: "F150", part_name: "Pickup A%2Fc Compressor", sell_through: null, active: null, sold: null, avg_sell_price: null, median_sell_price: null, sold_volume: null, best_image_url: null })!;
    expect(ac.typeKey).toBe("AC COMPRESSOR");
    expect(ac.price).toBeNull();
    expect(catalogRowToObservation({ year: 2016, make: "Ford", model: "F150", part_name: "Pickup Piston", sell_through: null, active: null, sold: null, avg_sell_price: null, median_sell_price: null, sold_volume: null, best_image_url: null })).toBeNull();
  });

  it("drops prices above the type ceiling but keeps the sell-through", () => {
    const o = catalogRowToObservation({ year: 2016, make: "Ford", model: "F150", part_name: "Jump Seat", sell_through: "64", active: "10", sold: "6", avg_sell_price: "1679.85", median_sell_price: "1679.85", sold_volume: 3, best_image_url: null })!;
    expect(o.price).toBeNull();
    expect(o.sellThroughPct).toBe(64);
  });

  it("maps only verified priced valuation rows", () => {
    const row = { make: "FORD", model: "F150", year_start: 2015, year_end: 2017, canonical_type: "STEERING WHEEL", market_price_usd: "120", sold_n_90d: 4, active_n: 86, sell_through_90d: "4.44", confidence: "0.44", status: "verified" };
    const o = verifiedRowToObservation(row)!;
    expect(o.source).toBe("verified");
    expect(o.yearEnd).toBe(2017);
    expect(o.confidence).toBe(0.5);
    expect(verifiedRowToObservation({ ...row, status: "insufficient" })).toBeNull();
    expect(verifiedRowToObservation({ ...row, market_price_usd: null })).toBeNull();
  });
});
