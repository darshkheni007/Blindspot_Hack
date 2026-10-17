import { localAssumptions, type AssumptionsInput } from "../detectors/assumptions";
import { localChecklist, type ChecklistInput } from "../detectors/checklist";
import { localContradictions, type CorpusInput } from "../detectors/contradictions";
import { localQuantitative } from "../detectors/quantitative";
import { localQuestions, type QuestionsInput } from "../detectors/questions";
import type { GenerateRequest, LLMProvider } from "./types";

/**
 * Offline provider. It is NOT a canned response: it runs rule-based detectors over the real
 * document text, so evidence quotes are genuine and every UI path works without an API key.
 * Quality is lower than a real model (keyword/pattern matching only).
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock";
  readonly model = "mock-rules-v1";
  constructor(private now: () => Date = () => new Date()) {}

  async generate<T>(req: GenerateRequest<T>): Promise<T> {
    const now = this.now();
    let out: unknown;
    switch (req.task) {
      case "assumptions": {
        const input = req.input as AssumptionsInput;
        out = localAssumptions(input, { project: input.project, now });
        break;
      }
      case "checklist": {
        const input = req.input as ChecklistInput;
        out = localChecklist(input, { project: input.project, now });
        break;
      }
      case "contradictions": {
        const input = req.input as CorpusInput;
        out = { findings: localContradictions(input, { project: input.project, now }) };
        break;
      }
      case "quantitative": {
        const input = req.input as CorpusInput;
        out = { findings: localQuantitative(input, { project: input.project, now }) };
        break;
      }
      case "questions":
        out = localQuestions(req.input as QuestionsInput);
        break;
      case "verify":
        // Refutation by a model needs a model; the programmatic checks in verifier.ts still run.
        out = { verdict: "supported", reason: "Mock provider performs no semantic refutation." };
        break;
    }
    return req.schema.parse(out);
  }
}
