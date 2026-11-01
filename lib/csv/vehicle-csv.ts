/**
 * Vehicle CSV parsing for bulk valuation. Accepts Copart / IAA exports
 * and plain Year/Make/Model sheets: headers are matched case- and
 * punctuation-insensitively against alias lists. Pure — Papa Parse does
 * the tokenizing in the browser; this maps rows to vehicle requests.
 */

import type { ParsedVehicleRequest } from "@/lib/valuation/request";

export type VehicleCsvRow = ParsedVehicleRequest;

type Field = "year" | "make" | "model" | "lot" | "vin";

const HEADER_ALIASES: Record<Field, string[]> = {
  year: ["Year", "Lot Year", "Model Year", "Vehicle Year", "Yr", "YR"],
  make: ["Make", "Lot Make Desc", "Lot Make", "Vehicle Make", "Make Desc", "Make Description", "Manufacturer", "Manufacturer Name", "Brand"],
  model: ["Model", "Lot Model Desc", "Lot Model", "Vehicle Model", "Model Desc", "Model Description", "Manufacturer Model", "Manufacturer Model Desc", "Model Group", "Model Detail"],
  lot: ["Lot/Inv #", "Lot Number", "Lot #", "Lot No", "Lot ID", "Lot", "Stock Number", "Stock #", "Stock", "Inventory #", "Unit #", "Claim #"],
  vin: ["VIN", "VIN Number", "Vehicle VIN", "VIN No", "Full VIN"],
};

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface HeaderMap { fields: Partial<Record<Field, string>>; unmapped: string[] }

/** Which original header feeds each field. First alias match wins. */
export function mapHeaders(headers: readonly string[]): HeaderMap {
  const byNorm = new Map<string, string>();
  for (const h of headers) if (!byNorm.has(normalizeHeader(h))) byNorm.set(normalizeHeader(h), h);
  const fields: Partial<Record<Field, string>> = {};
  const used = new Set<string>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[Field, string[]]>) {
    for (const a of aliases) {
      const original = byNorm.get(normalizeHeader(a));
      if (original && !used.has(original)) { fields[field] = original; used.add(original); break; }
    }
  }
  return { fields, unmapped: headers.filter((h) => !used.has(h)) };
}

export interface ParsedCsv {
  vehicles: VehicleCsvRow[];
  /** 1-based data row numbers that were skipped, with reasons. */
  skipped: Array<{ row: number; reason: string }>;
  headerMap: HeaderMap;
}

/**
 * Turn parsed rows (objects keyed by header) into vehicle requests. A
 * single "Vehicle" / "Description" column like "2015 FORD F-150" is
 * supported when no explicit year/make/model columns exist.
 */
export function rowsToVehicles(rows: ReadonlyArray<Record<string, string>>, headers: readonly string[]): ParsedCsv {
  const headerMap = mapHeaders(headers);
  const f = headerMap.fields;
  const descriptionCol = headers.find((h) => /^(vehicle|description|vehicle description|ymm|unit)$/i.test(h.trim()));
  const vehicles: VehicleCsvRow[] = [];
  const skipped: ParsedCsv["skipped"] = [];

  rows.forEach((row, i) => {
    const n = i + 1;
    const get = (field: Field) => (f[field] ? (row[f[field] as string] ?? "").trim() : "");
    let year = Number(get("year").replace(/[^0-9]/g, ""));
    let make = get("make");
    let model = get("model");
    if ((!year || !make || !model) && descriptionCol) {
      const m = (row[descriptionCol] ?? "").trim().match(/^(\d{4})\s+(\S+)\s+(.+)$/);
      if (m) { year = year || Number(m[1]); make = make || m[2]; model = model || m[3]; }
    }
    const empty = !year && !make && !model;
    if (empty) return; // blank / summary rows are silently ignored
    if (!Number.isInteger(year) || year < 1960 || year > new Date().getFullYear() + 1) return void skipped.push({ row: n, reason: `invalid year "${get("year")}"` });
    if (!make) return void skipped.push({ row: n, reason: "missing make" });
    if (!model) return void skipped.push({ row: n, reason: "missing model" });
    vehicles.push({ year, make, model, lot: get("lot") || null, vin: get("vin") || null });
  });

  return { vehicles, skipped, headerMap };
}
