import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveProvider } from "../src/llm/provider.js";
import { CliError } from "../src/errors.js";

afterEach(() => {
  delete process.env.HTMLBIN_LLM_BASE_URL;
  delete process.env.HTMLBIN_LLM_MODEL;
  delete process.env.HTMLBIN_LLM_API_KEY;
});

describe("resolveProvider", () => {
  it("throws no_llm_provider when env vars are missing", () => {
    expect(() => resolveProvider()).toThrow(CliError);
    try {
      resolveProvider();
    } catch (e) {
      expect((e as CliError).code).toBe("no_llm_provider");
    }
  });

  it("throws when only base URL is set", () => {
    process.env.HTMLBIN_LLM_BASE_URL = "https://api.openai.com/v1";
    expect(() => resolveProvider()).toThrow(CliError);
  });

  it("throws when only model is set", () => {
    process.env.HTMLBIN_LLM_MODEL = "gpt-4o-mini";
    expect(() => resolveProvider()).toThrow(CliError);
  });

  it("resolves when both URL and model are set", () => {
    process.env.HTMLBIN_LLM_BASE_URL = "https://api.openai.com/v1";
    process.env.HTMLBIN_LLM_MODEL = "gpt-4o-mini";
    const p = resolveProvider();
    expect(p.baseURL).toBe("https://api.openai.com/v1");
    expect(p.model).toBe("gpt-4o-mini");
    expect(p.apiKey).toBe("");
  });

  it("includes api key when set", () => {
    process.env.HTMLBIN_LLM_BASE_URL = "https://api.openai.com/v1";
    process.env.HTMLBIN_LLM_MODEL = "gpt-4o-mini";
    process.env.HTMLBIN_LLM_API_KEY = "sk-test";
    const p = resolveProvider();
    expect(p.apiKey).toBe("sk-test");
  });

  it("strips trailing slash from base URL", () => {
    process.env.HTMLBIN_LLM_BASE_URL = "http://localhost:11434/v1/";
    process.env.HTMLBIN_LLM_MODEL = "llama3.2";
    const p = resolveProvider();
    expect(p.baseURL).toBe("http://localhost:11434/v1");
  });

  it("works with Ollama-style local endpoint and no key", () => {
    process.env.HTMLBIN_LLM_BASE_URL = "http://localhost:11434/v1";
    process.env.HTMLBIN_LLM_MODEL = "llama3.2";
    const p = resolveProvider();
    expect(p.apiKey).toBe("");
  });
});

describe("exitCodeFor llm codes", () => {
  it("maps no_llm_provider to 9", async () => {
    const { exitCodeFor } = await import("../src/errors.js");
    expect(exitCodeFor("no_llm_provider")).toBe(9);
  });

  it("maps llm_error to 8", async () => {
    const { exitCodeFor } = await import("../src/errors.js");
    expect(exitCodeFor("llm_error")).toBe(8);
  });
});
