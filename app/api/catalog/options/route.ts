import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getCatalogIndex, listMakes, listModels } from "@/lib/vehicles/catalog-index.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/catalog/options            → { makes }
 *  GET /api/catalog/options?make=FORD  → { models } */
export async function GET(req: Request) {
  const make = new URL(req.url).searchParams.get("make");
  try {
    const index = await getCatalogIndex();
    if (make) return NextResponse.json({ models: listModels(index, make) }, { headers: { "Cache-Control": "public, max-age=600" } });
    return NextResponse.json({ makes: listMakes(index) }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (err) {
    logger.error("catalog options failed", { error: String(err) });
    return NextResponse.json({ error: "Catalog unavailable." }, { status: 500 });
  }
}
