import { describe, expect, it } from "vitest";
import { aggregateLiveMarket, type ClassifiedListing } from "./aggregate";

let n = 0;
const L = (source: "sold" | "active", price: number | null, decision: ClassifiedListing["decision"] = "accept"): ClassifiedListing => ({
  itemId: String(++n), title: `t${n}`, price, url: "u", source, decision, reason: "ok",
});

const base = { typeKey: "RADIO", query: "q", searchUrl: "s", resultCount: 50, maxPrice: 900 };

describe("aggregateLiveMarket", () => {
  it("prices from sold medians and computes sold/(sold+active)", () => {
    const m = aggregateLiveMarket({ ...base, soldAvailable: true, listings: [
      L("sold", 100), L("sold", 120), L("sold", 200), L("sold", 5000), // 5000 > ceiling → ignored for price
      L("active", 300), L("active", 310), L("active", null), L("active", 50, "reject"), L("active", 60, "ambiguous"),
    ] });
    expect(m.soldN).toBe(4);
    expect(m.activeN).toBe(3);
    expect(m.sellThrough).toBeCloseTo(4 / 7, 2);
    expect(m.priceBasis).toBe("sold");
    expect(m.price).toBe(120);
    expect(m.askingMedian).toBe(305);
    expect(m.rejectedN).toBe(1);
    expect(m.relevance).toBe(0.88); // 7 of 8 classified, rounded
  });

  it("falls back to discounted asking prices and leaves sell-through null when sold is unavailable", () => {
    const m = aggregateLiveMarket({ ...base, soldAvailable: false, listings: [L("active", 100), L("active", 150), L("active", 200)] });
    expect(m.priceBasis).toBe("asking");
    expect(m.price).toBe(120); // 150 × 0.8
    expect(m.sellThrough).toBeNull();
    expect(m.activeN).toBe(3);
  });

  it("reports no price with too little evidence", () => {
    const m = aggregateLiveMarket({ ...base, soldAvailable: true, listings: [L("active", 100), L("sold", 90)] });
    expect(m.priceBasis).toBe("none");
    expect(m.price).toBeNull();
    expect(m.sellThrough).toBe(0.5);
  });

  it("zero relevant listings → sell-through null, not zero", () => {
    const m = aggregateLiveMarket({ ...base, soldAvailable: true, listings: [L("active", 100, "reject")] });
    expect(m.sellThrough).toBeNull();
    expect(m.relevance).toBe(0);
  });
});
