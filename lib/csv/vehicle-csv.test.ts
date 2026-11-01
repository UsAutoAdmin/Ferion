import { describe, expect, it } from "vitest";
import { mapHeaders, rowsToVehicles } from "./vehicle-csv";

describe("mapHeaders", () => {
  it("recognises Copart headers regardless of punctuation and case", () => {
    const m = mapHeaders(["Lot/Inv #", "Lot Year", "Lot Make Desc", "Lot Model Desc", "VIN", "Odometer"]);
    expect(m.fields).toEqual({ lot: "Lot/Inv #", year: "Lot Year", make: "Lot Make Desc", model: "Lot Model Desc", vin: "VIN" });
    expect(m.unmapped).toEqual(["Odometer"]);
  });

  it("recognises plain and IAA-style headers", () => {
    expect(mapHeaders(["year", "MAKE", "Model", "Stock #"]).fields).toEqual({ year: "year", make: "MAKE", model: "Model", lot: "Stock #" });
  });
});

describe("rowsToVehicles", () => {
  const headers = ["Lot/Inv #", "Lot Year", "Lot Make Desc", "Lot Model Desc", "VIN"];

  it("maps rows and skips blanks and invalid rows with reasons", () => {
    const r = rowsToVehicles([
      { "Lot/Inv #": "123", "Lot Year": "2015", "Lot Make Desc": "FORD", "Lot Model Desc": "F150", VIN: "1FTEW1EF5FFA00001" },
      { "Lot/Inv #": "", "Lot Year": "", "Lot Make Desc": "", "Lot Model Desc": "", VIN: "" },
      { "Lot/Inv #": "124", "Lot Year": "abc", "Lot Make Desc": "FORD", "Lot Model Desc": "F150", VIN: "" },
      { "Lot/Inv #": "125", "Lot Year": "2012", "Lot Make Desc": "", "Lot Model Desc": "CAMRY", VIN: "" },
    ], headers);
    expect(r.vehicles).toEqual([{ year: 2015, make: "FORD", model: "F150", lot: "123", vin: "1FTEW1EF5FFA00001" }]);
    expect(r.skipped).toEqual([{ row: 3, reason: 'invalid year "abc"' }, { row: 4, reason: "missing make" }]);
  });

  it("falls back to a single description column", () => {
    const r = rowsToVehicles([{ Vehicle: "2015 FORD F-150 XLT", Stock: "9" }], ["Vehicle", "Stock"]);
    expect(r.vehicles).toEqual([{ year: 2015, make: "FORD", model: "F-150 XLT", lot: "9", vin: null }]);
  });
});
