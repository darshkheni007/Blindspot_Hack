import { env } from "../../env";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { LLMProvider } from "./types";

export function getProvider(): LLMProvider {
  if (env.analysisProvider === "anthropic") {
    if (!env.anthropicKey) throw new Error("ANALYSIS_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set");
    return new AnthropicProvider(env.anthropicKey, env.anthropicModel);
  }
  return new MockProvider();
}
export * from "./types";
