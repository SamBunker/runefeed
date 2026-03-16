// ws-server.ts — WebSocket broadcast server
//
// Two modes:
//
// LOCAL (default):
//   Plain ws://, relaxed limits. You're running this on your own machine
//   for your own use — no need for production hardening.
//
// PRODUCTION:
//   wss:// via TLS, strict rate limiting, connection caps, idle timeouts.
//   This is what you run when hosting a public feed that untrusted
//   clients connect to over the internet.
//
// All security limits come from config/default.json or config/production.json
// so you can tune them without touching code.

import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import type { IncomingMessage, Server } from 'http';
import type { WSMessage, ServerConfig } from '../shared/types.js';

export class RuneFeedWSServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket>;
  private mode: string;

  // Per-client track lists
  private clientTracks: Map<WebSocket, Set<string>> = new Map();

  // Per-IP connection counter
  private ipConnections: Map<string, number> = new Map();

  // Rate limiting: message timestamps per client
  private messageTimestamps: Map<WebSocket, number[]> = new Map();

  // Rate limit violations per client — disconnect after repeated violations
  private rateLimitStrikes: Map<WebSocket, number> = new Map();

  // Security config values (set from ServerConfig)
  private maxClients: number;
  private maxConnectionsPerIp: number;
  private maxIncomingMessageBytes: number;
  private maxTrackItems: number;
  private maxTrackItemLength: number;
  private maxMessagesPerMinute: number;
  private idleTimeoutMs: number;

  constructor(serverConfig: ServerConfig) {
    this.clients = new Set();
    this.mode = serverConfig.mode;

    // Pull security limits from config
    const sec = serverConfig.security;
    this.maxClients = sec.maxClients;
    this.maxConnectionsPerIp = sec.maxConnectionsPerIp;
    this.maxIncomingMessageBytes = sec.maxIncomingMessageBytes;
    this.maxTrackItems = sec.maxTrackItems;
    this.maxTrackItemLength = sec.maxTrackItemLength;
    this.maxMessagesPerMinute = sec.maxMessagesPerMinute;
    this.idleTimeoutMs = sec.idleTimeoutMs;

    // ── Create the WebSocket server ──
    // In production mode with TLS enabled, we create an HTTPS server
    // and attach the WebSocket server to it. This gives us wss:// —
    // encrypted WebSocket connections. Without TLS, we just open a
    // plain ws:// server on the port.
    if (serverConfig.tls.enabled) {
      const httpsServer = this.createTlsServer(serverConfig);
      this.wss = new WebSocketServer({
        server: httpsServer,
        maxPayload: this.maxIncomingMessageBytes,
      });
      httpsServer.listen(serverConfig.port, serverConfig.host, () => {
        console.log(`  \x1b[32m✓\x1b[0m wss:// server listening on ${serverConfig.host}:${serverConfig.port} (TLS)`);
      });
    } else {
      this.wss = new WebSocketServer({
        port: serverConfig.port,
        host: serverConfig.host,
        maxPayload: this.maxIncomingMessageBytes,
      });
      console.log(`  \x1b[32m✓\x1b[0m ws:// server listening on ${serverConfig.host}:${serverConfig.port} (no TLS)`);
    }

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
  }

  /**
   * Create an HTTPS server for TLS termination.
   * Reads cert + key from the paths in config.
   */
  private createTlsServer(serverConfig: ServerConfig): Server {
    const { certPath, keyPath } = serverConfig.tls;

    try {
      const cert = readFileSync(certPath, 'utf-8');
      const key = readFileSync(keyPath, 'utf-8');

      // createHttpsServer returns an https.Server which extends http.Server,
      // so the WebSocketServer can attach to it.
      return createHttpsServer({ cert, key }) as unknown as Server;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\x1b[31m✗ Failed to load TLS certificates:\x1b[0m ${msg}`);
      console.error(`  certPath: ${certPath}`);
      console.error(`  keyPath:  ${keyPath}`);
      console.error('  Make sure the paths in your config are correct and readable.');
      process.exit(1);
    }
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientIp = this.getClientIp(req);

    // ── Connection limit check ──
    if (this.clients.size >= this.maxClients) {
      console.warn(`  \x1b[33m⚠\x1b[0m Rejected connection from ${clientIp} — server full (${this.maxClients} max)`);
      ws.close(1013, 'Server at capacity');
      return;
    }

    // ── Per-IP limit check ──
    // In local mode with high limits, this effectively becomes a no-op.
    const currentIpCount = this.ipConnections.get(clientIp) ?? 0;
    if (currentIpCount >= this.maxConnectionsPerIp) {
      console.warn(`  \x1b[33m⚠\x1b[0m Rejected connection from ${clientIp} — per-IP limit (${this.maxConnectionsPerIp} max)`);
      ws.close(1008, 'Too many connections from your IP');
      return;
    }

    // ── Accept connection ──
    this.clients.add(ws);
    this.ipConnections.set(clientIp, currentIpCount + 1);
    this.messageTimestamps.set(ws, []);
    console.log(`  Client connected — ${this.clients.size} client(s) now connected   (${clientIp})`);

    // ── Idle timeout ──
    // Only active when idleTimeoutMs > 0. In local mode this is 0 (disabled)
    // so your own terminal session won't get booted.
    let alive = true;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    if (this.idleTimeoutMs > 0) {
      pingInterval = setInterval(() => {
        if (!alive) {
          console.log(`  Idle client disconnected — ${clientIp}`);
          ws.terminate();
          return;
        }
        alive = false;
        ws.ping();
      }, this.idleTimeoutMs / 2);

      ws.on('pong', () => {
        alive = true;
      });
    }

    // ── Handle incoming messages (with validation) ──
    this.rateLimitStrikes.set(ws, 0);

    ws.on('message', (raw) => {
      // Rate limit check (in local mode the limit is very high, so this
      // won't trigger unless something is genuinely wrong)
      if (!this.checkRateLimit(ws)) {
        const strikes = (this.rateLimitStrikes.get(ws) ?? 0) + 1;
        this.rateLimitStrikes.set(ws, strikes);
        // Disconnect after 3 rate limit violations — they're clearly abusing
        if (strikes >= 3) {
          console.warn(`  \x1b[33m⚠\x1b[0m Disconnecting client for repeated rate limit violations (${clientIp})`);
          ws.close(1008, 'Rate limit exceeded');
        }
        return;
      }

      try {
        // ws library already enforces maxPayload at the byte level.
        // This is a defense-in-depth check using byte length, not char count.
        const rawBuf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
        if (rawBuf.byteLength > this.maxIncomingMessageBytes) return;
        const rawStr = rawBuf.toString();

        const msg = JSON.parse(rawStr);

        // Reject prototype pollution attempts
        if (typeof msg !== 'object' || msg === null) return;
        if ('__proto__' in msg || 'constructor' in msg || 'prototype' in msg) return;

        // Whitelist approach: only accept known message types
        if (msg.type === 'subscribe-tracks') {
          this.handleSubscribeTracks(ws, msg);
        }
        // All other message types are silently dropped.
        // The server ONLY accepts subscribe-tracks from clients.
      } catch {
        // Malformed JSON — ignore silently
      }
    });

    // ── Cleanup on disconnect ──
    // Guard against double-cleanup: ws 'error' is often followed by 'close'.
    // Without the guard, the IP counter desyncs and allows limit bypass.
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;

      this.clients.delete(ws);
      this.clientTracks.delete(ws);
      this.messageTimestamps.delete(ws);
      this.rateLimitStrikes.delete(ws);
      if (pingInterval) clearInterval(pingInterval);

      const count = this.ipConnections.get(clientIp) ?? 1;
      if (count <= 1) {
        this.ipConnections.delete(clientIp);
      } else {
        this.ipConnections.set(clientIp, count - 1);
      }

      console.log(`  Client disconnected — ${this.clients.size} client(s) now connected`);
    };

    ws.on('close', cleanup);
    ws.on('error', (err) => {
      console.error(`  WebSocket client error: ${err.message}`);
      cleanup();
    });
  }

  /**
   * Extract client IP from trusted proxy headers.
   *
   * Trust chain: Cloudflare → NPM → Server
   *
   * We only read forwarded headers if the direct connection comes from
   * a known proxy IP (Docker network / localhost). This prevents clients
   * from spoofing X-Forwarded-For to bypass per-IP rate limits.
   */
  private getClientIp(req: IncomingMessage): string {
    const directIp = req.socket.remoteAddress ?? 'unknown';

    if (this.mode === 'production') {
      // Only trust proxy headers from known reverse proxy IPs
      if (this.isTrustedProxy(directIp)) {
        // Prefer CF-Connecting-IP (Cloudflare's real client IP)
        const cfIp = req.headers['cf-connecting-ip'];
        if (typeof cfIp === 'string' && this.isValidIp(cfIp)) {
          return cfIp.trim();
        }
        // Fall back to X-Forwarded-For (first IP in the chain)
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
          const first = forwarded.split(',')[0].trim();
          if (this.isValidIp(first)) return first;
        }
      }
    }

    return directIp;
  }

  /**
   * Check if the direct connection is from a known reverse proxy.
   * Docker bridge (172.x), localhost, or NPM on the local network.
   */
  private isTrustedProxy(ip: string): boolean {
    const cleaned = ip.replace(/^::ffff:/, '');
    return (
      cleaned === '127.0.0.1' ||
      cleaned === '::1' ||
      cleaned.startsWith('172.') ||
      cleaned.startsWith('10.') ||
      cleaned.startsWith('192.168.')
    );
  }

  /**
   * Basic IP format validation to prevent log injection via headers.
   */
  private isValidIp(value: string): boolean {
    return /^[\d.:a-fA-F]+$/.test(value) && value.length <= 45;
  }

  /**
   * Rate limiter: sliding window of message timestamps.
   */
  private checkRateLimit(ws: WebSocket): boolean {
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(ws);
    if (!timestamps) return false;

    const cutoff = now - 60_000;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= this.maxMessagesPerMinute) {
      return false;
    }

    timestamps.push(now);
    return true;
  }

  /**
   * Validate and handle subscribe-tracks messages.
   */
  private handleSubscribeTracks(ws: WebSocket, msg: unknown): void {
    if (typeof msg !== 'object' || msg === null) return;
    const obj = msg as Record<string, unknown>;
    if (!Array.isArray(obj.items)) return;

    const items: string[] = [];
    for (const item of obj.items) {
      if (typeof item !== 'string') continue;
      if (item.length === 0 || item.length > this.maxTrackItemLength) continue;
      // Only allow printable ASCII (letters, numbers, spaces, hyphens, apostrophes)
      // This matches OSRS item naming conventions and blocks control chars / ANSI
      if (!/^[a-zA-Z0-9 '\-()]+$/.test(item)) continue;
      if (items.length >= this.maxTrackItems) break;
      items.push(item.toLowerCase());
    }

    this.clientTracks.set(ws, new Set(items));
  }

  /**
   * Broadcast a message to ALL connected clients.
   */
  broadcast(message: WSMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  /**
   * Send a message to a single specific client.
   */
  sendTo(client: WebSocket, message: WSMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all tracked item names across all connected clients.
   */
  getAllTrackedItems(): Set<string> {
    const combined = new Set<string>();
    for (const tracks of this.clientTracks.values()) {
      for (const name of tracks) {
        combined.add(name);
      }
    }
    return combined;
  }

  /**
   * Provide a callback that runs when a new client connects.
   */
  onConnection(callback: (ws: WebSocket) => void): void {
    this.wss.on('connection', callback);
  }
}
