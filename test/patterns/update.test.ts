import { describe, expect, it, vi, beforeEach } from "vitest";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliError } from "../../src/errors.js";
import { parseAndValidatePattern } from "../../src/patterns/schema.js";
import { writePattern } from "../../src/patterns/install.js";
import { updatePatterns } from "../../src/patterns/update.js";

vi.mock("../../src/patterns/sources.js", () => ({
  fetchSource: vi.fn(),
  resolveSource: vi.fn(),
}));

// imported after mock so vi.mocked() wraps the stub
import { fetchSource } from "../../src/patterns/sources.js";

const PATTERN_A = `---
name: foo-bar
triggers:
  - go
---

## Heading

Some content.
`;

const PATTERN_A_V2 = `---
name: foo-bar
triggers:
  - go
  - run
---

## Heading

Updated content.
`;

const PATTERN_B = `---
name: baz-qux
triggers:
  - check
---

## Heading

Content.
`;

async function makeDir(): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), "htmlbin-update-"));
  const dir = join(base, "patterns");
  await mkdir(dir, { recursive: true });
  return dir;
}

describe("updatePatterns", () => {
  beforeEach(() => {
    vi.mocked(fetchSource).mockReset();
  });

  it("updates a pattern when the catalog returns fresh content", async () => {
    const dir = await makeDir();
    const parsed = parseAndValidatePattern(PATTERN_A);
    const installed = await writePattern(dir, parsed, false);

    vi.mocked(fetchSource).mockResolvedValueOnce(PATTERN_A_V2);

    const result = await updatePatterns({
      targetDir: dir,
      patterns: [{ name: "foo-bar", path: installed.path }],
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.status).toBe("updated");
    expect(result.results[0]?.name).toBe("foo-bar");
  });

  it("records not_in_catalog when catalog returns 404", async () => {
    const dir = await makeDir();
    const parsed = parseAndValidatePattern(PATTERN_A);
    const installed = await writePattern(dir, parsed, false);

    vi.mocked(fetchSource).mockRejectedValueOnce(
      new CliError("not_found", `No pattern named "foo-bar" in the catalog.`)
    );

    const result = await updatePatterns({
      targetDir: dir,
      patterns: [{ name: "foo-bar", path: installed.path }],
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.status).toBe("not_in_catalog");
  });

  it("records error on network failure and continues to next pattern", async () => {
    const dir = await makeDir();
    const parsedA = parseAndValidatePattern(PATTERN_A);
    const installedA = await writePattern(dir, parsedA, false);
    const parsedB = parseAndValidatePattern(PATTERN_B);
    const installedB = await writePattern(dir, parsedB, false);

    vi.mocked(fetchSource)
      .mockRejectedValueOnce(new CliError("network_error", "timeout"))
      .mockResolvedValueOnce(PATTERN_B);

    const result = await updatePatterns({
      targetDir: dir,
      patterns: [
        { name: "foo-bar", path: installedA.path },
        { name: "baz-qux", path: installedB.path },
      ],
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.status).toBe("error");
    expect(result.results[0]?.error).toBeDefined();
    expect(result.results[1]?.status).toBe("updated");
  });

  it("returns empty results when no patterns are installed", async () => {
    const dir = await makeDir();

    const result = await updatePatterns({ targetDir: dir, patterns: [] });

    expect(result.results).toHaveLength(0);
    expect(result.target_dir).toBe(dir);
  });

  it("uses a custom catalogBase when provided", async () => {
    const dir = await makeDir();
    const parsed = parseAndValidatePattern(PATTERN_A);
    const installed = await writePattern(dir, parsed, false);

    vi.mocked(fetchSource).mockResolvedValueOnce(PATTERN_A_V2);

    await updatePatterns({
      targetDir: dir,
      patterns: [{ name: "foo-bar", path: installed.path }],
      catalogBase: "https://custom.example/patterns",
    });

    const call = vi.mocked(fetchSource).mock.calls[0]?.[0];
    expect(call).toMatchObject({
      kind: "catalog",
      url: "https://custom.example/patterns/foo-bar.md",
    });
  });
});
