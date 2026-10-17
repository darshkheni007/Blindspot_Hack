import { z } from "zod";
import construction from "./construction.json";
import dataMl from "./data_ml.json";
import finance from "./finance.json";
import healthcare from "./healthcare.json";
import other from "./other.json";
import software from "./software.json";
import { CATEGORIES, type ChecklistItem } from "../types";

const ItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.string(),
  anchors: z.array(z.string()),
  keywords: z.array(z.string()).min(1),
  title: z.string(),
  why: z.string(),
  question: z.string(),
  owner: z.string(),
  nextStep: z.string(),
  disproof: z.string(),
  category: z.enum(CATEGORIES),
  factors: z.object({ impact: z.number(), likelihood: z.number(), irreversibility: z.number(), proximity: z.number(), cost: z.number() }),
  justifications: z.object({ impact: z.string(), irreversibility: z.string(), cost: z.string() }),
});

const BY_DOMAIN: Record<string, unknown[]> = {
  SOFTWARE: software,
  CONSTRUCTION: construction,
  HEALTHCARE: healthcare,
  FINANCE: finance,
  DATA_ML: dataMl,
  OTHER: [],
};

/** Domain checklist plus the cross-domain governance items. Edit the JSON files to change them. */
export function checklistFor(domain: string): ChecklistItem[] {
  const items = [...(BY_DOMAIN[domain] ?? []), ...other];
  return z.array(ItemSchema).parse(items);
}
