// Help banner + Sentry-style top-level help formatter, used when the user
// runs `htmlbin` (no args) or `htmlbin --help`. The ASCII logo and ANSI
// colors are gated on TTY + NO_COLOR, so agents (whose stdout is piped)
// see a plain-text version. Sub-commands keep commander's default help.

const LOGO = [
  "██╗  ██╗████████╗███╗   ███╗██╗     ██████╗ ██╗███╗   ██╗",
  "██║  ██║╚══██╔══╝████╗ ████║██║     ██╔══██╗██║████╗  ██║",
  "███████║   ██║   ██╔████╔██║██║     ██████╔╝██║██╔██╗ ██║",
  "██╔══██║   ██║   ██║╚██╔╝██║██║     ██╔══██╗██║██║╚██╗██║",
  "██║  ██║   ██║   ██║ ╚═╝ ██║███████╗██████╔╝██║██║ ╚████║",
  "╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝╚══════╝╚═════╝ ╚═╝╚═╝  ╚═══╝",
] as const;

// One row per command group, with the subcommand verbs pipe-separated.
const COMMANDS: ReadonlyArray<readonly [string, string]> = [
  ["$ htmlbin publish <file>",                       "Publish an HTML file and print the URL"],
  ["$ htmlbin serve <path> | --status | --stop",    "Run a local preview with live reload"],
  ["$ htmlbin list | url <slug> | delete <slug>",   "Browse and manage published drops"],
  ["$ htmlbin patterns list | init | add <source>", "Install + manage local patterns"],
  ["$ htmlbin login",                                "Sign in to htmlbin.dev (cloud backend)"],
  ["$ htmlbin setup --to <backend>",                "One-time backend setup (gh-pages, cloudflare)"],
];

const FLAGS: ReadonlyArray<readonly [string, string]> = [
  ["--to <backend>",     "Backend: cloud | gh-pages | cloudflare"],
  ["--output <format>",  "text | json (auto-flips to json in agent contexts)"],
  ["--debug",            "Include upstream response bodies in errors"],
  ["--help",             "Show help for a command"],
  ["--version",          "Show version"],
];

const ENV_VARS: ReadonlyArray<readonly [string, string]> = [
  ["HTMLBIN_TOKEN",                     "Cloud API token (overrides ./.htmlbin/token)"],
  ["HTMLBIN_BACKEND",                   "Default backend (overrides .htmlbin/config)"],
  ["HTMLBIN_DEBUG",                     "Include upstream response bodies in error details"],
  ["GITHUB_TOKEN",                      "Auth for the gh-pages backend"],
  ["CLOUDFLARE_API_TOKEN",              "Auth for the cloudflare backend"],
  ["CLAUDE_CODE / CURSOR_AGENT / ...",  "When set, --output flips to json by default"],
  ["NO_COLOR",                          "Disable colored output (no-color.org)"],
];

const RED  = "\x1b[31m";
const PINK = "\x1b[38;5;204m";
const DIM  = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function useColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return !!process.stdout.isTTY;
}

function paint(s: string, code: string): string {
  return useColor() ? code + s + RESET : s;
}

function row(left: string, right: string, leftWidth: number): string {
  return "  " + left.padEnd(leftWidth) + paint(right, DIM);
}

export function formatRootHelp(version: string): string {
  const lines: string[] = [];

  // Banner — only when we have color. Otherwise the plain text help below
  // stands alone (cleaner for agents and piped output).
  if (useColor()) {
    lines.push("");
    for (const l of LOGO) lines.push(paint(l, RED));
    lines.push("");
  }

  // Tagline — keep the red < > brackets that anchor the brand.
  lines.push(
    "  The command-line interface for " +
    paint("<", RED) + "htmlbin" + paint(">", RED) +
    " — publish HTML, get a URL."
  );
  lines.push("");

  // Commands
  const cmdW = Math.max(...COMMANDS.map(([c]) => c.length)) + 4;
  for (const [c, d] of COMMANDS) lines.push(row(c, d, cmdW));
  lines.push("");

  // Flags
  lines.push(paint("Flags:", BOLD));
  const flagW = Math.max(...FLAGS.map(([f]) => f.length)) + 4;
  for (const [f, d] of FLAGS) lines.push(row(f, d, flagW));
  lines.push("");

  // Environment variables
  lines.push(paint("Environment Variables:", BOLD));
  const envW = Math.max(...ENV_VARS.map(([e]) => e.length)) + 4;
  for (const [e, d] of ENV_VARS) lines.push(row(e, d, envW));
  lines.push("");

  // Try-this hint + Learn more footer
  lines.push("  try:  " + paint("htmlbin serve report.html", PINK));
  lines.push("");
  lines.push("  Learn more at " + paint("https://htmlbin.dev", RED) +
             "   " + paint("(v" + version + ")", DIM));
  lines.push("");

  return lines.join("\n");
}
