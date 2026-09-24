# INSIGHTS — client

Newest first. One entry = one surprise that cost time. Tag each entry `**Category:**`
with one of: **What Works**, **What Doesn't Work**, **Codebase Patterns**, **Tool &
Library Notes**, **Recurring Errors & Fixes**, **Session Notes** (2–5 takeaways when no
single entry fits), or **Open Questions**. Bug-shaped entries keep
**Symptom/Cause/Rule**; the rest use a single **Note** (or **Question**) — write it
"actionable cold" (specific enough to act on without re-investigating). Promote a
hardened rule into `CLAUDE.md` (one line) and mark it `→ promoted`. Cross-module
findings: `../INSIGHTS.md`.

---

## 2026-09-20 — A failed agent run never reaches the global error toast

**Symptom:** an agent fails mid-review; the run eventually shows `failed`, but the user
sees nothing until a reload.
**Cause:** runtime failures arrive as SSE events with `kind: "error"`. The global handlers
in `lib/providers.tsx` only see rejected queries and mutations — and the
`POST /pulls/:id/review` mutation already resolved when the run was queued.
**Rule:** `useRunEvents` calls `notify.error` itself for `kind === "error"`. Do not
simplify that away, and keep the `addEventListener` kind list
(`info`/`tool`/`result`/`error`) in sync with the server's — each SSE event is named
after its kind.

## 2026-09-20 — `EventSource.onerror` fires on a normal stream close

**Symptom:** treating `onerror` as a failure makes every completed run look broken.
**Cause:** the server ends the stream when the run finishes, and the browser surfaces
that close as an `error`. There is no separate "server closed" callback.
**Rule:** in `useRunEvents`, `onerror` closes the source and decrements the open count —
that is exactly how `running` flips to `false`. Authoritative status comes from polling
`/pulls/:id/runs`, not from the stream.
