import { describe, expect, it } from "vitest";
import { CliError } from "../src/errors.js";
import { parseGitRemote, parseOwnerName } from "../src/gh/repo.js";

describe("parseGitRemote", () => {
  it("parses SSH form", () => {
    expect(parseGitRemote("git@github.com:utsengar/htmlbin-cli.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin-cli",
    });
  });

  it("parses SSH form without .git", () => {
    expect(parseGitRemote("git@github.com:utsengar/htmlbin-cli")).toEqual({
      owner: "utsengar",
      name: "htmlbin-cli",
    });
  });

  it("parses ssh:// form", () => {
    expect(parseGitRemote("ssh://git@github.com/utsengar/htmlbin-cli.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin-cli",
    });
  });

  it("parses HTTPS form", () => {
    expect(parseGitRemote("https://github.com/utsengar/htmlbin-cli.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin-cli",
    });
  });

  it("parses HTTPS form without .git", () => {
    expect(parseGitRemote("https://github.com/utsengar/htmlbin-cli")).toEqual({
      owner: "utsengar",
      name: "htmlbin-cli",
    });
  });

  it("parses HTTPS form with auth prefix", () => {
    expect(parseGitRemote("https://x-access-token:abc@github.com/utsengar/htmlbin-cli.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin-cli",
    });
  });

  it("parses git:// form", () => {
    expect(parseGitRemote("git://github.com/utsengar/htmlbin-cli.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin-cli",
    });
  });

  it("trims trailing slash", () => {
    expect(parseGitRemote("https://github.com/utsengar/htmlbin-cli/")).toEqual({
      owner: "utsengar",
      name: "htmlbin-cli",
    });
  });

  it("throws on unparseable URL", () => {
    expect(() => parseGitRemote("https://gitlab.com/x/y.git")).toThrow(CliError);
    expect(() => parseGitRemote("not a url")).toThrow(CliError);
  });
});

describe("parseOwnerName", () => {
  it("parses owner/name", () => {
    expect(parseOwnerName("foo/bar")).toEqual({ owner: "foo", name: "bar" });
  });

  it("trims whitespace", () => {
    expect(parseOwnerName("  foo/bar  ")).toEqual({ owner: "foo", name: "bar" });
  });

  it("throws when missing slash", () => {
    expect(() => parseOwnerName("foobar")).toThrow(CliError);
  });

  it("throws when extra slashes", () => {
    expect(() => parseOwnerName("a/b/c")).toThrow(CliError);
  });
});

