import { describe, expect, it } from "vitest";
import { classifyVehicle, computeScrapValuation, DEFAULT_SCRAP_PRICES, heuristicProfile, parseProfilePayload, toPriceMap } from "./scrap";
import type { VehicleProfile } from "./types";

const profile: VehicleProfile = {
  year: 2015, make: "Ford", model: "F150", curbWeightLbs: 4500, engineName: "5.0L V8", engineBlockMaterial: "aluminum",
  engineWeightLbs: 500, wheelMaterial: "aluminum", wheelsWeightLbs: 100, copperLbs: 60, catalyticConverterCount: 2,
  catalyticConverterValueUsd: 400, confidence: 0.9, source: "cache",
};

describe("computeScrapValuation", () => {
  it("prices each carve-out at its material and the remainder as shred", () => {
    const r = computeScrapValuation(profile, DEFAULT_SCRAP_PRICES);
    const by = Object.fromEntries(r.lineItems.map((i) => [i.key, i]));
    expect(by.engine.valueUsd).toBe(250); // 500 × 0.50
    expect(by.wheels.valueUsd).toBe(80); // 100 × 0.80
    expect(by.copper.valueUsd).toBe(210); // 60 × 3.50
    expect(r.remainderLbs).toBe(3840);
    expect(by.remainder.valueUsd).toBe(384);
    expect(by.catalytic_converters.valueUsd).toBe(400);
    expect(r.totalValueUsd).toBe(1324);
    expect(r.profileSource).toBe("cache");
  });

  it("handles unknown materials and missing weights without NaN", () => {
    const r = computeScrapValuation({ ...profile, engineBlockMaterial: "unknown", curbWeightLbs: null, copperLbs: null }, DEFAULT_SCRAP_PRICES);
    const by = Object.fromEntries(r.lineItems.map((i) => [i.key, i]));
    expect(by.engine.valueUsd).toBeNull();
    expect(by.copper.valueUsd).toBeNull();
    expect(r.remainderLbs).toBeNull();
    expect(r.totalValueUsd).toBe(480);
  });

  it("clamps the remainder at zero", () => {
    const r = computeScrapValuation({ ...profile, curbWeightLbs: 1000 }, DEFAULT_SCRAP_PRICES);
    expect(r.remainderLbs).toBe(340);
    const r2 = computeScrapValuation({ ...profile, curbWeightLbs: 1000, engineWeightLbs: 2000 }, DEFAULT_SCRAP_PRICES);
    expect(r2.remainderLbs).toBe(0);
  });
});

describe("toPriceMap", () => {
  it("reads the price board rows", () => {
    expect(toPriceMap([{ material: "copper", price_per_lb: "3.5" }, { material: "steel_shred", price_per_lb: 0.1 }, { material: "x", price_per_lb: null }]))
      .toEqual({ copper: 3.5, steel_shred: 0.1 });
  });
});

describe("parseProfilePayload", () => {
  it("applies plausibility windows", () => {
    const p = parseProfilePayload({ curb_weight_lbs: 3300, engine_name: " 2.4L I4 ", engine_block_material: "Aluminum", engine_weight_lbs: 350, wheel_material: "steel", wheels_weight_lbs: 80, copper_lbs: 55, catalytic_converter_count: 1, catalytic_converter_value_usd: 120.456, confidence: 1.4 });
    expect(p.curbWeightLbs).toBe(3300);
    expect(p.engineName).toBe("2.4L I4");
    expect(p.engineBlockMaterial).toBe("aluminum");
    expect(p.wheelMaterial).toBe("steel");
    expect(p.catalyticConverterValueUsd).toBe(120.46);
    expect(p.confidence).toBe(1);
    const bad = parseProfilePayload({ curb_weight_lbs: 33000, engine_block_material: "plastic", wheels_weight_lbs: 5, catalytic_converter_value_usd: -4 });
    expect(bad.curbWeightLbs).toBeNull();
    expect(bad.engineBlockMaterial).toBe("unknown");
    expect(bad.wheelsWeightLbs).toBeNull();
    expect(bad.catalyticConverterValueUsd).toBeNull();
  });
});

describe("heuristic profile", () => {
  it("classifies common vehicles", () => {
    expect(classifyVehicle("Ford", "F150")).toBe("truck");
    expect(classifyVehicle("Ford", "F-150")).toBe("truck");
    expect(classifyVehicle("Honda", "CR-V")).toBe("suv");
    expect(classifyVehicle("Ram", "1500 Big Horn")).toBe("truck");
    expect(classifyVehicle("Toyota", "4")).toBe("suv");
    expect(classifyVehicle("Honda", "Civic")).toBe("compact");
    expect(classifyVehicle("Honda", "Accord")).toBe("midsize");
    expect(classifyVehicle("Chevrolet", "Express")).toBe("van");
    expect(classifyVehicle("BMW", "750LI")).toBe("luxury");
  });

  it("produces a low-confidence, fully populated profile", () => {
    const p = heuristicProfile(2015, "Ford", "F150");
    expect(p.source).toBe("heuristic");
    expect(p.confidence).toBe(0.3);
    expect(p.curbWeightLbs).toBeGreaterThan(4000);
    expect(p.engineBlockMaterial).toBe("iron");
    const old = heuristicProfile(1995, "Honda", "Civic");
    expect(old.wheelMaterial).toBe("steel");
    expect(computeScrapValuation(p, DEFAULT_SCRAP_PRICES).totalValueUsd).toBeGreaterThan(500);
  });
});
