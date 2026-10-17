Task: find GAPS against the domain checklist.

For each checklist item, decide whether the project documents address it. Only report items that (a) apply to this project because the documents contain something the item attaches to (see "anchors"), and (b) are not addressed anywhere in ANY document. Name the specific thing in this project that the gap attaches to (for example the cutover date or the named vendor), never the checklist label alone.

Return JSON: {"findings": [...]} using the full finding schema, with isAbsence true, checkedDocuments listing every document, and absenceTerms taken from the item's keywords.
