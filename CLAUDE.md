# DevDigest

Local-first AI pull-request review. Four standalone packages, **no monorepo workspace**.

## Stack

Node ≥22 · TypeScript 5.7 · Zod 3 · vitest 2

- `server/` `@devdigest/api` — Fastify 5 · Drizzle · Postgres 16 + pgvector · :3001 · **pnpm**
- `client/` `@devdigest/web` — Next 15 App Router · React 19 · TanStack Query · :3000 · **pnpm**
- `reviewer-core/` `@devdigest/reviewer-core` — pure review engine, no I/O · **npm**
- `e2e/` `@devdigest/e2e` — agent-browser flows · **npm**

## Commands

- Whole stack: `./scripts/dev.sh` (Postgres → migrate → seed → API + web)
- `server/`: `pnpm dev|build|typecheck|test` · `pnpm db:migrate|db:seed|db:generate`
- `client/`: `pnpm dev|build|typecheck|test`
- `reviewer-core/`, `e2e/`: `npm test` — npm, not pnpm; they have their own lockfiles

## Conventions that are not default here

- Packages share code through **tsconfig path aliases**, not published modules. `server`
  imports `../reviewer-core/src` as raw TypeScript; `reviewer-core` aliases
  `@devdigest/shared` back into `server/src/vendor/shared`.
- `@devdigest/shared` is **duplicated**. `server/src/vendor/shared` is canonical;
  `client/src/vendor/shared` is a copy that has already drifted. Change server first,
  then mirror. See `docs/contracts.md`.
- Migrations never run on boot. After schema changes: `cd server && pnpm db:migrate`.
- Secrets never live in the DB or in `AppConfig` — only `~/.devdigest/secrets.json` via
  `SecretsProvider`, or env. A key saved in the UI overrides the one in `.env`.

## Naming conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Wire fields (JSON, Zod contracts, DB columns) | `snake_case` | `cost_usd`, `findings_counts`, `head_sha` |
| TypeScript values, props, Drizzle fields | `camelCase` | `costUsd`, `findingsCount`, `headSha` |
| Types, Zod schemas, React components | `PascalCase` | `PrMeta`, `RunSummary`, `FindingsPanel` |
| Constants | `SCREAMING_SNAKE` | `SEVERITY_ORDER`, `LOW_CONFIDENCE_THRESHOLD` |
| Files | kebab-case, except a component file that matches its `PascalCase` export | `run-executor.ts`, `model-label.ts`, `FindingsPanel.tsx` |
| Component folders | `PascalCase/` with `styles.ts`, `constants.ts`, `helpers.ts`, `index.ts` | `PRRow/`, `RunTraceDrawer/` |
| Route folders (Next) | kebab-case; dynamic segments bracketed; route-private components under `_components/` | `repos/[repoId]/pulls/[number]/` |
| Server modules | folder per module, fixed file roles | `modules/pulls/{routes,service,repository}.ts` |
| Hooks | `use` + subject | `usePulls`, `usePrReviews`, `useRunTrace` |
| Booleans | `is`/`has`/`should` prefix, or a plain adjective for props | `isPending`, `hasFindings`, `hideLow` |
| Tests | `*.test.ts(x)` beside the unit; DB-backed server tests **must** be `*.it.test.ts` | `helpers.test.ts`, `reviews.it.test.ts` |
| Migrations | generated — never renamed by hand | `0010_dapper_the_liberteens.sql` |
| i18n keys | `camelCase`, nested by screen area | `list.columns.findings`, `panel.severityFilters` |
| Branches | `feat/`, `fix/`, `chore/`, `docs/` + kebab-case; a name no remote branch already uses | `feat/findings-severity-counters` |

The `snake_case` ↔ `camelCase` boundary is the important one: it sits exactly at the
contract. Anything crossing the wire or stored in Postgres is `snake_case`; the moment it
becomes a TypeScript value it is `camelCase`, and the mapping is written out by hand in
the repository layer (`run.repo.ts`) — there is no automatic converter to lean on.

## Do not touch

- `client/src/vendor/ui/**` — vendored design system. Consume it, do not refactor.
- `server/src/db/migrations/**` — never edit an applied migration; generate a new one.
- **Lock files** — `server/pnpm-lock.yaml`, `client/pnpm-lock.yaml`,
  `reviewer-core/package-lock.json`, `e2e/package-lock.json`, `skills-lock.json`. Never
  hand-edit or delete one to "fix" an install; change `package.json` and let the package
  manager rewrite it. Each package resolves independently — there is no workspace root.
- `server/clones/**` — runtime git checkouts.
- `.claude/skills/**` (vendored best-practice packs) — not product code. Course-authored
  skills (e.g. `engineering-insights/`) are the exception.

## Read when

- Touching any package → read that package's `CLAUDE.md` first.
- Changing the review flow end to end → `docs/architecture.md`.
- Changing a shared contract or type → `docs/contracts.md`.
- Changing tests or CI → `TESTING.md`.
- Starting a lesson feature → the matching file in `specs/`.
- After a surprise that cost you time → append to the nearest `INSIGHTS.md` (tag it
  `**Category:**`, per the `engineering-insights` skill / `/engineering-insights`).

## Product context

This is a **course starter**: one flow end to end (import a PR → run an agent review).
`README.md` lists L01–L08 features that are deliberately absent. The DB schema already
has every table, empty. **Code existing ≠ feature wired** — `client/src/vendor/ui` ships
components for absent features, and comments carry ticket codes (`F1`, `A2`, `T1.3`, `T3`)
from a larger private codebase.
