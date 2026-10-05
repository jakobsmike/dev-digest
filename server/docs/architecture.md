# server/ — architecture: the container, the adapters, and one request

How a request reaches the database and the outside world. Written about the code that
exists today; the API surface itself is in `../README.md`.

## The three layers, and why the boundary is where it is

```
modules/<name>/routes.ts     transport — Zod schemas, HTTP status, nothing else
        │
        ▼
modules/<name>/service.ts    logic — orchestrates, owns no SQL
        │
        ▼
modules/<name>/repository.ts Drizzle — SQL, owns no decisions
```

The rule that keeps this honest is that **a service never imports `drizzle-orm`** and a
route never imports a repository. When you see SQL in a route, something has been
short-circuited. `modules/pulls/routes.ts` is the deliberate exception: it has no service
or repository at all, because it is import-and-read with no logic worth a layer — and the
three read-time aggregations it does (latest score, total cost, severity counts) sit
inline there for exactly that reason.

## The container is the only way out of the process

`platform/container.ts` builds one `Container` per app instance. Everything that touches
the world outside this process is reached through it, and **nothing constructs an adapter
directly**:

| Member | Kind | What it hides |
| --- | --- | --- |
| `config` | value | parsed, validated env (`platform/config.ts`) |
| `db` | value | the Drizzle handle |
| `secrets` | provider | `~/.devdigest/secrets.json` or env; a UI-saved key wins |
| `auth` | provider | the single local workspace/user |
| `jobs` | runner | background work (`enqueue` / `register`) |
| `runBus` | bus | in-memory SSE fan-out for live run events |
| `llm(id)` | factory | OpenAI / Anthropic / OpenRouter, keyed by provider id |
| `github()` | factory | Octokit, async because it resolves a token first |
| `git` | factory | local clone/diff/blame |
| `repoIntel` | facade | the whole indexer — symbols, callers, rank, repo map |
| `embedder`, `tokenizer` | factory | pgvector embeddings, token counting |

Two consequences worth internalising:

- **`github()` is async and `git` is not.** The GitHub client cannot be built without a
  token, and the token comes from `SecretsProvider`, which may hit disk.
- **Every factory has an override.** `ContainerOverrides` (`container.ts:41-53`) is how
  tests inject `MockGitHubClient`, `MockGitClient`, `MockLLMProvider` from
  `adapters/mocks.ts`. That is why the integration tests need no keys and no network —
  and why a new adapter must be added to `ContainerOverrides` or it becomes untestable.

`repoIntel` is a facade on purpose: it degrades to empty results on an unindexed repo
rather than throwing, so every caller handles "nothing found" and none handle "indexer
missing".

## Adapters

`adapters/` is one folder per outside system: `llm/`, `github/`, `git/`, `secrets/`,
`auth/`, `embedder/`, `tokenizer/`, plus the analysis adapters `astgrep/`, `codeindex/`,
`depgraph/`. Each exports an interface from `@devdigest/shared` and one or more
implementations; `mocks.ts` sits alongside them and implements the same interfaces.

The LLM adapters are the ones with real behaviour beyond a fetch: they retry structured
output, count tokens, and price the call. Pricing is the interesting part — `llm/pricing.ts`
holds a static USD-per-1M table, while `platform/price-book.ts` prefers live OpenRouter
pricing with that table as fallback. Both end up on the same field, `costUsd`, so the
review engine never learns which provider it is talking to.

## One request, end to end

`POST /pulls/:id/review` is the only flow that touches every layer:

1. **routes** validates params, resolves the workspace from `auth`, returns `202` with
   run ids — it does not wait for the review.
2. **service** creates one `agent_runs` row per requested agent (`status: 'running'`) and
   hands off to `ReviewRunExecutor`.
3. **executor** (`modules/reviews/run-executor.ts`) resolves the diff via `git`, optionally
   enriches the prompt from `repoIntel`, then calls `reviewPullRequest()` in
   `@devdigest/reviewer-core`. The engine is pure: the executor owns all I/O around it.
4. **persistence** writes `reviews` + `findings`, completes the `agent_runs` row with
   duration, tokens, cost, grounding, score and blockers, and saves the whole trace as
   **one** jsonb document in `run_traces`.
5. **runBus** streams events to `GET /runs/:id/events` while all this happens; the client
   also polls `/pulls/:id/runs` every 4s because the bus is in-memory and a restart loses
   it.

Failure follows the same path: the executor catches, marks the run `failed` with the
error text, and still writes a trace from the buffered log — so a failed run is
inspectable after a reload instead of vanishing.

## Boot

`app.ts` builds the container, registers plugins and modules statically
(`modules/index.ts` — one import, one entry; autoload is deliberately not used), then
**reaps orphaned runs before listening**. A `running` row at boot can only be a run whose
process died, because a fresh process owns none — this assumes one API instance per
database, which is also why the SSE bus can be in-memory.

Migrations are **not** applied on boot. `relation … does not exist` always means
`pnpm db:migrate` has not been run.

## Read next

- Adding a module, or the request/DI diagram → `../README.md`, `modules.md`
- Schema, migrations, pgvector → `db.md`
- What must stay true of the review cycle → `../specs/review-flow.md`
- The engine itself → `../../reviewer-core/CLAUDE.md`
