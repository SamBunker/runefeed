// ws-client.ts — WebSocket client with client-side filtering

import WebSocket from 'ws';
import type { WSMessage, TrendingHeadline } from '../shared/types.js';
import { renderAlert, renderPrediction, renderBanner, renderHeadline, renderSystemMessage } from './display.js';
import type { DisplayOptions } from './display.js';
import { safeJsonParse } from './sanitize.js';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 10_000;

// ViewMode controls which type of data the client displays.
// "alerts" = traditional spike alerts (default)
// "predictions" = investment predictions (MOMENTUM, BUY-WINDOW, COOLING)
export type ViewMode = 'alerts' | 'predictions';

export interface WatchOptions {
  host: string;
  port: number;
  f2pOnly: boolean;
  minSpike: number;       // 0 = use server threshold (show all)
  showTax: boolean;       // false = --no-tax
  compact: boolean;       // true = --compact
  typeFilter: string | null; // "SELL-OFF", "BUY-IN", "SURGE", or null
  view: ViewMode;         // "alerts" or "predictions"
  minPrice: number;       // 0 = no minimum (show all); filters by item price
  trackItems: string[];   // lowercase item names to track; empty = show all
  minProfit: number;      // 0 = show all; only show predictions with flip >= this gp
  resourceFilter: 'all' | 'only' | 'hide'; // --resources = only, --hide-resources = hide
  tls: boolean;           // --tls forces wss:// connection
}

let currentHeadline: TrendingHeadline | null = null;

export async function connectAndWatch(options: WatchOptions): Promise<void> {
  const { host, port } = options;
  // Use wss:// (encrypted) when connecting to standard HTTPS port,
  // when the host isn't localhost, or when explicitly requested with --tls.
  // This is critical for remote connections — without TLS, anyone on the
  // network can read the WebSocket traffic.
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const useTls = options.tls || port === 443 || port === 8443 || !isLocal;
  const protocol = useTls ? 'wss' : 'ws';
  const url = `${protocol}://${host}:${port}`;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      console.log(`  Connecting to \x1b[1m${url}\x1b[0m...`);
      await connectOnce(url, options);
      retries++;
      console.log(`  Connection lost. Retrying in ${RETRY_DELAY_MS / 1000}s... (attempt ${retries}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY_MS);
    } catch (err) {
      retries++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\x1b[31m  Connection failed: ${msg}\x1b[0m`);

      if (retries >= MAX_RETRIES) {
        console.error('\x1b[31m  Max retries reached. Exiting.\x1b[0m');
        console.log('  \x1b[2mStart the server with: runefeed serve\x1b[0m');
        process.exit(1);
      }

      console.log(`  \x1b[2mRetrying in ${RETRY_DELAY_MS / 1000}s... (attempt ${retries}/${MAX_RETRIES})\x1b[0m`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

function connectOnce(url: string, options: WatchOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const displayOpts: DisplayOptions = {
      showTax: options.showTax,
      compact: options.compact,
    };

    ws.on('open', () => {
      console.log('  \x1b[32m✓\x1b[0m Connected');

      // If tracking items, tell the server so it can generate STABLE
      // predictions for them even when they're not spiking
      if (options.trackItems.length > 0) {
        ws.send(JSON.stringify({
          type: 'subscribe-tracks',
          items: options.trackItems,
        }));
      }

      console.log(renderBanner({
        host: options.host,
        port: options.port,
        f2pOnly: options.f2pOnly,
        minSpike: options.minSpike,
        showTax: options.showTax,
        compact: options.compact,
        typeFilter: options.typeFilter,
        view: options.view,
        minPrice: options.minPrice,
        minProfit: options.minProfit,
        trackItems: options.trackItems,
        resourceFilter: options.resourceFilter,
      }));
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        // safeJsonParse strips ANSI escape sequences from all string fields
        // and rejects __proto__/constructor keys to prevent prototype pollution.
        // This defends against malicious servers sending terminal injection payloads.
        const msg: WSMessage = safeJsonParse(raw.toString());
        handleMessage(msg, options, displayOpts);
      } catch {
        // Malformed message — ignore
      }
    });

    ws.on('close', () => resolve());
    ws.on('error', (err) => reject(err));
  });
}

function handleMessage(msg: WSMessage, options: WatchOptions, displayOpts: DisplayOptions): void {
  // ── Headline — show in alerts view only ──
  if (msg.type === 'headline' && options.view === 'alerts') {
    currentHeadline = msg.data;
    const rendered = renderHeadline(currentHeadline);
    if (rendered) console.log(rendered);
    return;
  }

  // ── Alert — only in alerts view ──
  if (msg.type === 'alert' && options.view === 'alerts') {
    const alert = msg.data;

    // F2P filter
    if (options.f2pOnly && alert.members) return;

    // Min spike filter
    if (options.minSpike > 0 && alert.spikeScore < options.minSpike) return;

    // Type filter
    if (options.typeFilter && alert.type !== options.typeFilter) return;

    // Min price filter — use sell or buy price, whichever is available
    const alertPrice = alert.sellPrice ?? alert.buyPrice ?? 0;
    if (options.minPrice > 0 && alertPrice < options.minPrice) return;

    // Track filter — if tracking specific items, only show those
    if (options.trackItems.length > 0 &&
        !options.trackItems.includes(alert.itemName.toLowerCase())) return;

    // Resource filter
    if (options.resourceFilter === 'only' && !alert.resource) return;
    if (options.resourceFilter === 'hide' && alert.resource) return;

    console.log(renderAlert(alert, displayOpts));
    return;
  }

  // ── Prediction — only in predictions view ──
  if (msg.type === 'prediction' && options.view === 'predictions') {
    const prediction = msg.data;

    // F2P filter
    if (options.f2pOnly && prediction.members) return;

    // Type filter (reuse --type for prediction types: momentum, buy-window, cooling)
    if (options.typeFilter && prediction.type !== options.typeFilter) return;

    // Min price filter
    if (options.minPrice > 0 && prediction.currentPrice < options.minPrice) return;

    // Track filter
    if (options.trackItems.length > 0 &&
        !options.trackItems.includes(prediction.itemName.toLowerCase())) return;

    // Min profit filter — only show predictions where the estimated flip is >= threshold
    if (options.minProfit > 0) {
      if (prediction.estimatedFlip === null || prediction.estimatedFlip < options.minProfit) return;
    }

    // Resource filter
    if (options.resourceFilter === 'only' && !prediction.resource) return;
    if (options.resourceFilter === 'hide' && prediction.resource) return;

    console.log(renderPrediction(prediction, displayOpts));
    return;
  }

  // ── System messages — show in all views ──
  if (msg.type !== 'alert' && msg.type !== 'prediction' && msg.type !== 'headline') {
    const text = renderSystemMessage(msg, options);
    if (text !== null) console.log(text);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
