// HTTP server + SSE broadcast hub. Two routes:
//   GET /__hb/sse  → text/event-stream; one connection per browser tab
//   GET /<rest>    → delegated to render.ts
//
// SSE clients are tracked in a Set so the watcher (wired up in index.ts)
// can broadcast `reload` to all of them. A 25s ping keeps proxies from
// closing idle connections.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { renderForRequest } from "./render.js";
import { CLIENT_CSS, CLIENT_JS } from "./client.js";
import type { ServeOptions } from "./types.js";

export interface ServerHandle {
  server: Server;
  port: number;
  url: string;
  broadcastReload(path: string): void;
  clientCount(): number;
  /** ms timestamp of last SSE activity (connect/disconnect/broadcast). */
  lastActivity(): number;
  close(): Promise<void>;
}

const PING_MS = 25_000;

export async function startServer(
  opts: ServeOptions,
  onClientChange?: (count: number) => void,
  onReload?: (path: string) => void
): Promise<ServerHandle> {
  const clients = new Set<ServerResponse>();
  let activityAt = Date.now();

  const server = createServer(async (req, res) => {
    try {
      const url = req.url ?? "/";
      if (url === "/__hb/sse") {
        handleSse(req, res, clients);
        activityAt = Date.now();
        onClientChange?.(clients.size);
        return;
      }
      // Strip query string before path resolution.
      const pathOnly = url.split("?")[0] ?? "/";
      if (pathOnly === "/__hb/client.css") {
        res.writeHead(200, {
          "Content-Type": "text/css; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(CLIENT_CSS);
        return;
      }
      if (pathOnly === "/__hb/client.js") {
        res.writeHead(200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(CLIENT_JS);
        return;
      }
      const result = await renderForRequest(pathOnly, opts);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`htmlbin serve: ${(e as Error).message}`);
    }
  });

  const pinger = setInterval(() => {
    for (const c of clients) {
      try { c.write(`:ping\n\n`); } catch { /* client gone; cleanup on next write */ }
    }
  }, PING_MS);
  pinger.unref?.();

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(opts.port, opts.host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });

  const addr = server.address() as AddressInfo;
  const url = `http://${formatHost(opts.host)}:${addr.port}/`;
  // Stamp the bound address back onto opts so renderForRequest can show
  // "localhost:<port>" in the modeline. Mutation is fine — opts is
  // module-local to one server lifecycle.
  opts.localAddr = `${formatHost(opts.host)}:${addr.port}`;

  return {
    server,
    port: addr.port,
    url,
    broadcastReload(path: string): void {
      activityAt = Date.now();
      for (const c of clients) {
        try {
          c.write(`event: reload\ndata: ${JSON.stringify({ path })}\n\n`);
        } catch {
          clients.delete(c);
        }
      }
      onReload?.(path);
    },
    clientCount(): number {
      return clients.size;
    },
    lastActivity(): number {
      return activityAt;
    },
    async close(): Promise<void> {
      clearInterval(pinger);
      for (const c of clients) {
        try { c.end(); } catch { /* ignore */ }
      }
      clients.clear();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}

function handleSse(
  _req: IncomingMessage,
  res: ServerResponse,
  clients: Set<ServerResponse>
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`event: open\ndata: ok\n\n`);
  clients.add(res);
  res.on("close", () => {
    clients.delete(res);
  });
}

// `localhost` reads nicer than `127.0.0.1` in printed URLs, but if the
// user bound to a real IP we keep it.
function formatHost(host: string): string {
  if (host === "127.0.0.1" || host === "0.0.0.0") return "localhost";
  return host;
}
