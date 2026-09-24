# reviewer-core/ — `@devdigest/reviewer-core`

The review engine: diff → prompt → LLM → grounded findings. Pipeline diagram and public
API: `README.md`.

## The one rule

**No I/O.** No DB, filesystem, GitHub or `process.env`; the only side effect is the
injected `LLMProvider`. If a change needs something from outside, add a field to
`ReviewInput` — the caller (`../server/src/modules/reviews/run-executor.ts`) resolves it.

## Packaging (not default here)

- **npm, not pnpm** — own lockfile. `npm test`, `npm run typecheck`.
- **Never emits JS.** `build` is a type-check. The server imports `src/` as raw
  TypeScript via a tsconfig alias, so an edit is live on the next `tsx` reload.
- `@devdigest/shared` aliases into `../server/src/vendor/shared`, declared twice —
  `tsconfig.json` `paths` and `vitest.config.ts` `resolve.alias`. Change both.
- A runtime dep here becomes a **server boot** dep (hence `npm ci` in `scripts/dev.sh`).
  Prefer none.

## Invariants — do not weaken

- **Grounding is mandatory.** `groundFindings` drops a finding whose cited lines miss
  every hunk; `FULL_FILE_KINDS` need only the file present.
- **The model's score is ignored** — `scoreFromFindings` recomputes it from the
  survivors, so the number and the list cannot disagree.
- **Wrap every external string** with `wrapUntrusted`, plus the `INJECTION_GUARD` on each
  system prompt. No keyword or denylist scanning of untrusted text.
- **An empty slot omits its section.** With `skills`/`memory`/`specs`/`callers`/
  `repoMap`/`prDescription` absent the prompt stays byte-identical — this is what makes
  the lesson features additive.
- **Section order is deliberate**: task → PR description → skills → memory → repo
  skeleton → project context → callers → diff. Change it together with
  `../docs/agent-prompts/README.md`.

## Tests

`npm test` — vitest, hermetic, stubbed `LLMProvider`. No keys, network or Docker. A test
needing a real provider does not belong here.

## Read when

- Changing the pipeline or the exported API → `README.md`.
- Changing what the model sees, or section order → `../docs/agent-prompts/README.md`.
- Changing a `Review` / `Finding` shape → `../docs/contracts.md` (the schema lives in the
  server's `vendor/shared`).
- Changing how the server feeds the engine → `../server/CLAUDE.md`.
- Writing tests → `../TESTING.md`.
