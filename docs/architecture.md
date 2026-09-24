# Architecture — the cross-module picture

`README.md` has the package table and the high-level mermaid diagram. This file covers
what that diagram leaves out: how the packages are wired together at build time, and
what actually happens during the two flows that matter.

## Wiring: aliases, not packages

There is no workspace and nothing is published. Cross-package imports are **tsconfig
path aliases resolved to raw TypeScript source**:

| Alias | Resolves to | Used by |
|---|---|---|
| `@devdigest/reviewer-core` | `reviewer-core/src` | server |
| `@devdigest/shared` | `server/src/vendor/shared` | server, reviewer-core |
| `@devdigest/shared` | `client/src/vendor/shared` | client (separate copy) |
| `@devdigest/ui` | `client/src/vendor/ui` | client |

Consequences worth knowing:

- The API executes reviewer-core's **source** (tsx in dev, vitest in tests). reviewer-core
  never emits JS — its `build` script is a type-check.
- reviewer-core's dependencies must be installed or the API crashes at boot with
  `ERR_MODULE_NOT_FOUND`. `scripts/dev.sh` runs `npm ci` there for exactly this reason.
- CI path filters must list `reviewer-core/**` under the server workflows, because the
  server type-checks against that source.

## Runtime topology

```
Browser ──REST──►                                  ┌─► Postgres (Drizzle)
          ──SSE──► server (Fastify :3001) ─────────┼─► GitHub API (Octokit)
                     │                             ├─► git clones (server/clones/)
                     │                             └─► LLM (OpenAI · Anthropic · OpenRouter)
                     └─ reviewer-core (in-process, pure)
```

Only Postgres runs in Docker. The API and the web app run on the host.

## The composition root

`server/src/platform/container.ts` is the single place adapters are constructed.
Services never instantiate an adapter; they read `container.llm(id)`,
`container.github()`, `container.git`, `container.repoIntel`, `container.secrets`.
Tests pass `ContainerOverrides` to swap in `src/adapters/mocks.ts`.

Modules do not import each other's internals. Shared repositories (agents, reviews) are
built on the container instead. The one visible exception is `repos/service.ts`, which
imports job-kind constants from `repo-intel`.

## Flow A — add a repo → the Indexed badge

```
POST /repos
  └ repos.service.add: parse URL, dedupe, insert row, enqueue "clone" job
       └ clone job: git clone (PAT-authenticated) → save path → enqueue "index" job
            └ repo-intel pipeline: walk → ast-grep symbols/refs → dependency-cruiser
              import graph → PageRank file rank → token-budgeted repo map → Postgres
```

Jobs run on a `p-queue` (concurrency 3) and are mirrored into the `jobs` table with a
timeout and retries. An unindexed repo degrades: the facade returns empty results rather
than throwing, and reviews silently fall back to diff-only.

Deeper detail: `../server/src/modules/repo-intel/README.md`.

## Flow B — run a review

```
POST /pulls/:id/review  {agentId | all:true}
  └ ReviewService.runReview
       creates agent_runs rows up front, returns run_ids immediately (fire-and-forget)
       └ ReviewRunExecutor.executeRuns  (background)
            1. loadDiff once, shared by every queued agent
            2. per agent (failures isolated):
                 resolve the LLM provider from the container
                 gather repo-intel context: callers digest, repo map, "top 5% hot file" note
            3. reviewer-core.reviewPullRequest():
                 assemblePrompt  — INJECTION_GUARD + <untrusted> wrapping
                 → single-pass, or map-reduce per file when >400 changed lines AND >1 file
                 → llm.completeStructured(Review schema, with retry/repair)
                 → groundFindings — drop any finding citing a line absent from the diff
                 → score recomputed from the survivors
            4. persist: reviews + findings + agent_runs + one run_traces document

Client: subscribes to GET /runs/:id/events (SSE); polls /pulls/:id/runs every 4s while
anything is running; refetches on done.
```

The division of labour: **reviewer-core owns the thinking, the server owns the I/O.**
Prompt assembly, the grounding gate and the structured-output parse live in the engine.
Context resolution, persistence, SSE and observability live in the server.

## Invariants worth not breaking

- **Grounding is mandatory.** A finding that cites a line not in the diff is dropped.
  The model's self-reported score and verdict are ignored; the score is recomputed from
  the findings that survived, and `countBlockers` is likewise deterministic.
- **Prompt-injection defence is one shared rule**, not text scanning. `INJECTION_GUARD`
  is appended to every system prompt and all external content is wrapped by
  `wrapUntrusted`. A denylist would only ever catch one phrasing.
- **Omit-when-empty.** Optional prompt slots (skills, memory, specs, callers, repoMap)
  must produce a byte-identical prompt when absent. Lessons rely on this to add a slot
  without changing the baseline.
- **One API instance per DB.** The SSE RunBus is in-memory, so orphaned `running` rows
  are reaped on boot. Multiple replicas would need heartbeats.
