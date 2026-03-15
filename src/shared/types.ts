// ─── Item Mapping ───────────────────────────────────────────────
// Comes from GET /mapping — loaded once at startup.
// Each item in OSRS has a unique numeric ID. This maps ID → metadata.

export interface ItemMapping {
  id: number;
  name: string;
  examine: string;
  members: boolean;   // true = members-only, false = F2P
  lowalch: number;    // low alchemy value in gp
  highalch: number;   // high alchemy value in gp
  limit: number;      // GE buy limit per 4 hours
  value: number;      // base store value
  icon: string;       // icon filename on the wiki
}

// ─── API Responses ──────────────────────────────────────────────
// These match the exact JSON shapes returned by the OSRS Wiki API.

// GET /latest — one entry per item
export interface LatestPriceEntry {
  high: number | null;     // instant-buy price (someone bought at this price)
  highTime: number | null; // unix timestamp of that trade
  low: number | null;      // instant-sell price (someone sold at this price)
  lowTime: number | null;  // unix timestamp of that trade
}

// GET /5m or /1h — one entry per item
export interface IntervalPriceEntry {
  avgHighPrice: number | null;  // average instant-buy price over the interval
  highPriceVolume: number;      // how many units were instant-bought
  avgLowPrice: number | null;   // average instant-sell price over the interval
  lowPriceVolume: number;       // how many units were instant-sold
}

// The full API responses wrap these in a { data: { [itemId]: entry } } shape
export interface LatestResponse {
  data: Record<string, LatestPriceEntry>;
  // Record<string, T> is TypeScript for "an object where every key is a string
  // and every value is type T". Like a Map/Dictionary in other languages.
}

export interface IntervalResponse {
  data: Record<string, IntervalPriceEntry>;
  timestamp?: number; // the start of this interval (only present when we request a specific timestamp)
}

// ─── Internal Data Structures ───────────────────────────────────

// What we store per item per 5-minute interval in the rolling window
export interface VolumeSnapshot {
  highVolume: number;  // units instant-bought
  lowVolume: number;   // units instant-sold
  totalVolume: number; // highVolume + lowVolume
  timestamp: number;   // unix timestamp of this interval
  avgHighPrice: number | null;  // average instant-buy price this interval
  avgLowPrice: number | null;   // average instant-sell price this interval
}

// ─── Alerts ─────────────────────────────────────────────────────

// The three types of spike we detect
export type AlertType = 'SELL-OFF' | 'BUY-IN' | 'SURGE';
// "type" keyword here creates a *type alias*. The pipe (|) means "one of these
// literal string values". TypeScript will error if you try to assign any other
// string to a variable of this type.

// A single alert emitted by the detection engine
export interface Alert {
  timestamp: string;   // ISO 8601 timestamp (e.g., "2026-03-14T14:35:02Z")
  type: AlertType;
  timeframe: string;   // "5m", "10m", or "30m" — which window triggered this
  itemId: number;
  itemName: string;
  members: boolean;
  volume: number;      // total volume this interval/window
  spikeScore: number;  // how many times above the rolling average
  highVolume: number;  // instant-buy volume (for dominance context)
  lowVolume: number;   // instant-sell volume (for dominance context)
  sellPrice: number | null;  // current instant-sell price from /latest
  buyPrice: number | null;   // current instant-buy price from /latest
  tax: number | null;        // GE tax on sell (2%, capped at 5M gp)
  afterTaxSell: number | null; // what you actually receive after tax
  spread: number | null;     // afterTaxSell - buyPrice (profit/loss per item)
  resource: boolean;         // true if this is a resource/skilling item (from config/resources.json)
}

// ─── Price Trends ───────────────────────────────────────────────

// Used by the "runefeed trends" command — tracks price movement, not volume
export type TrendDirection = 'RISING' | 'FALLING' | 'VOLATILE';

export interface PriceTrend {
  timestamp: string;
  direction: TrendDirection;
  timeframe: string;       // "5m", "10m", "30m"
  itemId: number;
  itemName: string;
  members: boolean;
  currentPrice: number;    // current avg price
  previousPrice: number;   // avg price at start of the timeframe window
  priceChange: number;     // absolute gp change
  priceChangePercent: number; // percentage change
  sellPrice: number | null;
  buyPrice: number | null;
  tax: number | null;
  afterTaxSell: number | null;
  spread: number | null;
}

// ─── Predictions ─────────────────────────────────────────────────

// The four types of prediction the engine can generate
export type PredictionType = 'MOMENTUM' | 'BUY-WINDOW' | 'COOLING' | 'STABLE';
// MOMENTUM   — price rising with accelerating volume (investment opportunity)
// BUY-WINDOW — item trading below its recent average (buy low opportunity)
// COOLING    — item that was spiking is now decelerating (sell signal / avoid)
// STABLE     — no significant movement; only emitted for tracked items so
//              you always see your portfolio status each cycle

export interface Prediction {
  timestamp: string;          // ISO 8601
  type: PredictionType;
  itemId: number;
  itemName: string;
  members: boolean;
  currentPrice: number;       // current instant-sell price from /latest
  avgPrice: number;           // average price over the 1h window
  priceChangePercent: number; // % difference: current vs average
  currentVolume: number;      // total volume in the latest 5m interval
  avgVolume: number;          // rolling average 5m volume
  volumeRatio: number;        // currentVolume / avgVolume (acceleration)
  buyPrice: number | null;    // current instant-buy price
  sellPrice: number | null;   // current instant-sell price
  tax: number | null;
  afterTaxSell: number | null;
  spread: number | null;
  estimatedFlip: number | null; // estimated profit per item after tax
  resource: boolean;            // true if this is a resource/skilling item
}

// ─── Headline / Trending ────────────────────────────────────────

// The "pinned" trending item at the top of the watch view
export interface TrendingHeadline {
  itemId: number;
  itemName: string;
  type: AlertType;
  timeframe: string;       // which timeframe it's trending over
  spikeScore: number;
  consecutiveCycles: number; // how many poll cycles it has been spiking
  volume: number;
  sellPrice: number | null;
  buyPrice: number | null;
}

// ─── Configuration ──────────────────────────────────────────────

export interface TlsConfig {
  enabled: boolean;
  certPath: string;   // path to fullchain.pem (or similar)
  keyPath: string;    // path to privkey.pem
}

export interface SecurityConfig {
  maxClients: number;           // total simultaneous connections
  maxConnectionsPerIp: number;  // per-IP limit
  maxIncomingMessageBytes: number;
  maxTrackItems: number;
  maxTrackItemLength: number;
  maxMessagesPerMinute: number;
  idleTimeoutMs: number;        // disconnect idle clients (0 = disabled)
}

export type ServerMode = 'local' | 'production';

export interface ServerConfig {
  port: number;
  host: string;
  mode: ServerMode;
  tls: TlsConfig;
  security: SecurityConfig;
}

export interface PollingConfig {
  fiveMinIntervalMs: number;
  latestIntervalMs: number;
}

export interface DetectionConfig {
  spikeThreshold: number;
  minVolume: number;
  minItemValue: number;
  maxItemValue: number;
  rollingWindowSize: number;
  sellOffDominance: number;
  buyInDominance: number;
  timeframes: string[];      // e.g. ["5m", "10m", "30m"]
  priceChangeThreshold: number; // minimum % price change to trigger a trend alert
}

export interface TaxConfig {
  taxRate: number;     // 0.02 = 2%
  taxCap: number;      // 5,000,000 gp max tax per item
}

export interface DisplayConfig {
  staggerEnabled: boolean;
  staggerDelayMs: number;
}

export interface OutputConfig {
  alertsFile: string;
  maxAlertsInFile: number;
}

export interface ApiConfig {
  baseUrl: string;
  userAgent: string;
}

// The full config object — mirrors config/default.json exactly
export interface AppConfig {
  server: ServerConfig;
  polling: PollingConfig;
  detection: DetectionConfig;
  tax: TaxConfig;
  display: DisplayConfig;
  output: OutputConfig;
  api: ApiConfig;
}

// ─── WebSocket Messages ─────────────────────────────────────────
// Messages sent from server to client over WebSocket.
// The "type" field acts as a discriminator — the client checks msg.type
// to know what shape the rest of the object has.

export type WSMessage =
  | { type: 'alert'; data: Alert }
  | { type: 'prediction'; data: Prediction }
  | { type: 'headline'; data: TrendingHeadline | null }
  | { type: 'price-trend'; data: PriceTrend }
  | { type: 'poll-start'; cycle: number }
  | { type: 'poll-end'; cycle: number; alertCount: number }
  | { type: 'no-spikes'; cycle: number }
  | { type: 'status'; nextPollIn: number; clients: number }
  | { type: 'error'; message: string };
// This is a "discriminated union" — one of TypeScript's most powerful features.
// When you check `if (msg.type === 'alert')`, TypeScript automatically knows
// that `msg.data` exists and is an Alert. No casting needed.
