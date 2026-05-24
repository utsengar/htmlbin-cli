// Per-CWD state file for `htmlbin serve`. Stored at `./.htmlbin/serve.json`
// so a subsequent `serve --status` / `serve --stop` (or another agent turn)
// can discover the running server without parsing logs.

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ServeState } from "./types.js";

export function stateFilePath(cwd = process.cwd()): string {
  return resolve(cwd, ".htmlbin/serve.json");
}

export async function writeState(state: ServeState, cwd = process.cwd()): Promise<void> {
  const path = stateFilePath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf8");
}

export async function readState(cwd = process.cwd()): Promise<ServeState | null> {
  try {
    const raw = await readFile(stateFilePath(cwd), "utf8");
    return JSON.parse(raw) as ServeState;
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return null;
    return null;
  }
}

export async function clearState(cwd = process.cwd()): Promise<void> {
  try {
    await unlink(stateFilePath(cwd));
  } catch (e) {
    if ((e as { code?: string }).code !== "ENOENT") throw e;
  }
}

// `kill(pid, 0)` is a permissionless liveness check — throws ESRCH if no
// such process. We treat any throw as "not alive" so a stale state file
// (e.g. previous run killed -9) doesn't block a fresh start.
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
