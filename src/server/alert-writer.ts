// alert-writer.ts — Appends alerts to a JSON Lines file
//
// JSON Lines (JSONL) is a format where each line is a complete JSON object.
// This is simpler than maintaining a proper JSON array because:
// - We can just append lines (no need to read/parse the whole file)
// - Each line is self-contained — easy to pipe to tools like jq
// - The file stays valid even if the process crashes mid-write

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
// These are Node.js built-in "fs" (filesystem) functions:
// - appendFileSync: adds text to the end of a file (creates it if missing)
// - existsSync: checks if a file exists
// - readFileSync: reads a file's entire contents
// - writeFileSync: overwrites a file's contents
//
// The "Sync" suffix means these block until complete. For a single-line
// append this is fine — it's microseconds. For heavy I/O you'd use the
// async versions, but that's overkill here.

import { dirname } from 'path';
import { mkdirSync } from 'fs';
import type { Alert, OutputConfig } from '../shared/types.js';

/**
 * Append a single alert as a JSON line to the alerts file.
 */
export function appendAlertToFile(alert: Alert, config: OutputConfig): void {
  const filePath = config.alertsFile;

  // Ensure the directory exists (creates data/ if it doesn't exist yet)
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  // { recursive: true } means "create parent directories too if needed"
  // — like `mkdir -p` in bash.

  const line = JSON.stringify(alert) + '\n';
  appendFileSync(filePath, line, 'utf-8');

  // Check if we need to prune old entries
  pruneIfNeeded(filePath, config.maxAlertsInFile);
}

/**
 * If the file exceeds maxLines, remove the oldest entries.
 * We keep 90% of maxLines after pruning to avoid pruning on every write.
 */
function pruneIfNeeded(filePath: string, maxLines: number): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  // .split('\n') breaks the file into an array of lines.
  // .filter() removes empty lines (the last line might be blank).

  if (lines.length <= maxLines) return;

  // Keep the newest 90% of max
  const keepCount = Math.floor(maxLines * 0.9);
  const trimmed = lines.slice(-keepCount);
  // .slice(-keepCount) takes the LAST keepCount elements from the array.
  // Negative index counts from the end. So slice(-9000) on a 10000-element
  // array returns elements 1000 through 9999 (the newest ones).

  writeFileSync(filePath, trimmed.join('\n') + '\n', 'utf-8');
  console.log(`    alerts.json pruned: ${lines.length} → ${trimmed.length} entries`);
}
