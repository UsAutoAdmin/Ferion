import { describe, expect, it } from "vitest";
import { buildExpansionPrompt, generationFromCrossCompat, genKey, parseExpansionPayload } from "./generations";

describe("parseExpansionPayload", () => {
  it("normalizes years, always includes the input year, clamps confidence", () => {
    const m = parseExpansionPayload({ expansions: [
      { year: 2011, make: "Honda", model: "Accord", compatible_years: [2012, 2008, 2009, 2010, 1800], confidence: 1.7 },
      { year: 2015, make: "Ford", model: "F150", compatible_years: [], confidence: 0 },
      { year: 2015, make: "", model: "X" },
    ] });
    expect(m.get(genKey(2011, "Honda", "Accord"))).toEqual({ years: [2008, 2009, 2010, 2011, 2012], confidence: 1 });
    expect(m.get(genKey(2015, "Ford", "F150"))).toEqual({ years: [2015], confidence: 0 });
    expect(m.size).toBe(2);
  });
});

describe("generationFromCrossCompat", () => {
  it("picks the most common covering range and clamps its reach", () => {
    const rows = [
      { compatible_year_start: 2009, compatible_year_end: 2026 }, // too wide, dropped
      { compatible_year_start: 2015, compatible_year_end: 2025 },
      { compatible_year_start: 2015, compatible_year_end: 2025 },
      { compatible_year_start: 2004, compatible_year_end: 2014 }, // does not cover
      { compatible_year_start: 2013, compatible_year_end: 2016 },
    ];
    expect(generationFromCrossCompat(2015, rows)).toEqual([2015, 2016, 2017, 2018, 2019, 2020]);
    expect(generationFromCrossCompat(2015, [{ compatible_year_start: null, compatible_year_end: 2016 }])).toBeNull();
  });
});

describe("buildExpansionPrompt", () => {
  it("lists every vehicle", () => {
    const p = buildExpansionPrompt([{ year: 2011, make: "Honda", model: "Accord" }, { year: 2015, make: "Ford", model: "F150" }]);
    expect(p).toContain("- 2011 Honda Accord");
    expect(p).toContain("- 2015 Ford F150");
  });
});
