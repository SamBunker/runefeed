// poller.ts — Orchestrates the polling lifecycle
//
// This is the "main loop" of the server. It:
// 1. Loads item mapping on startup
// 2. Backfills the rolling window with the last hour of data
// 3. Starts polling /5m every 5 minutes and /latest every 60 seconds
// 4. Runs spike detection (multi-timeframe) and broadcasts alerts via WebSocket
// 5. Tracks the trending headline across cycles

import { OsrsApiClient } from './api-client.js';
import { RollingWindow } from './rolling-window.js';
import { detectSpikes, generatePredictions, updateRollingWindow } from './detector.js';
import { RuneFeedWSServer } from './ws-server.js';
import type { AppConfig, ItemMapping, LatestPriceEntry, IntervalPriceEntry, Alert, Prediction, TrendingHeadline } from '../shared/types.js';
import { appendAlertToFile } from './alert-writer.js';

const MIN_WINDOW_DEPTH = 3;

export class Poller {
  private api: OsrsApiClient;
  private rollingWindow: RollingWindow;
  private wsServer: RuneFeedWSServer;
  private config: AppConfig;

  private itemMap: Map<number, ItemMapping> = new Map();
  private latestPrices: Map<number, LatestPriceEntry> = new Map();
  private oneHourData: Map<number, IntervalPriceEntry> = new Map();
  private excludeSet: Set<string>;
  private resourceSet: Set<string>;

  private cycle = 0;
  private fiveMinTimer: ReturnType<typeof setInterval> | null = null;
  private latestTimer: ReturnType<typeof setInterval> | null = null;
  private nextPollTime: number = 0;

  // Headline tracking: which items have been spiking across consecutive cycles
  // Map<itemId, { alert: Alert, consecutiveCycles: number }>
  private headlineTracker: Map<number, { alert: Alert; consecutiveCycles: number }> = new Map();
  private currentHeadline: TrendingHeadline | null = null;

  constructor(config: AppConfig, excludedItems: string[], resourceItems: string[]) {
    this.config = config;
    this.api = new OsrsApiClient(config);
    this.rollingWindow = new RollingWindow(config.detection.rollingWindowSize);
    this.wsServer = new RuneFeedWSServer(config.server);
    this.excludeSet = new Set(excludedItems.map(name => name.toLowerCase()));
    this.resourceSet = new Set(resourceItems.map(name => name.toLowerCase()));

    this.wsServer.onConnection((ws) => {
      // Send status + current headline to newly connected clients
      this.wsServer.sendTo(ws, {
        type: 'status',
        nextPollIn: Math.max(0, this.nextPollTime - Date.now()),
        clients: this.wsServer.clientCount,
      });
      if (this.currentHeadline) {
        this.wsServer.sendTo(ws, { type: 'headline', data: this.currentHeadline });
      }
    });
  }

  async start(): Promise<void> {
    // ── Load item mapping ──
    console.log('  Loading item mapping from API...');
    const mappings = await this.api.fetchMapping();
    for (const item of mappings) {
      this.itemMap.set(item.id, item);
    }
    const f2pCount = mappings.filter(m => !m.members).length;
    const memCount = mappings.filter(m => m.members).length;
    console.log(`    \x1b[32m✓\x1b[0m Loaded \x1b[1m${mappings.length.toLocaleString()}\x1b[0m tradeable items (${f2pCount.toLocaleString()} F2P, ${memCount.toLocaleString()} MEM)`);

    if (this.excludeSet.size > 0) {
      console.log(`    \x1b[32m✓\x1b[0m ${this.excludeSet.size} item(s) excluded`);
    }

    await this.backfill();

    console.log('  Starting /latest price cache poller (every 60s)...');
    await this.refreshLatestPrices();
    await this.refreshOneHourData();

    // ── Log ready state ──
    console.log('');
    console.log('\x1b[2m──────────────────────────────────────────────────────────────\x1b[0m');
    console.log('\x1b[1m\x1b[32m  RuneFeed server is running.\x1b[0m');
    console.log(`\x1b[2m  Config:      ${this.configSummary()}\x1b[0m`);
    console.log(`\x1b[2m  Timeframes:  ${this.config.detection.timeframes.join(', ')}\x1b[0m`);
    console.log(`\x1b[2m  GE Tax:      ${(this.config.tax.taxRate * 100).toFixed(0)}% (cap ${this.config.tax.taxCap.toLocaleString()} gp)\x1b[0m`);
    console.log('\x1b[2m──────────────────────────────────────────────────────────────\x1b[0m');
    console.log('');

    this.scheduleNextFiveMinPoll();
    this.latestTimer = setInterval(
      () => this.refreshLatestPrices(),
      this.config.polling.latestIntervalMs,
    );
  }

  private async backfill(): Promise<void> {
    const windowSize = this.config.detection.rollingWindowSize;
    console.log(`  Backfilling rolling window (last ${windowSize} x 5m intervals = ${windowSize * 5}m)...`);

    const nowSec = Math.floor(Date.now() / 1000);
    const aligned = Math.floor(nowSec / 300) * 300;

    let successCount = 0;

    for (let i = windowSize; i >= 1; i--) {
      const timestamp = aligned - (i * 300);
      try {
        const data = await this.api.fetchFiveMin(timestamp);
        updateRollingWindow(data, this.rollingWindow, timestamp);
        successCount++;
        process.stdout.write(`    Interval ${windowSize - i + 1}/${windowSize}\r`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`    \x1b[33m⚠\x1b[0m Interval ${windowSize - i + 1} failed: ${msg}`);
      }
    }

    console.log('');
    if (successCount === windowSize) {
      console.log(`    \x1b[32m✓\x1b[0m Rolling window ready — ${successCount} intervals loaded`);
    } else if (successCount >= MIN_WINDOW_DEPTH) {
      console.log(`    \x1b[33m⚠\x1b[0m Rolling window partially filled — ${successCount}/${windowSize} intervals`);
    } else {
      console.log(`    \x1b[33m⚠\x1b[0m Warning: only ${successCount} intervals loaded — alerts suppressed until ${MIN_WINDOW_DEPTH} intervals collected`);
    }
    console.log(`    Memory footprint: ~${(this.rollingWindow.itemCount * windowSize * 40 / 1024 / 1024).toFixed(1)} MB`);
  }

  private scheduleNextFiveMinPoll(): void {
    const now = Date.now();
    const intervalMs = this.config.polling.fiveMinIntervalMs;
    const nextBoundary = Math.ceil(now / intervalMs) * intervalMs;
    const delay = nextBoundary - now + 1000;

    this.nextPollTime = now + delay;
    console.log(`  Next /5m poll in ${Math.round(delay / 1000)}s`);

    setTimeout(() => {
      this.runPollCycle();
      this.fiveMinTimer = setInterval(
        () => this.runPollCycle(),
        intervalMs,
      );
    }, delay);
  }

  private async runPollCycle(): Promise<void> {
    this.cycle++;
    const cycleNum = this.cycle;
    this.nextPollTime = Date.now() + this.config.polling.fiveMinIntervalMs;

    console.log(`\n\x1b[1m--- Poll cycle #${cycleNum} ---\x1b[0m`);
    this.wsServer.broadcast({ type: 'poll-start', cycle: cycleNum });

    try {
      const intervalData = await this.api.fetchFiveMin();
      console.log(`    Response: ${intervalData.size.toLocaleString()} item entries`);

      // ── Detect spikes across all timeframes ──
      let alertCount = 0;
      const timestamp = Math.floor(Date.now() / 1000);
      const alertsThisCycle: Alert[] = [];

      for (const alert of detectSpikes(
        intervalData,
        this.latestPrices,
        this.itemMap,
        this.excludeSet,
        this.resourceSet,
        this.rollingWindow,
        this.config.detection,
        this.config.tax,
        MIN_WINDOW_DEPTH,
      )) {
        this.wsServer.broadcast({ type: 'alert', data: alert });
        // appendAlertToFile(alert, this.config.output); // disabled for now
        alertsThisCycle.push(alert);
        alertCount++;

        if (this.config.display.staggerEnabled && this.config.display.staggerDelayMs > 0) {
          await this.sleep(this.config.display.staggerDelayMs);
        }
      }

      // ── Update rolling window AFTER detection ──
      updateRollingWindow(intervalData, this.rollingWindow, timestamp);

      // ── Update headline tracker ──
      this.updateHeadline(alertsThisCycle);

      // ── Generate predictions ──
      let predictionCount = 0;
      // Gather all tracked items across connected clients
      const trackedItems = this.wsServer.getAllTrackedItems();

      for (const prediction of generatePredictions(
        intervalData,
        this.oneHourData,
        this.latestPrices,
        this.itemMap,
        this.excludeSet,
        this.resourceSet,
        this.rollingWindow,
        this.config.detection,
        this.config.tax,
        trackedItems,
      )) {
        this.wsServer.broadcast({ type: 'prediction', data: prediction });
        predictionCount++;
      }

      // Refresh /1h data after each poll cycle (it changes less frequently
      // than /latest, but we want it current for the next prediction run)
      this.refreshOneHourData();

      // ── Broadcast cycle completion ──
      if (alertCount === 0) {
        this.wsServer.broadcast({ type: 'no-spikes', cycle: cycleNum });
      }
      this.wsServer.broadcast({ type: 'poll-end', cycle: cycleNum, alertCount });

      console.log(`    \x1b[32m✓\x1b[0m Done — \x1b[1m${alertCount}\x1b[0m alert(s), \x1b[1m${predictionCount}\x1b[0m prediction(s) — \x1b[1m${this.wsServer.clientCount}\x1b[0m client(s) connected`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    \x1b[33m⚠\x1b[0m Poll cycle #${cycleNum} failed: ${msg}`);
      this.wsServer.broadcast({ type: 'error', message: `Poll cycle failed: ${msg}` });
    }
  }

  /**
   * Update the headline tracker based on this cycle's alerts.
   *
   * Logic:
   * - For each item that alerted this cycle, increment its consecutive count.
   * - For items that did NOT alert, reset their count (they stopped trending).
   * - The headline is the item with the highest consecutive cycle count,
   *   breaking ties by spike score.
   */
  private updateHeadline(alertsThisCycle: Alert[]): void {
    const alertedIds = new Set(alertsThisCycle.map(a => a.itemId));

    // Increment items that alerted
    for (const alert of alertsThisCycle) {
      const existing = this.headlineTracker.get(alert.itemId);
      if (existing) {
        existing.consecutiveCycles++;
        existing.alert = alert; // update with latest data
      } else {
        this.headlineTracker.set(alert.itemId, { alert, consecutiveCycles: 1 });
      }
    }

    // Reset items that didn't alert this cycle
    for (const [itemId] of this.headlineTracker) {
      if (!alertedIds.has(itemId)) {
        this.headlineTracker.delete(itemId);
      }
    }

    // Find the best headline: most consecutive cycles, then highest spike score
    let best: { alert: Alert; consecutiveCycles: number } | null = null;
    for (const entry of this.headlineTracker.values()) {
      if (entry.consecutiveCycles < 2) continue; // need at least 2 cycles to "trend"
      if (!best ||
          entry.consecutiveCycles > best.consecutiveCycles ||
          (entry.consecutiveCycles === best.consecutiveCycles &&
           entry.alert.spikeScore > best.alert.spikeScore)) {
        best = entry;
      }
    }

    if (best) {
      this.currentHeadline = {
        itemId: best.alert.itemId,
        itemName: best.alert.itemName,
        type: best.alert.type,
        timeframe: best.alert.timeframe,
        spikeScore: best.alert.spikeScore,
        consecutiveCycles: best.consecutiveCycles,
        volume: best.alert.volume,
        sellPrice: best.alert.sellPrice,
        buyPrice: best.alert.buyPrice,
      };
    } else {
      this.currentHeadline = null;
    }

    // Broadcast headline to all clients
    this.wsServer.broadcast({ type: 'headline', data: this.currentHeadline });
  }

  private async refreshLatestPrices(): Promise<void> {
    try {
      this.latestPrices = await this.api.fetchLatest();
      console.log(`    \x1b[32m✓\x1b[0m Price cache updated — ${this.latestPrices.size.toLocaleString()} items`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`    \x1b[33m⚠\x1b[0m Price cache refresh failed: ${msg}`);
    }
  }

  private async refreshOneHourData(): Promise<void> {
    try {
      this.oneHourData = await this.api.fetchOneHour();
      console.log(`    \x1b[32m✓\x1b[0m 1h data updated — ${this.oneHourData.size.toLocaleString()} items`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`    \x1b[33m⚠\x1b[0m 1h data refresh failed: ${msg}`);
    }
  }

  private configSummary(): string {
    const d = this.config.detection;
    const parts: string[] = [
      `spike ${d.spikeThreshold}x`,
      `minVol ${d.minVolume}`,
    ];
    if (d.minItemValue > 0) parts.push(`min ${d.minItemValue}gp`);
    if (d.maxItemValue > 0) parts.push(`max ${d.maxItemValue}gp`);
    if (this.config.display.staggerEnabled) {
      parts.push(`stagger ${this.config.display.staggerDelayMs}ms`);
    }
    return parts.join(' | ');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
