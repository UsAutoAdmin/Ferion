import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { parseBulkRequest } from "@/lib/valuation/request";
import { valueVehicles } from "@/lib/valuation/value-vehicles.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { vehicles: [{ year, make, model, lot?, vin? }] } → { results, rejected } */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = parseBulkRequest(body);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
  try {
    const started = Date.now();
    const results = await valueVehicles(parsed.vehicles);
    logger.info("bulk valuation", { vehicles: results.length, ms: Date.now() - started });
    return NextResponse.json({ results, rejected: parsed.rejected });
  } catch (err) {
    logger.error("bulk valuation failed", { error: String(err) });
    return NextResponse.json({ error: "Valuation failed. Check server configuration." }, { status: 500 });
  }
}
