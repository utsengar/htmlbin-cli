import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { CliError } from "../errors.js";
import { BUNDLED_PATTERNS } from "../patterns/bundled-data.js";
import { projectPatternsDir, globalPatternsDir } from "../patterns/paths.js";
import { parseAndValidatePattern } from "../patterns/schema.js";

export interface ResolvedPattern {
  name: string;
  body: string;
  triggers: string[];
}

async function patternsFromDir(dir: string): Promise<ResolvedPattern[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const out: ResolvedPattern[] = [];
  for (const f of files) {
    if (!f.endsWith(".md")) continue;
    const path = join(dir, f);
    try {
      if (!(await stat(path)).isFile()) continue;
      const raw = await readFile(path, "utf8");
      const parsed = parseAndValidatePattern(raw);
      out.push({
        name: parsed.frontmatter.name,
        body: parsed.body,
        triggers: parsed.frontmatter.triggers,
      });
    } catch {
      // skip malformed files silently — listing tolerates them too
    }
  }
  return out;
}

async function allPatterns(): Promise<Map<string, ResolvedPattern>> {
  const byName = new Map<string, ResolvedPattern>();

  // Precedence: bundled < global < project — later writes win.
  for (const p of BUNDLED_PATTERNS) {
    try {
      const parsed = parseAndValidatePattern(p.body);
      byName.set(parsed.frontmatter.name, {
        name: parsed.frontmatter.name,
        body: parsed.body,
        triggers: parsed.frontmatter.triggers,
      });
    } catch {
      // skip invalid bundled entry
    }
  }
  for (const p of await patternsFromDir(globalPatternsDir())) {
    byName.set(p.name, p);
  }
  for (const p of await patternsFromDir(projectPatternsDir())) {
    byName.set(p.name, p);
  }

  return byName;
}

export async function resolvePattern(opts: {
  name?: string;
  prompt: string;
}): Promise<ResolvedPattern | null> {
  const patterns = await allPatterns();

  if (opts.name) {
    const found = patterns.get(opts.name);
    if (!found) {
      throw new CliError("not_found", `Pattern "${opts.name}" not found.`, {
        hint: "Run 'htmlbin patterns list' to see installed patterns, or 'htmlbin patterns init' to install the defaults.",
      });
    }
    return found;
  }

  // Auto-detect: find the trigger with the longest match against the prompt.
  // Longer trigger = more specific = wins ties.
  const promptLower = opts.prompt.toLowerCase();
  let best: ResolvedPattern | null = null;
  let bestLen = 0;

  for (const pattern of patterns.values()) {
    for (const trigger of pattern.triggers) {
      if (promptLower.includes(trigger.toLowerCase()) && trigger.length > bestLen) {
        bestLen = trigger.length;
        best = pattern;
      }
    }
  }

  return best;
}
