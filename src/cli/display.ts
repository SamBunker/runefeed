// display.ts — Terminal formatting for the CLI client
//
// Renders alerts with configurable display modes.
// The "DisplayOptions" object controls which columns appear.

import chalk from 'chalk';
import type { Alert, Prediction, TrendingHeadline, WSMessage } from '../shared/types.js';
import { formatGp, formatVolume, formatSpikeScore, padRight, formatTimestamp, formatSpread } from '../shared/format.js';

/**
 * Display options — controlled by CLI flags on `runefeed watch`.
 * These are client-side only and don't affect the server.
 */
export interface DisplayOptions {
  showTax: boolean;     // --no-tax hides the tax/spread columns
  compact: boolean;     // --compact for minimal output
}

/**
 * Renders a single alert as a formatted terminal line.
 *
 * Full mode:
 * [14:35:02] [30m] SELL-OFF  Dragon bones        | Vol: 12,847 (8.3x) | Sell: 2,155 gp (-43 tax) | Buy: 2,215 gp | -60 gp  [MEM]
 *
 * No-tax mode (--no-tax):
 * [14:35:02] [30m] SELL-OFF  Dragon bones        | Vol: 12,847 (8.3x) | Sell: 2,198 gp  Buy: 2,215 gp  [MEM]
 *
 * Compact mode (--compact):
 * [14:35:02] SELL-OFF  Dragon bones  12,847 (8.3x)  [MEM]
 */
export function renderAlert(alert: Alert, options: DisplayOptions): string {
  const time = formatTimestamp(new Date(alert.timestamp));

  // Alert type — color-coded
  let typeLabel: string;
  let scoreStr: string;
  switch (alert.type) {
    case 'SELL-OFF':
      typeLabel = chalk.bold.red(padRight('SELL-OFF', 8));
      scoreStr = chalk.red(formatSpikeScore(alert.spikeScore));
      break;
    case 'BUY-IN':
      typeLabel = chalk.bold.green(padRight('BUY-IN', 8));
      scoreStr = chalk.green(formatSpikeScore(alert.spikeScore));
      break;
    case 'SURGE':
      typeLabel = chalk.bold.yellow(padRight('SURGE', 8));
      scoreStr = chalk.yellow(formatSpikeScore(alert.spikeScore));
      break;
  }

  // Tag — resource items get a distinct [RES] tag so they stand out
  const memberTag = alert.members ? '[MEM]' : '[F2P]';
  const tag = alert.resource
    ? chalk.yellow('[RES]') + chalk.dim(` ${memberTag}`)
    : chalk.dim(memberTag);

  // Derive the baseline average volume from spike score
  // spikeScore = volume / avgVolume, so avgVolume = volume / spikeScore
  const avgVol = alert.spikeScore > 0 ? Math.round(alert.volume / alert.spikeScore) : 0;
  const avgVolStr = chalk.dim(`avg ${formatVolume(avgVol)}`);

  // ── Compact mode ──
  if (options.compact) {
    const name = chalk.bold(padRight(alert.itemName, 22));
    return `[${time}] ${typeLabel}  ${name}  ${chalk.bold(formatVolume(alert.volume))} (${scoreStr} — ${avgVolStr})  ${tag}`;
  }

  // ── Full / no-tax modes ──
  const tfBadge = chalk.dim(`[${padRight(alert.timeframe, 3)}]`);
  const name = chalk.bold(padRight(alert.itemName, 22));
  const vol = `Vol: ${chalk.bold(formatVolume(alert.volume))} (${scoreStr} — ${avgVolStr})`;

  if (options.showTax) {
    // Full mode — after-tax sell, tax annotation, spread
    let sellStr: string;
    if (alert.sellPrice !== null && alert.tax !== null) {
      const afterTax = padRight(formatGp(alert.afterTaxSell), 12);
      sellStr = `Sell: ${chalk.bold(afterTax)}${chalk.dim(`(-${alert.tax} tax)`)}`;
    } else {
      sellStr = `Sell: ${chalk.bold(padRight(formatGp(alert.sellPrice), 12))}`;
    }

    const buy = `Buy: ${chalk.bold(formatGp(alert.buyPrice))}`;

    let spreadStr: string;
    if (alert.spread !== null) {
      const formatted = formatSpread(alert.spread);
      spreadStr = alert.spread >= 0
        ? chalk.green(formatted)
        : chalk.red(formatted);
    } else {
      spreadStr = chalk.dim('? gp');
    }

    return `[${time}] ${tfBadge} ${typeLabel}  ${name} | ${vol} | ${sellStr} | ${buy} | ${spreadStr}  ${tag}`;
  } else {
    // No-tax mode — just raw sell/buy prices
    const sell = `Sell: ${chalk.bold(padRight(formatGp(alert.sellPrice), 12))}`;
    const buy = `Buy: ${chalk.bold(formatGp(alert.buyPrice))}`;

    return `[${time}] ${tfBadge} ${typeLabel}  ${name} | ${vol} | ${sell} ${buy}  ${tag}`;
  }
}

/**
 * Renders a single prediction as a formatted terminal line.
 *
 * Full mode:
 * [14:35:02] MOMENTUM   Dragon bones        | +12.3% (142 → 160 gp) | Vol: 8,421 (3.2x avg) | Flip: +18 gp/ea  [MEM]
 * [14:35:02] BUY-WINDOW Cannonball           | -8.5% (168 → 154 gp) | Vol: 2,100 (1.1x avg) | Buy dip           [F2P]
 * [14:35:02] COOLING    Ranarr seed          | -2.1% (8,420 → 8,243 gp) | Vol: 312 (0.8x avg) | Sell signal      [MEM]
 *
 * Compact mode:
 * [14:35:02] MOMENTUM   Dragon bones  +12.3%  3.2x vol  +18 gp  [MEM]
 */
export function renderPrediction(prediction: Prediction, options: DisplayOptions): string {
  const time = formatTimestamp(new Date(prediction.timestamp));

  // Type label — color-coded
  let typeLabel: string;
  let changeStr: string;
  switch (prediction.type) {
    case 'MOMENTUM':
      typeLabel = chalk.bold.green(padRight('MOMENTUM', 10));
      changeStr = chalk.green(`+${prediction.priceChangePercent}%`);
      break;
    case 'BUY-WINDOW':
      typeLabel = chalk.bold.cyan(padRight('BUY-WINDOW', 10));
      changeStr = chalk.cyan(`${prediction.priceChangePercent}%`);
      break;
    case 'COOLING':
      typeLabel = chalk.bold.magenta(padRight('COOLING', 10));
      changeStr = chalk.magenta(`${prediction.priceChangePercent}%`);
      break;
    case 'STABLE':
      typeLabel = chalk.bold.white(padRight('STABLE', 10));
      changeStr = prediction.priceChangePercent >= 0
        ? chalk.dim(`+${prediction.priceChangePercent}%`)
        : chalk.dim(`${prediction.priceChangePercent}%`);
      break;
  }

  const memberTag = prediction.members ? '[MEM]' : '[F2P]';
  const tag = prediction.resource
    ? chalk.yellow('[RES]') + chalk.dim(` ${memberTag}`)
    : chalk.dim(memberTag);
  const name = chalk.bold(padRight(prediction.itemName, 22));

  const avgVolStr = chalk.dim(`avg ${formatVolume(prediction.avgVolume)}`);

  // ── Compact mode ──
  if (options.compact) {
    const flipStr = prediction.estimatedFlip !== null
      ? formatSpread(prediction.estimatedFlip)
      : chalk.dim('?');
    return `[${time}] ${typeLabel} ${name}  ${changeStr}  ${chalk.bold(`${prediction.volumeRatio}x`)} vol (${avgVolStr})  ${flipStr}  ${tag}`;
  }

  // ── Full mode ──
  const priceMove = `${changeStr} (${formatGp(prediction.avgPrice)} → ${formatGp(prediction.currentPrice)})`;
  const vol = `Vol: ${chalk.bold(formatVolume(prediction.currentVolume))} (${chalk.bold(`${prediction.volumeRatio}x`)} — ${avgVolStr})`;

  // Action column — context-specific, no raw tax number
  // The estimatedFlip already has tax baked in (afterTaxSell - buyPrice),
  // so showing it is enough. We just note "after tax" so the user knows.
  let actionStr: string;
  switch (prediction.type) {
    case 'MOMENTUM':
      if (prediction.estimatedFlip !== null) {
        const flipColor = prediction.estimatedFlip >= 0 ? chalk.green : chalk.red;
        actionStr = flipColor(`Flip: ${formatSpread(prediction.estimatedFlip)}/ea`);
        if (options.showTax) actionStr += chalk.dim(' after tax');
      } else {
        actionStr = chalk.green('Rising');
      }
      break;
    case 'BUY-WINDOW':
      // Show current buy price vs the average — the useful info for a buyer
      if (prediction.buyPrice !== null) {
        actionStr = chalk.cyan(`Buy: ${formatGp(prediction.buyPrice)}`);
      } else {
        actionStr = chalk.cyan('Buy dip');
      }
      break;
    case 'COOLING':
      if (prediction.estimatedFlip !== null) {
        const flipColor = prediction.estimatedFlip >= 0 ? chalk.green : chalk.red;
        actionStr = chalk.magenta('Sell') + ' ' + flipColor(`(${formatSpread(prediction.estimatedFlip)}/ea)`);
      } else {
        actionStr = chalk.magenta('Sell signal');
      }
      break;
    case 'STABLE':
      // Show current prices — this is a portfolio snapshot for tracked items
      if (prediction.sellPrice !== null && prediction.buyPrice !== null) {
        actionStr = chalk.dim(`Sell: ${formatGp(prediction.sellPrice)} | Buy: ${formatGp(prediction.buyPrice)}`);
      } else {
        actionStr = chalk.dim('No movement');
      }
      break;
  }

  return `[${time}] ${typeLabel} ${name} | ${priceMove} | ${vol} | ${actionStr}  ${tag}`;
}

/**
 * Renders the trending headline as a pinned box at the top.
 */
export function renderHeadline(headline: TrendingHeadline | null): string | null {
  if (!headline) return null;

  let typeColor: typeof chalk;
  switch (headline.type) {
    case 'SELL-OFF': typeColor = chalk.red; break;
    case 'BUY-IN': typeColor = chalk.green; break;
    case 'SURGE': typeColor = chalk.yellow; break;
  }

  const content = [
    chalk.bold.cyan('TRENDING:'),
    chalk.bold(headline.itemName),
    chalk.dim('—'),
    `Vol ${formatSpikeScore(headline.spikeScore)} avg over ${headline.timeframe}`,
    chalk.dim('—'),
    typeColor(headline.type),
    chalk.dim(`(${headline.consecutiveCycles} cycles)`),
  ].join(' ');

  const boxWidth = 70;
  const top = chalk.dim('┌' + '─'.repeat(boxWidth) + '┐');
  const bot = chalk.dim('└' + '─'.repeat(boxWidth) + '┘');
  const mid = chalk.dim('│ ') + content;

  return `${top}\n${mid}\n${bot}`;
}

/**
 * Renders the connection banner with active flags and available flags.
 */
export function renderBanner(opts: {
  host: string;
  port: number;
  f2pOnly: boolean;
  minSpike: number;
  showTax: boolean;
  compact: boolean;
  typeFilter: string | null;
  view: string;
  minPrice: number;
  minProfit: number;
  trackItems: string[];
  resourceFilter: string;
}): string {
  // Build active filters line
  const activeFilters: string[] = [];
  if (opts.view !== 'alerts') activeFilters.push(`view: ${opts.view}`);
  if (opts.f2pOnly) activeFilters.push('F2P only');
  if (opts.minSpike > 0) activeFilters.push(`spike >= ${opts.minSpike}x`);
  if (opts.minPrice > 0) activeFilters.push(`price >= ${opts.minPrice} gp`);
  if (opts.minProfit > 0) activeFilters.push(`profit >= ${opts.minProfit} gp`);
  if (!opts.showTax) activeFilters.push('tax hidden');
  if (opts.compact) activeFilters.push('compact');
  if (opts.typeFilter) activeFilters.push(`type: ${opts.typeFilter}`);
  if (opts.resourceFilter === 'only') activeFilters.push('resources only');
  if (opts.resourceFilter === 'hide') activeFilters.push('resources hidden');

  const filterStr = activeFilters.length > 0
    ? activeFilters.join(', ')
    : 'none (showing all)';

  // View-specific title
  const title = opts.view === 'predictions'
    ? chalk.bold.cyan('  RuneFeed — Prediction Feed')
    : chalk.bold.cyan('  RuneFeed — Live Alert Feed');

  const lines = [
    '',
    chalk.dim('──────────────────────────────────────────────────────────────'),
    title,
    chalk.dim(`  Server:     ${opts.host}:${opts.port}`),
    `  ${chalk.dim('Active:')}     ${chalk.white(filterStr)}`,
  ];

  // Show tracked items if any
  if (opts.trackItems.length > 0) {
    lines.push(`  ${chalk.dim('Tracking:')}   ${chalk.white(opts.trackItems.join(', '))}`);
  }

  lines.push(
    '',
    chalk.dim('  Available flags:'),
    chalk.dim('    --view <mode>      Switch view: alerts | predictions'),
    chalk.dim('    --f2p              Show F2P items only'),
    chalk.dim('    --min-spike <n>    Only show spikes >= nx (e.g. --min-spike 15)'),
    chalk.dim('    --min-price <n>    Only show items worth >= n gp'),
    chalk.dim('    --no-tax           Hide tax/spread columns'),
    chalk.dim('    --compact          Minimal output (name, volume, score)'),
    chalk.dim('    --type <type>      Filter: sell-off | buy-in | surge'),
    chalk.dim('                       (predictions: momentum | buy-window | cooling)'),
    chalk.dim('    --track <name>     Track specific items (repeatable)'),
    chalk.dim('    --min-profit <n>   Only predictions with flip >= n gp/ea'),
    chalk.dim('    --resources         Only show resource/skilling items'),
    chalk.dim('    --hide-resources    Hide resource/skilling items'),
    '',
    chalk.dim('  Press Ctrl+C to disconnect'),
    chalk.dim('──────────────────────────────────────────────────────────────'),
    '',
  );
  return lines.join('\n');
}

/**
 * Options passed to renderSystemMessage so it can display active settings.
 * Kept as a plain interface to avoid importing WatchOptions (circular dep).
 */
export interface SystemMessageContext {
  view: string;
  f2pOnly: boolean;
  minSpike: number;
  minPrice: number;
  minProfit: number;
  showTax: boolean;
  compact: boolean;
  typeFilter: string | null;
  trackItems: string[];
  resourceFilter: string;
}

/**
 * Builds a compact summary string of all active filters/settings.
 */
function buildSettingsSummary(ctx: SystemMessageContext): string {
  const parts: string[] = [];
  parts.push(`view: ${ctx.view}`);
  if (ctx.f2pOnly) parts.push('F2P only');
  if (ctx.minSpike > 0) parts.push(`spike >= ${ctx.minSpike}x`);
  if (ctx.minPrice > 0) parts.push(`price >= ${ctx.minPrice} gp`);
  if (ctx.minProfit > 0) parts.push(`profit >= ${ctx.minProfit} gp`);
  if (!ctx.showTax) parts.push('tax hidden');
  if (ctx.compact) parts.push('compact');
  if (ctx.typeFilter) parts.push(`type: ${ctx.typeFilter}`);
  if (ctx.resourceFilter === 'only') parts.push('resources only');
  if (ctx.resourceFilter === 'hide') parts.push('no resources');
  if (ctx.trackItems.length > 0) parts.push(`tracking: ${ctx.trackItems.join(', ')}`);
  return parts.join(' | ');
}

/**
 * Renders system messages.
 */
export function renderSystemMessage(msg: WSMessage, ctx?: SystemMessageContext): string | null {
  switch (msg.type) {
    case 'poll-start':
      return chalk.dim('──────────────────────────────────────────────────────────────\n') +
             chalk.dim(`[${formatTimestamp(new Date())}] Poll cycle #${msg.cycle} — processing...`);

    case 'no-spikes':
      return chalk.dim(`[${formatTimestamp(new Date())}] No spikes detected this interval.`);

    case 'poll-end': {
      const summary = ctx ? chalk.yellow(`  Polling for: ${buildSettingsSummary(ctx)}`) : '';
      const countLine = msg.alertCount > 0
        ? chalk.dim(`[${formatTimestamp(new Date())}] Cycle #${msg.cycle} complete — ${msg.alertCount} result(s)`)
        : chalk.dim(`[${formatTimestamp(new Date())}] Cycle #${msg.cycle} complete — no results`);
      return `${countLine}\n${summary}`;
    }

    case 'status': {
      const waitLine = chalk.dim(`  Waiting for next poll cycle...  (next /5m in ~${Math.round(msg.nextPollIn / 1000)}s)`);
      if (!ctx) return waitLine;
      const settingsLine = chalk.yellow(`  Polling for: ${buildSettingsSummary(ctx)}`);
      return `${waitLine}\n${settingsLine}`;
    }

    case 'error':
      return chalk.red(`[${formatTimestamp(new Date())}] Error: ${msg.message}`);

    default:
      return null;
  }
}
