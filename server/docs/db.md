# Database — schema layout and migration workflow

Drizzle ORM over Postgres 16 with pgvector. `postgres` (porsager) is the driver.

## Schema layout

`src/db/schema.ts` is a **barrel only**: it re-exports the domain files under
`src/db/schema/` and assembles the `schema` object used to type the Drizzle client.
Every consumer keeps importing from `db/schema`, so moving a table between domain
files is not a breaking change.

| File | Tables |
|---|---|
| `core.ts` | users, workspaces, workspace_members, settings |
| `repos.ts` | repos |
| `pulls.ts` | pull_requests, pr_files, pr_commits |
| `reviews.ts` | reviews, findings, pr_intent, pr_brief |
| `runs.ts` | agent_runs, run_traces, multi_agent_runs |
| `agents.ts` | agents, agent_versions, agent_skills |
| `repo-intel.ts` | repo_index_state, file_edges, file_facts, file_rank, repo_map_cache |
| `skills.ts` · `knowledge.ts` · `context.ts` · `eval.ts` · `ci.ts` · `ops.ts` | lesson features + jobs |

**The schema is complete; most of it is empty.** Tables for memory, conventions, eval,
CI and plugins exist so a lesson can wire a feature without a migration. An existing
table is not evidence of a working feature.

### Tenancy

Every domain table carries `workspace_id` (FK → workspaces) and, where relevant,
`created_by` (FK → users). Queries scope by `workspace_id`. Auth is a stub today
(`LocalNoAuthProvider` returns one workspace and one system user), so the scoping is
structural, not enforced by real authentication — keep it correct anyway.

## Migration workflow

```sh
# 1. edit src/db/schema/<domain>.ts
pnpm db:generate     # drizzle-kit writes a new SQL file + snapshot under src/db/migrations
pnpm db:migrate      # apply to the DB in DATABASE_URL
pnpm db:seed         # idempotent demo data (optional)
```

Config lives in `drizzle.config.ts` (`schema: ./src/db/schema.ts`,
`out: ./src/db/migrations`, `strict: true`).

### Rules

- **Never edit an applied migration.** Generate a new one. The `meta/_journal.json`
  index and the per-migration snapshots must stay consistent with the SQL files;
  hand-editing has broken the journal before.
- **Migrations do not run on boot.** `buildApp` never migrates. `relation … does not
  exist` at runtime always means `pnpm db:migrate` was not run.
- **pgvector is enabled by migration `0000`**, and `runMigrations` also issues
  `CREATE EXTENSION IF NOT EXISTS vector` first, because several tables declare
  `vector(1536)` columns. If you see `type "vector" does not exist`, the migrations ran
  against a different database than you think.
- `runMigrations` is shared by `pnpm db:migrate` and the testcontainers harness, so
  integration tests exercise the real migration path.

## Reset

```sh
docker compose down -v     # drops the volume
./scripts/dev.sh           # recreate, migrate, seed
```
