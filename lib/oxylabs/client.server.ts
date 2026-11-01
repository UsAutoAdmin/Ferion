import "server-only";

import { logger } from "@/lib/logger";

/**
 * Minimal Oxylabs Web Scraper API client (realtime endpoint, basic auth).
 * One call = one page. Callers pass a `source` plus either `url` or
 * `query`; we return the raw content and the upstream status so parsers
 * can decide what to do with it.
 */

const ENDPOINT = "https://realtime.oxylabs.io/v1/queries";
/** Oxylabs holds the connection while it retries upstream; be generous. */
const TIMEOUT_MS = 170_000;

export interface OxylabsRequest {
  source: "ebay" | "ebay_search" | "universal";
  url?: string;
  query?: string;
  domain?: string;
  geo_location?: string;
  render?: "html";
}

export interface OxylabsResult {
  /** Upstream status Oxylabs reports (200, or 6xx for its own faults). */
  statusCode: number;
  content: string;
  url: string | null;
  /** True when Oxylabs gave up (status 613) or returned no usable body. Target-specific challenge pages are the parser's call. */
  blocked: boolean;
  durationMs: number;
}

export function oxylabsAvailable(): boolean {
  return Boolean(process.env.OXYLABS_USERNAME && process.env.OXYLABS_PASSWORD);
}

function authHeader(): string {
  const u = process.env.OXYLABS_USERNAME ?? "";
  const p = process.env.OXYLABS_PASSWORD ?? "";
  return `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
}

export async function oxylabsScrape(req: OxylabsRequest): Promise<OxylabsResult> {
  if (!oxylabsAvailable()) throw new Error("Oxylabs credentials not configured.");
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: authHeader() },
      body: JSON.stringify(req),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const durationMs = Date.now() - started;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Oxylabs HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { results?: Array<{ content?: unknown; status_code?: number; url?: string }> };
    const first = json.results?.[0];
    const content = typeof first?.content === "string" ? first.content : "";
    const statusCode = first?.status_code ?? 0;
    const blocked = statusCode !== 200 || content.length < 5000;
    logger.info("oxylabs.scrape", { source: req.source, statusCode, bytes: content.length, blocked, durationMs });
    return { statusCode, content, url: first?.url ?? null, blocked, durationMs };
  } finally {
    clearTimeout(timer);
  }
}
