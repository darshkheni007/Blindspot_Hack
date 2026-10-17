import { readFileSync } from "node:fs";
import path from "node:path";

/** Bump when any prompt file changes; recorded on every analysis run and part of cache keys. */
export const PROMPT_VERSION = "v1";

const cache = new Map<string, string>();
export function loadPrompt(name: string): string {
  const key = `${PROMPT_VERSION}/${name}`;
  let text = cache.get(key);
  if (text === undefined) {
    text = readFileSync(path.join(process.cwd(), "prompts", PROMPT_VERSION, `${name}.md`), "utf8");
    cache.set(key, text);
  }
  return text;
}
