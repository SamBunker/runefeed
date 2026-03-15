#!/usr/bin/env node
// cli/index.ts — CLI entry point

import { Command } from 'commander';
import { hasClientConfig, loadClientConfig, deleteClientConfig, getConfigPath } from './client-config.js';
import { runSetup } from './setup-prompt.js';

const program = new Command();

// Commander "collect" pattern — lets a flag be repeated to build an array.
// Supports both repeated flags and comma-separated values:
//   --track "Dragon bones" --track "Yew roots"
//   --track "Dragon bones, Yew roots"
//   --track "Dragon bones" "Yew roots"   ← doesn't work with Commander,
//     but the comma style covers this use case.
function collect(value: string, previous: string[]): string[] {
  // Split on commas so --track "Dragon bones, Air rune" works
  const items = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  return previous.concat(items);
}

program
  .name('runefeed')
  .description('RuneFeed — Grand Exchange Watcher for OSRS')
  .version('1.0.0');

// ── runefeed serve ──
program
  .command('serve')
  .description('Start the RuneFeed monitoring server')
  .option('--production', 'Run in production mode (TLS, strict security)', false)
  .action(async (opts) => {
    const { main } = await import('./commands/serve.js');
    await main(opts.production);
  });

// ── runefeed watch ──
// All the display/filter flags live here on the CLIENT side.
// The server always detects everything — the client decides what to show.
program
  .command('watch')
  .description('Connect to a running RuneFeed server and stream alerts')
  .option('-H, --host <host>', 'Server hostname')
  .option('-p, --port <port>', 'Server port')
  .option('--f2p', 'Show only free-to-play items', false)
  .option('--min-spike <n>', 'Only show alerts with spike score >= this value (overrides server threshold)', '0')
  .option('--no-tax', 'Hide the tax/spread columns for a cleaner view')
  .option('--compact', 'Compact display — item name, volume, spike score, and type only')
  .option('--type <type>', 'Filter by alert type: sell-off, buy-in, or surge')
  .option('--view <mode>', 'Switch view: alerts (default) or predictions', 'alerts')
  .option('--min-price <n>', 'Only show items worth >= this many gp', '0')
  .option('--track <name>', 'Track specific items (repeatable, e.g. --track "Dragon bones" --track "Yew roots")', collect, [])
  .option('--min-profit <n>', 'Only show predictions with estimated flip >= n gp/ea (after tax)', '0')
  .option('--resources', 'Only show resource/skilling items')
  .option('--hide-resources', 'Hide resource/skilling items')
  .option('--tls', 'Force wss:// (encrypted) connection', false)
  .action(async (opts) => {
    // Resolve host/port: CLI flags > saved config > first-run setup
    let host = opts.host as string | undefined;
    let port = opts.port ? Number(opts.port) : undefined;

    if (!host || !port) {
      // No explicit flags — check saved config or run setup
      let config = loadClientConfig();
      if (!config) {
        config = await runSetup();
      }
      host = host ?? config.host;
      port = port ?? config.port;
    }

    const { connectAndWatch } = await import('./ws-client.js');
    await connectAndWatch({
      host,
      port,
      tls: opts.tls,
      f2pOnly: opts.f2p,
      minSpike: Number(opts.minSpike || '0'),
      showTax: opts.tax !== false,  // --no-tax sets opts.tax to false
      compact: opts.compact ?? false,
      typeFilter: opts.type?.toUpperCase() ?? null,
      view: opts.view?.toLowerCase() === 'predictions' ? 'predictions' : 'alerts',
      minPrice: Number(opts.minPrice || '0'),
      trackItems: (opts.track as string[]).map((name: string) => name.toLowerCase()),
      minProfit: Number(opts.minProfit || '0'),
      resourceFilter: opts.resources ? 'only' : opts.hideResources ? 'hide' : 'all',
    });
  });

// ── runefeed config ──
program
  .command('config')
  .description('Display current configuration')
  .action(async () => {
    const { showConfig } = await import('./commands/config.js');
    showConfig();
  });

// ── runefeed logout ──
program
  .command('logout')
  .description('Remove saved server config and reset to first-run state')
  .action(() => {
    if (deleteClientConfig()) {
      console.log(`\x1b[32m✓\x1b[0m Removed saved config from \x1b[90m${getConfigPath()}\x1b[0m`);
      console.log('  Next time you run \x1b[36mrunefeed watch\x1b[0m, you\'ll be prompted to set up again.');
    } else {
      console.log('\x1b[33mNo saved config found.\x1b[0m Nothing to remove.');
    }
  });

// ── runefeed setup ──
program
  .command('setup')
  .description('Re-run the server configuration prompt')
  .action(async () => {
    const config = await runSetup();
    console.log(`  Will connect to \x1b[36m${config.host}:${config.port}\x1b[0m on next \x1b[36mrunefeed watch\x1b[0m`);
  });

program.parse();
