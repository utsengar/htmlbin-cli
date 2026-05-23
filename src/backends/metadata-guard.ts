// Shared guards: non-cloud backends reject --metadata and --upsert at
// the boundary. Stable URLs there come from --pr <n>, so the metadata
// feature is cloud-only by design (see docs/superpowers/plans for the
// reasoning).

import { CliError } from "../errors.js";
import type { ListOpts, PublishOpts } from "../backend.js";

export function rejectMetadata(po: PublishOpts): void {
  if (po.metadata && Object.keys(po.metadata).length > 0) {
    throw new CliError(
      "invalid_arg",
      "--metadata is only supported on the cloud backend.",
      { hint: "Use --pr <n> for stable URLs on gh-pages and cloudflare." }
    );
  }
  if (po.upsert) {
    throw new CliError(
      "invalid_arg",
      "--upsert is only supported on the cloud backend.",
      { hint: "gh-pages and cloudflare slugs are already deterministic from --pr." }
    );
  }
}

export function rejectFilterMetadata(lo: ListOpts): void {
  if (lo.metadata && Object.keys(lo.metadata).length > 0) {
    throw new CliError(
      "invalid_arg",
      "--metadata filtering is only supported on the cloud backend."
    );
  }
}
