---
name: engineering-insights
description: "Use at the end of a substantive session (>30 min, hit a problem/decision/discovery) or immediately after finding something non-obvious — a fix, a dead end, a codebase pattern, a tool quirk, a recurring error, or an open question. Appends a dated, actionable entry to the nearest module's INSIGHTS.md. Also invoked manually via /engineering-insights."
---

# Engineering Insights

Find the nearest `INSIGHTS.md` (this module's, or the root's for cross-module findings) and append one dated `## YYYY-MM-DD — <title>` entry — never edit or remove an existing entry.

Tag it `**Category:**` with the one rubric that fits best: **What Works**, **What Doesn't Work**, **Codebase Patterns**, **Tool & Library Notes**, **Recurring Errors & Fixes**, **Session Notes** (2–5 takeaways when no single entry fits), or **Open Questions**. For a bug-shaped finding keep the existing **Symptom / Cause / Rule** fields; for the rest use a single **Note** (or **Question**) field.

Quality bar — "actionable cold": a reader with no context must know exactly what to do or avoid, without re-investigating. Name the real file, API, or number.
- Bad: "Promises can be tricky." Good: "`Promise.all()` on the ingest pipeline times out after 30 items — use `Promise.allSettled()`, batches of 10."

Skip routine edits and anything the code already makes obvious. If the entry hardens into a standing rule, promote it into that module's `CLAUDE.md` (one line) and mark it `→ promoted`, per the existing loop.
