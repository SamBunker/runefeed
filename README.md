# RuneFeed

Real-time Grand Exchange volume feed for Old School RuneScape. Detects massive sell-offs, buy-ins, and price surges as they happen.

Website: [runefeed.cc](https://runefeed.cc)

## Install

```bash
npm install -g runefeed
```

Requires Node.js 18+.

## Quick Start

```bash
runefeed watch
```

On first run, you'll be prompted to choose a server:

```
  1)  RuneFeed Public Feed  (feed.runefeed.cc)
  2)  Local Server          (localhost:3900)
  3)  Custom Server         (enter host & port)
```

Your choice is saved to `~/.runefeed/config.json` so you only configure once.

## Views

### Alerts (default)

Volume spike alerts triggered when an item trades at 10x+ its normal volume.

- **SELL-OFF** -- 70%+ of volume is instant-sells
- **BUY-IN** -- 70%+ of volume is instant-buys
- **SURGE** -- high volume, mixed direction

### Predictions

Investment signals based on price momentum and volume acceleration.

```bash
runefeed watch --view predictions
```

- **MOMENTUM** -- price up 3%+ with 2x+ volume
- **BUY-WINDOW** -- price down 5%+ from average (potential dip buy)
- **COOLING** -- was spiking, now decelerating (sell signal)
- **STABLE** -- no movement (only shown for tracked items)

## Flags

| Flag | Description |
|------|-------------|
| `--view predictions` | Switch to prediction feed |
| `--track "Dragon bones, Air rune"` | Track specific items (comma-separated) |
| `--min-spike 15` | Only show spikes >= 15x average |
| `--min-price 1000` | Only show items worth >= 1,000 gp |
| `--min-profit 200` | Only show predictions with flip >= 200 gp/ea |
| `--resources` | Only show resource/skilling items |
| `--hide-resources` | Hide resource/skilling items |
| `--f2p` | Free-to-play items only |
| `--compact` | Minimal output |
| `--no-tax` | Hide tax/spread columns |
| `--type sell-off` | Filter by alert type |
| `--tls` | Force encrypted connection |

Flags can be combined:

```bash
runefeed watch --view predictions --min-profit 200 --resources
runefeed watch --track "Dragon bones, Yew logs" --compact
runefeed watch --f2p --min-spike 20
```

## Commands

| Command | Description |
|---------|-------------|
| `runefeed watch` | Connect and stream live data |
| `runefeed serve` | Run your own server (local mode) |
| `runefeed serve --production` | Production mode with TLS and strict security |
| `runefeed config` | Show current server configuration |
| `runefeed setup` | Re-run the server setup prompt |
| `runefeed logout` | Clear saved server config |

## Self-Hosting

Clone the repo and run your own instance:

```bash
git clone https://github.com/SamBunker/runefeed.git
cd runefeed
npm install
npm run build
runefeed serve
```

Edit `config/default.json` to tune detection thresholds, polling intervals, and security limits.

For production deployment with TLS:

```bash
runefeed serve --production
```

This loads `config/production.json` with TLS cert paths and strict rate limiting. Docker is also supported via the included `Dockerfile` and `docker-compose.yml`.

## Data Source

All market data comes from the [OSRS Wiki Real-Time Prices API](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices). RuneFeed polls `/5m` every 5 minutes and `/latest` every 60 seconds.

## License

MIT
