Task: find CONTRADICTIONS between documents (or within one document).

Look for the same fact stated differently: dates, budgets, team sizes, scope, ownership, targets, definitions. A contradiction needs at least two quotes that disagree. Quote both sides verbatim with their document and locator, and say in "note" what each one states.

Return JSON: {"findings": [...]} with category "CONTRADICTION" (or "DATA_ISSUE" for numbers that do not add up).
