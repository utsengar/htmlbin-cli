// Owner-side metadata tag bag for cloud drops. Server-side spec lives in
// the htmlbin OpenAPI (1.2.0). The CLI parses --metadata k=v flags into
// a flat Record<string,string>, does the cheap local checks (count, parse
// form), and lets the server enforce the regex / length / value-type rules.
// Server errors come back as invalid_arg with structured `error.details`.

import { CliError } from "../errors.js";

const MAX_KEYS = 10;

/**
 * Parse repeatable --metadata k=v flags into an object. Splits on the
 * first `=`; later `=` characters are preserved inside the value. Empty
 * values are allowed; empty keys are not. Later occurrences of the same
 * key overwrite earlier ones.
 */
export function parseMetadata(pairs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq < 0) {
      throw new CliError(
        "invalid_arg",
        `--metadata "${pair}" must be in key=value form.`
      );
    }
    const key = pair.slice(0, eq);
    if (key.length === 0) {
      throw new CliError("invalid_arg", `--metadata "${pair}" has empty key.`);
    }
    out[key] = pair.slice(eq + 1);
  }
  return out;
}

/**
 * Locally enforce the cheap rules from the API spec. Key-regex, length,
 * and value-type checks are server-side; we surface those via error.details.
 */
export function validateLocally(metadata: Record<string, string>): void {
  const count = Object.keys(metadata).length;
  if (count > MAX_KEYS) {
    throw new CliError(
      "invalid_arg",
      `Too many metadata keys: ${count} (max ${MAX_KEYS}).`,
      { details: { max_keys: MAX_KEYS, given: count } }
    );
  }
}

/**
 * Build a `metadata.key=value&metadata.k2=v2` query string. Returns ""
 * for an empty object so the caller doesn't have to special-case the
 * dangling `?`.
 */
export function encodeFilterParams(metadata: Record<string, string>): string {
  return Object.entries(metadata)
    .map(([k, v]) => `metadata.${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}
