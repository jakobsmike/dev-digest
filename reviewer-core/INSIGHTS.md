# INSIGHTS — reviewer-core

Newest first. One entry = one surprise that cost time. Tag each entry `**Category:**`
with one of: **What Works**, **What Doesn't Work**, **Codebase Patterns**, **Tool &
Library Notes**, **Recurring Errors & Fixes**, **Session Notes** (2–5 takeaways when no
single entry fits), or **Open Questions**. Bug-shaped entries keep
**Symptom/Cause/Rule**; the rest use a single **Note** (or **Question**) — write it
"actionable cold" (specific enough to act on without re-investigating). Promote a
hardened rule into `CLAUDE.md` (one line) and mark it `→ promoted`. Cross-module
findings: `../INSIGHTS.md`.

---

## 2026-09-20 — `reduceReviews` computes a score that is immediately discarded

**Symptom:** tuning the mean-score arithmetic in `reduceReviews` changes nothing on
screen.
**Cause:** `reviewPullRequest` merges the partials, then overwrites the result with
`score: scoreFromFindings(ground.kept)`, recomputed from the findings that survived
grounding. The merged mean exists only between those two statements.
**Evidence:** `reviewer-core/src/review/run.ts:216` overwrites the merged score with
`scoreFromFindings` (`reviewer-core/src/review/reduce.ts:27`).
**Rule:** the score is a deterministic function of the surviving findings
(`SEVERITY_PENALTY` in `review/reduce.ts`). To change the number, change those penalties.
→ promoted to `CLAUDE.md` § Invariants

## 2026-09-20 — The `@devdigest/shared` alias is declared in two files

**Symptom:** `npm run typecheck` passes while `npm test` cannot resolve
`@devdigest/shared` (or the reverse), with no change to the import.
**Cause:** the alias into `../server/src/vendor/shared` exists twice — `tsconfig.json`
`paths` for the compiler, `vitest.config.ts` `resolve.alias` for the runner. Independent.
**Evidence:** `reviewer-core/tsconfig.json:22` and `reviewer-core/vitest.config.ts:9`.
**Rule:** change both in the same commit. Same duplication for the server's
`@devdigest/reviewer-core` alias.
