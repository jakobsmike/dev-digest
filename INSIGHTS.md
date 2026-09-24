# INSIGHTS — cross-module

Newest first. One entry = one thing that would cost the next session time to
rediscover, in this repo, that the code alone does not explain. Tag each entry
`**Category:**` with one of: **What Works**, **What Doesn't Work**, **Codebase
Patterns**, **Tool & Library Notes**, **Recurring Errors & Fixes**, **Session Notes**
(2–5 takeaways when no single entry fits), or **Open Questions**. Bug-shaped entries
keep **Symptom/Cause/Rule**; the rest use a single **Note** (or **Question**). Write
it "actionable cold" — specific enough that a reader with no context knows exactly
what to do or avoid, without re-investigating.

**The loop:** this file is the inbox (no size limit). `CLAUDE.md` is the curated map
(≤100 lines). When an entry hardens into a standing rule, promote it to one line in
`CLAUDE.md` and mark the entry `→ promoted`. When `CLAUDE.md` outgrows its budget,
demote the detail into `docs/`.

Entries that are specific to one package belong in that package's `INSIGHTS.md`.

---

## 2026-09-20 — `vendor/shared` is duplicated and the copies have drifted

**Symptom:** the client's `Provider` type has no `"openrouter"`, yet the agent-creation
UI offers it (`CreateAgentModal/constants.ts`). The client also lacks `AgentManifest`,
`CommitFilesPayload` and `sessionId`.
**Cause:** `@devdigest/shared` exists twice — `server/src/vendor/shared` (canonical) and
`client/src/vendor/shared` (a copy). Nothing enforces that they match.
**Rule:** change the server copy first, then mirror into the client in the same commit.
→ promoted to `CLAUDE.md` § Conventions, detail in `docs/contracts.md`

## 2026-09-20 — `main` was reverted to the starter state on purpose

**Symptom:** features referenced in commit history (a conventions extractor, skills
work) are absent from the working tree.
**Cause:** commit `c6af1e4` — "revert: restore main to the starter state, homework
belongs in forks".
**Rule:** do not "restore" work you find in git history onto `main`. Course homework
lives in forks.
