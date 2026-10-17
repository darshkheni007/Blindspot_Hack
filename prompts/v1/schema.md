Finding object (all fields required unless marked optional):
{
  "detector": string,                      // e.g. "checklist", "contradictions"
  "key": string,                           // stable slug for this issue, e.g. "checklist:rollback"
  "category": "ASSUMPTION" | "CONSTRAINT" | "QUESTION" | "CONTRADICTION" | "DATA_ISSUE",
  "title": string,                         // ONE specific sentence naming this project's things
  "whyItMatters": string,                  // 2-3 sentences
  "evidence": [{ "documentName": string, "locator": string, "quote": string, "note"?: string }],
  "isAbsence": boolean,
  "checkedDocuments": string[],            // required when isAbsence is true
  "absenceTerms": string[],                // terms that would refute an absence claim
  "confidence": "EVIDENCE_BACKED" | "INFERRED" | "PATTERN_BASED",
  "factors": { "impact": 1-5, "likelihood": 1-5, "irreversibility": 1-5, "proximity": 1-5, "cost": 1-5 },
  "justifications": { "impact": string, "likelihood": string, "irreversibility": string, "proximity": string, "cost": string },
  "disproof": string,                      // what would prove this finding wrong
  "question": string,                      // the question the team should ask
  "owner": string,                         // role best placed to answer
  "nextStep": string,
  "groupKey"?: string                      // findings with one root cause share a groupKey
}
