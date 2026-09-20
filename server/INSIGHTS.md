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

## 2026-09-20 — Migrations are never applied on boot

**Symptom:** a fresh clone 500s on every route with `relation "agents" does not exist`.
**Cause:** `buildApp()` wires plugins, the container and the modules, but never migrates.
Only `pnpm db:migrate` (or the testcontainers harness) applies migrations.
**Rule:** after a fresh DB or any schema change, run `cd server && pnpm db:migrate`.
→ promoted to `CLAUDE.md` § Gotchas

## 2026-09-20 — Stale `running` runs are reaped synchronously on boot

**Symptom:** after killing the dev server mid-review, runs showed as perpetually
"running" in the UI with no way to cancel them.
**Cause:** the RunBus is in-memory, so a dead process leaves orphaned `agent_runs` rows
with no runner behind them.
**Rule:** `buildApp` awaits `reapStaleRuns()` **before** listening — a fresh process has
no in-flight runs of its own, so every `running` row at that moment is genuinely
orphaned. This assumes a single API instance per DB. Multiple replicas would need
per-instance scoping or heartbeats.

## 2026-09-20 — A DB-backed test without the `.it.test.ts` suffix breaks CI

**Symptom:** the "hermetic" unit lane tries to start Docker and fails.
**Cause:** the split is purely by filename. `vitest run --exclude '**/*.it.test.ts'` is
the unit lane; `vitest run .it.test` is the integration lane. A DB test named
`foo.test.ts` lands in the wrong one.
**Rule:** any test importing `test/helpers/pg.ts` must be named `*.it.test.ts`.
→ promoted to `CLAUDE.md` § Tests
