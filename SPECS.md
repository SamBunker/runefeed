# GEWatch - Grand Exchange Watcher

## Overview

GEWatch is a real-time terminal monitoring tool that detects unusual trading activity on the Old School RuneScape Grand Exchange. It surfaces items experiencing abnormal volume spikes — heavy buy-ins or sell-offs — without requiring a whitelist, catching irregular activity as it happens.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    GEWatch Server                       │
│  (Long-running Node.js process / Docker container)      │
│                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ Poller   │──▶│ Spike Detect │──▶│ Alert Stream   │  │
│  │ (5m/1h)  │   │ Engine       │   │ (WebSocket)    │  │
│  └──────────┘   └──────────────┘   └────────────────┘  │
│        │                                    │           │
│        ▼                                    │           │
│  ┌──────────┐                               │           │
│  │ Rolling  │                               │           │
│  │ Window   │                               │           │
│  │ (memory) │                               │           │
│  └──────────┘                               │           │
└─────────────────────────────────────────────┼───────────┘
                                              │
                              ┌───────────────┼──────────┐
                              │  CLI Client   │          │
                              │  (Terminal)    ▼          │
                              │  ┌────────────────────┐  │
                              │  │ Live feed display  │  │
                              │  │ Timestamp | Info   │  │
                              │  └────────────────────┘  │
                              └──────────────────────────┘
```

### Components

1. **Server** — Long-running process that polls the OSRS Wiki API, detects volume spikes, and broadcasts alerts over WebSocket.
2. **CLI Client** — Connects to the server's WebSocket and renders alerts in the terminal as a live scrolling feed.

### Why Server + Client?

- The server monitors continuously, even when no terminal is open.
- Opening a terminal connects to the running server — no data gap, no restart.
- Multiple terminals can connect simultaneously.
- Future Discord webhook/bot alerting plugs directly into the server.

---

## Data Strategy (No Database Required)

### The Problem

Detecting "unusual" volume requires knowing what "normal" looks like. But we don't want to store every item's history in a database.

### The Solution: In-Memory Rolling Window

The server keeps a **rolling window of the last 12 intervals (1 hour)** of `/5m` data in memory. This is enough to:

- Calculate a short-term average volume per item.
- Compare the current interval's volume against that average.
- Detect spikes without persistent storage.

On startup, the server fetches the last hour of `/5m` data using the `timestamp` parameter to backfill its window immediately. No cold-start blind spot.

### Memory Footprint

- ~15,000 tradeable items x 12 intervals x ~40 bytes per entry = ~7 MB. Trivial.

---

## API Usage Plan

### Endpoints Used

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `GET /mapping` | Once on startup | Load item ID → name/metadata map, including `members` flag |
| `GET /5m` | Every 5 minutes | Volume + average prices for all items in one call |
| `GET /latest` | Every 60 seconds | Current instant-buy/sell prices for context |

### Politeness

- **No per-item queries.** The `/5m` and `/latest` endpoints return ALL items in a single request. One call every 5 minutes + one every 60 seconds is extremely lightweight.
- **User-Agent**: `GEWatch/1.0 - @<your-discord> on Discord` (required by the API).
- **No rate limiting concern** at these frequencies.

### F2P / Members Item Classification

The `/mapping` response includes a `members` boolean field for every item. This is loaded once at startup alongside the item name and `highalch` value and stored in the item metadata map. No additional API call is required.

Every alert the server emits carries a `members` field derived directly from this map:

- `members: false` — Free-to-play item, tradeable on F2P worlds.
- `members: true` — Members-only item.

This field is present in every WebSocket broadcast and every line written to `data/alerts.json`. The server never filters on it — classification is purely informational metadata. Consumers (CLI client, external scripts, future Discord bot) decide what to do with it.

---

## Spike Detection Algorithm

For each 5-minute interval, for each item:

```
current_volume = highPriceVolume + lowPriceVolume  (from current /5m snapshot)
avg_volume     = mean(volume over last 12 intervals)

spike_score = current_volume / max(avg_volume, 1)
```

An item triggers an alert when:

1. `spike_score >= SPIKE_THRESHOLD` (default: **5x** the rolling average)
2. `current_volume >= MIN_VOLUME` (default: **100** units — filters out low-liquidity noise)
3. Item is **not** in the exclude list

### Optional Value Filters

These are **off by default** (`0` = disabled) so that every item is evaluated for opportunities. Enable them to target specific price ranges:

- `minItemValue` (default: `0` / disabled) — Only alert on items worth at least this many gp. Useful for filtering out junk.
- `maxItemValue` (default: `0` / disabled) — Only alert on items worth at most this many gp. **"Penny stock" mode** — set this to e.g. `5000` to focus on low-value items with unusual movement.

Value is determined from the `/latest` instant-buy price, falling back to `highalch` from `/mapping` if no recent trade exists. When both filters are set, they define a price band (e.g., `minItemValue: 500, maxItemValue: 5000` targets items between 500–5,000 gp).

### Alert Classification

| Condition | Label |
|-----------|-------|
| `lowPriceVolume` dominates (>70% of total) | **SELL-OFF** — people dumping via instant-sell |
| `highPriceVolume` dominates (>70% of total) | **BUY-IN** — people buying via instant-buy |
| Neither dominates | **SURGE** — general volume spike both ways |

### Price Context

Each alert includes the current instant-buy/sell price from `/latest` so you can see what the item is trading at right now.

### Members / F2P Tag

Each alert also includes a `members` boolean. In the terminal feed, this renders as a short tag appended after the price columns:

- `[F2P]` — item is available on free-to-play worlds.
- `[MEM]` — members-only item.

The tag is always present on every alert line. It is dim by default so it does not compete visually with the alert type or prices, but is immediately readable when you want it.

---

## Streaming Pipeline & Real-Time Emission

### The Problem

The `/5m` endpoint returns ~15,000 items in a single JSON response. We need to process all of them efficiently and emit alerts as they're discovered — not wait until every item is checked.

### The Solution: Stream-As-You-Iterate

When a new `/5m` snapshot arrives:

1. **Parse** — Deserialize the full JSON response into a Map (single pass, ~2–3 MB payload).
2. **Iterate & Emit** — Loop through each item entry. For each item:
   - Look up its rolling window history.
   - Calculate spike score.
   - Check filters (exclude list, optional value filters).
   - **If it triggers: emit the alert immediately over WebSocket.** Don't wait for the rest.
   - Update the rolling window with this interval's data.
3. **Done** — By the time iteration finishes, all alerts have already been sent.

This means alerts appear in the terminal **as the server processes each item**, not after a batch step. Items that appear earlier in the response object hit the terminal first. The natural iteration time (~15,000 items in <100ms on Node.js) creates a near-instant but not simultaneous delivery — items trickle in over milliseconds.

### Optional Stagger Mode

For a more readable drip-feed effect, staggering can be enabled to add a small delay between each emitted alert:

- `staggerEnabled` (default: `false`) — When `true`, inserts `staggerDelayMs` between each alert emission.
- `staggerDelayMs` (default: `200ms`) — Delay between alerts when staggering is on.

When stagger is off (default), alerts emit at processing speed — effectively instant but naturally spread by computation time.

### Between Intervals

Between `/5m` snapshots (the 5-minute gap), the `/latest` endpoint is polled every 60 seconds. This keeps the price cache fresh for alert context but does **not** trigger volume alerts — volume data only comes from `/5m`.

---

## Terminal Output Format

```
[14:35:02] SELL-OFF  Dragon bones        | Vol: 12,847 (8.3x avg) | Sell: 2,198 gp  Buy: 2,215 gp  [MEM]
[14:35:02] BUY-IN   Cannonball          | Vol: 89,421 (5.1x avg) | Sell: 178 gp    Buy: 182 gp    [F2P]
[14:30:01] SURGE    Twisted bow         | Vol: 47 (12.0x avg)    | Sell: 1.02B gp  Buy: 1.03B gp  [MEM]
```

- Timestamps are local time, left-aligned.
- Alert type is color-coded (SELL-OFF = red, BUY-IN = green, SURGE = yellow).
- Volume shows absolute count and multiplier vs average.
- Prices are formatted with K/M/B suffixes for readability.
- `[F2P]` or `[MEM]` tag is appended at the end of every line in dim text. It is always present — no items are untagged.

---

## File Structure

```
GEWatch/
├── package.json
├── tsconfig.json
├── SPECS.md
├── config/
│   ├── default.json          # Thresholds, poll intervals, server port
│   └── exclude.json          # Item names to exclude from alerts
├── src/
│   ├── server/
│   │   ├── index.ts          # Server entry point
│   │   ├── poller.ts         # API polling logic
│   │   ├── detector.ts       # Spike detection engine
│   │   ├── rolling-window.ts # In-memory rolling data store
│   │   ├── api-client.ts     # OSRS Wiki API wrapper
│   │   └── ws-server.ts      # WebSocket broadcast server
│   ├── cli/
│   │   ├── index.ts          # CLI entry point
│   │   ├── display.ts        # Terminal formatting & colors
│   │   └── ws-client.ts      # WebSocket client
│   └── shared/
│       ├── types.ts          # Shared TypeScript types
│       └── format.ts         # Number/price formatting utils
├── data/
│   └── alerts.json           # Persisted alert log (appended over time)
├── Dockerfile                # Multi-stage build for server
├── docker-compose.yml        # Local dev + production deploy
└── .dockerignore
```

---

## Configuration

### `config/default.json`

```json
{
  "server": {
    "port": 3900,
    "host": "0.0.0.0"
  },
  "polling": {
    "fiveMinIntervalMs": 300000,
    "latestIntervalMs": 60000
  },
  "detection": {
    "spikeThreshold": 5,
    "minVolume": 100,
    "minItemValue": 0,
    "maxItemValue": 0,
    "rollingWindowSize": 12,
    "sellOffDominance": 0.70,
    "buyInDominance": 0.70
  },
  "display": {
    "staggerEnabled": false,
    "staggerDelayMs": 200
  },
  "output": {
    "alertsFile": "./data/alerts.json",
    "maxAlertsInFile": 10000
  },
  "api": {
    "baseUrl": "https://prices.runescape.wiki/api/v1/osrs",
    "userAgent": "GEWatch/1.0 - @yourdiscord on Discord"
  }
}
```

### `config/exclude.json`

```json
{
  "excludedItems": [
    "Burnt lobster",
    "Ugthanki dung"
  ]
}
```

Items are matched by name (case-insensitive). Add item names here to suppress their alerts.

---

## CLI Commands

```bash
# Start the server (background monitoring)
gewatch serve

# Connect to a running server and stream alerts
gewatch watch

# Connect and show only free-to-play items
gewatch watch --f2p

# Connect to a server on another machine
gewatch watch --host 192.168.1.50 --port 3900

# Remote connection, F2P filter
gewatch watch --host 192.168.1.50 --port 3900 --f2p

# Show current config
gewatch config
```

### `--f2p` Flag Behaviour

The `--f2p` flag is a **client-side display filter only**. It does not change what the server detects or logs. When active:

- Only alerts where `members === false` are printed to the terminal.
- Members items are silently skipped on the client.
- The connection banner reports `Filters: F2P items only` so the mode is visible.
- `data/alerts.json` on the server still records all alerts regardless of any client's `--f2p` flag. External tools always have the complete picture.

This design means one person can watch `gewatch watch --f2p` for F2P merching while another runs `gewatch watch` on the same server and sees everything — with no server restart or config change required.

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Runtime | **Node.js 20+ with TypeScript** | Single-threaded event loop is ideal — we're I/O bound (HTTP polling + WebSocket push), not CPU bound. Parsing ~15K items in a tight loop is <100ms. No need for multi-threading or heavier runtimes. |
| WebSocket | `ws` | Lightweight, battle-tested WebSocket server for Node.js |
| HTTP Client | Built-in `fetch` | Zero-dependency HTTP since Node 20. No axios/got needed. |
| Terminal Colors | `chalk` | ANSI color output for alert type coding |
| CLI Framework | `commander` | Minimal CLI arg parsing (`serve`, `watch`, `--host`, etc.) |
| Config | Direct JSON import | No config library needed — just `JSON.parse` on startup |
| Container | **Docker** (Alpine-based) | Runs on Portainer via GitOps. Single container, no orchestration. |
| Build | `tsc` | Standard TypeScript compilation, no bundler needed |

---

## Alert Persistence (`data/alerts.json`)

Alerts are appended to a JSON-lines file (one JSON object per line) for easy parsing:

```json
{"timestamp":"2026-03-14T14:35:02Z","type":"SELL-OFF","itemId":536,"itemName":"Dragon bones","members":true,"volume":12847,"spikeScore":8.3,"sellPrice":2198,"buyPrice":2215}
{"timestamp":"2026-03-14T14:35:02Z","type":"BUY-IN","itemId":2,"itemName":"Cannonball","members":false,"volume":89421,"spikeScore":5.1,"sellPrice":178,"buyPrice":182}
```

The `members` field is always present. This allows external tools to filter the log by account type without any special tooling beyond `jq`:

```bash
# Show only F2P alerts
jq 'select(.members == false)' data/alerts.json

# Show only members alerts
jq 'select(.members == true)' data/alerts.json
```

---

## Deployment

### Docker

The server runs as a single Docker container. No database, no external dependencies — just Node.js.

**Dockerfile** — Multi-stage build:
1. **Build stage**: Install deps, compile TypeScript.
2. **Run stage**: Copy compiled JS + node_modules into a slim Node 20 Alpine image.

**docker-compose.yml** — Used for both local testing and production:

```yaml
services:
  gewatch:
    build: .
    ports:
      - "3900:3900"
    volumes:
      - ./config:/app/config        # Config files (editable without rebuild)
      - ./data:/app/data            # Persistent alert log
    restart: unless-stopped
```

### Portainer / GitOps

The repo is structured so Portainer can deploy directly via GitOps:

- Point Portainer's **Git repository** stack at this repo.
- Portainer picks up `docker-compose.yml` from the repo root.
- On push to `main`, Portainer redeploys automatically (if GitOps polling or webhook is configured).
- Config overrides: mount a host-side `config/` directory to customize thresholds without modifying the image.

### Local Development

```bash
# Run server locally (no Docker)
npm run dev:server

# Run CLI client
npm run dev:cli

# Build and run with Docker
docker compose up --build
```

---

## Future / Suggestions

This section is reserved for future features and ideas. Redirect here when you have questions or want to add capabilities.

- **Discord alerting** — Webhook or bot integration to push alerts to a Discord channel. The server already has the alert stream; just add a Discord sink alongside the WebSocket broadcast.
- **Alert filtering in CLI** — Filter by spike score, volume, or price range. (Members/F2P filtering is already implemented via `--f2p`.)
- **Price change detection** — In addition to volume spikes, detect rapid price movement (e.g., price dropped 20% in the last hour).
- **Historical replay** — Save rolling window snapshots to disk periodically, allow replaying past sessions.
- **Web dashboard** — Serve a simple web UI from the same server for browser-based viewing.
- **Item watchlist mode** — Opposite of exclude: only alert on specific items (opt-in mode toggle).
- **GP-value weighting** — Rank alerts not just by volume count but by total GP moved (`volume * price`), surfacing economically significant events.
- **Cooldown per item** — After alerting on an item, suppress re-alerts for N minutes to reduce noise during sustained high-volume events.
- **Multi-game support** — The API also serves Deadman Mode (`/api/v1/dmm`). Could add a flag to monitor that economy too.

---

## Implementation Order

1. **Phase 1**: Shared types, API client, item mapping loader (including `members` field extraction)
2. **Phase 2**: Rolling window, poller, spike detection engine
3. **Phase 3**: WebSocket server, alert broadcasting (alerts include `members` field in payload)
4. **Phase 4**: CLI client with live terminal display (`[F2P]`/`[MEM]` tag on every alert line)
5. **Phase 5**: Config/exclude file support, alert persistence (`members` field in `alerts.json`)
6. **Phase 6**: Docker setup, CLI commands (`serve`, `watch`, `watch --f2p`)
