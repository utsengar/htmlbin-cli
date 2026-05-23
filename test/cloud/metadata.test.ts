import { describe, it, expect } from "vitest";
import {
  parseMetadata,
  validateLocally,
  encodeFilterParams,
} from "../../src/cloud/metadata.js";
import { CliError } from "../../src/errors.js";

describe("parseMetadata", () => {
  it("parses k=v pairs", () => {
    expect(parseMetadata(["repo=u/r", "pr=42"])).toEqual({ repo: "u/r", pr: "42" });
  });

  it("allows empty values", () => {
    expect(parseMetadata(["k="])).toEqual({ k: "" });
  });

  it("preserves = inside values", () => {
    expect(parseMetadata(["url=https://x.com/?a=b"])).toEqual({
      url: "https://x.com/?a=b",
    });
  });

  it("rejects empty key", () => {
    expect(() => parseMetadata(["=v"])).toThrow(CliError);
  });

  it("rejects missing =", () => {
    expect(() => parseMetadata(["foo"])).toThrow(CliError);
  });

  it("later key wins on collision", () => {
    expect(parseMetadata(["k=1", "k=2"])).toEqual({ k: "2" });
  });
});

describe("validateLocally", () => {
  it("accepts up to 10 keys", () => {
    const m = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, "v"]));
    expect(() => validateLocally(m)).not.toThrow();
  });

  it("rejects 11 keys", () => {
    const m = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, "v"]));
    expect(() => validateLocally(m)).toThrow(CliError);
  });
});

describe("encodeFilterParams", () => {
  it("URL-encodes both key and value", () => {
    expect(encodeFilterParams({ repo: "u/r" })).toBe("metadata.repo=u%2Fr");
  });

  it("joins multiple pairs with &", () => {
    expect(encodeFilterParams({ a: "1", b: "2" })).toBe("metadata.a=1&metadata.b=2");
  });

  it("returns empty string for empty object", () => {
    expect(encodeFilterParams({})).toBe("");
  });
});
