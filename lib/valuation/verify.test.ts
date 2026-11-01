import { describe, expect, it } from "vitest";
import type { LiveMarket } from "@/lib/ebay/aggregate";
import { valueParts } from "./parts";
import type { MarketObservation, PartValuation, VehicleValuation } from "./types";
import { liveToObservation, pickTypesToVerify } from "./verify";

const part = (typeKey: string, expectedValue: number, countedInTotal = true): PartValuation => ({
  typeKey, label: typeKey, category: "Interior", perVehicle: 1, unitPrice: expectedValue, sellThrough: 1, sellThroughAssumed: false,
  grossValue: expectedValue, expectedValue, priceTier: "exact", sellThroughTier: "exact", priceSamples: 3, verified: false, confidence: 0.8, imageUrl: null, exclusiveGroup: null, countedInTotal,
});

const valuation = (parts: PartValuation[], noData: string[]): VehicleValuation => ({
  input: { year: 2015, make: "Ford", model: "F-150" },
  resolved: { make: "Ford", catalogMake: "FORD", catalogModels: ["F150"], matchHow: "exact", generationYears: [2015, 2016, 2017] },
  scrap: { lineItems: [], totalValueUsd: 0, remainderLbs: null, profileSource: "heuristic", profileConfidence: 0.3 },
  parts: { parts, noData: noData.map((k) => ({ typeKey: k, label: k, category: "Interior" })), grossValue: 0, expectedValue: 0, coveredTypes: parts.length, totalTypes: 55 },
  totalExpectedUsd: 0, totalGrossUsd: 0, warnings: [],
});

const live = (over: Partial<LiveMarket>): LiveMarket => ({
  typeKey: "RADIO", query: "2015 Ford F150 Radio Receiver", searchUrl: "u", resultCount: 100, soldN: 0, activeN: 20, sellThrough: null, soldAvailable: false,
  price: 80, priceBasis: "asking", priceP25: 60, priceP75: 100, askingMedian: 100, relevance: 0.9, rejectedN: 2, evidence: [], checkedAt: "2026-11-01T00:00:00Z", ...over,
});

describe("pickTypesToVerify", () => {
  it("takes counted parts by rank, skips alternates, pads with no-data types", () => {
    const v = valuation([part("RADIO", 300), part("ARMREST", 200, false), part("GRILLE", 100)], ["CENTER CONSOLE", "JUMP SEAT", "DOOR PANEL"]);
    expect(pickTypesToVerify(v, 4)).toEqual(["RADIO", "GRILLE", "CENTER CONSOLE", "DOOR PANEL"]); // JUMP SEAT is conditional
    expect(pickTypesToVerify(v, 1)).toEqual(["RADIO"]);
  });
});

describe("liveToObservation", () => {
  it("returns null without a price", () => {
    expect(liveToObservation(live({ price: null, priceBasis: "none" }), 2015, "F150")).toBeNull();
  });

  it("carries counts only when sold data was available", () => {
    const blocked = liveToObservation(live({}), 2015, "F150") as MarketObservation;
    expect(blocked.sold).toBeNull();
    expect(blocked.active).toBeNull();
    expect(blocked.sellThroughPct).toBeNull();
    const withSold = liveToObservation(live({ soldAvailable: true, soldN: 10, activeN: 30, sellThrough: 0.25, priceBasis: "sold" }), 2015, "F150") as MarketObservation;
    expect(withSold).toMatchObject({ sold: 10, active: 30, sellThroughPct: 25, source: "verified", yearStart: 2015, yearEnd: 2015 });
    expect(withSold.confidence).toBeGreaterThan(blocked.confidence);
  });

  it("wins the price tier over catalog rows but keeps catalog sell-through when sold is blocked", () => {
    const catalog: MarketObservation = { typeKey: "RADIO", yearStart: 2015, yearEnd: 2017, model: "F150", price: 400, sellThroughPct: 55, sold: 11, active: 9, source: "catalog", confidence: 0.6, imageUrl: null, sourceName: "RADIO" };
    const liveObs = liveToObservation(live({}), 2015, "F150") as MarketObservation;
    const parts = valueParts({ year: 2015, generationYears: [2015, 2016, 2017] }, [catalog, liveObs]);
    const radio = parts.parts.find((p) => p.typeKey === "RADIO")!;
    expect(radio.unitPrice).toBe(80);
    expect(radio.verified).toBe(true);
    expect(radio.sellThrough).toBe(0.55);
    expect(radio.sellThroughAssumed).toBe(false);
  });
});
