import type { ZodType } from "zod";

export type TaskId = "assumptions" | "checklist" | "contradictions" | "quantitative" | "questions" | "verify";

export interface GenerateRequest<T> {
  task: TaskId;
  system: string;
  /** Instructions (from /prompts). */
  prompt: string;
  /** Structured payload. LLM providers receive it as JSON; the mock provider reads it directly. */
  input: unknown;
  schema: ZodType<T>;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generate<T>(req: GenerateRequest<T>): Promise<T>;
}

/** Raised when the provider cannot be reached or keeps failing; the run shows a friendly message. */
export class ProviderUnavailableError extends Error {
  constructor(message = "The analysis provider is unavailable right now.") {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}
