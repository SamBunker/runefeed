// rolling-window.ts — In-memory rolling data store
//
// Stores the last N intervals of volume data per item. Think of it as a
// sliding window that always holds the most recent hour of data (12 x 5min).
// As new data comes in, the oldest interval drops off.
//
// Now supports multi-timeframe aggregation: summing the last 2 intervals
// gives 10m, last 6 gives 30m. The underlying storage is always 5m intervals.
//
// No database, no disk — it's all in RAM. ~7 MB for 15K items x 12 intervals.

import type { VolumeSnapshot } from '../shared/types.js';

// Maps timeframe strings to how many 5m intervals they span
const TIMEFRAME_INTERVALS: Record<string, number> = {
  '5m': 1,
  '10m': 2,
  '30m': 6,
};
// Record<string, number> is TypeScript for { [key: string]: number }
// This lookup table converts "10m" → 2 intervals, "30m" → 6 intervals.

export { TIMEFRAME_INTERVALS };

export class RollingWindow {
  private data: Map<number, VolumeSnapshot[]>;
  private windowSize: number;

  constructor(windowSize: number) {
    this.data = new Map();
    this.windowSize = windowSize;
  }

  /**
   * Push a new volume snapshot for an item.
   * If the array exceeds windowSize, the oldest entry is removed (shift).
   */
  push(itemId: number, snapshot: VolumeSnapshot): void {
    let history = this.data.get(itemId);

    if (!history) {
      history = [];
      this.data.set(itemId, history);
    }

    history.push(snapshot);

    if (history.length > this.windowSize) {
      history.shift();
    }
  }

  /**
   * Get the full volume history for an item (all stored 5m intervals).
   */
  getHistory(itemId: number): readonly VolumeSnapshot[] {
    return this.data.get(itemId) ?? [];
  }

  /**
   * Calculate the average total volume for an item over its stored history.
   * Returns 0 if no history exists.
   */
  getAverageVolume(itemId: number): number {
    const history = this.getHistory(itemId);
    if (history.length === 0) return 0;
    const total = history.reduce((sum, snap) => sum + snap.totalVolume, 0);
    return total / history.length;
  }

  /**
   * Get aggregated volume for the last N 5m intervals.
   *
   * For multi-timeframe detection:
   *   getAggregatedVolume(itemId, 2) → sum of last 2 intervals (10m window)
   *   getAggregatedVolume(itemId, 6) → sum of last 6 intervals (30m window)
   *
   * Returns { highVolume, lowVolume, totalVolume } summed across the window.
   * Returns null if we don't have enough intervals to fill the window.
   */
  getAggregatedVolume(
    itemId: number,
    intervalCount: number,
  ): { highVolume: number; lowVolume: number; totalVolume: number } | null {
    const history = this.getHistory(itemId);
    if (history.length < intervalCount) return null;

    // .slice(-N) takes the last N elements from the array.
    const window = history.slice(-intervalCount);

    let highVolume = 0;
    let lowVolume = 0;

    for (const snap of window) {
      highVolume += snap.highVolume;
      lowVolume += snap.lowVolume;
    }

    return {
      highVolume,
      lowVolume,
      totalVolume: highVolume + lowVolume,
    };
  }

  /**
   * Get the average volume for a specific timeframe.
   *
   * For a 10m timeframe (2 intervals per window), this sums pairs of
   * consecutive intervals and averages those sums.
   *
   * Example with 12 stored intervals and timeframe "10m" (intervalCount=2):
   *   Pairs: [1+2, 3+4, 5+6, 7+8, 9+10, 11+12] → 6 windows
   *   Average = sum of all pair totals / 6
   *
   * Excludes the most recent `intervalCount` intervals (the "current window")
   * so we're comparing current activity against historical norms.
   */
  getAverageVolumeForTimeframe(itemId: number, intervalCount: number): number {
    const history = this.getHistory(itemId);

    // Need at least 2x the interval count: one window for "current" and
    // at least one for the "average" baseline.
    if (history.length < intervalCount * 2) return 0;

    // Exclude the most recent window (that's what we're comparing against)
    const baseline = history.slice(0, -intervalCount);

    // Sum all baseline volume and divide by how many windows fit
    const totalVol = baseline.reduce((sum, snap) => sum + snap.totalVolume, 0);
    const windowCount = baseline.length / intervalCount;

    return totalVol / windowCount;
  }

  /**
   * Get the average sell price (avgLowPrice) for an item over its stored history.
   * Skips intervals where the price is null (no trades that interval).
   * Returns null if no price data exists.
   */
  getAveragePrice(itemId: number): number | null {
    const history = this.getHistory(itemId);
    let sum = 0;
    let count = 0;

    for (const snap of history) {
      if (snap.avgLowPrice !== null) {
        sum += snap.avgLowPrice;
        count++;
      }
    }

    return count > 0 ? sum / count : null;
  }

  /**
   * How many intervals of data we have for a given item.
   */
  getDepth(itemId: number): number {
    return this.getHistory(itemId).length;
  }

  /**
   * How many unique items are tracked in the window.
   */
  get itemCount(): number {
    return this.data.size;
  }
}
