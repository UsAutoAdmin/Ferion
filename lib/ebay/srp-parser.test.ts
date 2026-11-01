import { describe, expect, it } from "vitest";
import { cleanTitle, isChallengePage, parseEbaySrp, parsePrice, parseResultCount, parseSoldDate } from "./srp-parser";

/** Trimmed from a live eBay SRP (s-card markup, Nov 2026). */
const CARD = (id: string, title: string, price: string, cond = "Pre-Owned") => `
<li class="s-card s-card--horizontal" id="item${id}"><div class="su-card-container">
<div class="su-card-container__media"><a class="s-card__link image-treatment" href="https://www.ebay.com/itm/${id}?fits=Year%3A2015&amp;hash=item1"></a></div>
<div class="su-card-container__content"><div class="su-card-container__header"><a class="s-card__link" href="https://www.ebay.com/itm/${id}?hash=x">
<div role="heading" aria-level="3" class="s-card__title"><span class="su-styled-text primary default">${title}</span><span class="clipped">Opens in a new window or tab</span></div></a>
<div class="s-card__subtitle-row"><div class="s-card__subtitle"><span class="su-styled-text secondary default">${cond}</span></div></div></div>
<div class="su-card-container__attributes"><div class="su-card-container__attributes__primary">
<div class="s-card__attribute-row"><span class="su-styled-text primary bold large-1 s-card__price">${price}</span></div>
<div class="s-card__attribute-row"><span class="su-styled-text secondary large">Buy It Now</span></div></div></div></div></div></li>`;

const PLACEHOLDER = `<li class="s-card s-card--horizontal" id=""><div class="su-card-container"><a class="s-card__link" href="https://ebay.com/itm/123456?x=1"><div role="heading" class="s-card__title"><span class="su-styled-text primary default">Shop on eBay</span></div></a><span class="s-card__price">$20.00</span></div></li>`;

const PAGE = `<html><body>
<h1 class="srp-controls__count-heading" tabindex="-1"><!--F#f_0--><span class="BOLD">226</span><!--F/--><!--F#f_0--> results for <!--F/--><span class="BOLD">2015 Ford F-150 ABS Pump Module</span></h1>
<ul>${PLACEHOLDER}
${CARD("366702188575", "15 16 2015 2016 Ford F150 ABS Pump Anti Lock Brake Module Part FL34-2C405-BA (For: 2015 Ford F-150)", "$30.00")}
${CARD("137797067841", "2015-2016 Ford F-150 F150 Abs Pump Control Module T7 0265255796 (For: 2015 Ford F-150)", "$110.46")}
${CARD("137797067841", "duplicate of the row above", "$1.00")}
${CARD("920079440747", "2015-2016 Ford F150 Pickup ABS Anti Lock Brake Pump Module Assembly OEM", "$119.94 to $139.94")}
</ul></body></html>`;

describe("parseEbaySrp", () => {
  it("reads the result count", () => {
    expect(parseResultCount(PAGE)).toBe(226);
    expect(parseResultCount("<h1 class=\"srp-controls__count-heading\"><span>1,204</span> results for x</h1>")).toBe(1204);
    expect(parseResultCount("<html></html>")).toBeNull();
  });

  it("extracts listings, skipping placeholders and duplicates", () => {
    const srp = parseEbaySrp(PAGE);
    expect(srp.resultCount).toBe(226);
    expect(srp.listings.map((l) => l.itemId)).toEqual(["366702188575", "137797067841", "920079440747"]);
    const first = srp.listings[0];
    expect(first.title).toBe("15 16 2015 2016 Ford F150 ABS Pump Anti Lock Brake Module Part FL34-2C405-BA");
    expect(first.fitsNote).toBe("For: 2015 Ford F-150");
    expect(first.price).toBe(30);
    expect(first.condition).toBe("Pre-Owned");
    expect(first.url).toBe("https://www.ebay.com/itm/366702188575");
    expect(first.soldAt).toBeNull();
  });

  it("takes the low end of a price range and tolerates missing fitment", () => {
    const srp = parseEbaySrp(PAGE);
    const last = srp.listings[2];
    expect(last.price).toBe(119.94);
    expect(last.fitsNote).toBeNull();
  });
});

/** Minified variant eBay also serves: unquoted single-class attributes, two subtitle rows. */
const MINIFIED = `<h1 class=srp-controls__count-heading tabindex=-1><span class=BOLD>830</span> results for <span class=BOLD>2015 Ford F150 Grille</span></h1>
<li class="s-card s-card--horizontal s-card--pagination-below" id=item4c39f76426><div class="su-card-container su-card-container--horizontal"><div class=su-card-container__media><a class="s-card__link image-treatment" href=https://www.ebay.com/itm/327390028838 target=_blank></a></div><div class=su-card-container__content><div class=su-card-container__header><a class=s-card__link target=_blank tabindex=-1 href=https://www.ebay.com/itm/327390028838><div role=heading aria-level=3 class=s-card__title><span class="su-styled-text primary default">2015 Ford F150 OEM Grille Black Ops Tuscany Complete Unit Tuxedo Black (For: 2015 Ford F-150)</span><span class=clipped>Opens in a new window or tab</span></div></a><div class=s-card__subtitle-row><div class=s-card__subtitle><span class="su-styled-text secondary default">6 Month Warranty! Fast Shipping and Clean Parts</span></div></div><div class=s-card__subtitle-row><div class=s-card__subtitle><span class="su-styled-text secondary default">Pre-Owned</span></div></div></div><div class="su-card-container__attributes"><div class=su-card-container__attributes__primary><div class=s-card__attribute-row><span class="su-styled-text primary bold large-1 s-card__price">$775.00</span><span class="su-styled-text secondary strikethrough large">$968.75</span></div></div></div></div></div></li>`;

describe("parseEbaySrp (minified markup)", () => {
  it("parses unquoted attributes", () => {
    const srp = parseEbaySrp(MINIFIED);
    expect(srp.resultCount).toBe(830);
    expect(srp.listings).toHaveLength(1);
    expect(srp.listings[0]).toMatchObject({ itemId: "327390028838", title: "2015 Ford F150 OEM Grille Black Ops Tuscany Complete Unit Tuxedo Black", fitsNote: "For: 2015 Ford F-150", price: 775 });
  });
  it("recognises the bot-check interstitial only when no tiles are present", () => {
    expect(isChallengePage("<html><body>Please verify yourself to continue</body></html>")).toBe(true);
    expect(isChallengePage(MINIFIED + "<script>var x='captcha Please verify yourself'</script>")).toBe(false);
    expect(isChallengePage(PAGE)).toBe(false);
  });
});

describe("helpers", () => {
  it("parsePrice", () => {
    expect(parsePrice("$1,250.00")).toBe(1250);
    expect(parsePrice("$30.00 to $45.00")).toBe(30);
    expect(parsePrice("Free")).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });
  it("cleanTitle strips eBay suffixes", () => {
    expect(cleanTitle("New ListingFord Radio (For: 2015 Ford F-150)Opens in a new window or tab")).toEqual({ title: "Ford Radio", fitsNote: "For: 2015 Ford F-150" });
    expect(cleanTitle("Plain title")).toEqual({ title: "Plain title", fitsNote: null });
  });
  it("parseSoldDate", () => {
    expect(parseSoldDate('<span class="s-item__caption">Sold  Oct 12, 2026</span>')).toBe("2026-10-12");
    expect(parseSoldDate("<span>$30.00</span>")).toBeNull();
  });
});
