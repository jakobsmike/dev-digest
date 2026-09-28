# reviewer-core/ — the pipeline, slot by slot

What `reviewPullRequest()` actually does between a diff and a grounded review. The public
API is in `../README.md`; the rules you must not weaken are in `../CLAUDE.md`.

## Shape

```
ReviewInput ──► selectMode ──► chunk(s) ──► assemblePrompt ──► completeStructured
                                                                      │
                             ReviewOutcome ◄── scoreFromFindings ◄── groundFindings ◄── reduce
```

Everything here is pure. The only side effect in the package is the injected
`LLMProvider`; there is no DB, filesystem, GitHub or `process.env`. If a change needs
something from outside, it becomes a field on `ReviewInput` and the caller
(`../server/src/modules/reviews/run-executor.ts`) resolves it.

## 1. Mode selection

`selectMode(strategy, diff, threshold)`:

- `single-pass` — always one call, whole diff.
- `map-reduce` — one call per changed file, but only when the diff has **more than one
  file**; a single-file diff silently falls back to single-pass.
- `auto` (default) — map-reduce only when the diff is both large (over the line
  threshold) **and** multi-file. Otherwise one call.

The practical consequence for tests: passing `strategy: 'map-reduce'` with a one-file
fixture does not exercise map-reduce.

## 2. Prompt assembly

`assemblePrompt` fills a fixed set of slots, in a **deliberate order**:

```
task → PR description → skills → memory → repo skeleton → project context → callers → diff
```

The invariant that makes the course's lesson features additive: **an empty slot omits its
section entirely**. With `skills`, `memory`, `specs`, `callers`, `repoMap` and
`prDescription` all absent, the prompt is byte-identical to the one the starter produces.
Adding a feature must never perturb the prompt of a repo that does not use it.

Every externally-sourced string is wrapped with `wrapUntrusted`, and each system prompt
carries `INJECTION_GUARD`. There is no keyword or denylist scanning of untrusted text —
the defence is structural (delimited, labelled, never executed), not lexical.

Section order is duplicated in `../../docs/agent-prompts/README.md`; change both.

## 3. The model call

`completeStructured` asks for a JSON `Review` and validates it against the Zod schema,
retrying on a shape failure up to `maxRetries`. Between chunks it consults
`checkCancelled`, which the caller supplies and which **throws** to abort — the engine
stays agnostic about the caller's error type (the server throws `RunCancelledError`).

Per-chunk accounting is summed on the way out:

- `tokensIn` / `tokensOut` — plain addition.
- `costUsd` — addition, but **null is contagious**: if any chunk's cost is unknown, the
  run's cost is `null`. A partial sum would read as a real total and under-report.

## 4. Reduce

Map-reduce partials are merged into one `Review`. Findings keep their citations; the
per-chunk labels survive into `ReviewOutcome.chunks` so the server can render them as
tool calls in the run trace.

## 5. Grounding — the gate

`groundFindings` drops any finding whose cited lines miss every hunk of the diff. This is
what stops a confident model from inventing `src/config.ts:999`. Kinds in
`FULL_FILE_KINDS` are exempt from line matching and need only the file to be present,
because a "secret committed" or "lethal trifecta" finding is about the file, not a line.

The outcome reports `grounding` as a human string (`"3/4 passed"`) and keeps every
dropped finding with its reason in `dropped` — the engine never goes silent about what it
threw away.

## 6. Scoring

`scoreFromFindings` recomputes the score from the **survivors**, applying a per-severity
penalty. The model's self-reported score is read and discarded. Two reasons: cheap models
report nonsense (an "approve" with score 10), and a derived score cannot contradict the
list of findings shown next to it.

## Testing this package

`npm test` — vitest, hermetic, stubbed `LLMProvider`. No keys, no network, no Docker. A
test that needs a real provider does not belong here.

The stub is usually a hand-rolled object literal implementing `LLMProvider`, which lets a
test control per-call results — that is how the cost null-propagation case is exercised
(`test/run.test.ts`, `costingLlm`).

## Packaging traps

- **npm, not pnpm.** Own lockfile.
- **Never emits JS.** `build` is a type-check; the server imports `src/` as raw TypeScript
  through a tsconfig alias, so an edit is live on the next `tsx` reload.
- `@devdigest/shared` is aliased **twice** — `tsconfig.json` `paths` and
  `vitest.config.ts` `resolve.alias`. Change both or tests and typecheck disagree.
- A runtime dependency here becomes a **server boot** dependency. Prefer none.

## Read next

- Public API and diagram → `../README.md`
- What must stay true of grounding → `../specs/grounding.md`
- Prompt contents and order → `../../docs/agent-prompts/README.md`
- How the server feeds this → `../../server/docs/architecture.md`
