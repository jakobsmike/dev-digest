# server/ — `@devdigest/api`

Fastify 5 API: repos, PRs, agents, and the review runner. `README.md` has the API map,
the request/DI flow diagram and the env table — not repeated here.

## Layering (every module follows it)

`modules/<name>/routes.ts` (transport) → `service.ts` (logic) → `repository.ts` (Drizzle).
Pure transforms in `helpers.ts`, literals in `constants.ts`. No SQL in services, no logic
in routes.

## Rules

- **Add a module**: create `modules/<name>/routes.ts` exporting a default Fastify plugin,
  then one import + one entry in `modules/index.ts`. Static registration is deliberate —
  do not switch to autoload. See `docs/modules.md`.
- **Never construct an adapter.** Resolve it from the DI container (`container.llm(id)`,
  `container.github()`, `container.git`, `container.repoIntel`). Tests inject through
  `ContainerOverrides`.
- **Validate with Zod route schemas** (`schema: { params, body }` on a
  `withTypeProvider<ZodTypeProvider>()` instance), not `Schema.parse(req.body)` inside
  the handler. Invalid input is rejected with 422 before the handler runs.
- **Errors**: throw `AppError` subclasses (`NotFoundError`, `ConfigError`, …). The global
  handler in `app.ts` builds the response envelope. Do not hand-roll error replies.
- **Secrets**: `container.secrets.get(...)` only. Never read an API key from `process.env`
  and never put one in `AppConfig`.
- **repo-intel**: call the facade (`container.repoIntel.*`), never the pipeline internals.
  It degrades to empty results on an unindexed repo — handle empty, do not throw.
- **Background work**: `container.jobs.enqueue(workspaceId, kind, payload)`, with the
  handler registered via `jobs.register(kind, …)` at plugin load.

## Tests

- `*.it.test.ts` = DB-backed (testcontainers Postgres). Everything else must be hermetic.
  A test importing `test/helpers/pg.ts` **must** use that suffix or the CI split breaks.
- unit: `pnpm exec vitest run --exclude '**/*.it.test.ts'`
- integration: `pnpm exec vitest run .it.test`
- Mock the outside world with `src/adapters/mocks.ts` — no keys, no network.

## Gotchas

- `relation … does not exist` → migrations were not applied. Run `pnpm db:migrate`.
  They are never applied on boot.
- The SSE RunBus is in-memory: **one API instance per DB**. Boot reaps orphaned
  `running` runs before accepting requests.
- `platform/{grounding,prompt,structured}.ts` are re-export shims to
  `@devdigest/reviewer-core`. Change the engine, not the shim.
- `platform/model-router.ts` has its own `Provider` type without `'openrouter'`.
  Check whether anything still calls it before relying on it.
- Comments carry ticket codes (`F1`, `A2`, `T1.3`, `T3`) and mention a CI `agent-runner`
  that does not exist in this repo.

## Read when

- Adding a route or a module → `README.md` (§ Request & DI flow, § API map) and `docs/modules.md`.
- Touching the indexer → `src/modules/repo-intel/README.md`.
- Touching prompt assembly, grounding or the LLM call → `../reviewer-core/CLAUDE.md`.
- Changing the schema → `docs/db.md`, then `pnpm db:generate`.
- Changing a request/response shape → `../docs/contracts.md`.
- Writing tests → `../TESTING.md`.
