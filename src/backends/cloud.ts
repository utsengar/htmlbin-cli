// Cloud backend — talks to htmlbin.dev API.

import { basename, extname } from "node:path";
import { CloudApi, type CloudDrop } from "../cloud/api.js";
import { deviceCodeLogin, requireToken } from "../cloud/auth.js";
import { loadHtml } from "../load.js";
import { CliError } from "../errors.js";
import type {
  Backend,
  DropSummary,
  ListOpts,
  PublishOpts,
  PublishResult,
  UpdateOpts,
  UpdateResult,
} from "../backend.js";

const MAX_HTML_BYTES = 2 * 1024 * 1024;

export interface CloudBackendOpts {
  apiUrl?: string;
  token?: string;
  cwd?: string;
}

export function createCloudBackend(opts: CloudBackendOpts = {}): Backend {
  const baseUrl = opts.apiUrl ?? "https://htmlbin.dev";

  let cached: CloudApi | null = null;
  async function api(): Promise<CloudApi> {
    if (cached) return cached;
    const token = opts.token ?? (await requireToken(opts.cwd)).token;
    cached = new CloudApi(baseUrl, token);
    return cached;
  }

  async function loadFile(file: string): Promise<{ filePath: string; html: string }> {
    const cwdOpt = opts.cwd === undefined ? {} : { cwd: opts.cwd };
    return loadHtml(file, { maxBytes: MAX_HTML_BYTES, ...cwdOpt });
  }

  return {
    name: "cloud",

    async publish(po: PublishOpts): Promise<PublishResult> {
      // Upsert branch: lookup-then-mutate keyed on metadata.
      if (po.upsert) {
        if (!po.metadata || Object.keys(po.metadata).length === 0) {
          throw new CliError(
            "invalid_arg",
            "--upsert requires at least one --metadata key=value.",
            {
              hint: "Add one or more --metadata flags so the lookup has something to match on.",
            }
          );
        }
        const res = await (await api()).listDrops({
          metadata: po.metadata,
          pageSize: 1,
        });
        if (res.data.length > 0) {
          const slug = res.data[0]!.slug;
          const { filePath, html } = await loadFile(po.file);
          const title = po.title?.trim() || defaultTitle(filePath);
          const body: Parameters<CloudApi["updateDrop"]>[1] = { html, title };
          if (po.description) body.description = po.description;
          body.metadata = po.metadata;
          const drop = await (await api()).updateDrop(slug, body);
          return { url: drop.url, slug: drop.slug, matched: true };
        }
        // fall through to POST
      }

      const { filePath, html } = await loadFile(po.file);
      const title = po.title?.trim() || defaultTitle(filePath);
      const body: Parameters<CloudApi["publish"]>[0] = { html, title };
      if (po.description) body.description = po.description;
      if (po.context) body.context = po.context;
      if (po.metadata && Object.keys(po.metadata).length > 0) {
        body.metadata = po.metadata;
      }
      const drop = await (await api()).publish(body);
      return { url: drop.url, slug: drop.slug };
    },

    async list(lo: ListOpts = {}): Promise<DropSummary[]> {
      const out: DropSummary[] = [];
      let page = 1;
      const pageSize = 100;
      const metadata =
        lo.metadata && Object.keys(lo.metadata).length > 0 ? lo.metadata : undefined;
      for (;;) {
        const params: Parameters<CloudApi["listDrops"]>[0] = {
          page,
          pageSize,
          sortBy: "updated_at",
        };
        if (metadata) params.metadata = metadata;
        const resp = await (await api()).listDrops(params);
        for (const d of resp.data) out.push(toSummary(d));
        if (page >= resp.pagination.total_pages) break;
        page += 1;
      }
      return out;
    },

    async delete(slug: string): Promise<void> {
      await (await api()).deleteDrop(slug);
    },

    async url(slug: string): Promise<string> {
      const drop = await (await api()).getDrop(slug);
      return drop.url;
    },

    async update(slug: string, uo: UpdateOpts): Promise<UpdateResult> {
      if (uo.metadata && uo.clearMetadata) {
        throw new CliError(
          "invalid_arg",
          "--metadata and --clear-metadata are mutually exclusive."
        );
      }
      const metadata = uo.clearMetadata ? {} : uo.metadata;

      if (uo.file) {
        const { html } = await loadFile(uo.file);
        const body: Parameters<CloudApi["updateDrop"]>[1] = { html };
        if (uo.title) body.title = uo.title;
        if (uo.description !== undefined) body.description = uo.description;
        if (metadata !== undefined) body.metadata = metadata;
        const drop = await (await api()).updateDrop(slug, body);
        return { url: drop.url, slug: drop.slug, mode: "put" };
      }

      const body: Parameters<CloudApi["patchDrop"]>[1] = {};
      if (uo.title) body.title = uo.title;
      if (uo.description !== undefined) body.description = uo.description;
      if (metadata !== undefined) body.metadata = metadata;
      if (Object.keys(body).length === 0) {
        throw new CliError(
          "invalid_arg",
          "update requires --file, --title, --description, --metadata, or --clear-metadata."
        );
      }
      const drop = await (await api()).patchDrop(slug, body);
      return { url: drop.url, slug: drop.slug, mode: "patch" };
    },

    async login(): Promise<void> {
      await deviceCodeLogin({ apiUrl: baseUrl, cwd: opts.cwd, label: "@htmlbin/cli" });
    },
  };
}

function toSummary(d: CloudDrop): DropSummary {
  const out: DropSummary = {
    slug: d.slug,
    url: d.url,
    updated_at: new Date(d.updated_at).toISOString(),
  };
  if (d.title) out.title = d.title;
  if (d.metadata && Object.keys(d.metadata).length > 0) out.metadata = d.metadata;
  return out;
}

function defaultTitle(filePath: string): string {
  const base = basename(filePath, extname(filePath));
  return base || "untitled";
}
