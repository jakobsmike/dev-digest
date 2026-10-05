# INSIGHTS — e2e

Newest first. One entry = one surprise that cost time. Tag each entry `**Category:**`
with one of: **What Works**, **What Doesn't Work**, **Codebase Patterns**, **Tool &
Library Notes**, **Recurring Errors & Fixes**, **Session Notes** (2–5 takeaways when no
single entry fits), or **Open Questions**. Bug-shaped entries keep
**Symptom/Cause/Rule**; the rest use a single **Note** (or **Question**) — write it
"actionable cold" (specific enough to act on without re-investigating). Promote a
hardened rule into `CLAUDE.md` (one line) and mark it `→ promoted`. Cross-module
findings: `../INSIGHTS.md`.

---

## 2026-09-28 — Prose in `specs/` is safe after all — the runner filters

**Category:** Recurring Errors & Fixes

**Note:** the 2026-09-20 entry below states the rule too strongly. `run.ts` does not read
"everything in `specs/`" — it filters, `.filter((f) => f.endsWith(".flow.json"))`
(`e2e/run.ts:55`), so a `.md` beside the flows is ignored, not mis-parsed. `specs/coverage.md`
now lives there and states what the suite must cover; flows stay `NN-name.flow.json` and
keep their lexical run order. The older entry's real lesson survives: the folder's meaning
is fixed by the runner, so never assume a file there is inert — check the filter first.
Evidence that it is inert today: `e2e/specs/coverage.md:1` and a green `npm test`.

## 2026-09-20 — `specs/` here is the flow directory, not a spec folder

**Symptom:** a Markdown spec dropped into `e2e/specs/` looks harmless — every other
package keeps its specs there.
**Cause:** `run.ts` reads `specs/` at startup and treats `*.flow.json` as the suite. The
path derives from the runner's own location, so the folder's meaning is fixed.
**Evidence:** `e2e/run.ts:55`.
**Rule:** feature specs go in `docs/`, named `spec-<name>.md`. Only `*.flow.json` belongs
in `specs/`.
→ promoted to `CLAUDE.md`

## 2026-09-20 — Flow `02` fails against a dev DB holding your own repos

**Symptom:** green in CI, red locally, failing at "root redirects to the seeded repo's PR
list".
**Cause:** the home route redirects to the **first** repo, and flow `02` asserts it lands
on the seeded demo one. Any repo you added can come first.
**Evidence:** `e2e/specs/02-repo-pulls-detail.flow.json:1`.
**Rule:** run `npm run e2e:hermetic` (`../scripts/e2e.sh`) — ephemeral Postgres on 5433,
empty every run. Do not "fix" the flow by loosening the assertion.
→ promoted to `CLAUDE.md` § Gotchas
