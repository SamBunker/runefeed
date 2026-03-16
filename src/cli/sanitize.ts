// sanitize.ts — Sanitize untrusted data from the server
//
// All string fields coming over WebSocket are untrusted. A malicious server
// could inject ANSI escape sequences to hijack the terminal, or send
// __proto__ keys to pollute Object.prototype.

/**
 * Strip ANSI escape sequences, OSC sequences, and non-printable characters
 * from a string. This prevents terminal injection attacks where a rogue
 * server could clear the screen, change the window title, or inject
 * clipboard content via OSC 52.
 */
export function stripAnsi(str: string): string {
  return str
    // CSI sequences: ESC [ ... letter (e.g., \x1b[2J to clear screen)
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    // OSC sequences: ESC ] ... BEL or ST (e.g., \x1b]0;title\x07)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Other ESC sequences
    .replace(/\x1b[^[\]].?/g, '')
    // Remaining non-printable ASCII (except space, tab, newline)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

/**
 * Recursively sanitize all string values in an object.
 * Also rejects __proto__, constructor, and prototype keys to prevent
 * prototype pollution via JSON.parse.
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return stripAnsi(obj) as unknown as T;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Block prototype pollution keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    clean[key] = sanitizeObject(value);
  }
  return clean as T;
}

/**
 * Safe JSON parse that sanitizes the result.
 * Prevents both prototype pollution and terminal injection.
 */
export function safeJsonParse<T>(raw: string): T {
  const parsed = JSON.parse(raw);
  return sanitizeObject(parsed);
}
