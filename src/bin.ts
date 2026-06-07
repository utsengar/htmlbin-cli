// CLI entrypoint. commander wires subcommands to backend methods.
//
//   htmlbin publish <file>             → publish
//   htmlbin list                       → list
//   htmlbin delete <slug>              → delete
//   htmlbin url <slug>                 → print URL
//   htmlbin login                      → cloud device-code auth
//   htmlbin setup                      → backend-specific one-time prep
//
// Every command accepts `--to <backend>`. The active backend resolves via
// the precedence in src/config.ts.

import { Command, Option } from "commander";
import { createCloudBackend } from "./backends/cloud.js";
import { createGhPagesBackend } from "./backends/gh-pages.js";
import { createCloudflareBackend } from "./backends/cloudflare.js";
import { CliError, exitCodeFor } from "./errors.js";
import {
  loadConfigFile,
  resolveBackend,
  type ConfigFile,
} from "./config.js";
import type {
  Backend,
  BackendName,
  DropSummary,
  ListOpts,
  PublishOpts,
  UpdateOpts,
} from "./backend.js";
import { parseMetadata, validateLocally } from "./cloud/metadata.js";
import { setAgent } from "./useragent.js";
import { setDebug } from "./debug.js";
import {
  globalPatternsDir,
  projectPatternsDir,
  DEFAULT_CATALOG_BASE,
} from "./patterns/paths.js";
import { listPatterns } from "./patterns/list.js";
import { initPatterns } from "./patterns/init.js";
import { ensureNoSilentSkip, installPattern } from "./patterns/install.js";
import { resolveSource } from "./patterns/sources.js";
import { updatePatterns } from "./patterns/update.js";
// Pull the version from package.json at build time so `--version` and the
// published npm version can never drift apart. tsup inlines the JSON value
// during bundling — no runtime FS lookup, no need to ship package.json
// alongside the bin.
import pkg from "../package.json" with { type: "json" };

const VERSION = pkg.version;

// Exit silently when the consumer closes the pipe (`htmlbin list | head -1`).
// Without this, Node treats EPIPE on stdout/stderr as an unhandled error and
// crashes mid-write with a stack trace and a non-zero exit.
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") process.exit(0);
    throw err;
  });
}

// Agent-runner env vars that, when present, default --output to json so
// the runner gets parseable data without having to know about the flag.
// Mirrors DataDog/pup's detection list as of 2026-05, plus a couple of
// runners we want to cover ourselves. Tuple of [env var, friendly name]
// — the friendly name is included in the User-Agent.
const AGENT_ENV_VARS: ReadonlyArray<readonly [string, string]> = [
  ["CLAUDECODE", "claude-code"],
  ["CLAUDE_CODE", "claude-code"],
  ["CURSOR_AGENT", "cursor"],
  ["CODEX", "codex"],
  ["CODEX_AGENT", "codex"],
  ["OPENAI_CODEX", "codex"],
  ["OPENCODE", "opencode"],
  ["AIDER", "aider"],
  ["CLINE", "cline"],
  ["WINDSURF_AGENT", "windsurf"],
  ["GITHUB_COPILOT", "github-copilot"],
  ["AMAZON_Q", "amazon-q"],
  ["AWS_Q_DEVELOPER", "amazon-q"],
  ["GEMINI_CODE_ASSIST", "gemini-code-assist"],
  ["SRC_CODY", "sourcegraph-cody"],
  ["PI_CODING_AGENT", "pi"],
  ["AMP_CODE", "amp"],
  ["DEVIN", "devin"],
  ["AGENT", "generic-agent"], // generic fallback for runners we haven't named
];

export function detectAgent(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.FORCE_AGENT_MODE) return "forced";
  for (const [key, name] of AGENT_ENV_VARS) {
    if (env[key]) return name;
  }
  return null;
}

function isAgentContext(env: NodeJS.ProcessEnv = process.env): boolean {
  return detectAgent(env) !== null;
}

type OutputMode = "text" | "json";
// Mutable module-level — set by the commander preAction hook before each
// command runs. Used by die() since errors can throw from anywhere.
let OUTPUT_MODE: OutputMode = isAgentContext() ? "json" : "text";

// Configure the User-Agent module with the detected agent name at startup
// so every HTTP call includes it. If the detection result changes (e.g.,
// FORCE_AGENT_MODE flips on between calls), the preAction hook re-syncs.
setAgent(detectAgent());

interface GlobalOpts {
  to?: string;
  output?: OutputMode;
  debug?: boolean;
}

interface PublishCmdOpts extends GlobalOpts {
  title?: string;
  description?: string;
  slug?: string;
  repo?: string;
  branch?: string;
  project?: string;
  metadata?: string[];
  upsert?: boolean;
}

interface UpdateCmdOpts extends GlobalOpts {
  file?: string;
  title?: string;
  description?: string;
  metadata?: string[];
  clearMetadata?: boolean;
}

interface ListCmdOpts extends GlobalOpts {
  project?: string;
  repo?: string;
  branch?: string;
  limit?: string;
  metadata?: string[];
}

interface SetupCmdOpts extends GlobalOpts {
  // gh-pages
  branch?: string;
  repo?: string;
  // cloudflare
  project?: string;
  productionBranch?: string;
  idp?: string[];
  emailDomain?: string[];
  email?: string[];
}

async function makeBackend(name: BackendName, cfg: ConfigFile, extra: PublishCmdOpts | SetupCmdOpts = {}): Promise<Backend> {
  switch (name) {
    case "cloud":
      return createCloudBackend({ apiUrl: cfg.api_url });
    case "gh-pages":
      return createGhPagesBackend({
        repo: extra.repo ?? cfg.repo,
        branch: extra.branch ?? cfg.branch,
      });
    case "cloudflare":
      return createCloudflareBackend({
        accountId: cfg.account_id,
        project: (extra as PublishCmdOpts).project ?? cfg.project,
        setupIdp: (extra as SetupCmdOpts).idp,
        setupEmailDomain: (extra as SetupCmdOpts).emailDomain,
        setupEmail: (extra as SetupCmdOpts).email,
        productionBranch: (extra as SetupCmdOpts).productionBranch,
      });
  }
}

async function resolveActiveBackend(globalOpts: GlobalOpts): Promise<{ backend: BackendName; config: ConfigFile }> {
  const config = await loadConfigFile();
  const resolved = resolveBackend({
    flag: globalOpts.to,
    env: process.env.HTMLBIN_BACKEND,
    config,
  });
  return { backend: resolved.backend, config };
}

function die(err: unknown): never {
  if (err instanceof CliError) {
    if (OUTPUT_MODE === "json") {
      const body: { error: Record<string, unknown> } = {
        error: { code: err.code, message: err.message },
      };
      if (err.hint) body.error.hint = err.hint;
      if (err.details) body.error.details = err.details;
      process.stderr.write(JSON.stringify(body) + "\n");
    } else {
      process.stderr.write(`error: ${err.message}  [${err.code}]\n`);
      if (err.hint) process.stderr.write(`hint:  ${err.hint}\n`);
      if (err.details && Object.keys(err.details).length > 0) {
        for (const [k, v] of Object.entries(err.details)) {
          process.stderr.write(`  ${k}: ${formatDetailValue(v)}\n`);
        }
      }
    }
    process.exit(exitCodeFor(err.code));
  }
  const message = (err as Error)?.message ?? String(err);
  if (OUTPUT_MODE === "json") {
    process.stderr.write(JSON.stringify({ error: { code: "unknown", message } }) + "\n");
  } else {
    process.stderr.write(`error: ${message}\n`);
  }
  process.exit(1);
}

function formatDetailValue(v: unknown): string {
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  return JSON.stringify(v);
}

// Emit a result. JSON mode prints the structured payload on stdout;
// text mode invokes the human renderer (which may have side effects like
// writing notes to stderr — those only fire in text mode).
function emit(payload: unknown, renderText: () => string): void {
  if (OUTPUT_MODE === "json") {
    process.stdout.write(JSON.stringify(payload) + "\n");
  } else {
    process.stdout.write(renderText());
  }
}

async function run(): Promise<void> {
  const program = new Command();
  program
    .name("htmlbin")
    .description("Publish HTML, get a URL. Cloud by default; pluggable backends for org-internal hosting.")
    .version(VERSION)
    .addOption(
      new Option("--to <backend>", "backend to use: cloud | gh-pages | cloudflare").choices([
        "cloud",
        "gh-pages",
        "cloudflare",
      ])
    )
    .addOption(
      new Option("--output <format>", "output format (auto-detects coding-agent env vars and defaults to json then)")
        .choices(["text", "json"])
    )
    .addOption(
      new Option(
        "--debug",
        "include raw upstream HTTP response bodies in error details (also: HTMLBIN_DEBUG=1). Off by default to avoid leaking server responses into public CI logs."
      )
    );

  // Sync OUTPUT_MODE + User-Agent before each command runs so die() and
  // emit() see the resolved value, and outbound HTTP carries the detected
  // agent. Precedence: explicit --output > agent env detection > "text".
  program.hook("preAction", () => {
    const opts = program.opts<GlobalOpts>();
    if (opts.output) OUTPUT_MODE = opts.output;
    else OUTPUT_MODE = isAgentContext() ? "json" : "text";
    setAgent(detectAgent());
    // Debug: explicit --debug flag OR HTMLBIN_DEBUG truthy env. Anything
    // truthy other than "0"/"false"/"" enables; reject those so users
    // can `HTMLBIN_DEBUG=0 htmlbin …` without surprise.
    const envDebug = process.env.HTMLBIN_DEBUG;
    const envEnabled =
      typeof envDebug === "string" &&
      envDebug !== "" &&
      envDebug !== "0" &&
      envDebug.toLowerCase() !== "false";
    setDebug(!!opts.debug || envEnabled);
  });

  // --- publish ---
  program
    .command("publish")
    .description("Publish an HTML file and print the resulting URL")
    .argument("<file>", "path to an HTML file")
    .option("--title <text>", "title (cloud backend; defaults to filename)")
    .option("--description <text>", "description (cloud backend)")
    .option(
      "--slug <name>",
      "target slug. cloud: publishes a new version of an existing drop. gh-pages/cloudflare: required (sets the URL path / subdomain)."
    )
    .option("--repo <owner/name>", "repo (gh-pages; default: git remote origin)")
    .option("--branch <name>", "branch (gh-pages; default: gh-pages)")
    .option("--project <name>", "Pages project (cloudflare; default: $CLOUDFLARE_PAGES_PROJECT)")
    .option(
      "--metadata <k=v...>",
      "metadata key=value (cloud only; repeatable, up to 10)"
    )
    .option("--upsert", "look up by --metadata first; PUT if found, POST if not (cloud only)")
    .action(async (file: string, cmdOpts: PublishCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        const opts: PublishOpts = { file };
        if (cmdOpts.title) opts.title = cmdOpts.title;
        if (cmdOpts.description) opts.description = cmdOpts.description;
        if (cmdOpts.slug) opts.slug = cmdOpts.slug;
        if (cmdOpts.metadata?.length) {
          const parsed = parseMetadata(cmdOpts.metadata);
          validateLocally(parsed);
          opts.metadata = parsed;
        }
        if (cmdOpts.upsert) opts.upsert = true;
        const r = await be.publish(opts);
        const payload: Record<string, unknown> = {
          url: r.url,
          slug: r.slug,
          backend,
        };
        if (r.matched !== undefined) payload.matched = r.matched;
        if (r.note) payload.note = r.note;
        emit(payload, () => {
          let out = r.url + "\n";
          if (r.note) process.stderr.write(`note:  ${r.note}\n`);
          return out;
        });
      } catch (e) {
        die(e);
      }
    });

  // --- list ---
  program
    .command("list")
    .description("List published drops on the active backend")
    .option("--project <name>", "Pages project (cloudflare)")
    .option("--repo <owner/name>", "repo (gh-pages)")
    .option("--branch <name>", "branch (gh-pages)")
    .option("-n, --limit <n>", "max rows to return (default: all)")
    .option(
      "--metadata <k=v...>",
      "filter by metadata key=value (cloud only; AND across pairs)"
    )
    .action(async (cmdOpts: ListCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        const listOpts: ListOpts = {};
        if (cmdOpts.metadata?.length) {
          const parsed = parseMetadata(cmdOpts.metadata);
          validateLocally(parsed);
          listOpts.metadata = parsed;
        }
        let rows = await be.list(listOpts);
        if (cmdOpts.limit) {
          const n = Number.parseInt(cmdOpts.limit, 10);
          if (!Number.isFinite(n) || n < 1) {
            throw new CliError("invalid_arg", `--limit must be a positive integer (got: ${cmdOpts.limit})`);
          }
          rows = rows.slice(0, n);
        }
        emit(rows, () => {
          if (rows.length === 0) return "(no drops)\n";
          if (process.stdout.isTTY) return formatListForHumans(rows);
          // Pipe-friendly: tab-separated, no headers, full ISO timestamp.
          return rows
            .map((r) => `${r.slug}\t${r.updated_at}\t${r.title ?? ""}\t${r.url}`)
            .join("\n") + "\n";
        });
      } catch (e) {
        die(e);
      }
    });

  // --- update ---
  program
    .command("update")
    .description("Update an existing drop (cloud backend)")
    .argument("<slug>", "slug of the drop to update")
    .option("--file <path>", "new HTML body (PUT — mints a new version)")
    .option("--title <text>", "new title")
    .option("--description <text>", "new description")
    .option(
      "--metadata <k=v...>",
      "replace the metadata map (repeatable; up to 10)"
    )
    .option("--clear-metadata", "clear all metadata (sends {})")
    .action(async (slug: string, cmdOpts: UpdateCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        if (backend !== "cloud") {
          throw new CliError(
            "invalid_arg",
            "update is only supported on the cloud backend."
          );
        }
        const be = await makeBackend(backend, config);
        if (!be.update) {
          throw new CliError("invalid_arg", "Backend does not support update.");
        }
        const updateOpts: UpdateOpts = {};
        if (cmdOpts.file) updateOpts.file = cmdOpts.file;
        if (cmdOpts.title) updateOpts.title = cmdOpts.title;
        if (cmdOpts.description !== undefined) updateOpts.description = cmdOpts.description;
        if (cmdOpts.metadata?.length) {
          const parsed = parseMetadata(cmdOpts.metadata);
          validateLocally(parsed);
          updateOpts.metadata = parsed;
        }
        if (cmdOpts.clearMetadata) updateOpts.clearMetadata = true;
        const r = await be.update(slug, updateOpts);
        emit(
          { url: r.url, slug: r.slug, mode: r.mode, backend },
          () =>
            `${r.mode === "put" ? "updated (new version)" : "patched"}: ${r.url}\n`
        );
      } catch (e) {
        die(e);
      }
    });

  // --- delete ---
  program
    .command("delete")
    .description("Delete a drop (slug or PR number)")
    .argument("<slug>", "slug or PR number")
    .option("--project <name>", "Pages project (cloudflare)")
    .option("--repo <owner/name>", "repo (gh-pages)")
    .option("--branch <name>", "branch (gh-pages)")
    .action(async (slug: string, cmdOpts: PublishCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        await be.delete(slug);
        emit({ deleted: true, slug, backend }, () => `deleted ${slug}\n`);
      } catch (e) {
        die(e);
      }
    });

  // --- url ---
  program
    .command("url")
    .description("Print the URL for a given slug (no publish)")
    .argument("<slug>", "slug or PR number")
    .option("--project <name>", "Pages project (cloudflare)")
    .option("--repo <owner/name>", "repo (gh-pages)")
    .option("--branch <name>", "branch (gh-pages)")
    .action(async (slug: string, cmdOpts: PublishCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        const url = await be.url(slug);
        emit({ url, slug, backend }, () => url + "\n");
      } catch (e) {
        die(e);
      }
    });

  // --- login ---
  program
    .command("login")
    .description("Sign in (cloud backend only — device-code flow with GitHub)")
    .action(async () => {
      try {
        const cloud = createCloudBackend();
        if (!cloud.login) throw new CliError("invalid_arg", "Cloud backend has no login method.");
        await cloud.login();
      } catch (e) {
        die(e);
      }
    });

  // --- setup ---
  program
    .command("setup")
    .description("One-time prep for the selected backend (creates branches / projects, prints UI steps)")
    .option("--branch <name>", "branch (gh-pages; default: gh-pages)")
    .option("--repo <owner/name>", "repo (gh-pages)")
    .option("--project <name>", "Pages project (cloudflare)")
    .option("--production-branch <name>", "production branch (cloudflare; default: main)")
    .option("--idp <id...>", "Cloudflare Access IdP id(s) to allow (repeatable)")
    .option("--email-domain <domain...>", "allow this email domain (Access)")
    .option("--email <addr...>", "allow this specific email (Access)")
    .action(async (cmdOpts: SetupCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        if (!be.setup) throw new CliError("invalid_arg", `Backend "${backend}" has no setup step.`);
        const r = await be.setup();
        emit({ instructions: r.instructions, backend }, () =>
          r.instructions.map((line) => line + "\n").join("")
        );
      } catch (e) {
        die(e);
      }
    });

  // --- patterns (sub-subcommands: list, init, add) ---
  registerPatternsCommands(program);

  await program.parseAsync(process.argv);
}

// ---------------------------------------------------------------
// `htmlbin patterns` — install + manage local patterns the skill at
// /.well-known/agent-skills/htmlbin/SKILL.md teaches agents to look for.
// Three subcommands: list, init, add. Project-local beats global beats
// the catalog at https://htmlbin.dev/.well-known/patterns/.
// ---------------------------------------------------------------

function registerPatternsCommands(program: Command): void {
  const patterns = program
    .command("patterns")
    .description("Install + manage local patterns (project + machine-global)");

  // -- patterns list --
  patterns
    .command("list")
    .description("List installed patterns and which file wins per name")
    .action(async () => {
      try {
        const r = await listPatterns();
        emit(r, () => {
          if (r.effective.length === 0) {
            return [
              "(no patterns installed)",
              `Run 'htmlbin patterns init' to fetch the official 3 into ${globalPatternsDir()}.`,
              "",
            ].join("\n");
          }
          return formatPatternsForHumans(r);
        });
      } catch (e) {
        die(e);
      }
    });

  // -- patterns init --
  patterns
    .command("init")
    .description("Install the official catalog patterns (falls back to bundled when offline)")
    .option("--force", "overwrite existing files")
    .option("--project", "install into ./.htmlbin/patterns instead of the global dir")
    .option(
      "--catalog <url>",
      `override the catalog base (default: ${DEFAULT_CATALOG_BASE})`
    )
    .action(async (cmdOpts: { force?: boolean; project?: boolean; catalog?: string }) => {
      try {
        const targetDir = cmdOpts.project ? projectPatternsDir() : globalPatternsDir();
        const initArgs: {
          targetDir: string;
          force?: boolean;
          catalogBase?: string;
        } = { targetDir };
        if (cmdOpts.force) initArgs.force = cmdOpts.force;
        if (cmdOpts.catalog) initArgs.catalogBase = cmdOpts.catalog;
        const r = await initPatterns(initArgs);
        emit(r, () => {
          const lines: string[] = [];
          if (r.offline) lines.push("(offline — using bundled fallback)");
          lines.push(`target: ${r.target_dir}`);
          for (const e of r.installed) {
            const tag = e.status === "wrote" ? "  +" : "  =";
            lines.push(`${tag} ${e.name}${e.status === "skipped" ? " (already installed)" : ""}`);
          }
          if (r.installed.length === 0) lines.push("(no patterns)");
          lines.push("");
          return lines.join("\n");
        });
      } catch (e) {
        die(e);
      }
    });

  // -- patterns add --
  patterns
    .command("add")
    .description(
      "Install one pattern. Source: bare name, https URL, github:owner/repo/path, gist:hash, or a local file path."
    )
    .argument("<source>", "where to fetch the pattern from")
    .option("--force", "overwrite an existing destination")
    .option("--project", "install into ./.htmlbin/patterns instead of the global dir")
    .option(
      "--catalog <url>",
      `override the catalog base (default: ${DEFAULT_CATALOG_BASE})`
    )
    .action(
      async (
        source: string,
        cmdOpts: { force?: boolean; project?: boolean; catalog?: string }
      ) => {
        try {
          const dir = cmdOpts.project ? projectPatternsDir() : globalPatternsDir();
          const resolveOpts: { catalogBase?: string } = {};
          if (cmdOpts.catalog) resolveOpts.catalogBase = cmdOpts.catalog;
          const rs = resolveSource(source, resolveOpts);
          const r = await installPattern({
            dir,
            source: rs,
            force: !!cmdOpts.force,
          });
          ensureNoSilentSkip(r, "add");
          emit(r, () => `${r.status === "wrote" ? "wrote" : "skipped"} ${r.path}\n`);
        } catch (e) {
          die(e);
        }
      }
    );

  // -- patterns update --
  patterns
    .command("update")
    .description("Re-fetch installed patterns from the catalog and overwrite with the latest version")
    .option("--project", "update patterns in ./.htmlbin/patterns instead of the global dir")
    .option(
      "--catalog <url>",
      `override the catalog base (default: ${DEFAULT_CATALOG_BASE})`
    )
    .action(async (cmdOpts: { project?: boolean; catalog?: string }) => {
      try {
        const dir = cmdOpts.project ? projectPatternsDir() : globalPatternsDir();
        const listed = await listPatterns();
        const patterns = cmdOpts.project ? listed.project : listed.global;
        const updateOpts: Parameters<typeof updatePatterns>[0] = { targetDir: dir, patterns };
        if (cmdOpts.catalog) updateOpts.catalogBase = cmdOpts.catalog;
        const r = await updatePatterns(updateOpts);

        emit(r, () => {
          if (r.results.length === 0) return "(no patterns installed)\n";
          const lines: string[] = [];
          for (const res of r.results) {
            if (res.status === "updated") {
              lines.push(`  updated          ${res.name}`);
            } else if (res.status === "not_in_catalog") {
              lines.push(`  skipped          ${res.name}  (not in catalog)`);
            } else {
              lines.push(`  error            ${res.name}  (${res.error ?? "unknown error"})`);
            }
          }
          const updated = r.results.filter((x) => x.status === "updated").length;
          const skipped = r.results.filter((x) => x.status === "not_in_catalog").length;
          const errors = r.results.filter((x) => x.status === "error").length;
          const summary = [
            updated > 0 ? `${updated} updated` : null,
            skipped > 0 ? `${skipped} not in catalog` : null,
            errors > 0 ? `${errors} error${errors > 1 ? "s" : ""}` : null,
          ]
            .filter(Boolean)
            .join(", ");
          return lines.join("\n") + "\n" + summary + "\n";
        });
      } catch (e) {
        die(e);
      }
    });
}

function formatPatternsForHumans(r: Awaited<ReturnType<typeof listPatterns>>): string {
  const rows = r.effective;
  const headers = { name: "NAME", source: "SOURCE", path: "PATH" } as const;
  const cols: Array<keyof typeof headers> = ["name", "source", "path"];
  const widths: Record<string, number> = {};
  for (const c of cols) {
    widths[c] = Math.max(
      headers[c].length,
      ...rows.map((row) => String(row[c]).length)
    );
  }
  const SEP = "  ";
  const DIM = "\x1b[2m";
  const RESET = "\x1b[0m";
  const headerLine =
    DIM + cols.map((c) => headers[c].padEnd(widths[c] ?? 0)).join(SEP) + RESET;
  const rowLines = rows.map((row) =>
    cols.map((c) => String(row[c]).padEnd(widths[c] ?? 0)).join(SEP)
  );
  return [headerLine, ...rowLines].join("\n") + "\n";
}

// ---------------------------------------------------------------
// list-output formatter for TTY (aligned columns, smart timestamps)
// ---------------------------------------------------------------

function formatListForHumans(rows: DropSummary[]): string {
  const data = rows.map((r) => ({
    slug: r.slug,
    updated: humanTime(r.updated_at),
    title: truncate(r.title?.trim() || "—", 50),
    url: r.url,
  }));

  const headers = { slug: "SLUG", updated: "UPDATED", title: "TITLE", url: "URL" } as const;
  const cols: Array<keyof typeof headers> = ["slug", "updated", "title", "url"];

  const widths: Record<string, number> = {};
  for (const c of cols) {
    widths[c] = Math.max(headers[c].length, ...data.map((d) => d[c].length));
  }

  const SEP = "  ";
  const DIM = "\x1b[2m";
  const RESET = "\x1b[0m";

  const headerLine = DIM + cols.map((c) => headers[c].padEnd(widths[c] ?? 0)).join(SEP) + RESET;
  const rowLines = data.map((d) =>
    cols.map((c) => d[c].padEnd(widths[c] ?? 0)).join(SEP)
  );
  return [headerLine, ...rowLines].join("\n") + "\n";
}

function humanTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const ms = Math.max(0, Date.now() - t);
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (ms < min) return "just now";
  if (ms < hr) return `${Math.floor(ms / min)}m ago`;
  if (ms < day) return `${Math.floor(ms / hr)}h ago`;
  if (ms < 30 * day) return `${Math.floor(ms / day)}d ago`;
  // older: YYYY-MM-DD
  return iso.slice(0, 10);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

run().catch(die);
