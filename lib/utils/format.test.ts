import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatInteger,
  formatPercent,
} from "./format";

describe("formatCurrency", () => {
  it("rounds to whole dollars with grouping", () => {
    expect(formatCurrency(1234.56)).toBe("$1,235");
    expect(formatCurrency(0)).toBe("$0");
  });

  it("renders a dash for missing or non-finite values", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
    expect(formatCurrency(Number.NaN)).toBe("—");
  });
});

describe("formatCurrencyPrecise", () => {
  it("always shows two decimals", () => {
    expect(formatCurrencyPrecise(42)).toBe("$42.00");
    expect(formatCurrencyPrecise(1234.5)).toBe("$1,234.50");
  });
});

describe("formatInteger", () => {
  it("groups thousands and drops decimals", () => {
    expect(formatInteger(1234567.8)).toBe("1,234,568");
    expect(formatInteger(null)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("treats values ≤ 1 as ratios", () => {
    expect(formatPercent(0.425)).toBe("42.5%");
    expect(formatPercent(1)).toBe("100.0%");
  });

  it("treats values > 1 as percentages", () => {
    expect(formatPercent(45)).toBe("45.0%");
  });

  it("honors isPercent for small percentages", () => {
    expect(formatPercent(0.5, { isPercent: true })).toBe("0.5%");
  });

  it("respects digits", () => {
    expect(formatPercent(0.33333, { digits: 0 })).toBe("33%");
  });
});
