# Data fetching in the client

Everything the UI shows comes through one path. The rules that must not be broken are
summarised in `../CLAUDE.md`.

## The three layers

```
component  →  hook (src/lib/hooks/*)  →  api.ts  →  fetch  →  Fastify :3001
```

1. **`lib/api.ts`** — the only place that calls `fetch`. Prefixes `API_BASE`, sets
   `content-type` only when a body is sent, unwraps the server's error envelope
   (`{ error: { code, message, details } }`) into an `ApiError`, returns `undefined` on
   `204`.
2. **`lib/hooks/*`** — one React Query hook per endpoint, grouped by domain: `core.ts`
   (settings, secrets, repos, pulls), `agents.ts`, `reviews.ts`, `trace.ts`,
   `repo-intel.ts`. All re-exported from `hooks/index.ts`.
3. **components** — call hooks. Never `fetch`, never a hand-built URL.

A new endpoint means a new hook beside its siblings.

## Types

Types come from `@devdigest/shared`, re-exported through `lib/types.ts` so components
import from one place. Do not redefine a server shape locally. The one exception in the
tree is `RepoIntelState` in `hooks/repo-intel.ts` — repo-intel's types live server-side
and are not in the shared contracts, so the hook declares the subset the badge needs.
Shapes change on the server first: `../../docs/contracts.md`.

## Query keys

Arrays: domain string, then the scoping id. **Keep the id** — a PR-scoped hook that omits
`prId` serves another PR's cache after navigation.

| Key | Holds |
|---|---|
| `["settings"]`, `["secrets-status"]`, `["provider-models"]` | settings screen |
| `["repos"]`, `["pulls", repoId]` | repo + PR lists |
| `["reviews", prId]` | persisted reviews + findings |
| `["pr-runs", prId]`, `["pr-active-runs", prId]` | run history / in-flight runs |
| `["run-trace", runId]` | one run's full trace document |
| `["pr-comments", prId]` | GitHub review comments, proxied |
| `["repo-intel-state", repoId]` | Indexed badge |

## Mutations and invalidation

Each mutation owns the cache consequences of its own write, in `onSuccess`:

- `useUpdateSettings` writes the response back with `setQueryData` — no refetch.
- `useTestConnection` invalidates `["provider-models"]` + `["secrets-status"]`:
  validating a key changes which models resolve.
- `useDeleteRun` invalidates **both** `["pr-runs", prId]` and `["reviews", prId]` — the
  server deletes the review the run produced, so one invalidation leaves a ghost.
- `useRunReview` invalidates `["reviews", prId]`; the run itself is tracked by SSE.

## Live runs: polling plus SSE

A review is fire-and-forget server-side, so progress arrives two ways and needs both.

**Polling** is the source of truth that survives a reload. `usePrActiveRuns` /
`usePrRuns` set `refetchInterval` to 4000 while anything is `running`, else `false`, so
the poll stops by itself.

**SSE** is the live log. `useRunEvents(runIds)` opens one `EventSource` per run on
`/runs/:id/events`. Three details matter:

- The server names each SSE event after its kind, so the hook listens for
  `info` / `tool` / `result` / `error` **and** `onmessage`. A new server-side kind must be
  added to that list.
- **Agent failures arrive as SSE `error` events**, not as a rejected query or mutation, so
  the global toast never sees them — the hook calls `notify.error` itself. Remove it and a
  failed run goes silent until a reload.
- `es.onerror` also fires on a **normal** stream close; that is how `running` flips to
  false. Not a failure.

Non-JSON keepalive frames are swallowed by the `try/catch` around `JSON.parse`.

## Error surfacing

Configured once in `lib/providers.tsx`:

- **Queries** toast only on status `0` (API unreachable) or `>= 500`. An expected 4xx stays
  silent so the component can render an inline empty state.
- **Mutations** always toast — they are user actions, and silence reads as a bug.
- Defaults: `retry: 1`, `staleTime: 30_000`, no refetch on window focus.

## Read when

- Changing a request or response shape → `../../docs/contracts.md`.
- Tracing a run through the server → `../../docs/architecture.md`.
- Testing a hook or a fetching component → `../../TESTING.md`.
