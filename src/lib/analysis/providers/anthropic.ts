import Anthropic from "@anthropic-ai/sdk";
import { sleep } from "../../utils";
import { ProviderUnavailableError, type GenerateRequest, type LLMProvider } from "./types";

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const MAX_INPUT_CHARS = 450_000;

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  constructor(apiKey: string, readonly model: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 0, timeout: 120_000 });
  }

  private async call(system: string, user: string): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await this.client.messages.create({
          model: this.model,
          max_tokens: 8000,
          temperature: 0.2,
          system,
          messages: [{ role: "user", content: user }],
        });
        return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number }).status;
        const retryable = status === undefined || RETRYABLE.has(status);
        if (!retryable) break;
        await sleep(800 * 2 ** attempt + Math.random() * 300);
      }
    }
    // Never include prompt/document content in the error.
    throw new ProviderUnavailableError(
      `The analysis provider could not be reached (${(lastErr as { status?: number })?.status ?? "network error"}). Your documents are saved; try again in a few minutes.`,
    );
  }

  async generate<T>(req: GenerateRequest<T>): Promise<T> {
    let payload = JSON.stringify(req.input);
    if (payload.length > MAX_INPUT_CHARS) payload = payload.slice(0, MAX_INPUT_CHARS) + '..."truncated"';
    const user = `${req.prompt}\n\nINPUT (JSON):\n${payload}`;
    let text = await this.call(req.system, user);
    for (let repair = 0; ; repair++) {
      try {
        return req.schema.parse(extractJson(text));
      } catch (e) {
        if (repair >= 1) throw new ProviderUnavailableError("The analysis provider returned an unreadable answer twice. Please run the analysis again.");
        text = await this.call(
          req.system,
          `${user}\n\nYour previous answer was not valid for the required JSON format (${(e as Error).message.slice(0, 200)}). Reply again with only the corrected JSON object.`,
        );
      }
    }
  }
}
