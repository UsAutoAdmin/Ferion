import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { parseVehicleRequest } from "@/lib/valuation/request";
import { valueVehicles } from "@/lib/valuation/value-vehicles.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { year, make, model } → VehicleValuation */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = parseVehicleRequest(body);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
  try {
    const [valuation] = await valueVehicles([parsed]);
    return NextResponse.json(valuation);
  } catch (err) {
    logger.error("single valuation failed", { error: String(err) });
    return NextResponse.json({ error: "Valuation failed. Check server configuration." }, { status: 500 });
  }
}
