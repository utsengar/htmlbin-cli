// Regression: when the consumer of a pipe closes stdout before the CLI
// finishes writing (e.g. `htmlbin list | head -1`), Node raises EPIPE on
// process.stdout. Without a handler, the CLI crashes with an unhandled
// stream error and a non-zero exit. bin.ts installs a handler that turns
// EPIPE into a silent exit-0; this test pins that behavior.

import { describe, expect, it } from "vitest";
import { execa } from "execa";
import { CLI_BIN, distAvailable } from "./helpers.js";

describe.skipIf(!distAvailable())("EPIPE handling", () => {
  it("exits 0 with no stack trace when stdout is closed mid-write", async () => {
    // `--help` produces enough lines to outpace `head -c 1`. Wrap in bash
    // so we can use PIPESTATUS to surface the CLI's exit code rather than
    // head's. Without the handler, PIPESTATUS[0] would be 1 and stderr
    // would contain "EPIPE" / "Error: write EPIPE".
    const r = await execa(
      "bash",
      [
        "-c",
        `set -o pipefail; node "${CLI_BIN}" --help | head -c 1 > /dev/null; exit \${PIPESTATUS[0]}`,
      ],
      { reject: false }
    );
    expect(r.exitCode).toBe(0);
    const stderr = typeof r.stderr === "string" ? r.stderr : "";
    expect(stderr).not.toMatch(/EPIPE/);
    expect(stderr).not.toMatch(/Error: write/);
  });
});
