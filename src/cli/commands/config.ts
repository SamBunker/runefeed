// commands/config.ts — "runefeed config" command implementation
//
// Reads and displays the current configuration in a readable format.
// This helps you verify what settings are active without opening JSON files.

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import type { AppConfig } from '../../shared/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = join(__dirname, '..', '..', 'config');

export function showConfig(): void {
  // ── Load config ──
  let config: AppConfig;
  try {
    config = JSON.parse(readFileSync(join(configDir, 'default.json'), 'utf-8'));
  } catch (err) {
    console.error(chalk.red('Could not read config/default.json'));
    process.exit(1);
  }

  // ── Load exclude list ──
  let excludedItems: string[] = [];
  try {
    const data = JSON.parse(readFileSync(join(configDir, 'exclude.json'), 'utf-8'));
    excludedItems = data.excludedItems ?? [];
  } catch {
    // No exclude file — that's fine
  }

  // ── Display ──
  console.log('');
  console.log(chalk.bold.cyan('RuneFeed — Current Configuration'));
  console.log(chalk.dim(`  Source: ${join(configDir, 'default.json')}`));
  console.log('');
  console.log(chalk.dim('──────────────────────────────────────────────────────────────'));
  console.log('');

  // Helper to print a labeled value with optional description
  const row = (label: string, value: string, desc?: string) => {
    // Template literals (`backtick strings`) allow embedded expressions
    // with ${...} and span multiple lines. Way cleaner than concatenation.
    const descStr = desc ? `   ${chalk.dim(`(${desc})`)}` : '';
    console.log(`  ${label.padEnd(20)}${chalk.bold(value)}${descStr}`);
  };
  // "const row = (label, value, desc?) => { ... }" is an arrow function.
  // It's shorthand for "function row(label, value, desc) { ... }".
  // The => syntax is common in TypeScript/JavaScript.

  console.log(chalk.bold('SERVER'));
  row('port', String(config.server.port));
  row('host', config.server.host);
  console.log('');

  console.log(chalk.bold('POLLING'));
  row('fiveMinIntervalMs', `${config.polling.fiveMinIntervalMs.toLocaleString()} ms`, 'every 5 minutes');
  row('latestIntervalMs', `${config.polling.latestIntervalMs.toLocaleString()} ms`, 'every 60 seconds');
  console.log('');

  console.log(chalk.bold('DETECTION'));
  row('spikeThreshold', `${config.detection.spikeThreshold}x`, `alert when volume >= ${config.detection.spikeThreshold}x rolling average`);
  row('minVolume', String(config.detection.minVolume), 'minimum trades in interval');
  row('rollingWindowSize', String(config.detection.rollingWindowSize), `${config.detection.rollingWindowSize} x 5m = ${config.detection.rollingWindowSize * 5}m`);
  row('sellOffDominance', String(config.detection.sellOffDominance), `>${config.detection.sellOffDominance * 100}% low-price vol = SELL-OFF`);
  row('buyInDominance', String(config.detection.buyInDominance), `>${config.detection.buyInDominance * 100}% high-price vol = BUY-IN`);
  row('minItemValue', config.detection.minItemValue === 0 ? '0' : `${config.detection.minItemValue.toLocaleString()} gp`,
    config.detection.minItemValue === 0 ? 'disabled' : undefined);
  row('maxItemValue', config.detection.maxItemValue === 0 ? '0' : `${config.detection.maxItemValue.toLocaleString()} gp`,
    config.detection.maxItemValue === 0 ? 'disabled' : undefined);
  row('timeframes', config.detection.timeframes.join(', '), 'volume spike detection windows');
  row('priceChangeThreshold', `${config.detection.priceChangeThreshold}%`, 'min % price change for trend alerts');
  console.log('');

  console.log(chalk.bold('GE TAX'));
  row('taxRate', `${(config.tax.taxRate * 100).toFixed(0)}%`, 'Grand Exchange tax on sells');
  row('taxCap', `${config.tax.taxCap.toLocaleString()} gp`, 'maximum tax per item');
  console.log('');

  console.log(chalk.bold('DISPLAY'));
  row('staggerEnabled', String(config.display.staggerEnabled));
  row('staggerDelayMs', `${config.display.staggerDelayMs} ms`, 'used only when staggerEnabled = true');
  console.log('');

  console.log(chalk.bold('OUTPUT'));
  row('alertsFile', config.output.alertsFile);
  row('maxAlertsInFile', config.output.maxAlertsInFile.toLocaleString(), 'oldest pruned when limit reached');
  console.log('');

  console.log(chalk.bold('API'));
  row('baseUrl', config.api.baseUrl);
  row('userAgent', config.api.userAgent);
  console.log('');

  console.log(chalk.bold('EXCLUDE LIST') + '   ' + chalk.dim('source: ./config/exclude.json'));
  if (excludedItems.length === 0) {
    console.log('  ' + chalk.dim('(none)'));
  } else {
    for (const item of excludedItems) {
      console.log(`  ${item}`);
    }
  }

  // ── Load resource list ──
  let resourceItems: string[] = [];
  try {
    const data = JSON.parse(readFileSync(join(configDir, 'resources.json'), 'utf-8'));
    resourceItems = data.resourceItems ?? [];
  } catch {
    // No resource file — that's fine
  }

  console.log('');
  console.log(chalk.bold('RESOURCE LIST') + '   ' + chalk.dim('source: ./config/resources.json'));
  if (resourceItems.length === 0) {
    console.log('  ' + chalk.dim('(none)'));
  } else {
    // Show count + first few items to avoid flooding the terminal
    console.log(`  ${chalk.dim(`${resourceItems.length} items tagged as resources`)}`);
    const preview = resourceItems.slice(0, 10);
    for (const item of preview) {
      console.log(`  ${item}`);
    }
    if (resourceItems.length > 10) {
      console.log(`  ${chalk.dim(`... and ${resourceItems.length - 10} more`)}`);
    }
  }

  console.log('');
  console.log(chalk.dim('──────────────────────────────────────────────────────────────'));
  console.log(chalk.dim('  Edit config/default.json, config/exclude.json, or config/resources.json'));
  console.log(chalk.dim('  to change settings. Restart the server for changes to take effect.'));
  console.log('');
}
