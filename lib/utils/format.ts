/**
 * Formatting helpers shared across the UI. Keep these pure so they can be
 * unit-tested without a DOM.
 */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** `$1,234` — whole dollars, used for aggregate stats. */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return usd.format(value);
}

/** `$1,234.56` — used for individual part prices. */
export function formatCurrencyPrecise(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return usdPrecise.format(value);
}

/** `1,234` */
export function formatInteger(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return integer.format(value);
}

/**
 * `42.5%` — accepts either a ratio (0–1) or a percentage (0–100).
 * Values ≤ 1 are treated as ratios unless `isPercent` is set.
 */
export function formatPercent(
  value: number | null | undefined,
  opts: { isPercent?: boolean; digits?: number } = {}
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = opts.digits ?? 1;
  const pct = opts.isPercent || value > 1 ? value : value * 100;
  return `${pct.toFixed(digits)}%`;
}
