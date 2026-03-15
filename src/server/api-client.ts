// api-client.ts — Wrapper around the OSRS Wiki Real-Time Prices API
//
// This module handles all HTTP communication with the API. The rest of
// the app never calls fetch() directly — it goes through these functions.
// This keeps API details (URLs, headers, error handling) in one place.

import type {
  ItemMapping,
  LatestPriceEntry,
  IntervalPriceEntry,
  AppConfig,
} from '../shared/types.js';
// The "import type" syntax tells TypeScript "I only need this for type-checking,
// don't include it in the compiled JavaScript." It's an optimization — the
// compiled JS file won't have an import statement for types at all.
//
// The ".js" extension is required even though the source file is ".ts".
// This is a Node.js ES module requirement — at runtime, the files ARE .js
// (TypeScript compiles .ts → .js), so imports must reference the .js output.

/**
 * OsrsApiClient wraps the OSRS Wiki pricing API.
 *
 * In TypeScript, a "class" bundles data (properties) and behavior (methods)
 * together. The constructor runs when you create an instance with `new`.
 */
export class OsrsApiClient {
  private baseUrl: string;
  private userAgent: string;
  // "private" means these can only be accessed inside this class.
  // Outside code can't do `client.baseUrl` — the compiler prevents it.

  constructor(config: AppConfig) {
    this.baseUrl = config.api.baseUrl;
    this.userAgent = config.api.userAgent;
  }

  /**
   * Internal helper for making GET requests with proper headers and error handling.
   *
   * The <T> is a "generic type parameter" — it means "the caller tells me what
   * type the JSON response will be." This way we get type safety without
   * writing a separate method for each endpoint.
   *
   * "async" means this function returns a Promise — it does work that takes
   * time (network request) and you "await" the result.
   */
  private async fetchJson<T>(path: string, retries = 3): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as T;
        // "as T" is a type assertion — we tell TypeScript "trust me, the JSON
        // matches this type." The API docs guarantee the shape.
      } catch (err) {
        const isLast = attempt === retries;
        const message = err instanceof Error ? err.message : String(err);

        if (isLast) {
          throw new Error(`API request failed after ${retries} attempts: ${url} — ${message}`);
        }

        // Wait 30 seconds before retrying (matches SIMULATION.md behavior)
        console.error(`[API] ${message} — retrying in 30s (attempt ${attempt}/${retries})`);
        await this.sleep(30_000);
      }
    }

    // TypeScript requires this even though the loop always returns or throws.
    // It's called an "exhaustiveness check" — the compiler can't prove the
    // loop always terminates, so we help it.
    throw new Error('Unreachable');
  }

  /**
   * GET /mapping — Returns metadata for all tradeable items.
   * Called once at startup to build the item ID → name/members/highalch map.
   */
  async fetchMapping(): Promise<ItemMapping[]> {
    return this.fetchJson<ItemMapping[]>('/mapping');
  }

  /**
   * GET /latest — Returns current instant-buy/sell prices for all items.
   * Returns a Map for fast lookups by item ID.
   *
   * A Map is JavaScript's built-in hash map. Unlike a plain object, it:
   * - Has .get(), .set(), .has() methods
   * - Keys can be any type (we use numbers)
   * - Is optimized for frequent additions/deletions
   */
  async fetchLatest(): Promise<Map<number, LatestPriceEntry>> {
    const raw = await this.fetchJson<{ data: Record<string, LatestPriceEntry> }>('/latest');
    const map = new Map<number, LatestPriceEntry>();

    for (const [idStr, entry] of Object.entries(raw.data)) {
      map.set(Number(idStr), entry);
      // Object.entries() turns { "536": {...}, "2": {...} } into an array of
      // [key, value] pairs. We convert the string key to a number since item
      // IDs are numeric.
    }

    return map;
  }

  /**
   * GET /5m — Returns 5-minute averaged prices and volumes for all items.
   * Optionally accepts a Unix timestamp to fetch a specific historical interval.
   */
  async fetchFiveMin(timestamp?: number): Promise<Map<number, IntervalPriceEntry>> {
    // The "?" after "timestamp" means the parameter is optional.
    // Inside the function, its type is "number | undefined".
    const path = timestamp ? `/5m?timestamp=${timestamp}` : '/5m';
    const raw = await this.fetchJson<{ data: Record<string, IntervalPriceEntry> }>(path);
    const map = new Map<number, IntervalPriceEntry>();

    for (const [idStr, entry] of Object.entries(raw.data)) {
      map.set(Number(idStr), entry);
    }

    return map;
  }

  /**
   * GET /1h — Returns 1-hour averaged prices and volumes for all items.
   * Used by the prediction engine to compare current prices against hourly averages.
   *
   * Same shape as /5m but aggregated over the last hour instead of 5 minutes.
   */
  async fetchOneHour(): Promise<Map<number, IntervalPriceEntry>> {
    const raw = await this.fetchJson<{ data: Record<string, IntervalPriceEntry> }>('/1h');
    const map = new Map<number, IntervalPriceEntry>();

    for (const [idStr, entry] of Object.entries(raw.data)) {
      map.set(Number(idStr), entry);
    }

    return map;
  }

  /**
   * Simple sleep utility. Returns a Promise that resolves after `ms` milliseconds.
   *
   * "await this.sleep(5000)" pauses execution for 5 seconds without blocking
   * the event loop — other things (like WebSocket messages) can still happen.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
    // This is a common JavaScript pattern. "new Promise" creates a promise,
    // and "resolve" is the function that completes it. setTimeout calls
    // resolve after the delay, which "wakes up" whoever is awaiting it.
  }
}
