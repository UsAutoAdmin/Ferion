import { describe, expect, it } from "vitest";
import { canonicalMake, catalogMakeKeys, displayModel, matchCatalogModels, modelTokens } from "./normalize";

describe("canonicalMake", () => {
  it("resolves auction codes and free text", () => {
    expect(canonicalMake("TOYT")).toBe("Toyota");
    expect(canonicalMake("chevy")).toBe("Chevrolet");
    expect(canonicalMake("MERZ")).toBe("Mercedes-Benz");
    expect(canonicalMake("mercedes benz")).toBe("Mercedes-Benz");
    expect(canonicalMake("land rover")).toBe("Land Rover");
    expect(canonicalMake("bmw")).toBe("BMW");
    expect(canonicalMake("Honda")).toBe("Honda");
    expect(canonicalMake("  ford ")).toBe("Ford");
  });
});

describe("catalogMakeKeys", () => {
  it("expands makes the catalog files differently", () => {
    expect(catalogMakeKeys("Ram")).toEqual(["RAM", "DODGE"]);
    expect(catalogMakeKeys("Land Rover")).toContain("ROVER");
    expect(catalogMakeKeys("Toyota")).toEqual(["TOYOTA"]);
  });
});

describe("modelTokens", () => {
  it("strips trim and body noise but keeps the first token", () => {
    expect(modelTokens("F-150 XLT SuperCrew 4x4")).toEqual(["F150"]);
    expect(modelTokens("Silverado 1500 LT")).toEqual(["SILVERADO", "1500"]);
    expect(modelTokens("Grand Cherokee Laredo")).toEqual(["GRAND", "CHEROKEE"]);
    expect(modelTokens("Ram 1500 Big Horn")).toEqual(["1500", "BIG", "HORN"]);
    expect(modelTokens("XLT")).toEqual(["XLT"]);
  });
});

describe("matchCatalogModels", () => {
  const ford = ["F150", "F250", "F250SD", "F350", "EXPLORER", "FOCUS", "CROWN", "FORD", "FIVE", "E150"];
  const toyota = ["4", "CAMRY", "COROLLA", "LAND", "TACOMA", "TUNDRA", "FJ", "86"];
  const jeep = ["GRAND", "CHEROKEE", "WRANGLER", "COMPASS"];
  const rover = ["RANGE", "DISCOVERY", "EVOQUE", "LAND", "LR4"];
  const dodge = ["1500", "2500", "CHARGER", "CARAVAN", "RAM"];

  it("matches exact spellings regardless of punctuation", () => {
    expect(matchCatalogModels("F-150", ford)).toEqual({ models: ["F150"], how: "exact" });
    expect(matchCatalogModels("f150 xlt", ford)).toEqual({ models: ["F150"], how: "exact" });
    expect(matchCatalogModels("Camry", toyota)).toEqual({ models: ["CAMRY"], how: "exact" });
  });

  it("matches the catalog's first-token models", () => {
    expect(matchCatalogModels("4Runner", toyota)).toEqual({ models: ["4"], how: "prefix" });
    expect(matchCatalogModels("4 Runner SR5", toyota)).toEqual({ models: ["4"], how: "prefix" });
    expect(matchCatalogModels("Land Cruiser", toyota)).toEqual({ models: ["LAND"], how: "prefix" });
    expect(matchCatalogModels("Range Rover Sport", rover)).toEqual({ models: ["RANGE"], how: "prefix" });
    expect(matchCatalogModels("Crown Victoria", ford)).toEqual({ models: ["CROWN"], how: "prefix" });
    expect(matchCatalogModels("Five Hundred", ford)).toEqual({ models: ["FIVE"], how: "prefix" });
  });

  it("does not merge Grand Cherokee into Cherokee", () => {
    expect(matchCatalogModels("Grand Cherokee", jeep)).toEqual({ models: ["GRAND"], how: "prefix" });
    expect(matchCatalogModels("Cherokee", jeep)).toEqual({ models: ["CHEROKEE"], how: "exact" });
  });

  it("falls back to a later token", () => {
    expect(matchCatalogModels("Ram 1500 Big Horn", [...dodge, "150"], "DODGE")).toEqual({ models: ["1500"], how: "prefix" });
    expect(matchCatalogModels("Sierra 1500", ["1500", "2500", "ACADIA"])).toEqual({ models: ["1500"], how: "token" });
  });

  it("handles Super Duty suffixes", () => {
    expect(matchCatalogModels("F-250 Super Duty", ford)).toEqual({ models: ["F250", "F250SD"], how: "exact" });
    expect(matchCatalogModels("F250SD", ford)).toEqual({ models: ["F250SD"], how: "exact" });
  });

  it("ignores make-named junk rows and reports no match", () => {
    expect(matchCatalogModels("Ford", ford, "FORD")).toEqual({ models: [], how: "none" });
    expect(matchCatalogModels("Zephyr", ford)).toEqual({ models: [], how: "none" });
    expect(matchCatalogModels("", ford)).toEqual({ models: [], how: "none" });
  });
});

describe("displayModel", () => {
  it("title-cases words, keeps codes", () => {
    expect(displayModel("CROWN")).toBe("Crown");
    expect(displayModel("F150")).toBe("F150");
    expect(displayModel("CR-V")).toBe("CR-V");
    expect(displayModel("GRAND")).toBe("Grand");
  });
});
