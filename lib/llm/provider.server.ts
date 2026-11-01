import "server-only";

/**
 * LLM provider selection. OpenAI preferred when both keys exist; an
 * explicit `LLM_PROVIDER` override wins. Returns null when nothing is
 * configured so callers degrade to cache/heuristics.
 */
export type LlmProvider = "openai" | "anthropic";

export function getAvailableLlmProvider(): LlmProvider | null {
  const override = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (override === "openai") return process.env.OPENAI_API_KEY ? "openai" : null;
  if (override === "anthropic") return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}
