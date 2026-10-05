# Spec — what the browser suite must cover

**Status:** built. Behaviour that must stay true, not work to be done.

Prose, not a flow: `run.ts` reads only `*.flow.json` from this folder and ignores this
file. It states what the executable flows beside it are for, and what they are not for.

## The contract of this suite

1. **Every flow is deterministic.** Read-only seeded data, no model call, no API key. A
   flow that needs an LLM response does not belong here — that is what
   `server/test/*.it.test.ts` with `MockLLMProvider` is for.
2. **Every flow asserts something a user can see**, addressed by its visible text or ARIA
   role. Never a CSS path, never an internal id.
3. **A flow fails loudly or not at all.** Any non-zero command exit fails the flow; there
   is no soft assertion.
4. **Flows run in lexical filename order and share one browser session.** A new flow must
   tolerate wherever the previous one left the page, and must leave the app in a state the
   next one can start from.

## Current coverage

| Flow | Guarantees |
| --- | --- |
| `01-app-boot` | the app boots and the root redirects to the seeded repo's PR list |
| `02-repo-pulls-detail` | a PR row opens the detail route and its header renders |
| `03-agents` | the agents list renders and an agent opens in the editor |
| `04-pr-findings` | Agent runs tab → the seeded run's accordion shows verdict, finding count and a FindingCard |
| `05-pr-diff` | Files changed renders a file-by-file diff |
| `06-onboarding` | the onboarding route renders |
| `07-settings` | settings sections render and secret state shows without exposing a value |

## Deliberately not covered

- **Anything that spends money.** Triggering a real review, any live provider call.
- **Timing-dependent UI** — SSE progress, live log streaming, the 4s run poll. These are
  covered by unit tests against the hook, because asserting on them in a browser buys
  flake rather than confidence.
- **Layout and clipping.** A flow proves an element is in the DOM and reachable, not that
  it is visible or unclipped. Hover popovers are the live example: JSDOM cannot catch
  clipping and neither can a `wait --text`. That check stays manual.
- **Both themes.** Covered by the client's render smoke test instead.

## Adding a flow

A new flow earns its place when it protects a path a user actually takes and that unit
tests cannot reach — typically a route transition, or a component that only assembles
correctly with real data. Number it after the last one, describe in its `description`
which components it exercises and what seeded state it assumes, and label every step.

If the behaviour is still being designed, write `../docs/spec-<name>.md` first and delete
it once the flow ships.
