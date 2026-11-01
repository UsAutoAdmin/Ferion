import { describe, expect, it } from "vitest";
import { PART_TYPES } from "@/lib/catalog/part-types";
import { buildEbayQuery, ebayModel, ebaySearchUrl, searchTermForType } from "./query";

describe("buildEbayQuery", () => {
  it("uses seller wording for the type", () => {
    expect(buildEbayQuery({ year: 2015, make: "Ford", model: "F-150" }, "ANTI LOCK BRAKE PUMP")).toBe("2015 Ford F150 ABS Pump Module");
    expect(buildEbayQuery({ year: 2018, make: "RAM", model: "1500 BIG HORN" }, "RADIO")).toBe("2018 Ram 1500 Radio Receiver");
    expect(buildEbayQuery({ year: 2011, make: "Jeep", model: "GRAND CHEROKEE" }, "DASH BEZEL")).toBe("2011 Jeep Grand Cherokee Radio Dash Bezel Trim");
  });

  it("drops trim noise but keeps multi-word models", () => {
    expect(ebayModel("SILVERADO 1500 LT")).toBe("Silverado 1500");
    expect(ebayModel("ACCORD EX-L")).toBe("Accord");
    expect(ebayModel("CR-V")).toBe("CRV");
    expect(ebayModel("RANGE ROVER SPORT")).toBe("Range Rover");
    expect(ebayModel("ALTIMA 2.5 S")).toBe("Altima");
  });

  it("has a search term for every tracked type", () => {
    for (const t of PART_TYPES) {
      const term = searchTermForType(t.key);
      expect(term.length, t.key).toBeGreaterThan(2);
      expect(term, t.key).not.toMatch(/\(|\)/);
    }
  });

  it("builds used-only search URLs with and without the sold filter", () => {
    const active = new URL(ebaySearchUrl("2015 Ford F150 Radio Receiver", { sold: false }));
    expect(active.searchParams.get("_nkw")).toBe("2015 Ford F150 Radio Receiver");
    expect(active.searchParams.get("LH_ItemCondition")).toBe("3000");
    expect(active.searchParams.get("LH_Sold")).toBeNull();
    const sold = new URL(ebaySearchUrl("x", { sold: true }));
    expect(sold.searchParams.get("LH_Sold")).toBe("1");
    expect(sold.searchParams.get("LH_Complete")).toBe("1");
  });
});
