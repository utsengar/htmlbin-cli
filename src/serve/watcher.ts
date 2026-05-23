// Thin wrapper over `fs.watch` with debouncing. Editors like vim emit
// rename+rename on save (write to tmp, rename over original), which yields
// two raw events ~1ms apart. We collapse them so SSE clients see one
// reload, not two.

import { watch, type FSWatcher } from "node:fs";
import { stat } from "node:fs/promises";

export interface Watcher {
  close(): void;
}

const DEBOUNCE_MS = 50;

export async function watchTarget(
  target: string,
  onChange: (path: string) => void
): Promise<Watcher> {
  const st = await stat(target);
  const recursive = st.isDirectory();

  let timer: NodeJS.Timeout | null = null;
  let lastPath = target;

  const fsWatcher: FSWatcher = watch(
    target,
    { recursive, persistent: true },
    (_event, filename) => {
      if (filename) {
        const name = filename.toString();
        // Skip dotfiles and node_modules. The state file `.htmlbin/serve.json`
        // is inside the watched directory in dir mode and would otherwise
        // trigger phantom reloads at start/stop.
        if (shouldIgnore(name)) return;
        lastPath = name;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onChange(lastPath);
      }, DEBOUNCE_MS);
    }
  );

  return {
    close(): void {
      if (timer) clearTimeout(timer);
      fsWatcher.close();
    },
  };
}

function shouldIgnore(relPath: string): boolean {
  // Split on both unix and windows separators so this works cross-platform.
  const parts = relPath.split(/[\\/]/);
  for (const part of parts) {
    if (part.startsWith(".")) return true;
    if (part === "node_modules") return true;
  }
  return false;
}
