// Cloudflare Pages + Access backend.

import { CliError } from "../errors.js";
import { loadHtml } from "../load.js";
import type {
  Backend,
  DropSummary,
  ListOpts,
  PublishOpts,
  PublishResult,
  SetupResult,
} from "../backend.js";
import { rejectMetadata, rejectFilterMetadata } from "./metadata-guard.js";
import { CloudflareApi } from "../cf/api.js";
import { uploadAssets } from "../cf/upload.js";
import { setupCloudflare, type CfSetupOpts } from "../cf/setup.js";

const MAX_HTML_BYTES = 25 * 1024 * 1024;

export interface CloudflareBackendOpts {
  apiToken?: string;
  accountId?: string;
  project?: string;
  productionBranch?: string;
  /** Setup-only flags passed through from CLI. */
  setupIdp?: string[];
  setupEmailDomain?: string[];
  setupEmail?: string[];
}

export function createCloudflareBackend(opts: CloudflareBackendOpts = {}): Backend {
  const apiToken = opts.apiToken ?? process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = opts.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const project = opts.project ?? process.env.CLOUDFLARE_PAGES_PROJECT?.trim();

  function api(): CloudflareApi {
    if (!apiToken) {
      throw new CliError("cloudflare_token_missing", "No Cloudflare API token.", {
        hint: "Set $CLOUDFLARE_API_TOKEN (scopes: Pages: edit, Access: edit on a specific account).",
      });
    }
    if (!accountId) {
      throw new CliError("cloudflare_account_missing", "No Cloudflare account id.", {
        hint: "Set $CLOUDFLARE_ACCOUNT_ID.",
      });
    }
    return new CloudflareApi(apiToken, accountId);
  }

  function requireProject(): string {
    if (!project) {
      throw new CliError("cloudflare_project_missing", "No Cloudflare Pages project name.", {
        hint: "Pass --project <name> or set $CLOUDFLARE_PAGES_PROJECT.",
      });
    }
    return project;
  }

  function aliasFor(po: PublishOpts): string {
    if (!po.slug) {
      throw new CliError(
        "invalid_arg",
        "--slug is required on the cloudflare backend.",
        {
          hint: "Pass --slug pr-${PR_NUMBER} (or any deterministic name); the slug becomes the deployment alias / subdomain.",
        }
      );
    }
    return po.slug.replace(/[^A-Za-z0-9-]/g, "-").toLowerCase();
  }

  return {
    name: "cloudflare",

    async publish(po: PublishOpts): Promise<PublishResult> {
      rejectMetadata(po);
      const client = api();
      const proj = requireProject();
      const { html } = await loadHtml(po.file, { maxBytes: MAX_HTML_BYTES });
      const alias = aliasFor(po);

      // Ensure the project exists (cheap idempotent check).
      let p = await client.getProject(proj);
      if (!p) {
        p = await client.createProject(proj, opts.productionBranch ?? "main");
      }

      // Single-file deployment: the HTML at the alias root.
      const assets = [{ path: "/index.html", content: html }];
      const upload = await uploadAssets(client, proj, assets);
      await client.createDeployment(proj, upload.manifest, alias);

      return {
        url: `https://${alias}.${p.subdomain}`,
        slug: alias,
        note: "Cloudflare Pages serves the URL within seconds. Access gates it if configured.",
      };
    },

    async list(lo: ListOpts = {}): Promise<DropSummary[]> {
      rejectFilterMetadata(lo);
      const client = api();
      const proj = requireProject();
      const deps = await client.listDeployments(proj);
      const seen = new Set<string>();
      const out: DropSummary[] = [];
      // Walk newest-first; one row per unique alias.
      for (const d of deps) {
        for (const a of d.aliases ?? []) {
          if (seen.has(a)) continue;
          seen.add(a);
          const p = await client.getProject(proj);
          out.push({
            slug: a,
            url: `https://${a}.${p?.subdomain ?? "pages.dev"}`,
            updated_at: d.created_on,
          });
        }
      }
      return out;
    },

    async delete(slugArg: string): Promise<void> {
      const client = api();
      const proj = requireProject();
      const deps = await client.listDeployments(proj);
      const matching = deps.filter((d) => (d.aliases ?? []).includes(slugArg));
      if (matching.length === 0) {
        throw new CliError("not_found", `No deployments aliased to ${slugArg} in ${proj}.`);
      }
      for (const d of matching) {
        await client.deleteDeployment(proj, d.id);
      }
    },

    async url(slugArg: string): Promise<string> {
      const client = api();
      const proj = requireProject();
      const p = await client.getProject(proj);
      return `https://${slugArg}.${p?.subdomain ?? "pages.dev"}`;
    },

    async setup(): Promise<SetupResult> {
      const client = api();
      const proj = requireProject();
      const cfOpts: CfSetupOpts = { project: proj };
      if (opts.productionBranch) cfOpts.productionBranch = opts.productionBranch;
      if (opts.setupIdp) cfOpts.idp = opts.setupIdp;
      if (opts.setupEmailDomain) cfOpts.emailDomain = opts.setupEmailDomain;
      if (opts.setupEmail) cfOpts.email = opts.setupEmail;
      return setupCloudflare(client, cfOpts);
    },
  };
}
