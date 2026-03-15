// format.ts — Number and price formatting utilities
//
// In TypeScript, functions declare their parameter types and return type:
//   function name(param: Type): ReturnType { ... }
// This means the compiler catches mistakes like passing a string where a
// number is expected, before you even run the code.

/**
 * Formats a gold piece value with K/M/B suffixes for readability.
 * Examples:
 *   178       → "178 gp"
 *   37800     → "37.8K gp"
 *   2790000   → "2.79M gp"
 *   1021000000 → "1.02B gp"
 */
export function formatGp(value: number | null): string {
  if (value === null) return '? gp';

  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B gp`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M gp`;
  }
  if (abs >= 100_000) {
    return `${(value / 1_000).toFixed(1)}K gp`;
  }
  // The underscore in 1_000_000 is just a visual separator — JavaScript
  // ignores it. It makes large numbers easier to read in source code.

  return `${value.toLocaleString()} gp`;
}

/**
 * Formats a volume number with commas.
 * Examples:
 *   89421  → "89,421"
 *   312044 → "312,044"
 */
export function formatVolume(value: number): string {
  return value.toLocaleString();
}

/**
 * Formats a spike score as a multiplier string.
 * Examples:
 *   8.3333 → "8.3x"
 *   12.0   → "12.0x"
 */
export function formatSpikeScore(score: number): string {
  return `${score.toFixed(1)}x`;
}

/**
 * Pads a string to a fixed width (right-padded with spaces).
 * Used to align columns in the terminal output.
 *
 * "padEnd" is a built-in JavaScript string method:
 *   "hello".padEnd(10) → "hello     "
 */
export function padRight(str: string, width: number): string {
  return str.padEnd(width);
}

/**
 * Formats a Date object as a local time string like "14:35:02".
 *
 * The Intl.DateTimeFormat API is built into JavaScript and handles
 * locale-aware formatting. We force 'en-GB' for 24-hour time.
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ─── GE Tax ──────────────────────────────────────────────────

/**
 * Calculate the Grand Exchange tax on a sale.
 *
 * As of May 2025, the GE takes a 2% cut on every sale, capped at 5,000,000 gp.
 * Items sold for under 50 gp have no tax (2% of 49 = 0.98, rounds down to 0).
 *
 * @param sellPrice - The instant-sell price of the item
 * @param taxRate   - Tax rate as a decimal (0.02 = 2%). Configurable in case Jagex changes it.
 * @param taxCap    - Maximum tax per item in gp (default 5,000,000)
 * @returns The tax amount in gp (always a whole number, rounded down)
 */
export function calculateGeTax(
  sellPrice: number,
  taxRate: number = 0.02,
  taxCap: number = 5_000_000,
): number {
  const rawTax = Math.floor(sellPrice * taxRate);
  return Math.min(rawTax, taxCap);
}

/**
 * Calculate the after-tax sell price.
 * This is what you actually receive when selling an item on the GE.
 */
export function afterTaxPrice(sellPrice: number, taxRate: number = 0.02, taxCap: number = 5_000_000): number {
  return sellPrice - calculateGeTax(sellPrice, taxRate, taxCap);
}

/**
 * Calculate the spread (margin) between buying and selling an item,
 * accounting for the GE tax on the sell side.
 *
 * Positive = profit per item. Negative = loss per item.
 *
 * Example: Buy at 2,215 gp, sell at 2,198 gp
 *   Tax on sell: floor(2198 * 0.02) = 43 gp
 *   After-tax sell: 2198 - 43 = 2,155 gp
 *   Spread: 2,155 - 2,215 = -60 gp (loss)
 */
export function calculateSpread(
  buyPrice: number | null,
  sellPrice: number | null,
  taxRate: number = 0.02,
  taxCap: number = 5_000_000,
): number | null {
  if (buyPrice === null || sellPrice === null) return null;
  return afterTaxPrice(sellPrice, taxRate, taxCap) - buyPrice;
}

/**
 * Format a spread value with +/- sign and gp suffix.
 * Examples:
 *   60   → "+60 gp"
 *   -43  → "-43 gp"
 *   null → "? gp"
 */
export function formatSpread(spread: number | null): string {
  if (spread === null) return '? gp';
  const sign = spread >= 0 ? '+' : '';
  // Positive numbers don't get a "+" by default, so we add it manually.
  // Negative numbers already have "-" from the number itself.

  const abs = Math.abs(spread);
  if (abs >= 1_000_000) {
    return `${sign}${(spread / 1_000_000).toFixed(2)}M gp`;
  }
  if (abs >= 100_000) {
    return `${sign}${(spread / 1_000).toFixed(1)}K gp`;
  }
  return `${sign}${spread.toLocaleString()} gp`;
}
