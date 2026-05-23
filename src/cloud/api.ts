// Thin client around the htmlbin.dev JSON API.
// Surface the API's snake_case error codes directly; the CLI's CliError
// uses the same vocabulary.

import { request } from "undici";
import { CliError, type CliErrorCode } from "../errors.js";
import { userAgent } from "../useragent.js";
import { isDebug } from "../debug.js";

export interface CloudDrop {
  slug: string;
  title: string;
  description?: string | null;
  url: string;
  raw_url: string;
  locked: boolean;
  latest_version: number;
  view_count: number;
  metadata: Record<string, string>;
  created_at: number;
  updated_at: number;
}

export interface ListResponse {
  data: CloudDrop[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    sort_by: string;
    sort_order: string;
  };
}

export class CloudApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  publish(body: {
    html: string;
    title: string;
    description?: string;
    passcode?: string;
    context?: string;
    metadata?: Record<string, string>;
  }): Promise<CloudDrop> {
    return this.json<CloudDrop>("POST", "/api/drops", body);
  }

  getDrop(slug: string): Promise<CloudDrop> {
    return this.json<CloudDrop>("GET", `/api/drops/${encodeURIComponent(slug)}`);
  }

  listDrops(params: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
    metadata?: Record<string, string>;
  } = {}): Promise<ListResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.sortBy) qs.set("sortBy", params.sortBy);
    if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
    for (const [k, v] of Object.entries(params.metadata ?? {})) {
      qs.append(`metadata.${k}`, v);
    }
    const q = qs.toString();
    return this.json<ListResponse>("GET", `/api/drops${q ? "?" + q : ""}`);
  }

  deleteDrop(slug: string): Promise<void> {
    return this.json<void>("DELETE", `/api/drops/${encodeURIComponent(slug)}`, undefined, true);
  }

  /**
   * PUT — mint a new version. Replaces HTML and any of the optional fields
   * passed. Metadata, when present, replaces the entire map (per the spec's
   * replace-whole semantics).
   */
  updateDrop(
    slug: string,
    body: {
      html: string;
      title?: string;
      description?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<CloudDrop> {
    return this.json<CloudDrop>("PUT", `/api/drops/${encodeURIComponent(slug)}`, body);
  }

  /**
   * PATCH — mutate fields without minting a new version. Omitting a field
   * leaves it untouched; sending `metadata: {}` clears the map.
   */
  patchDrop(
    slug: string,
    body: {
      title?: string;
      description?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<CloudDrop> {
    return this.json<CloudDrop>("PATCH", `/api/drops/${encodeURIComponent(slug)}`, body);
  }

  private async json<T>(
    method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH",
    path: string,
    body?: unknown,
    expectNoContent = false
  ): Promise<T> {
    const url = this.baseUrl.replace(/\/$/, "") + path;
    let res;
    try {
      res = await request(url, {
        method,
        headers: {
          "user-agent": userAgent(),
          authorization: `Bearer ${this.token}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new CliError("network_error", `Network error calling ${url}`, { cause: e });
    }

    if (expectNoContent && res.statusCode === 204) {
      // drain
      await res.body.text();
      return undefined as T;
    }

    const text = await res.body.text();
    let parsed: unknown;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        const safeDetails = isDebug()
          ? { status: res.statusCode, body: text.slice(0, 400) }
          : { status: res.statusCode, body_length: text.length };
        if (res.statusCode >= 400) {
          throw new CliError(
            "network_error",
            `Non-JSON error response from ${url} (HTTP ${res.statusCode})`,
            { details: safeDetails }
          );
        }
        throw new CliError("network_error", `Non-JSON response from ${url}`, {
          details: safeDetails,
        });
      }
    }

    if (res.statusCode >= 400) {
      const err = (parsed as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | undefined)?.error;
      const code = (err?.code ?? "network_error") as CliErrorCode;
      throw new CliError(code, err?.message ?? `HTTP ${res.statusCode}`, {
        details: { status: res.statusCode, ...(err?.details ?? {}) },
      });
    }

    return parsed as T;
  }
}
