/**
 * Validation for valuation API payloads. Pure, shared by both routes.
 */

export const BULK_LIMIT = 500;
const THIS_YEAR = new Date().getFullYear();

export interface ParsedVehicleRequest { year: number; make: string; model: string; lot: string | null; vin: string | null }

export function parseVehicleRequest(raw: unknown): ParsedVehicleRequest | string {
  if (!raw || typeof raw !== "object") return "Vehicle must be an object.";
  const o = raw as Record<string, unknown>;
  const year = Number(o.year);
  if (!Number.isInteger(year) || year < 1960 || year > THIS_YEAR + 1) return `Invalid year "${String(o.year)}".`;
  const make = typeof o.make === "string" ? o.make.trim() : "";
  const model = typeof o.model === "string" ? o.model.trim() : "";
  if (!make) return "Make is required.";
  if (!model) return "Model is required.";
  if (make.length > 40 || model.length > 60) return "Make/model too long.";
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : null);
  return { year, make, model, lot: str(o.lot), vin: str(o.vin) };
}

export function parseBulkRequest(raw: unknown): { vehicles: ParsedVehicleRequest[]; rejected: Array<{ index: number; error: string }> } | string {
  const list = raw && typeof raw === "object" ? (raw as { vehicles?: unknown }).vehicles : undefined;
  if (!Array.isArray(list)) return "Body must be { vehicles: [...] }.";
  if (list.length === 0) return "No vehicles provided.";
  if (list.length > BULK_LIMIT) return `At most ${BULK_LIMIT} vehicles per upload.`;
  const vehicles: ParsedVehicleRequest[] = [];
  const rejected: Array<{ index: number; error: string }> = [];
  list.forEach((v, index) => {
    const parsed = parseVehicleRequest(v);
    if (typeof parsed === "string") rejected.push({ index, error: parsed });
    else vehicles.push(parsed);
  });
  return { vehicles, rejected };
}
