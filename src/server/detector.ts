// detector.ts — Spike detection engine (multi-timeframe)
//
// For each item in a /5m snapshot, checks volume spikes across multiple
// timeframes (5m, 10m, 30m). Each timeframe aggregates the appropriate
// number of 5m intervals and compares against the rolling average for
// that same window size.
//
// Also calculates GE tax, after-tax sell price, and spread per alert.
//
// Uses generator functions to yield alerts one at a time for real-time emission.

import type {
  Alert,
  AlertType,
  Prediction,
  PredictionType,
  IntervalPriceEntry,
  LatestPriceEntry,
  ItemMapping,
  DetectionConfig,
  TaxConfig,
  VolumeSnapshot,
  PriceTrend,
  TrendDirection,
} from '../shared/types.js';
import { calculateGeTax, afterTaxPrice, calculateSpread } from '../shared/format.js';
import type { RollingWindow } from './rolling-window.js';
import { TIMEFRAME_INTERVALS } from './rolling-window.js';

/**
 * Detect volume spikes across all items and timeframes.
 *
 * This is a generator — it yields alerts one by one as they're found.
 * The poller iterates over this and broadcasts each alert immediately.
 *
 * Multi-timeframe logic:
 *   For timeframe "5m"  → check the latest 1 interval vs rolling average of 1-interval windows
 *   For timeframe "10m" → sum latest 2 intervals vs rolling average of 2-interval windows
 *   For timeframe "30m" → sum latest 6 intervals vs rolling average of 6-interval windows
 *
 * An item can trigger on multiple timeframes (e.g., spiking on both 5m and 30m).
 * We deduplicate by keeping the LONGEST timeframe that triggers.
 * Rationale: if Dragon bones is 8x on 30m, it's more meaningful than 5x on 5m.
 */
export function* detectSpikes(
  intervalData: Map<number, IntervalPriceEntry>,
  latestPrices: Map<number, LatestPriceEntry>,
  itemMap: Map<number, ItemMapping>,
  excludeSet: Set<string>,
  resourceSet: Set<string>,
  rollingWindow: RollingWindow,
  config: DetectionConfig,
  taxConfig: TaxConfig,
  minWindowDepth: number,
): Generator<Alert> {
  // We need to collect per-item results across timeframes to deduplicate.
  // Map<itemId, best Alert (longest timeframe that triggered)>
  const bestAlerts = new Map<number, Alert>();

  for (const [itemId, entry] of intervalData) {
    const item = itemMap.get(itemId);
    if (!item) continue;
    if (excludeSet.has(item.name.toLowerCase())) continue;

    // Value filters
    const latestPrice = latestPrices.get(itemId);
    const itemValue = latestPrice?.high ?? latestPrice?.low ?? item.highalch ?? 0;
    if (config.minItemValue > 0 && itemValue < config.minItemValue) continue;
    if (config.maxItemValue > 0 && itemValue > config.maxItemValue) continue;

    // Check each configured timeframe
    for (const tf of config.timeframes) {
      const intervalCount = TIMEFRAME_INTERVALS[tf];
      if (!intervalCount) continue;

      // For the "5m" timeframe, use the current interval data directly
      // For longer timeframes, aggregate from the rolling window + current data
      let totalVolume: number;
      let highVolume: number;
      let lowVolume: number;

      if (intervalCount === 1) {
        // 5m: just use the current snapshot
        highVolume = entry.highPriceVolume;
        lowVolume = entry.lowPriceVolume;
        totalVolume = highVolume + lowVolume;
      } else {
        // 10m/30m: sum the last (intervalCount - 1) intervals from history
        // plus the current interval
        const histAgg = rollingWindow.getAggregatedVolume(itemId, intervalCount - 1);
        if (!histAgg) continue; // not enough history for this timeframe
        highVolume = histAgg.highVolume + entry.highPriceVolume;
        lowVolume = histAgg.lowVolume + entry.lowPriceVolume;
        totalVolume = highVolume + lowVolume;
      }

      if (totalVolume < config.minVolume) continue;

      // Check window depth
      if (rollingWindow.getDepth(itemId) < minWindowDepth) continue;

      // Calculate spike score against the average for this timeframe
      const avgVolume = rollingWindow.getAverageVolumeForTimeframe(itemId, intervalCount);
      if (avgVolume === 0 && intervalCount > 1) continue; // no baseline for longer TF
      const spikeScore = totalVolume / Math.max(avgVolume, 1);

      if (spikeScore < config.spikeThreshold) continue;

      // Classify
      const type = classifySpike(highVolume, lowVolume, totalVolume, config);

      // Tax calculation
      const sellPrice = latestPrice?.low ?? null;
      const buyPrice = latestPrice?.high ?? null;
      const tax = sellPrice !== null ? calculateGeTax(sellPrice, taxConfig.taxRate, taxConfig.taxCap) : null;
      const afterTax = sellPrice !== null ? afterTaxPrice(sellPrice, taxConfig.taxRate, taxConfig.taxCap) : null;
      const spread = calculateSpread(buyPrice, sellPrice, taxConfig.taxRate, taxConfig.taxCap);

      const alert: Alert = {
        timestamp: new Date().toISOString(),
        type,
        timeframe: tf,
        itemId,
        itemName: item.name,
        members: item.members,
        volume: totalVolume,
        spikeScore: Math.round(spikeScore * 10) / 10,
        highVolume,
        lowVolume,
        sellPrice,
        buyPrice,
        tax,
        afterTaxSell: afterTax,
        spread,
        resource: resourceSet.has(item.name.toLowerCase()),
      };

      // Keep the longest timeframe that triggers for each item
      const existing = bestAlerts.get(itemId);
      if (!existing || intervalCount > (TIMEFRAME_INTERVALS[existing.timeframe] ?? 0)) {
        bestAlerts.set(itemId, alert);
      }
    }
  }

  // Yield all deduplicated alerts
  for (const alert of bestAlerts.values()) {
    yield alert;
  }
}

/**
 * Detect price trends across all items.
 * Compares current average price to historical average price
 * across each configured timeframe.
 */
export function* detectPriceTrends(
  intervalData: Map<number, IntervalPriceEntry>,
  latestPrices: Map<number, LatestPriceEntry>,
  itemMap: Map<number, ItemMapping>,
  excludeSet: Set<string>,
  rollingWindow: RollingWindow,
  config: DetectionConfig,
  taxConfig: TaxConfig,
): Generator<PriceTrend> {
  for (const [itemId, entry] of intervalData) {
    const item = itemMap.get(itemId);
    if (!item) continue;
    if (excludeSet.has(item.name.toLowerCase())) continue;

    const latestPrice = latestPrices.get(itemId);
    const currentPrice = entry.avgHighPrice ?? entry.avgLowPrice;
    if (currentPrice === null) continue;

    // Value filters
    const itemValue = latestPrice?.high ?? latestPrice?.low ?? item.highalch ?? 0;
    if (config.minItemValue > 0 && itemValue < config.minItemValue) continue;
    if (config.maxItemValue > 0 && itemValue > config.maxItemValue) continue;

    // Check each timeframe for price movement
    for (const tf of config.timeframes) {
      const intervalCount = TIMEFRAME_INTERVALS[tf];
      if (!intervalCount) continue;

      const history = rollingWindow.getHistory(itemId);
      if (history.length < intervalCount * 2) continue;

      // Get the average price from the historical window
      // We look at the intervals BEFORE the current window
      const baseline = history.slice(0, -intervalCount);
      let priceSum = 0;
      let priceCount = 0;

      // We need price data in the rolling window. For now, we use the
      // interval data's avgHighPrice as a proxy. The rolling window stores
      // volume but not prices, so we compare current interval price
      // against the item's latest known price trend.
      //
      // A more accurate approach: we'll store price data in snapshots too.
      // For now, skip price trends if we can't determine a baseline.
      // This will be enhanced when we add price storage to VolumeSnapshot.
    }
  }
  // Price trends will be fully implemented once we store price history
  // in the rolling window (next iteration). For now, this generator
  // yields nothing — the infrastructure is in place.
}

/**
 * Generate predictions based on current prices vs rolling averages.
 *
 * Three prediction types:
 *
 * MOMENTUM — price is UP from the rolling average AND volume is elevated.
 *   This means money is flowing into the item. Good investment signal.
 *   Trigger: price > avgPrice by 3%+ AND volume >= 2x average.
 *
 * BUY-WINDOW — price is DOWN from the rolling/1h average.
 *   The item is temporarily cheap. Could be a dip to buy into.
 *   Trigger: currentPrice < avgPrice by 5%+ AND reasonable volume.
 *
 * COOLING — volume WAS elevated but is now dropping, price may be peaking.
 *   The spike is fading. Time to sell or avoid buying.
 *   Trigger: recent history had high volume (>3x) but current interval is < 1.5x avg.
 *
 * The /1h data provides the baseline "what does this item normally trade at?"
 * We compare the current /latest price against that 1h average.
 */
export function* generatePredictions(
  fiveMinData: Map<number, IntervalPriceEntry>,
  oneHourData: Map<number, IntervalPriceEntry>,
  latestPrices: Map<number, LatestPriceEntry>,
  itemMap: Map<number, ItemMapping>,
  excludeSet: Set<string>,
  resourceSet: Set<string>,
  rollingWindow: RollingWindow,
  config: DetectionConfig,
  taxConfig: TaxConfig,
  trackedItems: Set<string> = new Set(),
): Generator<Prediction> {
  for (const [itemId, fiveMin] of fiveMinData) {
    const item = itemMap.get(itemId);
    if (!item) continue;
    if (excludeSet.has(item.name.toLowerCase())) continue;

    const latest = latestPrices.get(itemId);
    const oneHour = oneHourData.get(itemId);

    // We need a current price to work with
    const currentPrice = latest?.low ?? fiveMin.avgLowPrice;
    if (currentPrice === null || currentPrice <= 0) continue;

    // Value filters (same as alerts)
    const itemValue = latest?.high ?? latest?.low ?? item.highalch ?? 0;
    if (config.minItemValue > 0 && itemValue < config.minItemValue) continue;
    if (config.maxItemValue > 0 && itemValue > config.maxItemValue) continue;

    // ── Build baseline price ──
    // Option 1: 1h average from the API (best)
    // Option 2: rolling window average from stored 5m snapshots
    const oneHourAvgPrice = oneHour?.avgLowPrice ?? null;
    const rollingAvgPrice = rollingWindow.getAveragePrice(itemId);
    const avgPrice = oneHourAvgPrice ?? rollingAvgPrice;
    if (avgPrice === null || avgPrice <= 0) continue;

    // ── Price change ──
    const priceChangePercent = ((currentPrice - avgPrice) / avgPrice) * 100;

    // ── Volume metrics ──
    const currentVolume = fiveMin.highPriceVolume + fiveMin.lowPriceVolume;
    const avgVolume = rollingWindow.getAverageVolume(itemId);
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

    // Is this item being tracked by any client?
    const isTracked = trackedItems.has(item.name.toLowerCase());

    // Need minimum volume to avoid noise on dead items
    // (but always allow tracked items through)
    if (currentVolume < config.minVolume && !isTracked) continue;

    // ── Tax/spread ──
    const sellPrice = latest?.low ?? null;
    const buyPrice = latest?.high ?? null;
    const tax = sellPrice !== null ? calculateGeTax(sellPrice, taxConfig.taxRate, taxConfig.taxCap) : null;
    const afterTax = sellPrice !== null ? afterTaxPrice(sellPrice, taxConfig.taxRate, taxConfig.taxCap) : null;
    const spread = calculateSpread(buyPrice, sellPrice, taxConfig.taxRate, taxConfig.taxCap);

    // Estimated flip profit: if you buy at buyPrice and sell at current sellPrice
    const estimatedFlip = (afterTax !== null && buyPrice !== null)
      ? afterTax - buyPrice
      : null;

    // ── Classify prediction type ──
    let predictionType: PredictionType | null = null;

    // MOMENTUM: price rising 3%+ with volume at least 2x average
    if (priceChangePercent >= 3 && volumeRatio >= 2) {
      predictionType = 'MOMENTUM';
    }
    // BUY-WINDOW: price 5%+ below average (a dip)
    else if (priceChangePercent <= -5 && volumeRatio >= 0.5) {
      predictionType = 'BUY-WINDOW';
    }
    // COOLING: check if recent history had a spike but current interval is calming
    else if (avgVolume > 0) {
      // Look at the last 2 intervals — were they elevated?
      const recentAgg = rollingWindow.getAggregatedVolume(itemId, 2);
      if (recentAgg) {
        const recentAvgPer5m = recentAgg.totalVolume / 2;
        const recentRatio = recentAvgPer5m / avgVolume;
        // Recent history was 3x+ but current is under 1.5x → cooling off
        if (recentRatio >= 3 && volumeRatio < 1.5) {
          predictionType = 'COOLING';
        }
      }
    }

    // If no prediction type triggered but this item is tracked,
    // emit STABLE so the client always sees their portfolio status
    if (predictionType === null) {
      if (isTracked) {
        predictionType = 'STABLE';
      } else {
        continue;
      }
    }

    const prediction: Prediction = {
      timestamp: new Date().toISOString(),
      type: predictionType,
      itemId,
      itemName: item.name,
      members: item.members,
      currentPrice,
      avgPrice: Math.round(avgPrice),
      priceChangePercent: Math.round(priceChangePercent * 10) / 10,
      currentVolume,
      avgVolume: Math.round(avgVolume),
      volumeRatio: Math.round(volumeRatio * 10) / 10,
      buyPrice,
      sellPrice,
      tax,
      afterTaxSell: afterTax,
      spread,
      estimatedFlip,
      resource: resourceSet.has(item.name.toLowerCase()),
    };

    yield prediction;
  }
}

function classifySpike(
  highVolume: number,
  lowVolume: number,
  totalVolume: number,
  config: DetectionConfig,
): AlertType {
  if (totalVolume === 0) return 'SURGE';
  const lowRatio = lowVolume / totalVolume;
  const highRatio = highVolume / totalVolume;
  if (lowRatio >= config.sellOffDominance) return 'SELL-OFF';
  if (highRatio >= config.buyInDominance) return 'BUY-IN';
  return 'SURGE';
}

/**
 * Updates the rolling window with a new interval's data.
 */
export function updateRollingWindow(
  intervalData: Map<number, IntervalPriceEntry>,
  rollingWindow: RollingWindow,
  timestamp: number,
): void {
  for (const [itemId, entry] of intervalData) {
    const snapshot: VolumeSnapshot = {
      highVolume: entry.highPriceVolume,
      lowVolume: entry.lowPriceVolume,
      totalVolume: entry.highPriceVolume + entry.lowPriceVolume,
      timestamp,
      avgHighPrice: entry.avgHighPrice,   // store prices for prediction engine
      avgLowPrice: entry.avgLowPrice,
    };
    rollingWindow.push(itemId, snapshot);
  }
}
