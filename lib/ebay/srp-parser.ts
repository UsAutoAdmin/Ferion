/**
 * eBay search-results (SRP) HTML → listings. Pure, regex-based: the page
 * is 1–4 MB and we only need a handful of fields per tile. Handles the
 * current `s-card` markup and the legacy `s-item` markup.
 */

export interface EbayListing {
  itemId: string;
  title: string;
  /** eBay's fitment annotation when present: "(For: 2015 Ford F-150)". */
  fitsNote: string | null;
  price: number | null;
  condition: string | null;
  url: string;
  /** ISO date for sold tiles; null for active. */
  soldAt: string | null;
}

export interface EbaySrp {
  /** eBay's own "N results" heading; null when not shown. */
  resultCount: number | null;
  listings: EbayListing[];
}

const PLACEHOLDER_IDS = new Set(["123456"]);

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function first(block: string, re: RegExp): string | null {
  const m = block.match(re);
  return m ? stripTags(m[1]) : null;
}

export function parsePrice(text: string | null): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\$\s?(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

export function parseSoldDate(block: string): string | null {
  const m = stripTags(block).match(/Sold\s+([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[1]];
  if (month === undefined) return null;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[2]))).toISOString().slice(0, 10);
}

/** Split "Title text (For: 2015 Ford F-150)Opens in a new window or tab". */
export function cleanTitle(raw: string): { title: string; fitsNote: string | null } {
  let t = raw.replace(/Opens in a new window or tab/g, "").replace(/^New Listing/i, "").trim();
  let fitsNote: string | null = null;
  const m = t.match(/\((For:[^)]*)\)\s*$/);
  if (m) { fitsNote = m[1]; t = t.slice(0, m.index).trim(); }
  return { title: t, fitsNote };
}

export function parseResultCount(html: string): number | null {
  const heading = html.match(/srp-controls__count-heading["']?[^>]*>([\s\S]*?)<\/h1>/);
  const text = heading ? stripTags(heading[1]) : null;
  const m = text?.replace(/,/g, "").match(/(\d+)\+?\s+results?/i);
  return m ? Number(m[1]) : null;
}

/**
 * eBay serves both quoted (`class="s-card__title"`) and minified unquoted
 * (`class=s-card__title`) attribute markup; match the class token followed
 * by the end of the attribute either way.
 */
const cls = (name: string) => `${name}(?:"|'|\\s|>)[^>]*>`;
const TITLE_RE = new RegExp(`${cls("s-card__title")}([\\s\\S]*?)<\\/div>`);
const LEGACY_TITLE_RE = new RegExp(`${cls("s-item__title")}([\\s\\S]*?)<\\/(?:div|h3|span)>`);
const PRICE_RE = new RegExp(`${cls("s-card__price")}([\\s\\S]*?)<\\/span>`);
const LEGACY_PRICE_RE = new RegExp(`${cls("s-item__price")}([\\s\\S]*?)<\\/span>`);
const SUBTITLE_RE = new RegExp(`${cls("s-card__subtitle")}([\\s\\S]*?)<\\/div>`);
const LEGACY_SUBTITLE_RE = new RegExp(`${cls("SECONDARY_INFO")}([\\s\\S]*?)<\\/span>`);
const TILE_SOURCE = `<li[^>]*class=["']?(?:s-card|s-item)(?:["'\\s][^>]*)?>[\\s\\S]*?<\\/li>`;
const TILE_RE = new RegExp(TILE_SOURCE, "g");
const HAS_TILE_RE = new RegExp(TILE_SOURCE);

function parseCard(block: string): EbayListing | null {
  const id = block.match(/\/itm\/(\d{9,15})/)?.[1];
  if (!id || PLACEHOLDER_IDS.has(id)) return null;
  const rawTitle = first(block, TITLE_RE) ?? first(block, LEGACY_TITLE_RE);
  if (!rawTitle || /^Shop on eBay$/i.test(rawTitle)) return null;
  const { title, fitsNote } = cleanTitle(rawTitle);
  if (!title) return null;
  const price = parsePrice(first(block, PRICE_RE) ?? first(block, LEGACY_PRICE_RE));
  const condition = first(block, SUBTITLE_RE) ?? first(block, LEGACY_SUBTITLE_RE);
  return { itemId: id, title, fitsNote, price, condition, url: `https://www.ebay.com/itm/${id}`, soldAt: parseSoldDate(block) };
}

/** eBay's bot-check interstitial (no tiles, verification copy). */
export function isChallengePage(html: string): boolean {
  return !HAS_TILE_RE.test(html) && /Please verify yourself|Pardon Our Interruption/.test(html);
}

export function parseEbaySrp(html: string): EbaySrp {
  const blocks = [...html.matchAll(TILE_RE)].map((m) => m[0]);
  const seen = new Set<string>();
  const listings: EbayListing[] = [];
  for (const b of blocks) {
    const l = parseCard(b);
    if (l && !seen.has(l.itemId)) { seen.add(l.itemId); listings.push(l); }
  }
  return { resultCount: parseResultCount(html), listings };
}
