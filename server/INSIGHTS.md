# INSIGHTS — server

Newest first. One entry = one surprise that cost time. Tag each entry `**Category:**`
with one of: **What Works**, **What Doesn't Work**, **Codebase Patterns**, **Tool &
Library Notes**, **Recurring Errors & Fixes**, **Session Notes** (2–5 takeaways when no
single entry fits), or **Open Questions**. Bug-shaped entries keep
**Symptom/Cause/Rule**; the rest use a single **Note** (or **Question**) — write it
"actionable cold" (specific enough to act on without re-investigating). Promote hardened
rules into `CLAUDE.md` (one line) and mark the entry `→ promoted`. Cross-module findings
belong in the root `../INSIGHTS.md`.

---

## 2026-09-24 — `dockerAvailable()` says yes while Testcontainers says no (Colima)

**Symptom:** with Colima running, the integration lane stopped skipping and started
**failing** — all 6 files, `Error: Could not find a working container runtime strategy`.
Worse than the honest skip it replaced.
**Cause:** `test/helpers/pg.ts:24` gates on `execSync('docker info')`, which succeeds
because the Docker CLI reads the `colima` context. Testcontainers does not read that
context — it probes `/var/run/docker.sock`, which Colima never creates (its socket is
`~/.colima/default/docker.sock`).
**Rule:** on Colima, run the integration lane with both vars set, or the gate lies:
```
DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" \
TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock \
pnpm exec vitest run .it.test
```
The second one is not redundant: it is the path Testcontainers bind-mounts into the Ryuk
reaper container, and Ryuk fails without it even once `DOCKER_HOST` is correct.

## 2026-09-24 — `MockGitHubClient` ships exactly ONE pull request

**Symptom:** a new integration test died on `Cannot read properties of undefined
(reading 'id')` at `pulls[1]`.
**Cause:** `src/adapters/mocks.ts:138` returns a single hardcoded PR (#482) unless
`opts.pulls` is passed. Nothing in the name suggests a fixture of size one.
**Rule:** any test that needs a second PR must spell the list out:
`new MockGitHubClient({ pulls: [pr(901, …), pr(902, …)] })`. Select rows by
`.find((p) => p.number === 901)`, never by index — the list order is not guaranteed and
earlier tests in the same container may have imported other PRs into the same repo.

## 2026-09-20 — Migrations are never applied on boot

**Symptom:** a fresh clone 500s on every route with `relation "agents" does not exist`.
**Cause:** `buildApp()` wires plugins, the container and the modules, but never migrates.
Only `pnpm db:migrate` (or the testcontainers harness) applies migrations.
**Evidence:** `server/src/app.ts:81` reaps runs on boot but never migrates.
**Rule:** after a fresh DB or any schema change, run `cd server && pnpm db:migrate`.
→ promoted to `CLAUDE.md` § Gotchas

## 2026-09-20 — Stale `running` runs are reaped synchronously on boot

**Symptom:** after killing the dev server mid-review, runs showed as perpetually
"running" in the UI with no way to cancel them.
**Cause:** the RunBus is in-memory, so a dead process leaves orphaned `agent_runs` rows
with no runner behind them.
**Evidence:** `server/src/app.ts:74-81`.
**Rule:** `buildApp` awaits `reapStaleRuns()` **before** listening — a fresh process has
no in-flight runs of its own, so every `running` row at that moment is genuinely
orphaned. This assumes a single API instance per DB. Multiple replicas would need
per-instance scoping or heartbeats.

## 2026-09-20 — A DB-backed test without the `.it.test.ts` suffix breaks CI

**Symptom:** the "hermetic" unit lane tries to start Docker and fails.
**Cause:** the split is purely by filename. `vitest run --exclude '**/*.it.test.ts'` is
the unit lane; `vitest run .it.test` is the integration lane. A DB test named
`foo.test.ts` lands in the wrong one.
**Evidence:** `server/package.json:11` — one `vitest run`; the lanes are split by the
`--exclude`/filter args in CI, purely on the filename.
**Rule:** any test importing `test/helpers/pg.ts` must be named `*.it.test.ts`.
→ promoted to `CLAUDE.md` § Tests
