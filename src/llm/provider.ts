import { CliError } from "../errors.js";

export interface LLMProvider {
  baseURL: string;
  apiKey: string;
  model: string;
}

export function resolveProvider(): LLMProvider {
  const baseURL = process.env.HTMLBIN_LLM_BASE_URL?.trim();
  const model = process.env.HTMLBIN_LLM_MODEL?.trim();

  if (!baseURL || !model) {
    throw new CliError(
      "no_llm_provider",
      "HTMLBIN_LLM_BASE_URL and HTMLBIN_LLM_MODEL must be set to use generate.",
      {
        hint: "Any OpenAI-compatible endpoint works. Example:\n" +
          "  HTMLBIN_LLM_BASE_URL=https://api.openai.com/v1\n" +
          "  HTMLBIN_LLM_MODEL=gpt-4o-mini\n" +
          "  HTMLBIN_LLM_API_KEY=<your key>",
      }
    );
  }

  return {
    baseURL: baseURL.replace(/\/$/, ""),
    apiKey: process.env.HTMLBIN_LLM_API_KEY ?? "",
    model,
  };
}
