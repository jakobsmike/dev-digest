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

## 2026-09-24 — A "ready" health check can be answering the PREVIOUS stack

**Symptom:** `./scripts/dev.sh` exited immediately with `EADDRINUSE` on :3000 and :3001,
yet a `until curl -sf localhost:3001/health` readiness loop returned instantly. The ports
answered — from dev servers left over from an earlier run, serving a **different git
branch**. Verification nearly ran against stale code.
**Cause:** `dev.sh`'s `cleanup` trap kills only the API child (`$SERVER_PID`); the Next
dev server and any orphan from a previously killed run survive. A port check proves
something is listening, never that it is *your* something.
**Evidence:** `scripts/dev.sh:98-102` — the `cleanup` trap kills `$SERVER_PID` only.
**Rule:** before starting the stack, free the ports and wait for them to actually clear:
```
for p in 3000 3001; do kill -9 $(lsof -ti tcp:$p) 2>/dev/null; done
until ! lsof -ti tcp:3000 >/dev/null && ! lsof -ti tcp:3001 >/dev/null; do sleep 1; done
```
Then check the startup log for `EADDRINUSE` before trusting any readiness probe.

## 2026-09-24 — A local branch silently adopts a same-named remote branch

**Symptom:** a branch holding exactly one commit reported `ahead 1, behind 17` and a PR
would have shown 17 commits by four other authors.
**Cause:** `feat/pr-run-cost` already existed on the remote with unrelated work. Once
fetched, the local branch of the same name tracked it, so "behind" measured distance from
someone else's lineage — not from `origin/main`, against which the branch was a clean
`0/1`.
**Evidence:** `CLAUDE.md:50` — the branch-naming row added after this bit us.
**Rule:** judge a branch by `git rev-list --left-right --count origin/main...HEAD`, not by
the ahead/behind in `git status`, which reports against whatever upstream got attached.
Check `git ls-remote --heads origin <name>` before naming a branch.

## 2026-09-20 — `vendor/shared` is duplicated and the copies have drifted

**Symptom:** the client's `Provider` type has no `"openrouter"`, yet the agent-creation
UI offers it (`CreateAgentModal/constants.ts`). The client also lacks `AgentManifest`,
`CommitFilesPayload` and `sessionId`.
**Cause:** `@devdigest/shared` exists twice — `server/src/vendor/shared` (canonical) and
`client/src/vendor/shared` (a copy). Nothing enforces that they match.
**Evidence:** `client/src/vendor/shared/contracts/platform.ts:1` vs
`server/src/vendor/shared/contracts/platform.ts:1` — two files, no enforcement.
**Rule:** change the server copy first, then mirror into the client in the same commit.
→ promoted to `CLAUDE.md` § Conventions, detail in `docs/contracts.md`

## 2026-09-20 — `main` was reverted to the starter state on purpose

**Symptom:** features referenced in commit history (a conventions extractor, skills
work) are absent from the working tree.
**Cause:** commit `c6af1e4` — "revert: restore main to the starter state, homework
belongs in forks".
**Evidence:** `README.md:82` — L01 is listed as a feature to build, not one that shipped.
**Rule:** do not "restore" work you find in git history onto `main`. Course homework
lives in forks.
