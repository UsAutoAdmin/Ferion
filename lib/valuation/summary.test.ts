import { describe, expect, it } from "vitest";
import { ageBucket, summarizeFleet, toCsv, vehiclesCsv } from "./summary";
import type { PartValuation, VehicleValuation } from "./types";

function part(p: Partial<PartValuation> & { typeKey: string; expectedValue: number }): PartValuation {
  return {
    label: p.typeKey, category: "Interior", perVehicle: 1, unitPrice: p.expectedValue, sellThrough: 1, sellThroughAssumed: false,
    grossValue: p.expectedValue, priceTier: "exact", sellThroughTier: "exact", priceSamples: 1, verified: false, confidence: 0.8,
    imageUrl: null, exclusiveGroup: null, countedInTotal: true, ...p,
  };
}

function vehicle(year: number, make: string, parts: PartValuation[], scrap: number, lot = "1"): VehicleValuation {
  const expected = parts.filter((p) => p.countedInTotal).reduce((s, p) => s + p.expectedValue, 0);
  return {
    input: { year, make, model: "X", lot, vin: null },
    resolved: { make, catalogMake: make.toUpperCase(), catalogModels: ["X"], matchHow: "exact", generationYears: [year] },
    scrap: { lineItems: [], totalValueUsd: scrap, remainderLbs: null, profileSource: "heuristic", profileConfidence: 0.3 },
    parts: { parts, noData: [], grossValue: expected, expectedValue: expected, coveredTypes: parts.length, totalTypes: 55 },
    totalExpectedUsd: scrap + expected, totalGrossUsd: scrap + expected, warnings: [],
  };
}

describe("summarizeFleet", () => {
  const results = [
    vehicle(2015, "Ford", [part({ typeKey: "RADIO", expectedValue: 100 }), part({ typeKey: "AIR BAG", expectedValue: 300 })], 800, "A"),
    vehicle(2005, "Honda", [part({ typeKey: "RADIO", expectedValue: 50 }), part({ typeKey: "CONSOLE LID", expectedValue: 40, countedInTotal: false })], 600, "B"),
    vehicle(2015, "Ford", [], 700, "C"),
  ];

  it("totals, averages and ranks part types", () => {
    const s = summarizeFleet(results);
    expect(s.vehicles).toBe(3);
    expect(s.matched).toBe(2);
    expect(s.totalExpected).toBe(800 + 400 + 600 + 50 + 700);
    expect(s.scrapTotal).toBe(2100);
    expect(s.partsExpected).toBe(450);
    expect(s.avgExpectedPerVehicle).toBe(850);
    expect(s.medianExpectedPerVehicle).toBe(700);
    expect(s.topTypes[0]).toEqual({ typeKey: "AIR BAG", label: "AIR BAG", vehicles: 1, expectedValue: 300, avgUnitPrice: 300 });
    expect(s.topTypes[1]).toEqual({ typeKey: "RADIO", label: "RADIO", vehicles: 2, expectedValue: 150, avgUnitPrice: 75 });
    expect(s.topTypes.find((t) => t.typeKey === "CONSOLE LID")).toBeUndefined();
    expect(s.byMake[0]).toEqual({ make: "Ford", vehicles: 2, expectedValue: 1900, avgExpected: 950 });
    expect(s.byAge.map((a) => a.bucket)).toEqual([ageBucket(2015), ageBucket(2005)]);
  });
});

describe("csv export", () => {
  it("quotes cells with commas and quotes", () => {
    expect(toCsv([["a,b", 'say "hi"', 3, null]])).toBe('"a,b","say ""hi""",3,');
  });

  it("writes one row per vehicle with top parts inline", () => {
    const csv = vehiclesCsv([vehicle(2015, "Ford", [part({ typeKey: "RADIO", expectedValue: 100 })], 800, "A")], 2);
    const lines = csv.split("\n");
    expect(lines[0].startsWith("Lot,VIN,Year,Make,Model")).toBe(true);
    expect(lines[0]).toContain("Part 2 Expected");
    expect(lines[1]).toContain("A,,2015,Ford,X,X,800,100,100,900,1,,RADIO,100,100,100,,,,");
  });
});
