// The Backend interface. Every destination the CLI can publish to
// implements this. The CLI core never reaches past these methods.

export type BackendName = "cloud" | "gh-pages" | "cloudflare";

export interface PublishOpts {
  /** Absolute or relative path to the HTML file to publish. */
  file: string;
  /** Title for the drop (cloud backend only). */
  title?: string;
  /** Description (cloud backend only). */
  description?: string;
  /** PR number, used for gh-pages / cloudflare slug. */
  pr?: number;
  /** Explicit slug override. */
  slug?: string;
  /** Owner-side tag bag (cloud only). gh-pages/cloudflare reject. */
  metadata?: Record<string, string>;
  /**
   * Lookup-then-mutate. When true, the backend looks up an existing drop
   * matching `metadata`, PUTs to its slug if found, POSTs otherwise.
   * Requires at least one metadata entry. Cloud only.
   */
  upsert?: boolean;
  /**
   * Free-form context for the drop — e.g. the prompt used to generate it.
   * Cloud only; other backends ignore it.
   */
  context?: string;
}

export interface UpdateOpts {
  /** New HTML body. Present → PUT (new version); absent → PATCH. */
  file?: string;
  title?: string;
  description?: string;
  /** Replace the metadata map. Omit to leave untouched. */
  metadata?: Record<string, string>;
  /** Explicit clear. Mutually exclusive with `metadata`. */
  clearMetadata?: boolean;
}

export interface ListOpts {
  metadata?: Record<string, string>;
}

export interface DropSummary {
  slug: string;
  url: string;
  updated_at: string;
  /** Title — populated by backends that carry it (cloud); undefined elsewhere. */
  title?: string;
  metadata?: Record<string, string>;
}

export interface PublishResult {
  url: string;
  slug: string;
  /** True when --upsert matched an existing drop. */
  matched?: boolean;
  /** Optional human-readable note (e.g. "rebuild may take ~60s"). */
  note?: string;
}

export interface UpdateResult {
  url: string;
  slug: string;
  /** "put" → new version; "patch" → fields-only mutation. */
  mode: "put" | "patch";
}

export interface SetupResult {
  /** Lines of human-readable instructions to print to stdout. */
  instructions: string[];
}

export interface Backend {
  readonly name: BackendName;

  publish(opts: PublishOpts): Promise<PublishResult>;
  list(opts?: ListOpts): Promise<DropSummary[]>;
  delete(slug: string): Promise<void>;
  url(slug: string): Promise<string>;

  // Optional capabilities — backends opt in.
  update?(slug: string, opts: UpdateOpts): Promise<UpdateResult>;
  setup?(): Promise<SetupResult>;
  login?(): Promise<void>;
}
