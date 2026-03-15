// client-config.ts — Persistent client configuration
//
// Stores connection settings in ~/.runefeed/config.json so users don't
// need to pass --host and --port every time. Created on first run via
// an interactive setup prompt.
//
// The config file lives in the USER's home directory, not the project.
// This means it persists across npm updates and works globally.

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ~/.runefeed/config.json
const CONFIG_DIR = join(homedir(), '.runefeed');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export interface ClientConfig {
  host: string;
  port: number;
  // We store the server "label" so we can show it in the banner
  // e.g., "RuneFeed Public Feed" or "My Local Server"
  label: string;
}

// The default public feed — used when user selects "public server"
export const DEFAULT_CONFIG: ClientConfig = {
  host: 'feed.runefeed.cc',
  port: 443,
  label: 'RuneFeed Public Feed',
};

// Local dev config — used when user selects "local server"
export const LOCAL_CONFIG: ClientConfig = {
  host: 'localhost',
  port: 3900,
  label: 'Local Server',
};

/**
 * Check if a saved client config exists.
 */
export function hasClientConfig(): boolean {
  return existsSync(CONFIG_PATH);
}

/**
 * Load the saved client config. Returns null if none exists.
 */
export function loadClientConfig(): ClientConfig | null {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // Validate the shape — don't trust the file blindly
    if (typeof parsed.host === 'string' && typeof parsed.port === 'number') {
      return {
        host: parsed.host,
        port: parsed.port,
        label: parsed.label ?? 'Custom Server',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save client config to disk.
 */
export function saveClientConfig(config: ClientConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Delete the saved client config ("logout").
 */
export function deleteClientConfig(): boolean {
  if (existsSync(CONFIG_PATH)) {
    unlinkSync(CONFIG_PATH);
    return true;
  }
  return false;
}

/**
 * Get the config directory path (for display purposes).
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}
