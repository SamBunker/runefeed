// setup-prompt.ts — First-run interactive setup
//
// On first `runefeed watch`, asks the user whether to connect to the
// public feed or configure a custom server. Saves the choice to
// ~/.runefeed/config.json so they never need to answer again.

import * as readline from 'readline';
import {
  ClientConfig,
  DEFAULT_CONFIG,
  LOCAL_CONFIG,
  saveClientConfig,
  getConfigPath,
} from './client-config.js';

/**
 * Prompt the user with a question and return their answer.
 */
function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Run the first-time setup prompt.
 * Returns the chosen ClientConfig.
 */
export async function runSetup(): Promise<ClientConfig> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log();
  console.log('\x1b[33m┌─────────────────────────────────────────┐\x1b[0m');
  console.log('\x1b[33m│   RuneFeed — First-Time Setup            │\x1b[0m');
  console.log('\x1b[33m└─────────────────────────────────────────┘\x1b[0m');
  console.log();
  console.log('  Choose a server to connect to:\n');
  console.log('  \x1b[36m1)\x1b[0m  RuneFeed Public Feed  \x1b[90m(feed.runefeed.io)\x1b[0m');
  console.log('  \x1b[36m2)\x1b[0m  Local Server          \x1b[90m(localhost:3900)\x1b[0m');
  console.log('  \x1b[36m3)\x1b[0m  Custom Server         \x1b[90m(enter host & port)\x1b[0m');
  console.log();

  let config: ClientConfig;

  while (true) {
    const choice = await ask(rl, '  Select [1/2/3]: ');

    if (choice === '1') {
      config = { ...DEFAULT_CONFIG };
      break;
    } else if (choice === '2') {
      config = { ...LOCAL_CONFIG };
      break;
    } else if (choice === '3') {
      const host = await ask(rl, '  Host: ');
      if (!host) {
        console.log('  \x1b[31mHost cannot be empty.\x1b[0m');
        continue;
      }
      // Validate hostname: reject URL metacharacters that could cause
      // the WebSocket URL to be parsed incorrectly
      if (!/^[a-zA-Z0-9.\-:[\]]+$/.test(host)) {
        console.log('  \x1b[31mInvalid hostname. Use letters, numbers, dots, and hyphens only.\x1b[0m');
        continue;
      }
      const portStr = await ask(rl, '  Port [3900]: ');
      const port = portStr ? Number(portStr) : 3900;
      if (isNaN(port) || port < 1 || port > 65535) {
        console.log('  \x1b[31mInvalid port number.\x1b[0m');
        continue;
      }
      const label = (await ask(rl, '  Label [Custom Server]: ')) || 'Custom Server';
      config = { host, port, label };
      break;
    } else {
      console.log('  \x1b[31mPlease enter 1, 2, or 3.\x1b[0m');
    }
  }

  rl.close();

  saveClientConfig(config);
  console.log();
  console.log(`  \x1b[32m✓\x1b[0m Saved to \x1b[90m${getConfigPath()}\x1b[0m`);
  console.log(`  \x1b[90mConnecting to ${config.label} (${config.host}:${config.port})...\x1b[0m`);
  console.log();

  return config;
}
