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
    ws.on('message', (raw) => {
      // Rate limit check (in local mode the limit is very high, so this
      // won't trigger unless something is genuinely wrong)
      if (!this.checkRateLimit(ws)) {
        return;
      }

      try {
        const rawStr = raw.toString();
        if (rawStr.length > this.maxIncomingMessageBytes) return;

        const msg = JSON.parse(rawStr);

        // Whitelist approach: only accept known message types
        if (msg.type === 'subscribe-tracks') {
          this.handleSubscribeTracks(ws, msg);
        }
      } catch {
        // Malformed JSON — ignore silently
      }
    });

    // ── Cleanup on disconnect ──
    const cleanup = () => {
      this.clients.delete(ws);
      this.clientTracks.delete(ws);
      this.messageTimestamps.delete(ws);
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
   * Extract client IP, respecting X-Forwarded-For when behind a reverse proxy.
   * In local mode you're not behind a proxy, so this just returns the socket IP.
   */
  private getClientIp(req: IncomingMessage): string {
    if (this.mode === 'production') {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
    }
    return req.socket.remoteAddress ?? 'unknown';
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
