import { CliError } from "../errors.js";
import { resolveProvider } from "./provider.js";
import type { ResolvedPattern } from "./pattern-resolve.js";

const BASE_SYSTEM =
  "You are an HTML generator. Return only a complete, valid HTML document. " +
  "No markdown. No code fences. No explanation. " +
  "Start immediately with <!DOCTYPE html>.";

export async function generateHtml(
  prompt: string,
  data?: string,
  pattern?: ResolvedPattern
): Promise<string> {
  const { baseURL, apiKey, model } = resolveProvider();

  const systemContent = pattern
    ? `${BASE_SYSTEM}\n\nUse the following pattern as your guide for structure, content, and quality:\n\n${pattern.body}`
    : BASE_SYSTEM;

  const userContent = data ? `${prompt}\n\n${data}` : prompt;

  let res: Response;
  try {
    res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new CliError("llm_error", `LLM request failed: ${msg}`, { cause: err });
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new CliError("llm_error", `LLM returned non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const msg = (body as any)?.error?.message ?? `HTTP ${res.status}`;
    throw new CliError("llm_error", `LLM provider error: ${msg}`, {
      details: { status: res.status, code: (body as any)?.error?.code },
    });
  }

  const content: unknown = (body as any)?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new CliError("llm_error", "LLM returned an empty or unexpected response shape");
  }

  return extractHtml(content);
}

function extractHtml(raw: string): string {
  // Strip markdown code fences — some models add them despite instructions.
  const stripped = raw
    .replace(/^```(?:html)?\r?\n?/i, "")
    .replace(/\r?\n?```\s*$/, "")
    .trim();

  if (!stripped.toLowerCase().startsWith("<!doctype") && !stripped.startsWith("<html")) {
    throw new CliError(
      "llm_error",
      "LLM response does not appear to be an HTML document.",
      { hint: "Try a more specific prompt, or check that your model supports HTML generation." }
    );
  }

  return stripped;
}
