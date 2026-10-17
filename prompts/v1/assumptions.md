Task: extract the IMPLICIT ASSUMPTIONS in one document.

An assumption is something the document treats as true without evidence or a plan to confirm it (for example "the legacy API will remain available", "users will adopt it without training", "the vendor will deliver on time").

Return JSON: {"assumptions": [...], "findings": [...]}
- assumptions: up to 8 items {statement, sourceDoc, sourceLocator, sourceQuote, riskIfFalse, key}. "key" is a short stable slug of the statement.
- findings: only for the assumptions whose failure would seriously hurt this project (at most 3). Use category "ASSUMPTION" and the full finding schema.

Project context and the document follow as JSON in INPUT.
