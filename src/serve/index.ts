// Orchestration for the three `htmlbin serve` modes:
//   start  → bind, watch, write state, run until SIGINT / idle timeout
//   status → read state file (validate liveness), print
//   stop   → read state file, kill pid, clear state
//
// Agent-first defaults:
//   - When agent context is detected, `open` flips off (no browser to open)
//     and `idleTimeout` defaults to 5 min instead of 30.
//   - With --output json, every lifecycle event is one JSON object per
//     line on stdout: started, reload, client-connected, client-
//     disconnected, idle-shutdown, stopped.

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { CliError } from "../errors.js";
import {
  clearState,
  isProcessAlive,
  readState,
  writeState,
} from "./state.js";
import { startServer, type ServerHandle } from "./server.js";
import { watchTarget } from "./watcher.js";
import type { ServeMode, ServeOptions, ServeState } from "./types.js";

const RENDERABLE_EXTS = new Set([".html", ".htm", ".md"]);

export interface StartArgs {
  path: string;
  host?: string;
  port?: number;
  open?: boolean;
  reload?: boolean;
  overlay?: boolean;
  idleTimeout?: number;
  json: boolean;
  /** True when an agent env var was detected at process start. */
  agentContext: boolean;
}

export async function startServe(args: StartArgs): Promise<void> {
  const target = resolve(process.cwd(), args.path);
  const st = await statSafe(target);
  if (!st) {
    throw new CliError("file_not_found", `Path not found: ${args.path}`);
  }
  const mode: ServeMode = st.isDirectory() ? "dir" : "file";
  if (mode === "file" && !RENDERABLE_EXTS.has(extname(target).toLowerCase())) {
    throw new CliError(
      "invalid_arg",
      `Unsupported file type: ${extname(target) || "(none)"}`,
      { hint: "Pass an .html, .htm, or .md file — or a directory." }
    );
  }

  // Refuse if a server is already running for this cwd. Stale state file
  // (pid no longer alive) is fine — we'll overwrite it.
  const existing = await readState();
  if (existing && isProcessAlive(existing.pid)) {
    throw new CliError(
      "serve_already_running",
      `A serve process is already running (pid ${existing.pid}) for ${existing.serving}`,
      {
        hint: "Run `htmlbin serve --stop` first, or use a different working directory.",
        details: { url: existing.url, pid: existing.pid },
      }
    );
  }

  const opts: ServeOptions = {
    target,
    mode,
    host: args.host ?? "127.0.0.1",
    port: args.port ?? 0,
    open: args.open ?? !args.agentContext,
    reload: args.reload ?? true,
    overlay: args.overlay ?? true,
    idleTimeout: args.idleTimeout ?? (args.agentContext ? 5 : 30),
    json: args.json,
  };

  let handle: ServerHandle;
  try {
    handle = await startServer(opts, (count) => {
      emit(args.json, count >= 1 ? "client-connected" : "client-disconnected", {
        clients: count,
      });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "EADDRINUSE") {
      throw new CliError(
        "serve_port_in_use",
        `Port ${args.port} is already in use.`,
        { hint: "Omit --port to pick an ephemeral one." }
      );
    }
    throw e;
  }

  const state: ServeState = {
    pid: process.pid,
    url: handle.url,
    port: handle.port,
    serving: target,
    mode,
    started_at: new Date().toISOString(),
  };
  await writeState(state);

  emit(args.json, "started", {
    url: handle.url,
    port: handle.port,
    serving: target,
    mode,
    pid: process.pid,
  });

  const watcher = await watchTarget(target, (changedPath) => {
    handle.broadcastReload(changedPath);
    emit(args.json, "reload", { path: changedPath, at: new Date().toISOString() });
  });

  // Idle shutdown: poll every 30s; exit when no clients have been
  // connected for `idleTimeout` minutes. 0 disables.
  let idleTimer: NodeJS.Timeout | null = null;
  if (opts.idleTimeout > 0) {
    const idleMs = opts.idleTimeout * 60_000;
    idleTimer = setInterval(() => {
      if (handle.clientCount() === 0 && Date.now() - handle.lastActivity() > idleMs) {
        emit(args.json, "idle-shutdown", { idle_minutes: opts.idleTimeout });
        shutdown(0).catch(() => process.exit(0));
      }
    }, 30_000);
    idleTimer.unref?.();
  }

  if (opts.open) openInBrowser(handle.url);

  const shutdown = async (exitCode: number): Promise<void> => {
    if (idleTimer) clearInterval(idleTimer);
    watcher.close();
    await handle.close();
    await clearState();
    emit(args.json, "stopped", { code: exitCode });
    process.exit(exitCode);
  };

  process.on("SIGINT", () => { void shutdown(0); });
  process.on("SIGTERM", () => { void shutdown(0); });
}

export async function statusServe(json: boolean): Promise<void> {
  const state = await readState();
  if (!state) {
    emit(json, "status", { running: false });
    return;
  }
  const alive = isProcessAlive(state.pid);
  if (!alive) {
    await clearState();
    emit(json, "status", { running: false, note: "stale state file removed" });
    return;
  }
  emit(json, "status", {
    running: true,
    url: state.url,
    port: state.port,
    serving: state.serving,
    mode: state.mode,
    pid: state.pid,
    started_at: state.started_at,
  });
}

export async function stopServe(json: boolean): Promise<void> {
  const state = await readState();
  if (!state) {
    throw new CliError("serve_not_running", "No serve process is recorded for this directory.");
  }
  if (!isProcessAlive(state.pid)) {
    await clearState();
    throw new CliError("serve_not_running", `Recorded pid ${state.pid} is not alive (stale state removed).`);
  }
  try {
    process.kill(state.pid, "SIGTERM");
  } catch (e) {
    throw new CliError("serve_not_running", `Could not signal pid ${state.pid}: ${(e as Error).message}`);
  }
  // Wait briefly for the target process to exit and clear its own state.
  // If it doesn't (e.g. wedged), clear the state file ourselves.
  for (let i = 0; i < 20; i++) {
    await sleep(50);
    if (!isProcessAlive(state.pid)) break;
  }
  await clearState();
  emit(json, "stopped", { pid: state.pid });
}

async function statSafe(p: string): Promise<{ isDirectory: () => boolean } | null> {
  try {
    return await stat(p);
  } catch {
    return null;
  }
}

function openInBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "cmd" :
    "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // Swallow — opening the browser is a convenience, not load-bearing.
  }
}

function emit(json: boolean, event: string, fields: Record<string, unknown>): void {
  if (json) {
    process.stdout.write(JSON.stringify({ event, ...fields }) + "\n");
    return;
  }
  process.stdout.write(humanFormat(event, fields) + "\n");
}

function humanFormat(event: string, f: Record<string, unknown>): string {
  switch (event) {
    case "started":
      return `serving ${f.serving} at ${f.url}\n(press Ctrl+C to stop; pid ${f.pid})`;
    case "reload":
      return `reload: ${f.path}`;
    case "client-connected":
      return `client connected (${f.clients} total)`;
    case "client-disconnected":
      return `client disconnected (${f.clients} remaining)`;
    case "idle-shutdown":
      return `idle for ${f.idle_minutes}m — shutting down`;
    case "stopped":
      return f.pid !== undefined ? `stopped pid ${f.pid}` : `stopped`;
    case "status":
      if (!f.running) return "no serve process running";
      return [
        `running pid ${f.pid}`,
        `url:     ${f.url}`,
        `serving: ${f.serving}`,
        `mode:    ${f.mode}`,
        `since:   ${f.started_at}`,
      ].join("\n");
    default:
      return `${event} ${JSON.stringify(f)}`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
