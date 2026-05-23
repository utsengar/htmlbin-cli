import { describe, it, expect } from "vitest";
import {
  rejectMetadata,
  rejectFilterMetadata,
} from "../../src/backends/metadata-guard.js";
import { CliError } from "../../src/errors.js";

describe("rejectMetadata (publish boundary)", () => {
  it("throws when metadata is non-empty", () => {
    expect(() => rejectMetadata({ file: "x", metadata: { k: "v" } })).toThrow(CliError);
  });

  it("throws when upsert is set", () => {
    expect(() => rejectMetadata({ file: "x", upsert: true })).toThrow(CliError);
  });

  it("noop when neither is set", () => {
    expect(() => rejectMetadata({ file: "x" })).not.toThrow();
  });

  it("noop on empty metadata object", () => {
    expect(() => rejectMetadata({ file: "x", metadata: {} })).not.toThrow();
  });

  it("attaches invalid_arg code", () => {
    try {
      rejectMetadata({ file: "x", metadata: { k: "v" } });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).code).toBe("invalid_arg");
    }
  });
});

describe("rejectFilterMetadata (list boundary)", () => {
  it("throws when metadata is non-empty", () => {
    expect(() => rejectFilterMetadata({ metadata: { k: "v" } })).toThrow(CliError);
  });

  it("noop when undefined or empty", () => {
    expect(() => rejectFilterMetadata({})).not.toThrow();
    expect(() => rejectFilterMetadata({ metadata: {} })).not.toThrow();
  });
});
