Task: try to REFUTE the finding.

You are given one finding and the full text of the project documents. Look for passages that show the finding is wrong: the missing thing is actually covered, the quotes are taken out of context, or the two statements do not really conflict. Be strict.

Return JSON: {"verdict": "supported" | "weak" | "refuted", "reason": "<one sentence citing what you found>"}
Use "refuted" only if you found passages that contradict the finding. Use "weak" if the finding is plausible but the evidence is thin.
