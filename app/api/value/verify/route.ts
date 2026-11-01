import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { parseVehicleRequest } from "@/lib/valuation/request";
import { liveVerificationAvailable, verifyVehicle } from "@/lib/valuation/verify.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST { year, make, model, topN? } → VehicleValuation with live eBay readings */
export async function POST(req: Request) {
  if (!liveVerificationAvailable()) return NextResponse.json({ error: "Live verification not configured (OXYLABS_USERNAME / OXYLABS_PASSWORD)." }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = parseVehicleRequest(body);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
  const topNRaw = Number((body as { topN?: unknown }).topN);
  const topN = Number.isInteger(topNRaw) && topNRaw > 0 ? Math.min(topNRaw, 30) : undefined;
  try {
    return NextResponse.json(await verifyVehicle(parsed, topN));
  } catch (err) {
    logger.error("live verification failed", { error: String(err) });
    return NextResponse.json({ error: "Live verification failed." }, { status: 500 });
  }
}

/** GET → whether live verification is configured (UI decides to auto-run). */
export function GET() {
  return NextResponse.json({ available: liveVerificationAvailable() });
}
