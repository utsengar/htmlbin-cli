// Debug flag — gates inclusion of raw upstream HTTP response bodies in
// error `details`. When off (default), errors carry only structured
// fields (status code, error codes from the API envelope, etc.). When
// on, raw response bodies flow through so an operator can diagnose
// upstream issues.
//
// Activated by the `--debug` CLI flag or `HTMLBIN_DEBUG=1`. The flag is
// off by default so error output from `htmlbin` running in public CI
// (PR previews, etc.) never echoes an upstream stack trace into the
// public logs.

let DEBUG = false;

export function setDebug(enabled: boolean): void {
  DEBUG = !!enabled;
}

export function isDebug(): boolean {
  return DEBUG;
}
