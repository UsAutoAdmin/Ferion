import { describe, expect, it } from "vitest";
import { classifyListing, titleNamesType, yearsInTitle, type RelevanceInput } from "./relevance";

const f150 = (over: Partial<RelevanceInput> = {}): RelevanceInput => ({
  title: "", fitsNote: null, make: "Ford", model: "F-150", year: 2015, generationYears: [2015, 2016, 2017], typeKey: "ANTI LOCK BRAKE PUMP", ...over,
});

describe("yearsInTitle", () => {
  it("reads ranges, 2-digit runs and single years", () => {
    expect(yearsInTitle("2015-2017 Ford F150 ABS", 2015)).toEqual([2015, 2016, 2017]);
    expect(yearsInTitle("15 16 17 Ford F150 ABS", 2015)).toEqual([2015, 2016, 2017]);
    expect(yearsInTitle("Ford F150 ABS 2016 OEM", 2015)).toEqual([2016]);
    expect(yearsInTitle("Ford F150 ABS FL34-2C405-BA", 2015)).toEqual([]);
  });
});

describe("classifyListing (live titles for 2015 F-150 ABS pump)", () => {
  it("accepts OEM pulls that name vehicle, type and overlapping years", () => {
    expect(classifyListing(f150({ title: "15 16 2015 2016 Ford F150 ABS Pump Anti Lock Brake Module Part FL34-2C405-BA" })).decision).toBe("accept");
    expect(classifyListing(f150({ title: "2015-2016 Ford F150 Pickup ABS Anti Lock Brake Pump Module Assembly OEM" })).decision).toBe("accept");
  });

  it("trusts eBay's fitment note when the title lacks a year", () => {
    const r = classifyListing(f150({ title: "Ford F150 ABS Pump Control Module T7 0265255796", fitsNote: "For: 2015 Ford F-150" }));
    expect(r).toEqual({ decision: "accept", reason: "ebay_fitment" });
  });

  it("rejects wrong years, other vehicles, aftermarket, services and pieces", () => {
    expect(classifyListing(f150({ title: "2009-2014 Ford F150 ABS Pump Module" })).reason).toBe("year_mismatch");
    expect(classifyListing(f150({ title: "2015 Toyota Tundra ABS Pump Module" })).reason).toBe("no_vehicle");
    expect(classifyListing(f150({ title: "Brand New ABS Pump Module for 2015 Ford F150" })).reason).toBe("aftermarket");
    expect(classifyListing(f150({ title: "Dorman ABS Module 2015 Ford F150" })).reason).toBe("aftermarket_brand");
    expect(classifyListing(f150({ title: "2015 Ford F150 ABS Module Repair Service" })).reason).toBe("service_or_broken");
    expect(classifyListing(f150({ title: "2015 Ford F150 ABS Pump Bracket" })).reason).toBe("component:bracket");
    expect(classifyListing(f150({ title: "2015 Ford F150 Steering Wheel" })).reason).toBe("type_not_named");
  });

  it("flags undecidable titles as ambiguous", () => {
    expect(classifyListing(f150({ title: "Ford F150 ABS Pump Module OEM" })).reason).toBe("no_year");
    expect(classifyListing(f150({ title: "ABS Pump Module for 2015 Ford F150" })).reason).toBe("fitment_wording");
  });

  it("does not flag type words as components of themselves", () => {
    const bezel = classifyListing({ title: "2015 2016 2017 Ford F150 Radio Dash Bezel Trim OEM", fitsNote: null, make: "Ford", model: "F-150", year: 2015, generationYears: [2015, 2016, 2017], typeKey: "DASH BEZEL" });
    expect(bezel.decision).toBe("accept");
    const wheel = classifyListing({ title: "2015 Ford F150 Steering Wheel Leather OEM", fitsNote: null, make: "Ford", model: "F-150", year: 2015, generationYears: [2015], typeKey: "STEERING WHEEL" });
    expect(wheel.decision).toBe("accept");
  });

  it("titleNamesType recognises aliases and synonyms", () => {
    expect(titleNamesType("Ford F150 Anti-Lock Brake Pump", "ANTI LOCK BRAKE PUMP")).toBe(true);
    expect(titleNamesType("Ford F150 Speedometer Gauge Cluster", "INSTRUMENT CLUSTER")).toBe(true);
    expect(titleNamesType("Ford F150 Alternator", "GENERATOR")).toBe(true);
    expect(titleNamesType("Ford F150 Tailgate", "RADIO")).toBe(false);
  });
});
