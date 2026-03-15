#!/usr/bin/env node
// server/index.ts — Server entry point
//
// Two modes:
//   runefeed serve           → loads config/default.json  (local, no TLS, relaxed limits)
//   runefeed serve --production  → loads config/production.json (TLS, strict security)
//
// You can also set NODE_ENV=production to get the same effect.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Poller } from './poller.js';
import type { AppConfig } from '../shared/types.js';

// Resolve paths relative to the package root, not the working directory.
// This is critical for npm global installs where the user runs `runefeed serve`
// from any directory — we need to find config/ next to dist/, not in their cwd.
const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');  // dist/server/ → dist/ → package root
const configDir = join(PKG_ROOT, 'config');

// ── ASCII Banner ──
const BANNER = `
\x1b[1m\x1b[36m██████╗ ██╗   ██╗███╗   ██╗███████╗███████╗███████╗███████╗██████╗
██╔══██╗██║   ██║████╗  ██║██╔════╝██╔════╝██╔════╝██╔════╝██╔══██╗
██████╔╝██║   ██║██╔██╗ ██║█████╗  █████╗  █████╗  █████╗  ██║  ██║
██╔══██╗██║   ██║██║╚██╗██║██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  ██║  ██║
██║  ██║╚██████╔╝██║ ╚████║███████╗██║     ███████╗███████╗██████╔╝
╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝     ╚══════╝╚══════╝╚═════╝
\x1b[0m\x1b[2m  RuneFeed v1.0.0 — OSRS Grand Exchange Volume Feed\x1b[0m

\x1b[2m──────────────────────────────────────────────────────────────\x1b[0m

\x1b[1mInitializing...\x1b[0m
`;

export async function main(production = false): Promise<void> {
  console.log(BANNER);

  // ── Determine mode ──
  const isProduction = production || process.env.NODE_ENV === 'production';
  const configFile = join(configDir, isProduction ? 'production.json' : 'default.json');

  if (isProduction) {
    console.log('  \x1b[35m⬤ PRODUCTION MODE\x1b[0m — TLS enabled, strict security');
  } else {
    console.log('  \x1b[36m⬤ LOCAL MODE\x1b[0m — no TLS, relaxed limits');
  }

  // ── Load config ──
  if (!existsSync(configFile)) {
    console.error(`\x1b[31m✗ Config file not found: ${configFile}\x1b[0m`);
    if (isProduction) {
      console.error('  Copy config/production.json from the template and fill in your TLS cert paths.');
    }
    process.exit(1);
  }

  const config: AppConfig = JSON.parse(
    readFileSync(configFile, 'utf-8'),
  );

  console.log(`  \x1b[32m✓\x1b[0m Config loaded from ${configFile}`);
  console.log(`    Mode:     ${config.server.mode}`);
  console.log(`    Port:     ${config.server.port}`);
  console.log(`    TLS:      ${config.server.tls.enabled ? 'enabled' : 'disabled'}`);
  console.log(`    Clients:  ${config.server.security.maxClients} max (${config.server.security.maxConnectionsPerIp}/IP)`);
  console.log(`    Idle:     ${config.server.security.idleTimeoutMs > 0 ? (config.server.security.idleTimeoutMs / 1000) + 's' : 'disabled'}`);
  console.log(`    Rate:     ${config.server.security.maxMessagesPerMinute} msg/min`);

  // ── Load exclude list ──
  let excludedItems: string[] = [];
  try {
    const excludeData = JSON.parse(
      readFileSync(join(configDir, 'exclude.json'), 'utf-8'),
    );
    excludedItems = excludeData.excludedItems ?? [];
  } catch {
    console.log('  \x1b[2mNo exclude.json found — no items excluded\x1b[0m');
  }

  // ── Load resource list ──
  let resourceItems: string[] = [];
  try {
    const resourceData = JSON.parse(
      readFileSync(join(configDir, 'resources.json'), 'utf-8'),
    );
    resourceItems = resourceData.resourceItems ?? [];
    console.log(`  \x1b[32m✓\x1b[0m ${resourceItems.length} resource item(s) loaded`);
  } catch {
    console.log('  \x1b[2mNo resources.json found — resource tagging disabled\x1b[0m');
  }

  // ── Start the poller ──
  const poller = new Poller(config, excludedItems, resourceItems);
  await poller.start();
}

// Run main() and handle any fatal errors
main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
  process.exit(1);
});
