# e2e/ — `@devdigest/e2e`

Deterministic browser flows over the main journeys, driven by Vercel `agent-browser`
(Rust/CDP CLI — no Playwright, no LLM). Flow format and locator rules: `README.md`.

## `specs/` here is NOT a spec folder

`specs/*.flow.json` is the flow directory, read by `run.ts` at startup. Feature specs go
in `docs/`.

## Rules

- **Deterministic locators only**: `--url`, `--text`, `find role|text|label`. **Never**
  the AI `chat` command — unrepeatable, and needs a key.
- **A failing command IS the assertion.** Non-zero exit fails the step and aborts the
  flow; `wait --text` / `wait --url` exit non-zero when their condition never holds.
  `assert.stdoutIncludes` is an extra check, not the primary one.
- **Seeded data only.** Nothing may trigger an LLM call or need a key. A journey that
  needs a model does not belong in this suite.
- **Flows run in lexical filename order, sharing one browser session** (the daemon keeps
  the page between commands) — but must not depend on another flow's state.
- **npm, not pnpm** — own lockfile. `npm test` runs `run.ts`.

## Preconditions

`npm test` drives an already-running stack; it starts nothing. It needs the web app up, a
freshly seeded DB, and `npm i -g agent-browser && agent-browser install`.

Prefer `npm run e2e:hermetic` (`../scripts/e2e.sh`): isolated Postgres and stack on ports
5433 / 3101 / 3100, so it never touches your dev DB. CI builds its own stack instead.

## Gotchas

- **Flow `02` assumes the seeded demo repo is the only repo** — it follows the home
  redirect to the *first* one, so it fails legitimately against a dev DB with your own
  repos. That is what the ephemeral Postgres in `e2e.sh` is for.
- Env: `E2E_BASE_URL` (default `http://localhost:3000`), `AGENT_BROWSER_BIN`,
  `E2E_STEP_TIMEOUT` (default 60000 ms).
- A failed step writes `test-results/<flow>-fail.png` best-effort — look before debugging.

## Read when

- Writing or changing a flow → `README.md`.
- Deciding whether a case belongs here at all → `../TESTING.md` § philosophy.
- The UI under a flow changed → `../client/CLAUDE.md`.
