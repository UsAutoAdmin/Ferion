/**
 * Auction make codes → canonical manufacturer names.
 *
 * Copart and IAA exports use short codes ("TOYT", "MERZ", "CHEV") in the
 * Make column. These never match the catalog's spellings, so we resolve
 * the well-known ones statically before any lookup. Pure — no I/O.
 */

export const AUCTION_MAKE_CODES: Readonly<Record<string, string>> = Object.freeze({
  TOYT: "Toyota", HOND: "Honda", NISS: "Nissan", CHEV: "Chevrolet", CHEVY: "Chevrolet", FORD: "Ford",
  GMC: "GMC", RAM: "Ram", DODG: "Dodge", CHRY: "Chrysler", JEEP: "Jeep", JEP: "Jeep", HYUN: "Hyundai",
  KIA: "Kia", SUBA: "Subaru", MAZD: "Mazda", MITS: "Mitsubishi", VOLK: "Volkswagen", VW: "Volkswagen",
  VOLV: "Volvo", BUIC: "Buick", CADI: "Cadillac", LINC: "Lincoln", ISUZ: "Isuzu",
  ACUR: "Acura", AUDI: "Audi", BMW: "BMW", INFI: "Infiniti", JAGU: "Jaguar", LAND: "Land Rover",
  LNDR: "Land Rover", LEXS: "Lexus", LEXU: "Lexus", MERZ: "Mercedes-Benz", MBNZ: "Mercedes-Benz",
  MINI: "Mini", MIN: "Mini", PORS: "Porsche", GENE: "Genesis", GENS: "Genesis", MASE: "Maserati",
  ALFA: "Alfa Romeo", FIAT: "Fiat", SAAB: "Saab", SCIO: "Scion",
  ASTO: "Aston Martin", BENT: "Bentley", FERR: "Ferrari", LAMB: "Lamborghini", LOTU: "Lotus",
  MAYB: "Maybach", ROLL: "Rolls-Royce", RROY: "Rolls-Royce", SMAR: "Smart", SUZI: "Suzuki", SUZU: "Suzuki",
  TESL: "Tesla", RIVI: "Rivian", RIVA: "Rivian", LUCI: "Lucid", POLE: "Polestar", FISK: "Fisker", VINF: "VinFast",
  MERC: "Mercury", OLDS: "Oldsmobile", PLYM: "Plymouth", PONT: "Pontiac", SATU: "Saturn", HUMM: "Hummer",
  EAGL: "Eagle", GEO: "Geo", AMC: "AMC", DATS: "Datsun",
  FRHT: "Freightliner", FRGH: "Freightliner", KENW: "Kenworth", PETB: "Peterbilt", INTL: "International",
  MACK: "Mack", WSTR: "Western Star",
});

/** Resolve a code or full name to a canonical make; null when unknown. */
export function lookupMakeCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  return key ? (AUCTION_MAKE_CODES[key] ?? null) : null;
}
