/**
 * Shared valuation types. Safe to import from client components.
 */

import type { PartCategory } from "@/lib/catalog/part-types";

/** One market data point for a part type on a vehicle, from any source. */
export interface MarketObservation {
  /** Ferion part type key (see PART_TYPES). */
  typeKey: string;
  yearStart: number;
  yearEnd: number;
  /** Catalog model the observation came from (upper-case). */
  model: string;
  /** Representative sold price, USD; null when unknown. */
  price: number | null;
  /** Sell-through as a percentage (65 = 65%); may exceed 100. */
  sellThroughPct: number | null;
  sold: number | null;
  active: number | null;
  source: "catalog" | "verified";
  /** 0..1; how much to trust `price`. */
  confidence: number;
  imageUrl: string | null;
  /** Original spelling the source used, for debugging / display. */
  sourceName: string;
}

export type MatchTier = "exact" | "generation" | "nearby";

export interface PartValuation {
  typeKey: string;
  label: string;
  category: PartCategory;
  perVehicle: number;
  /** Representative price for one unit, USD. */
  unitPrice: number;
  /** Sell-through fraction used (0..1); already capped. */
  sellThrough: number;
  /** True when no source gave a sell-through and a default was assumed. */
  sellThroughAssumed: boolean;
  /** unitPrice × perVehicle — the everything-sells ceiling. */
  grossValue: number;
  /** unitPrice × sellThrough × perVehicle — what to expect. */
  expectedValue: number;
  priceTier: MatchTier;
  sellThroughTier: MatchTier | null;
  /** Observations that contributed to the price. */
  priceSamples: number;
  verified: boolean;
  confidence: number;
  imageUrl: string | null;
  exclusiveGroup: string | null;
  /** False for the lesser members of an exclusive group. */
  countedInTotal: boolean;
}

export interface PartsValuation {
  parts: PartValuation[];
  /** Type keys we track but found no data for on this vehicle. */
  noData: Array<{ typeKey: string; label: string; category: PartCategory }>;
  /** Σ grossValue over counted parts. */
  grossValue: number;
  /** Σ expectedValue over counted parts. */
  expectedValue: number;
  /** Count of counted parts with data. */
  coveredTypes: number;
  totalTypes: number;
}

export type ScrapMaterial = "steel_shred" | "iron_engine" | "cast_aluminum" | "aluminum_wheels" | "copper";
export type ScrapPriceMap = Partial<Record<ScrapMaterial, number>>;

export type WheelMaterial = "aluminum" | "steel" | "unknown";
export type EngineBlockMaterial = "aluminum" | "iron" | "unknown";
export type ProfileSource = "cache" | "llm" | "heuristic" | "unavailable";

export interface VehicleProfile {
  year: number;
  make: string;
  model: string;
  curbWeightLbs: number | null;
  engineName: string | null;
  engineBlockMaterial: EngineBlockMaterial;
  engineWeightLbs: number | null;
  wheelMaterial: WheelMaterial;
  wheelsWeightLbs: number | null;
  copperLbs: number | null;
  catalyticConverterCount: number | null;
  catalyticConverterValueUsd: number | null;
  confidence: number | null;
  source: ProfileSource;
}

export interface ScrapLineItem {
  key: "engine" | "wheels" | "copper" | "remainder" | "catalytic_converters";
  label: string;
  materialLabel: string;
  weightLbs: number | null;
  pricePerLb: number | null;
  valueUsd: number | null;
}

export interface ScrapValuation {
  lineItems: ScrapLineItem[];
  totalValueUsd: number;
  remainderLbs: number | null;
  profileSource: ProfileSource;
  profileConfidence: number | null;
}

export interface VehicleValuation {
  input: { year: number; make: string; model: string; lot?: string | null; vin?: string | null };
  /** Canonical make + catalog match details. */
  resolved: {
    make: string;
    catalogMake: string | null;
    catalogModels: string[];
    matchHow: "exact" | "prefix" | "token" | "none";
    generationYears: number[];
  };
  scrap: ScrapValuation;
  parts: PartsValuation;
  /** scrap.totalValueUsd + parts.expectedValue */
  totalExpectedUsd: number;
  /** scrap.totalValueUsd + parts.grossValue */
  totalGrossUsd: number;
  warnings: string[];
}
