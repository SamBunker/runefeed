# GEWatch — Interactive Simulation Document

This document simulates GEWatch as a fully built and running product. Every terminal
output shown here is what a user would actually see on screen. ANSI color codes are
described inline using tags like [RED], [GREEN], [YELLOW], [DIM], [BOLD], [RESET] and
[CYAN]. Box-drawing characters are used to represent terminal borders and layout.

Prices used throughout reflect realistic OSRS Grand Exchange values as of early 2026.

---

## Table of Contents

1. Server Startup
2. CLI Client Connection
3. Live Alert Feed
4. Value Filter Examples
5. Exclude List
6. F2P / Members Filtering
7. Configuration (`gewatch config`)
8. Alert Persistence (`data/alerts.json`)
9. Docker Deployment
10. Edge Cases
11. Multiple Clients Simultaneously

---

## 1. Server Startup

### Command

```
$ gewatch serve
```

### Terminal Output — Full Startup Sequence

```
[BOLD][CYAN]
 ██████╗ ███████╗██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗
██╔════╝ ██╔════╝██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║
██║  ███╗█████╗  ██║ █╗ ██║███████║   ██║   ██║     ███████║
██║   ██║██╔══╝  ██║███╗██║██╔══██║   ██║   ██║     ██╔══██║
╚██████╔╝███████╗╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║
 ╚═════╝ ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝
[RESET]
[DIM]  Grand Exchange Watcher v1.0.0 — OSRS Volume Spike Monitor[RESET]

[DIM]──────────────────────────────────────────────────────────────[RESET]

[BOLD]Initializing...[RESET]

[DIM][09:14:22][RESET]  Loading item mapping from API...
[DIM][09:14:22][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/mapping
[DIM][09:14:23][RESET]    [GREEN]✓[RESET] Loaded [BOLD]15,342[RESET] tradeable items

[DIM][09:14:23][RESET]  Backfilling rolling window (last 12 x 5m intervals = 1 hour)...
[DIM][09:14:23][RESET]    Fetching interval  1/12  (t-60m) ...
[DIM][09:14:23][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/5m?timestamp=1741944862
[DIM][09:14:24][RESET]    [GREEN]✓[RESET] interval  1 — [BOLD]14,891[RESET] items with volume data
[DIM][09:14:24][RESET]    Fetching interval  2/12  (t-55m) ...
[DIM][09:14:24][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/5m?timestamp=1741945162
[DIM][09:14:25][RESET]    [GREEN]✓[RESET] interval  2 — [BOLD]14,903[RESET] items with volume data
[DIM][09:14:25][RESET]    Fetching interval  3/12  (t-50m) ...
[DIM][09:14:26][RESET]    [GREEN]✓[RESET] interval  3 — [BOLD]14,877[RESET] items with volume data
[DIM][09:14:26][RESET]    Fetching interval  4/12  (t-45m) ...
[DIM][09:14:27][RESET]    [GREEN]✓[RESET] interval  4 — [BOLD]14,919[RESET] items with volume data
[DIM][09:14:27][RESET]    Fetching interval  5/12  (t-40m) ...
[DIM][09:14:28][RESET]    [GREEN]✓[RESET] interval  5 — [BOLD]14,888[RESET] items with volume data
[DIM][09:14:28][RESET]    Fetching interval  6/12  (t-35m) ...
[DIM][09:14:29][RESET]    [GREEN]✓[RESET] interval  6 — [BOLD]14,902[RESET] items with volume data
[DIM][09:14:29][RESET]    Fetching interval  7/12  (t-30m) ...
[DIM][09:14:30][RESET]    [GREEN]✓[RESET] interval  7 — [BOLD]14,866[RESET] items with volume data
[DIM][09:14:30][RESET]    Fetching interval  8/12  (t-25m) ...
[DIM][09:14:31][RESET]    [GREEN]✓[RESET] interval  8 — [BOLD]14,911[RESET] items with volume data
[DIM][09:14:31][RESET]    Fetching interval  9/12  (t-20m) ...
[DIM][09:14:32][RESET]    [GREEN]✓[RESET] interval  9 — [BOLD]14,894[RESET] items with volume data
[DIM][09:14:32][RESET]    Fetching interval 10/12  (t-15m) ...
[DIM][09:14:33][RESET]    [GREEN]✓[RESET] interval 10 — [BOLD]14,908[RESET] items with volume data
[DIM][09:14:33][RESET]    Fetching interval 11/12  (t-10m) ...
[DIM][09:14:34][RESET]    [GREEN]✓[RESET] interval 11 — [BOLD]14,887[RESET] items with volume data
[DIM][09:14:34][RESET]    Fetching interval 12/12  (t-5m) ...
[DIM][09:14:35][RESET]    [GREEN]✓[RESET] interval 12 — [BOLD]14,921[RESET] items with volume data

[DIM][09:14:35][RESET]  [GREEN]✓[RESET] Rolling window ready — [BOLD]12 intervals[RESET] loaded in [BOLD]12.4s[RESET]
[DIM][09:14:35][RESET]    Memory footprint: [BOLD]~6.8 MB[RESET]

[DIM][09:14:35][RESET]  Starting /latest price cache poller (every 60s)...
[DIM][09:14:35][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/latest
[DIM][09:14:36][RESET]    [GREEN]✓[RESET] Price cache warm — [BOLD]15,218[RESET] items with instant prices

[DIM][09:14:36][RESET]  Starting WebSocket server...
[DIM][09:14:36][RESET]    [GREEN]✓[RESET] Listening on [BOLD]ws://0.0.0.0:3900[RESET]

[DIM]──────────────────────────────────────────────────────────────[RESET]
[BOLD][GREEN]  GEWatch server is running.[RESET]
[DIM]  Clients connect via:  gewatch watch[RESET]
[DIM]  Config:               ./config/default.json[RESET]
[DIM]  Alert log:            ./data/alerts.json[RESET]
[DIM]  Spike threshold:      5x rolling average[RESET]
[DIM]  Min volume:           100 trades[RESET]
[DIM]  Value filters:        disabled[RESET]
[DIM]  Stagger mode:         off[RESET]
[DIM]──────────────────────────────────────────────────────────────[RESET]

[DIM][09:14:36][RESET]  Scheduling first /5m poll in [BOLD]4m 47s[RESET] (next interval boundary)...

[DIM][09:19:01][RESET]  [BOLD]--- Poll cycle #1 ---[RESET]
[DIM][09:19:01][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/5m
[DIM][09:19:02][RESET]    Response: [BOLD]2.4 MB[RESET] — [BOLD]14,934[RESET] item entries
[DIM][09:19:02][RESET]    Processing 14,934 items...
[DIM][09:19:02][RESET]    [GREEN]✓[RESET] Done — [BOLD]3[RESET] alerts emitted — [BOLD]0 clients[RESET] connected
[DIM][09:19:02][RESET]    Next poll in [BOLD]5m 00s[RESET]
```

The first poll cycle runs even with no clients connected. Alerts are still written to
`data/alerts.json`. When a client connects later it begins receiving live alerts
immediately from the next cycle onward.

---

## 2. CLI Client Connection

### 2a. Local connection (default host/port)

```
$ gewatch watch
```

```
[DIM][09:22:14][RESET]  Connecting to [BOLD]ws://localhost:3900[RESET]...
[DIM][09:22:14][RESET]  [GREEN]✓[RESET] Connected

[DIM]──────────────────────────────────────────────────────────────[RESET]
[BOLD][CYAN]  GEWatch — Live Alert Feed[RESET]
[DIM]  Server:    localhost:3900[RESET]
[DIM]  Filters:   none (showing all items)[RESET]
[DIM]  Stagger:   off[RESET]
[DIM]  Press Ctrl+C to disconnect[RESET]
[DIM]──────────────────────────────────────────────────────────────[RESET]

[DIM]  Waiting for next poll cycle...  (next /5m in ~2m 31s)[RESET]
```

The client correctly reports the approximate wait time based on the server's next
scheduled poll. The display sits quietly until alerts arrive.

---

### 2b. Remote host connection

```
$ gewatch watch --host 192.168.1.50 --port 3900
```

```
[DIM][09:22:14][RESET]  Connecting to [BOLD]ws://192.168.1.50:3900[RESET]...
[DIM][09:22:15][RESET]  [GREEN]✓[RESET] Connected

[DIM]──────────────────────────────────────────────────────────────[RESET]
[BOLD][CYAN]  GEWatch — Live Alert Feed[RESET]
[DIM]  Server:    192.168.1.50:3900[RESET]
[DIM]  Filters:   none (showing all items)[RESET]
[DIM]  Stagger:   off[RESET]
[DIM]  Press Ctrl+C to disconnect[RESET]
[DIM]──────────────────────────────────────────────────────────────[RESET]

[DIM]  Waiting for next poll cycle...  (next /5m in ~4m 07s)[RESET]
```

The banner reflects the actual remote address so the user always knows which server
they are watching.

---

## 3. Live Alert Feed

### 3a. Stagger OFF (default) — alerts fire at processing speed

This is what you see when a poll cycle completes. Alerts from one cycle typically
arrive within a 50-100ms window and appear nearly simultaneously.

The following scenario unfolds across three separate poll cycles. Timestamps are
realistic and spread 5 minutes apart as the tool actually runs.

---

#### Poll cycle at 09:24:01 — two alerts

```
[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:24:01] Poll cycle #3 — processing...[RESET]

[09:24:01] [BOLD][RED]SELL-OFF[RESET]  Dragon bones          | Vol: [BOLD]12,847[RESET] ([RED]8.3x avg[RESET])  | Sell: [BOLD]2,198 gp[RESET]   Buy: [BOLD]2,215 gp[RESET]  [DIM][MEM][RESET]
[09:24:01] [BOLD][GREEN]BUY-IN  [RESET]  Cannonball            | Vol: [BOLD]89,421[RESET] ([GREEN]5.1x avg[RESET])  | Sell: [BOLD]178 gp[RESET]     Buy: [BOLD]182 gp[RESET]    [DIM][F2P][RESET]
```

Both alerts appear within ~40ms of each other — to the eye they look simultaneous.

---

#### Poll cycle at 09:29:01 — one alert

```
[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:29:01] Poll cycle #4 — processing...[RESET]

[09:29:01] [BOLD][YELLOW]SURGE   [RESET]  Twisted bow           | Vol: [BOLD]47[RESET] ([YELLOW]12.0x avg[RESET])   | Sell: [BOLD]1.02B gp[RESET]   Buy: [BOLD]1.03B gp[RESET]  [DIM][MEM][RESET]
```

---

#### Poll cycle at 09:34:01 — no alerts

```
[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:34:01] Poll cycle #5 — processing...[RESET]
[DIM][09:34:01] No spikes detected this interval.[RESET]
```

A "no spikes" line is printed so the user knows the poll ran and is healthy — the
terminal is not simply frozen.

---

#### Poll cycle at 09:39:01 — multi-alert burst (four alerts)

```
[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:39:01] Poll cycle #6 — processing...[RESET]

[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Abyssal whip          | Vol: [BOLD]1,204[RESET] ([RED]6.7x avg[RESET])   | Sell: [BOLD]2.79M gp[RESET]   Buy: [BOLD]2.81M gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Rune platebody        | Vol: [BOLD]4,882[RESET] ([GREEN]5.3x avg[RESET])   | Sell: [BOLD]37,800 gp[RESET]  Buy: [BOLD]38,200 gp[RESET]  [DIM][F2P][RESET]
[09:39:01] [BOLD][YELLOW]SURGE   [RESET]  Bandos godsword       | Vol: [BOLD]318[RESET] ([YELLOW]9.1x avg[RESET])    | Sell: [BOLD]11.9M gp[RESET]   Buy: [BOLD]12.1M gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Nature rune           | Vol: [BOLD]312,044[RESET] ([GREEN]7.8x avg[RESET])  | Sell: [BOLD]119 gp[RESET]     Buy: [BOLD]122 gp[RESET]    [DIM][F2P][RESET]
```

Four alerts arrive within ~80ms. Because stagger is off, all four land at the same
clock-second in the terminal display.

---

### 3b. Stagger ON — drip-feed effect

To enable stagger, set `"staggerEnabled": true` in `config/default.json`. With the
default `staggerDelayMs` of 200ms, the same four-alert burst from cycle #6 would
instead appear like this:

```
[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:39:01] Poll cycle #6 — processing...[RESET]

[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Abyssal whip          | Vol: [BOLD]1,204[RESET] ([RED]6.7x avg[RESET])   | Sell: [BOLD]2.79M gp[RESET]   Buy: [BOLD]2.81M gp[RESET]  [DIM][MEM][RESET]
[09:39:02] [BOLD][GREEN]BUY-IN  [RESET]  Rune platebody        | Vol: [BOLD]4,882[RESET] ([GREEN]5.3x avg[RESET])   | Sell: [BOLD]37,800 gp[RESET]  Buy: [BOLD]38,200 gp[RESET]  [DIM][F2P][RESET]
[09:39:02] [BOLD][YELLOW]SURGE   [RESET]  Bandos godsword       | Vol: [BOLD]318[RESET] ([YELLOW]9.1x avg[RESET])    | Sell: [BOLD]11.9M gp[RESET]   Buy: [BOLD]12.1M gp[RESET]  [DIM][MEM][RESET]
[09:39:02] [BOLD][GREEN]BUY-IN  [RESET]  Nature rune           | Vol: [BOLD]312,044[RESET] ([GREEN]7.8x avg[RESET])  | Sell: [BOLD]119 gp[RESET]     Buy: [BOLD]122 gp[RESET]    [DIM][F2P][RESET]
```

Each line is separated by 200ms. The timestamps visibly step forward in seconds,
giving the feed a readable drip effect rather than a wall of text.

---

### 3c. Scenario walkthroughs

#### Scenario: SELL-OFF — Dragon bones being dumped

Context: A large player or bot is mass-selling Dragon bones via instant-sell. The
`lowPriceVolume` dominates at over 70% of total volume for this interval.

```
[09:24:01] [BOLD][RED]SELL-OFF[RESET]  Dragon bones          | Vol: [BOLD]12,847[RESET] ([RED]8.3x avg[RESET])  | Sell: [BOLD]2,198 gp[RESET]   Buy: [BOLD]2,215 gp[RESET]  [DIM][MEM][RESET]
```

- The rolling average for Dragon bones was ~1,548 trades per 5m interval.
- This interval saw 12,847 — 8.3 times the average.
- Sell price (2,198) is slightly below the typical ~2,220 range, consistent with
  someone pushing through the order book.
- lowPriceVolume: 9,714 (75.6% of total) — qualifies as SELL-OFF.

---

#### Scenario: BUY-IN — Cannonballs being accumulated

Context: A mercher or clan is buying up Cannonballs in bulk ahead of a manipulation
attempt, or a large Ironman clan just placed a massive buy order.

```
[09:24:01] [BOLD][GREEN]BUY-IN  [RESET]  Cannonball            | Vol: [BOLD]89,421[RESET] ([GREEN]5.1x avg[RESET])  | Sell: [BOLD]178 gp[RESET]     Buy: [BOLD]182 gp[RESET]    [DIM][F2P][RESET]
```

- Rolling average: ~17,533 cannonballs per 5m interval.
- This interval: 89,421 — 5.1x.
- highPriceVolume: 66,940 (74.9% of total) — qualifies as BUY-IN.
- Buy price (182) is slightly above the usual ~179, reflecting buy-side pressure.

---

#### Scenario: SURGE — Twisted bow, high-value, both sides active

Context: News broke on Reddit about a Twisted bow mechanic change. Both buyers and
sellers are reacting. Neither side dominates — total volume is the signal.

```
[09:29:01] [BOLD][YELLOW]SURGE   [RESET]  Twisted bow           | Vol: [BOLD]47[RESET] ([YELLOW]12.0x avg[RESET])   | Sell: [BOLD]1.02B gp[RESET]   Buy: [BOLD]1.03B gp[RESET]  [DIM][MEM][RESET]
```

- Rolling average: ~4 Twisted bows per 5m interval. (High-value items trade rarely.)
- This interval: 47 — 12.0x.
- The MIN_VOLUME threshold of 100 would normally filter this out. Note: this item
  passes only if minVolume is adjusted downward for high-value items, or if the
  operator has set minVolume to something lower like 20. In the default config at
  minVolume=100 this alert would NOT fire. Shown here as an illustration — operators
  monitoring high-value items should set minVolume: 20 or lower.
- highPriceVolume: 26 (55.3%), lowPriceVolume: 21 (44.7%) — neither dominates at 70%.
  Classified as SURGE.

---

#### Scenario: Quiet period

After a burst of early-morning activity, the market goes quiet during mid-morning:

```
[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][10:04:01] Poll cycle #11 — processing...[RESET]
[DIM][10:04:01] No spikes detected this interval.[RESET]

[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][10:09:01] Poll cycle #12 — processing...[RESET]
[DIM][10:09:01] No spikes detected this interval.[RESET]

[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][10:14:01] Poll cycle #13 — processing...[RESET]
[DIM][10:14:01] No spikes detected this interval.[RESET]
```

Three consecutive quiet intervals. The poll separator lines confirm the server is
alive and polling. The user is not looking at a dead terminal.

---

## 4. Value Filter Examples

### 4a. No filters (default) — everything shows

`config/default.json` with both value filters at 0 (disabled):

```json
"detection": {
  "minItemValue": 0,
  "maxItemValue": 0,
  ...
}
```

All spiking items appear regardless of price:

```
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Dragon bones          | Vol: [BOLD]12,847[RESET] ([RED]8.3x avg[RESET])   | Sell: [BOLD]2,198 gp[RESET]   Buy: [BOLD]2,215 gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Cannonball            | Vol: [BOLD]89,421[RESET] ([GREEN]5.1x avg[RESET])   | Sell: [BOLD]178 gp[RESET]     Buy: [BOLD]182 gp[RESET]    [DIM][F2P][RESET]
[09:39:01] [BOLD][YELLOW]SURGE   [RESET]  Twisted bow           | Vol: [BOLD]47[RESET] ([YELLOW]12.0x avg[RESET])    | Sell: [BOLD]1.02B gp[RESET]   Buy: [BOLD]1.03B gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Abyssal whip          | Vol: [BOLD]1,204[RESET] ([RED]6.7x avg[RESET])   | Sell: [BOLD]2.79M gp[RESET]   Buy: [BOLD]2.81M gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Rune platebody        | Vol: [BOLD]4,882[RESET] ([GREEN]5.3x avg[RESET])   | Sell: [BOLD]37,800 gp[RESET]  Buy: [BOLD]38,200 gp[RESET]  [DIM][F2P][RESET]
[09:39:01] [BOLD][YELLOW]SURGE   [RESET]  Bandos godsword       | Vol: [BOLD]318[RESET] ([YELLOW]9.1x avg[RESET])    | Sell: [BOLD]11.9M gp[RESET]   Buy: [BOLD]12.1M gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Nature rune           | Vol: [BOLD]312,044[RESET] ([GREEN]7.8x avg[RESET])  | Sell: [BOLD]119 gp[RESET]     Buy: [BOLD]122 gp[RESET]    [DIM][F2P][RESET]
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Burnt lobster         | Vol: [BOLD]9,311[RESET] ([RED]14.2x avg[RESET])  | Sell: [BOLD]1 gp[RESET]       Buy: [BOLD]1 gp[RESET]        [DIM][F2P][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Oak logs              | Vol: [BOLD]187,442[RESET] ([GREEN]6.0x avg[RESET])  | Sell: [BOLD]54 gp[RESET]      Buy: [BOLD]56 gp[RESET]      [DIM][F2P][RESET]
```

Note the last two entries: Burnt lobster (1 gp) and Oak logs (54 gp) spike but are
essentially noise in terms of economic significance.

---

### 4b. minItemValue: 1250 — cheap junk filtered out

Set in `config/default.json`:

```json
"detection": {
  "minItemValue": 1250,
  "maxItemValue": 0
}
```

The server banner now reflects the active filter:

```
[DIM]  Filters:   minItemValue >= 1,250 gp[RESET]
```

Same poll cycle, with cheap items filtered:

```
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Dragon bones          | Vol: [BOLD]12,847[RESET] ([RED]8.3x avg[RESET])   | Sell: [BOLD]2,198 gp[RESET]   Buy: [BOLD]2,215 gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][YELLOW]SURGE   [RESET]  Twisted bow           | Vol: [BOLD]47[RESET] ([YELLOW]12.0x avg[RESET])    | Sell: [BOLD]1.02B gp[RESET]   Buy: [BOLD]1.03B gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Abyssal whip          | Vol: [BOLD]1,204[RESET] ([RED]6.7x avg[RESET])   | Sell: [BOLD]2.79M gp[RESET]   Buy: [BOLD]2.81M gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Rune platebody        | Vol: [BOLD]4,882[RESET] ([GREEN]5.3x avg[RESET])   | Sell: [BOLD]37,800 gp[RESET]  Buy: [BOLD]38,200 gp[RESET]  [DIM][F2P][RESET]
[09:39:01] [BOLD][YELLOW]SURGE   [RESET]  Bandos godsword       | Vol: [BOLD]318[RESET] ([YELLOW]9.1x avg[RESET])    | Sell: [BOLD]11.9M gp[RESET]   Buy: [BOLD]12.1M gp[RESET]  [DIM][MEM][RESET]
```

Filtered out (below 1,250 gp): Cannonball (178 gp), Nature rune (119 gp),
Burnt lobster (1 gp), Oak logs (54 gp). The feed is now cleaner and focused
on items with actual economic weight.

---

### 4c. maxItemValue: 5000 — "penny stock" mode

Set in `config/default.json`:

```json
"detection": {
  "minItemValue": 0,
  "maxItemValue": 5000
}
```

Banner:

```
[DIM]  Filters:   maxItemValue <= 5,000 gp[RESET]
```

Same poll cycle:

```
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Cannonball            | Vol: [BOLD]89,421[RESET] ([GREEN]5.1x avg[RESET])   | Sell: [BOLD]178 gp[RESET]     Buy: [BOLD]182 gp[RESET]    [DIM][F2P][RESET]
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Dragon bones          | Vol: [BOLD]12,847[RESET] ([RED]8.3x avg[RESET])   | Sell: [BOLD]2,198 gp[RESET]   Buy: [BOLD]2,215 gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Nature rune           | Vol: [BOLD]312,044[RESET] ([GREEN]7.8x avg[RESET])  | Sell: [BOLD]119 gp[RESET]     Buy: [BOLD]122 gp[RESET]    [DIM][F2P][RESET]
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Burnt lobster         | Vol: [BOLD]9,311[RESET] ([RED]14.2x avg[RESET])  | Sell: [BOLD]1 gp[RESET]       Buy: [BOLD]1 gp[RESET]        [DIM][F2P][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Oak logs              | Vol: [BOLD]187,442[RESET] ([GREEN]6.0x avg[RESET])  | Sell: [BOLD]54 gp[RESET]      Buy: [BOLD]56 gp[RESET]      [DIM][F2P][RESET]
```

All high-value items (Twisted bow, Abyssal whip, Rune platebody, Bandos godsword)
are suppressed. This mode is useful for low-cost item flippers watching for momentum
plays on cheap consumables.

---

### 4d. Band filter — minItemValue: 500, maxItemValue: 50000

```json
"detection": {
  "minItemValue": 500,
  "maxItemValue": 50000
}
```

Banner:

```
[DIM]  Filters:   500 gp <= itemValue <= 50,000 gp[RESET]
```

Same poll cycle result — only items priced between 500 gp and 50,000 gp:

```
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Dragon bones          | Vol: [BOLD]12,847[RESET] ([RED]8.3x avg[RESET])   | Sell: [BOLD]2,198 gp[RESET]   Buy: [BOLD]2,215 gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Rune platebody        | Vol: [BOLD]4,882[RESET] ([GREEN]5.3x avg[RESET])   | Sell: [BOLD]37,800 gp[RESET]  Buy: [BOLD]38,200 gp[RESET]  [DIM][F2P][RESET]
```

Cannonball (178 gp) falls below the 500 gp floor. Nature rune (119 gp), Burnt lobster,
Oak logs also excluded. Abyssal whip (2.79M gp), Twisted bow (1.02B gp), and Bandos
godsword (11.9M gp) are above the 50,000 gp ceiling. The band zeroes in on mid-range
tradeable items — herbs, seeds, common equipment.

---

## 5. Exclude List

### Excluding an item

Dragon bones is generating noise because a major clan is botting Prayer training and
the item spikes every single poll cycle. You want to exclude it.

Edit `config/exclude.json`:

```json
{
  "excludedItems": [
    "Burnt lobster",
    "Ugthanki dung",
    "Dragon bones"
  ]
}
```

Items are matched case-insensitively. The server reads this file on startup. To apply
the change to a running server, restart it (`Ctrl+C` then `gewatch serve` again).

After restart, the startup log confirms the exclude list:

```
[DIM][09:14:23][RESET]  Loading exclude list...
[DIM][09:14:23][RESET]    [GREEN]✓[RESET] [BOLD]3[RESET] items excluded: Burnt lobster, Ugthanki dung, Dragon bones
```

Now in the alert feed, Dragon bones no longer appears even when it spikes at 8.3x:

```
[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:39:01] Poll cycle #6 — processing...[RESET]

[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Cannonball            | Vol: [BOLD]89,421[RESET] ([GREEN]5.1x avg[RESET])   | Sell: [BOLD]178 gp[RESET]     Buy: [BOLD]182 gp[RESET]    [DIM][F2P][RESET]
[09:39:01] [BOLD][YELLOW]SURGE   [RESET]  Bandos godsword       | Vol: [BOLD]318[RESET] ([YELLOW]9.1x avg[RESET])    | Sell: [BOLD]11.9M gp[RESET]   Buy: [BOLD]12.1M gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Nature rune           | Vol: [BOLD]312,044[RESET] ([GREEN]7.8x avg[RESET])  | Sell: [BOLD]119 gp[RESET]     Buy: [BOLD]122 gp[RESET]    [DIM][F2P][RESET]
```

Dragon bones is silently dropped. No indication of exclusion in the live feed — it
simply does not appear.

---

### Full exclude.json example for a noisy market session

```json
{
  "excludedItems": [
    "Burnt lobster",
    "Ugthanki dung",
    "Dragon bones",
    "Ranarr seed",
    "Oak logs",
    "Cowhide",
    "Bucket of sand",
    "Soda ash"
  ]
}
```

This excludes prayer-training staples (Dragon bones), commonly botted resources
(Oak logs, Cowhide), and crafting supplies (Bucket of sand, Soda ash) that spike
predictably every morning when bots log in.

---

## 6. F2P / Members Filtering

### How classification works

When the server loads the item mapping at startup, every item in the `/mapping` response
includes a `members` boolean. This is stored alongside the item name in memory. No
extra API call is needed and there is no manual list to maintain — Jagex defines which
items are F2P and the API reflects it.

Every alert the server emits and every line written to `data/alerts.json` carries
this field. The server itself never filters on it.

### What the tag looks like in the feed

Every alert line ends with a dim membership tag. It is always present, never absent.

```
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Dragon bones          | Vol: [BOLD]12,847[RESET] ([RED]8.3x avg[RESET])   | Sell: [BOLD]2,198 gp[RESET]   Buy: [BOLD]2,215 gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Cannonball            | Vol: [BOLD]89,421[RESET] ([GREEN]5.1x avg[RESET])   | Sell: [BOLD]178 gp[RESET]     Buy: [BOLD]182 gp[RESET]    [DIM][F2P][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Nature rune           | Vol: [BOLD]312,044[RESET] ([GREEN]7.8x avg[RESET])  | Sell: [BOLD]119 gp[RESET]     Buy: [BOLD]122 gp[RESET]    [DIM][F2P][RESET]
[09:39:01] [BOLD][YELLOW]SURGE   [RESET]  Bandos godsword       | Vol: [BOLD]318[RESET] ([YELLOW]9.1x avg[RESET])    | Sell: [BOLD]11.9M gp[RESET]   Buy: [BOLD]12.1M gp[RESET]  [DIM][MEM][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Rune platebody        | Vol: [BOLD]4,882[RESET] ([GREEN]5.3x avg[RESET])   | Sell: [BOLD]37,800 gp[RESET]  Buy: [BOLD]38,200 gp[RESET]  [DIM][F2P][RESET]
[09:39:01] [BOLD][RED]SELL-OFF[RESET]  Abyssal whip          | Vol: [BOLD]1,204[RESET] ([RED]6.7x avg[RESET])   | Sell: [BOLD]2.79M gp[RESET]   Buy: [BOLD]2.81M gp[RESET]  [DIM][MEM][RESET]
```

The tag is intentionally dim. It lives at the end of the line where it does not compete
visually with the alert type or prices during a busy burst of alerts, but can be read
immediately when you scan for it.

---

### 6a. `gewatch watch --f2p` — F2P-only terminal view

```
$ gewatch watch --f2p
```

```
[DIM][09:39:00][RESET]  Connecting to [BOLD]ws://localhost:3900[RESET]...
[DIM][09:39:00][RESET]  [GREEN]✓[RESET] Connected

[DIM]──────────────────────────────────────────────────────────────[RESET]
[BOLD][CYAN]  GEWatch — Live Alert Feed[RESET]
[DIM]  Server:    localhost:3900[RESET]
[DIM]  Filters:   F2P items only[RESET]
[DIM]  Stagger:   off[RESET]
[DIM]  Press Ctrl+C to disconnect[RESET]
[DIM]──────────────────────────────────────────────────────────────[RESET]

[DIM]  Waiting for next poll cycle...  (next /5m in ~0m 01s)[RESET]

[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:39:01] Poll cycle #6 — processing...[RESET]

[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Cannonball            | Vol: [BOLD]89,421[RESET] ([GREEN]5.1x avg[RESET])   | Sell: [BOLD]178 gp[RESET]     Buy: [BOLD]182 gp[RESET]    [DIM][F2P][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Nature rune           | Vol: [BOLD]312,044[RESET] ([GREEN]7.8x avg[RESET])  | Sell: [BOLD]119 gp[RESET]     Buy: [BOLD]122 gp[RESET]    [DIM][F2P][RESET]
[09:39:01] [BOLD][GREEN]BUY-IN  [RESET]  Rune platebody        | Vol: [BOLD]4,882[RESET] ([GREEN]5.3x avg[RESET])   | Sell: [BOLD]37,800 gp[RESET]  Buy: [BOLD]38,200 gp[RESET]  [DIM][F2P][RESET]
```

The members items (Dragon bones, Bandos godsword, Abyssal whip) from that same poll
cycle are silently skipped. They were detected by the server and written to
`alerts.json` as normal — the CLI client simply did not display them.

The `Filters: F2P items only` line in the banner makes the active mode unambiguous.

---

### 6b. Combining `--f2p` with `--host`

```
$ gewatch watch --host 192.168.1.50 --port 3900 --f2p
```

```
[DIM][09:39:00][RESET]  Connecting to [BOLD]ws://192.168.1.50:3900[RESET]...
[DIM][09:39:00][RESET]  [GREEN]✓[RESET] Connected

[DIM]──────────────────────────────────────────────────────────────[RESET]
[BOLD][CYAN]  GEWatch — Live Alert Feed[RESET]
[DIM]  Server:    192.168.1.50:3900[RESET]
[DIM]  Filters:   F2P items only[RESET]
[DIM]  Stagger:   off[RESET]
[DIM]  Press Ctrl+C to disconnect[RESET]
[DIM]──────────────────────────────────────────────────────────────[RESET]

[DIM]  Waiting for next poll cycle...  (next /5m in ~3m 14s)[RESET]
```

The flag works identically for remote connections.

---

### 6c. Using `data/alerts.json` externally for F2P analysis

Because `members` is a field in every persisted alert, post-session analysis needs no
special tooling. Standard `jq` queries work directly:

```bash
# Only F2P alerts from the last session
jq 'select(.members == false)' data/alerts.json

# F2P BUY-IN alerts only — potential merch targets
jq 'select(.members == false and .type == "BUY-IN")' data/alerts.json

# Members-only SELL-OFFs — might indicate supply flood on member items
jq 'select(.members == true and .type == "SELL-OFF")' data/alerts.json

# Count F2P alerts vs members alerts
jq -s '{f2p: map(select(.members == false)) | length, members: map(select(.members == true)) | length}' data/alerts.json
```

Example output of the last query after a one-hour session:

```json
{
  "f2p": 23,
  "members": 41
}
```

This reflects the expected ratio — the F2P economy is smaller with fewer actively
traded items, so F2P alerts are less frequent but often represent more concentrated
activity on a narrow item pool.

---

### 6d. Known F2P tradeable items (context)

The following items are free-to-play tradeable on the Grand Exchange and will carry
`[F2P]` tags when they spike. This list is illustrative, not exhaustive:

| Item | Typical price | Common spike reason |
|------|--------------|---------------------|
| Cannonball | ~180 gp | Bulk buying by rangers / merchers |
| Nature rune | ~120 gp | Runecrafting output surge |
| Rune platebody | ~38,000 gp | F2P armour flipping |
| Rune full helm | ~21,000 gp | F2P armour flipping |
| Rune scimitar | ~15,000 gp | Popular F2P weapon |
| Lobster | ~110 gp | F2P food staple |
| Shark | ~850 gp | Members food but GE-accessible F2P |
| Oak logs | ~55 gp | Bot-driven woodcutting output |
| Coal | ~175 gp | F2P mining output |
| Mithril ore | ~130 gp | F2P mining output |
| Law rune | ~185 gp | Runecrafting output |
| Chaos rune | ~70 gp | Runecrafting output |
| Iron ore | ~80 gp | F2P mining staple |

Members items like Dragon bones, Abyssal whip, and Bandos godsword will never carry
`[F2P]` — they will always show `[MEM]`.

---

## 7. Configuration (`gewatch config`)

### Command

```
$ gewatch config
```

### Terminal Output

```
[BOLD][CYAN]GEWatch — Current Configuration[RESET]
[DIM]  Source: /app/config/default.json[RESET]


[DIM]──────────────────────────────────────────────────────────────[RESET]

[BOLD]SERVER[RESET]
  port                [BOLD]3900[RESET]
  host                [BOLD]0.0.0.0[RESET]

[BOLD]POLLING[RESET]
  fiveMinIntervalMs   [BOLD]300,000 ms[RESET]   [DIM](every 5 minutes)[RESET]
  latestIntervalMs    [BOLD]60,000 ms[RESET]    [DIM](every 60 seconds)[RESET]

[BOLD]DETECTION[RESET]
  spikeThreshold      [BOLD]5x[RESET]           [DIM](alert when volume >= 5x rolling average)[RESET]
  minVolume           [BOLD]100[RESET]           [DIM](minimum trades in interval to qualify)[RESET]
  rollingWindowSize   [BOLD]12[RESET]            [DIM](number of 5m intervals = 1 hour)[RESET]
  sellOffDominance    [BOLD]0.70[RESET]          [DIM](>70% low-price vol = SELL-OFF)[RESET]
  buyInDominance      [BOLD]0.70[RESET]          [DIM](>70% high-price vol = BUY-IN)[RESET]
  minItemValue        [BOLD]0[RESET]             [DIM](disabled — all items evaluated)[RESET]
  maxItemValue        [BOLD]0[RESET]             [DIM](disabled — all items evaluated)[RESET]

[BOLD]DISPLAY[RESET]
  staggerEnabled      [BOLD]false[RESET]
  staggerDelayMs      [BOLD]200 ms[RESET]        [DIM](used only when staggerEnabled = true)[RESET]

[BOLD]OUTPUT[RESET]
  alertsFile          [BOLD]./data/alerts.json[RESET]
  maxAlertsInFile     [BOLD]10,000[RESET]        [DIM](oldest entries pruned when limit reached)[RESET]

[BOLD]API[RESET]
  baseUrl             [BOLD]https://prices.runescape.wiki/api/v1/osrs[RESET]
  userAgent           [BOLD]GEWatch/1.0 - @yourdiscord on Discord[RESET]

[BOLD]EXCLUDE LIST[RESET]   [DIM]source: /app/config/exclude.json[RESET]
  Burnt lobster
  Ugthanki dung

[BOLD]ITEM MAPPING[RESET]
  Total items loaded   [BOLD]15,342[RESET]
  F2P items            [BOLD]1,089[RESET]   [DIM](members == false)[RESET]
  Members items        [BOLD]14,253[RESET]  [DIM](members == true)[RESET]

[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM]  Edit config/default.json or config/exclude.json to change settings.[RESET]
[DIM]  Restart the server for changes to take effect.[RESET]
```

---

## 8. Alert Persistence (`data/alerts.json`)

### What the file looks like after a one-hour session

Alerts are stored as JSON Lines (one JSON object per line). The file can be opened in
any text editor or piped to `jq` for querying. Each line is a complete, self-contained
record.

```
D:/GEWatcher/data/alerts.json
```

```jsonl
{"timestamp":"2026-03-14T09:19:02Z","type":"SELL-OFF","itemId":536,"itemName":"Dragon bones","members":true,"volume":4211,"spikeScore":5.4,"sellPrice":2201,"buyPrice":2218}
{"timestamp":"2026-03-14T09:19:02Z","type":"BUY-IN","itemId":2,"itemName":"Cannonball","members":false,"volume":51302,"spikeScore":5.2,"sellPrice":179,"buyPrice":182}
{"timestamp":"2026-03-14T09:24:01Z","type":"SELL-OFF","itemId":536,"itemName":"Dragon bones","members":true,"volume":12847,"spikeScore":8.3,"sellPrice":2198,"buyPrice":2215}
{"timestamp":"2026-03-14T09:24:01Z","type":"BUY-IN","itemId":2,"itemName":"Cannonball","members":false,"volume":89421,"spikeScore":5.1,"sellPrice":178,"buyPrice":182}
{"timestamp":"2026-03-14T09:29:01Z","type":"SURGE","itemId":20997,"itemName":"Twisted bow","members":true,"volume":47,"spikeScore":12.0,"sellPrice":1021000000,"buyPrice":1032000000}
{"timestamp":"2026-03-14T09:39:01Z","type":"SELL-OFF","itemId":4151,"itemName":"Abyssal whip","members":true,"volume":1204,"spikeScore":6.7,"sellPrice":2790000,"buyPrice":2810000}
{"timestamp":"2026-03-14T09:39:01Z","type":"BUY-IN","itemId":1093,"itemName":"Rune platebody","members":false,"volume":4882,"spikeScore":5.3,"sellPrice":37800,"buyPrice":38200}
{"timestamp":"2026-03-14T09:39:01Z","type":"SURGE","itemId":11802,"itemName":"Bandos godsword","members":true,"volume":318,"spikeScore":9.1,"sellPrice":11900000,"buyPrice":12100000}
{"timestamp":"2026-03-14T09:39:01Z","type":"BUY-IN","itemId":561,"itemName":"Nature rune","members":false,"volume":312044,"spikeScore":7.8,"sellPrice":119,"buyPrice":122}
{"timestamp":"2026-03-14T09:44:01Z","type":"BUY-IN","itemId":453,"itemName":"Coal","members":false,"volume":228910,"spikeScore":5.9,"sellPrice":174,"buyPrice":176}
{"timestamp":"2026-03-14T09:49:01Z","type":"SELL-OFF","itemId":3802,"itemName":"Ranarr seed","members":true,"volume":8841,"spikeScore":6.2,"sellPrice":47200,"buyPrice":48100}
{"timestamp":"2026-03-14T09:54:01Z","type":"BUY-IN","itemId":385,"itemName":"Shark","members":false,"volume":44203,"spikeScore":5.5,"sellPrice":848,"buyPrice":855}
{"timestamp":"2026-03-14T09:59:01Z","type":"SURGE","itemId":11802,"itemName":"Bandos godsword","members":true,"volume":291,"spikeScore":8.2,"sellPrice":12050000,"buyPrice":12200000}
{"timestamp":"2026-03-14T10:04:01Z","type":"SELL-OFF","itemId":536,"itemName":"Dragon bones","members":true,"volume":9102,"spikeScore":7.1,"sellPrice":2185,"buyPrice":2204}
{"timestamp":"2026-03-14T10:09:01Z","type":"BUY-IN","itemId":1079,"itemName":"Rune platelegs","members":false,"volume":3211,"spikeScore":5.8,"sellPrice":37400,"buyPrice":37900}
```

### Querying the file with jq (example usage)

```bash
# Show all SELL-OFF events
jq 'select(.type == "SELL-OFF")' data/alerts.json

# Show only high-value items (over 1M gp)
jq 'select(.sellPrice > 1000000)' data/alerts.json

# Count alerts per item
jq -s 'group_by(.itemName) | map({item: .[0].itemName, count: length}) | sort_by(-.count)' data/alerts.json

# F2P items only
jq 'select(.members == false)' data/alerts.json

# F2P BUY-IN opportunities only
jq 'select(.members == false and .type == "BUY-IN")' data/alerts.json

# Members SELL-OFF events only
jq 'select(.members == true and .type == "SELL-OFF")' data/alerts.json
```

### When the file reaches maxAlertsInFile (10,000 lines)

The server logs a maintenance event and prunes the oldest entries:

```
[DIM][14:22:01][RESET]  alerts.json reached 10,000 entries — pruning oldest 1,000 records
[DIM][14:22:01][RESET]  [GREEN]✓[RESET] alerts.json trimmed to 9,000 entries
```

The file never exceeds 10,000 lines unless the operator manually increases the limit.

---

## 9. Docker Deployment

### 9a. `docker compose up --build`

```
$ docker compose up --build
```

```
[+] Building 34.2s (14/14) FINISHED
 => [gewatch internal] load build definition from Dockerfile           0.1s
 => => transferring dockerfile: 487B                                   0.0s
 => [gewatch internal] load .dockerignore                              0.0s
 => => transferring context: 89B                                       0.0s
 => [gewatch internal] load metadata for docker.io/library/node:20-   1.4s
 => [gewatch build 1/6] FROM docker.io/library/node:20-alpine@sha256  0.0s
 => [gewatch internal] load build context                              0.1s
 => => transferring context: 48.22kB                                   0.0s
 => CACHED [gewatch build 2/6] WORKDIR /build                         0.0s
 => [gewatch build 3/6] COPY package*.json ./                         0.1s
 => [gewatch build 4/6] RUN npm ci --quiet                            14.3s
 => [gewatch build 5/6] COPY . .                                       0.2s
 => [gewatch build 6/6] RUN npm run build                             8.1s
 => [gewatch run 1/4] FROM docker.io/library/node:20-alpine@sha256    0.0s
 => [gewatch run 2/4] WORKDIR /app                                     0.0s
 => [gewatch run 3/4] COPY --from=build /build/dist ./dist            0.1s
 => [gewatch run 4/4] COPY --from=build /build/node_modules ./node_   1.8s
 => [gewatch] exporting to image                                       0.8s
 => => exporting layers                                                0.8s
 => => writing image sha256:a3f92c1d...                                0.0s
 => => naming to docker.io/library/gewatcher-gewatch                   0.0s

[+] Running 2/2
 ✔ Network gewatcher_default  Created                                  0.1s
 ✔ Container gewatcher-gewatch-1  Started                              0.4s

Attaching to gewatcher-gewatch-1

gewatcher-gewatch-1  |
gewatcher-gewatch-1  |  ██████╗ ███████╗██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗
gewatcher-gewatch-1  | ██╔════╝ ██╔════╝██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║
gewatcher-gewatch-1  | ██║  ███╗█████╗  ██║ █╗ ██║███████║   ██║   ██║     ███████║
gewatcher-gewatch-1  | ██║   ██║██╔══╝  ██║███╗██║██╔══██║   ██║   ██║     ██╔══██║
gewatcher-gewatch-1  | ╚██████╔╝███████╗╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║
gewatcher-gewatch-1  |  ╚═════╝ ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝
gewatcher-gewatch-1  |
gewatcher-gewatch-1  |   Grand Exchange Watcher v1.0.0 — OSRS Volume Spike Monitor
gewatcher-gewatch-1  |
gewatcher-gewatch-1  | [09:14:22]  Loading item mapping from API...
gewatcher-gewatch-1  | [09:14:23]    ✓ Loaded 15,342 tradeable items
gewatcher-gewatch-1  | [09:14:23]  Backfilling rolling window (last 12 x 5m intervals = 1 hour)...
gewatcher-gewatch-1  | [09:14:23]    Fetching interval  1/12  (t-60m) ...
gewatcher-gewatch-1  |    ... (12 intervals load) ...
gewatcher-gewatch-1  | [09:14:35]    ✓ Rolling window ready — 12 intervals loaded in 12.4s
gewatcher-gewatch-1  | [09:14:36]    ✓ Listening on ws://0.0.0.0:3900
gewatcher-gewatch-1  |
gewatcher-gewatch-1  |   GEWatch server is running.
```

The container is now running. On a server with Portainer you would detach
(`Ctrl+C` stops logs but not the container since `restart: unless-stopped` is set).

---

### 9b. Running detached (production mode)

```
$ docker compose up --build -d
```

```
[+] Building 0.4s (14/14) FINISHED   (image cached from prior build)
[+] Running 1/1
 ✔ Container gewatcher-gewatch-1  Started                              0.3s
```

Check it's healthy:

```
$ docker compose ps
```

```
NAME                     IMAGE                    COMMAND                  SERVICE   CREATED         STATUS         PORTS
gewatcher-gewatch-1      gewatcher-gewatch        "node dist/server/in…"   gewatch   8 seconds ago   Up 7 seconds   0.0.0.0:3900->3900/tcp
```

---

### 9c. Portainer Stack View

In the Portainer web UI (typically `http://192.168.1.50:9000`) the stack appears as:

```
┌─────────────────────────────────────────────────────────────────┐
│ Stacks > gewatcher                                              │
├─────────────────────────────────────────────────────────────────┤
│ Status:   [GREEN]Active[RESET]       Containers: 1      Created: 2026-03-14   │
│ Source:   Git repository   Branch: main                         │
│ URL:      https://github.com/youruser/GEWatcher                 │
│                                                                 │
│ Containers                                                      │
│ ┌────────────────────┬──────────┬────────┬──────────────────┐   │
│ │ Name               │ Status   │ Image  │ Published Ports  │   │
│ ├────────────────────┼──────────┼────────┼──────────────────┤   │
│ │ gewatcher-gewatch-1│ [GREEN]running[RESET]  │ gewatch│ 3900:3900/tcp    │   │
│ └────────────────────┴──────────┴────────┴──────────────────┘   │
│                                                                 │
│ Volumes                                                         │
│   ./config  →  /app/config   (config files)                     │
│   ./data    →  /app/data     (alert log persistence)            │
└─────────────────────────────────────────────────────────────────┘
```

GitOps auto-redeploy is enabled. Pushing to `main` triggers Portainer to pull the
new image within ~60 seconds and redeploy the container.

---

## 10. Edge Cases

### 10a. Server not running — client tries to connect

```
$ gewatch watch
```

```
[DIM][09:22:14][RESET]  Connecting to [BOLD]ws://localhost:3900[RESET]...
[RED][09:22:17]  Connection failed: ECONNREFUSED localhost:3900[RESET]
[DIM]  Is the server running?  Start it with: gewatch serve[RESET]
[DIM]  Retrying in 10s... (attempt 1/5)[RESET]

[DIM][09:22:27][RESET]  Connecting to [BOLD]ws://localhost:3900[RESET]...
[RED][09:22:30]  Connection failed: ECONNREFUSED localhost:3900[RESET]
[DIM]  Retrying in 10s... (attempt 2/5)[RESET]

[DIM][09:22:40][RESET]  Connecting to [BOLD]ws://localhost:3900[RESET]...
[RED][09:22:43]  Connection failed: ECONNREFUSED localhost:3900[RESET]
[DIM]  Retrying in 10s... (attempt 3/5)[RESET]

[DIM][09:22:53][RESET]  Connecting to [BOLD]ws://localhost:3900[RESET]...
[RED][09:22:56]  Connection failed: ECONNREFUSED localhost:3900[RESET]
[DIM]  Retrying in 10s... (attempt 4/5)[RESET]

[DIM][09:23:06][RESET]  Connecting to [BOLD]ws://localhost:3900[RESET]...
[RED][09:23:09]  Connection failed: ECONNREFUSED localhost:3900[RESET]
[RED]  Max retries reached. Exiting.[RESET]
[DIM]  Start the server with: gewatch serve[RESET]
```

The client retries 5 times with 10-second gaps before giving up. The user is
instructed clearly how to fix it. Exit code is non-zero (1) so scripts can detect it.

---

### 10b. API is down — server polling fails

The server is running. The OSRS Wiki API returns a 503 on a scheduled maintenance window.

```
[DIM][10:00:01][RESET]  [BOLD]--- Poll cycle #13 ---[RESET]
[DIM][10:00:01][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/5m
[YELLOW][10:00:04]  API error: 503 Service Unavailable — retrying in 30s[RESET]

[DIM][10:00:34][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/5m (retry 1/3)
[YELLOW][10:00:37]  API error: 503 Service Unavailable — retrying in 30s[RESET]

[DIM][10:01:07][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/5m (retry 2/3)
[YELLOW][10:01:10]  API error: 503 Service Unavailable — retrying in 30s[RESET]

[DIM][10:01:40][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/5m (retry 3/3)
[YELLOW][10:01:43]  API error: 503 Service Unavailable — skipping this interval[RESET]
[DIM][10:01:43]  Rolling window unchanged. Next poll attempt in 5m 00s[RESET]
```

Clients connected during this period see:

```
[DIM][10:00:01] Poll cycle #13 — API unavailable, skipped.[RESET]
```

The server does not crash. It logs the failure, skips the interval, and resumes
normally at the next scheduled time. The rolling window is not updated for the
skipped interval, which slightly skews the average for one subsequent cycle — a
known and acceptable tradeoff.

---

### 10c. No items spike — quiet market

Already shown in section 3 but worth noting the exact server-side log:

```
[DIM][10:04:01][RESET]  [BOLD]--- Poll cycle #14 ---[RESET]
[DIM][10:04:01][RESET]    GET https://prices.runescape.wiki/api/v1/osrs/5m
[DIM][10:04:02][RESET]    Response: 2.3 MB — 14,901 item entries
[DIM][10:04:02][RESET]    Processing 14,901 items...
[DIM][10:04:02][RESET]    [GREEN]✓[RESET] Done — [BOLD]0[RESET] alerts emitted — [BOLD]2 clients[RESET] connected
[DIM][10:04:02][RESET]    Next poll in [BOLD]5m 00s[RESET]
```

Client terminal:

```
[DIM][10:04:01] Poll cycle #14 — processing...[RESET]
[DIM][10:04:01] No spikes detected this interval.[RESET]
```

The "no spikes" message is always printed. The user can distinguish between
"nothing happened" and "the tool crashed."

---

### 10d. Cold start — first few intervals before window is full

During the first 12 poll cycles after a fresh start with no backfill (hypothetical
scenario — in practice the backfill prevents this), the rolling window would have
fewer than 12 data points. The server handles this gracefully:

In practice, the server always backfills 12 intervals on startup, so this condition
only appears if the API was unavailable during startup backfill. In that case:

```
[DIM][09:14:23][RESET]  Backfilling rolling window...
[YELLOW][09:14:23]  Warning: API unavailable during backfill — starting with empty window[RESET]
[DIM][09:14:23][RESET]  Will suppress alerts until [BOLD]3[RESET] intervals of data are collected
[DIM]  (spike detection requires at least 3 data points to be meaningful)[RESET]
```

Server log during warm-up:

```
[DIM][09:19:01][RESET]  Poll cycle #1 — window size: 1/12 — [DIM]alerts suppressed (warming up)[RESET]
[DIM][09:24:01][RESET]  Poll cycle #2 — window size: 2/12 — [DIM]alerts suppressed (warming up)[RESET]
[DIM][09:29:01][RESET]  Poll cycle #3 — window size: 3/12 — [GREEN]alerts now active[RESET]
```

Client sees during warm-up:

```
[DIM][09:19:01] Poll cycle #1 — warming up (1/3 minimum intervals collected)...[RESET]
[DIM][09:24:01] Poll cycle #2 — warming up (2/3 minimum intervals collected)...[RESET]
[DIM][09:29:01] Poll cycle #3 — [GREEN]window ready — live alerts enabled[RESET]

[09:29:01] [BOLD][RED]SELL-OFF[RESET]  Dragon bones          | Vol: [BOLD]14,021[RESET] ([RED]6.8x avg[RESET])   | Sell: [BOLD]2,195 gp[RESET]   Buy: [BOLD]2,212 gp[RESET]  [DIM][MEM][RESET]
```

The spike scores will be noisier with only 3 intervals of history versus 12, but the
tool correctly communicates this to the user and does not silently produce garbage.

---

## 11. Multiple Clients Simultaneously

Two terminals connecting to the same server receive identical alert streams in real
time. There is no coordination between clients — the server broadcasts to all
connected WebSocket clients simultaneously.

---

### Terminal A — opened first at 09:20:00

```
$ gewatch watch
[DIM][09:20:00][RESET]  Connecting to [BOLD]ws://localhost:3900[RESET]...
[DIM][09:20:00][RESET]  [GREEN]✓[RESET] Connected

[DIM]──────────────────────────────────────────────────────────────[RESET]
[BOLD][CYAN]  GEWatch — Live Alert Feed[RESET]
[DIM]  Server:    localhost:3900[RESET]
[DIM]  Filters:   none (showing all items)[RESET]
[DIM]  Stagger:   off[RESET]
[DIM]  Press Ctrl+C to disconnect[RESET]
[DIM]──────────────────────────────────────────────────────────────[RESET]

[DIM]  Waiting for next poll cycle...  (next /5m in ~4m 01s)[RESET]

[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:24:01] Poll cycle #3 — processing...[RESET]

[09:24:01] [BOLD][RED]SELL-OFF[RESET]  Dragon bones          | Vol: [BOLD]12,847[RESET] ([RED]8.3x avg[RESET])   | Sell: [BOLD]2,198 gp[RESET]   Buy: [BOLD]2,215 gp[RESET]  [DIM][MEM][RESET]
[09:24:01] [BOLD][GREEN]BUY-IN  [RESET]  Cannonball            | Vol: [BOLD]89,421[RESET] ([GREEN]5.1x avg[RESET])   | Sell: [BOLD]178 gp[RESET]     Buy: [BOLD]182 gp[RESET]    [DIM][F2P][RESET]

[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:29:01] Poll cycle #4 — processing...[RESET]

[09:29:01] [BOLD][YELLOW]SURGE   [RESET]  Bandos godsword       | Vol: [BOLD]318[RESET] ([YELLOW]9.1x avg[RESET])    | Sell: [BOLD]11.9M gp[RESET]   Buy: [BOLD]12.1M gp[RESET]  [DIM][MEM][RESET]
[09:29:01] [BOLD][GREEN]BUY-IN  [RESET]  Shark                 | Vol: [BOLD]44,203[RESET] ([GREEN]5.5x avg[RESET])   | Sell: [BOLD]848 gp[RESET]     Buy: [BOLD]855 gp[RESET]    [DIM][F2P][RESET]
```

---

### Terminal B — opened at 09:27:45, connects mid-session

```
$ gewatch watch
[DIM][09:27:45][RESET]  Connecting to [BOLD]ws://localhost:3900[RESET]...
[DIM][09:27:45][RESET]  [GREEN]✓[RESET] Connected

[DIM]──────────────────────────────────────────────────────────────[RESET]
[BOLD][CYAN]  GEWatch — Live Alert Feed[RESET]
[DIM]  Server:    localhost:3900[RESET]
[DIM]  Filters:   none (showing all items)[RESET]
[DIM]  Stagger:   off[RESET]
[DIM]  Press Ctrl+C to disconnect[RESET]
[DIM]──────────────────────────────────────────────────────────────[RESET]

[DIM]  Waiting for next poll cycle...  (next /5m in ~1m 16s)[RESET]

[DIM]──────────────────────────────────────────────────────────────[RESET]
[DIM][09:29:01] Poll cycle #4 — processing...[RESET]

[09:29:01] [BOLD][YELLOW]SURGE   [RESET]  Bandos godsword       | Vol: [BOLD]318[RESET] ([YELLOW]9.1x avg[RESET])    | Sell: [BOLD]11.9M gp[RESET]   Buy: [BOLD]12.1M gp[RESET]  [DIM][MEM][RESET]
[09:29:01] [BOLD][GREEN]BUY-IN  [RESET]  Shark                 | Vol: [BOLD]44,203[RESET] ([GREEN]5.5x avg[RESET])   | Sell: [BOLD]848 gp[RESET]     Buy: [BOLD]855 gp[RESET]    [DIM][F2P][RESET]
```

Terminal B correctly misses the 09:24:01 cycle (it was not connected then) and
picks up exactly where Terminal A is from cycle #4 onward. Both terminals show the
exact same alerts for poll cycle #4 — same timestamps, same volumes, same prices.

---

### Server log with two clients

```
[DIM][09:24:01][RESET]  Poll cycle #3 — 2 alerts emitted — [BOLD]1 client[RESET] connected
[DIM][09:27:45][RESET]  Client connected — [BOLD]2 clients[RESET] now connected   [DIM](ws://127.0.0.1:54821)[RESET]
[DIM][09:29:01][RESET]  Poll cycle #4 — 2 alerts emitted — [BOLD]2 clients[RESET] connected
```

The server tracks connected client count and logs it with each poll cycle. The
client IP is logged at connection time for diagnostics.

---

### Terminal A: Client B disconnects

When the second client presses Ctrl+C, Terminal A is completely unaffected:

```
[DIM][09:31:12]  (client disconnected — 1 client now connected)[RESET]
```

This message appears on the server log, not on Terminal A's feed. Terminal A's
live alert stream continues uninterrupted.

---

## Summary of Visual Conventions

Throughout this simulation the following color and style conventions are used,
matching what `chalk` renders in a real terminal:

```
[RED]    — SELL-OFF labels and error messages
[GREEN]  — BUY-IN labels, success states, checkmarks
[YELLOW] — SURGE labels and warning messages
[CYAN]   — Headers and section banners
[BOLD]   — Item names, volume numbers, config values
[DIM]    — Timestamps, separators, metadata, waiting state text, [F2P]/[MEM] tags
[RESET]  — Return to default terminal color
```

The alert line format is fixed-width so that long item names and short ones both
align correctly in the terminal. The column layout is:

```
[timestamp] [type padded to 8 chars]  [name padded to 22 chars]  | Vol: [volume] ([score]x avg)  | Sell: [price]  Buy: [price]  [DIM][tag][RESET]
```

The `[tag]` is either `[F2P]` or `[MEM]` — always present, always dim, always last.
It does not disrupt the visual rhythm of the price columns. When scanning a busy feed
you read the type and price first; the tag is there when you need to filter by eye or
when you want to confirm an item's account-type before acting on it.

The `--f2p` flag on `gewatch watch` is a client-side display filter only. The server
sees and records everything. The tag in the feed and the `members` field in
`data/alerts.json` give you the same information through two different consumption
paths: one for live terminal use, one for post-session analysis.
```
