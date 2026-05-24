// `htmlbin patterns update` — re-fetch every installed pattern from the catalog.
//
// For each installed pattern name, derives the catalog URL and GETs a fresh
// copy. Patterns that 404 (custom or local-only) are skipped with a warning;
// network and parse errors are recorded per-entry and do not abort the run.

import { CliError } from "../errors.js";
import { catalogPatternUrl, DEFAULT_CATALOG_BASE } from "./paths.js";
import { fetchSource } from "./sources.js";
import { parseAndValidatePattern } from "./schema.js";
import { writePattern } from "./install.js";
import type { ListedPattern } from "./list.js";

export type UpdatePatternStatus = "updated" | "not_in_catalog" | "error";

export interface UpdatePatternResult {
  name: string;
  path: string;
  status: UpdatePatternStatus;
  error?: string;
}

export interface UpdateResult {
  target_dir: string;
  results: UpdatePatternResult[];
}

export interface UpdateOpts {
  /** Directory whose patterns should be refreshed. */
  targetDir: string;
  /** Already-listed patterns from that dir (from listPatterns). */
  patterns: ListedPattern[];
  /** Override the catalog base URL. */
  catalogBase?: string;
}

export async function updatePatterns(opts: UpdateOpts): Promise<UpdateResult> {
  const base = opts.catalogBase ?? DEFAULT_CATALOG_BASE;
  const results: UpdatePatternResult[] = [];

  for (const pattern of opts.patterns) {
    const url = catalogPatternUrl(base, pattern.name);
    const rs = { kind: "catalog" as const, name: pattern.name, url };

    let raw: string;
    try {
      raw = await fetchSource(rs);
    } catch (e) {
      if (e instanceof CliError && e.code === "not_found") {
        results.push({ name: pattern.name, path: pattern.path, status: "not_in_catalog" });
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name: pattern.name, path: pattern.path, status: "error", error: msg });
      continue;
    }

    try {
      const parsed = parseAndValidatePattern(raw, pattern.name);
      const r = await writePattern(opts.targetDir, parsed, true);
      results.push({ name: pattern.name, path: r.path, status: "updated" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name: pattern.name, path: pattern.path, status: "error", error: msg });
    }
  }

  return { target_dir: opts.targetDir, results };
}
