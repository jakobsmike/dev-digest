# Spec — the review cycle

**Status:** built. This describes behaviour that must stay true, not work to be done.
Change the code and this file together; if they disagree, one of them is a bug.

Covers `POST /pulls/:id/review` through to what the PR list and PR detail read back.

## Triggering

- A review is **always manual**. Nothing in this package starts a review on a poll, a
  webhook, or a boot. `POST /repos/:id/poll` syncs the PR list and must not trigger one.
- `POST /pulls/:id/review` returns **202** with one run id per requested agent, before any
  model call. The request never blocks on the review.
- Requesting no agents runs every **enabled** agent. A disabled agent is never run
  implicitly.

## While a run is in flight

- Exactly one `agent_runs` row exists per agent per trigger, created with
  `status: 'running'` before the first token is spent.
- Live progress is published on `GET /runs/:id/events` (SSE). The bus is in-memory, so
  it is a convenience, never the source of truth: `GET /pulls/:id/runs` is authoritative
  and the client polls it every 4s while anything is running.
- Cancellation is cooperative. `checkCancelled` is consulted before each chunk's model
  call, so a cancel takes effect at the next chunk boundary, not mid-call.

## On success

All of this happens for one run, and the trace is written **once**:

| Written | Where | Note |
| --- | --- | --- |
| the review | `reviews` | verdict, summary, score, model |
| its findings | `findings` | only those that survived grounding |
| the run row | `agent_runs` | duration, tokens in/out, `cost_usd`, grounding, score, blockers |
| the whole trace | `run_traces` | ONE jsonb document, PK = run id |
| the reviewed sha | `pull_requests.last_reviewed_sha` | drives needs-review / reviewed / stale |

Invariants:

- **The model's self-reported score is discarded.** `scoreFromFindings` recomputes it from
  the findings that survived grounding, so the number and the list can never disagree.
- **`blockers` is deterministic**, computed from the agent's `ci_fail_on` gate — not from
  the model's verdict. The timeline colours on this, which is why a run that "approved"
  but tripped the gate still reads rejected.
- **`cost_usd` is the engine's total for the run**, summed across map-reduce chunks. It is
  `null` — never `0` — when any chunk's cost is unknown, because a partial sum would read
  as a real total.

## On failure or cancellation

- The run row is completed with `status: 'failed' | 'cancelled'`, the error text, zeroed
  tokens and **`cost_usd: null`**.
- A trace is still written, from the buffered log. A failed run must survive a reload with
  its error visible — it must not disappear from the timeline.
- A pre-work failure (diff load, missing clone) fails **every** queued run of that
  trigger, each with the same message.

## What the PR list reads back

`GET /repos/:id/pulls` aggregates on read — there is no denormalised column for any of
this, and each aggregation is one `IN` query plus grouping in JS, never N+1.

| Field | Rule | Absent means |
| --- | --- | --- |
| `score` | the **latest** review's score | never reviewed |
| `cost_usd` | **sum** over every `done` run of the PR; an unpriced run contributes 0 | no successful run yet — not "$0" |
| `findings_counts` | severities across **each agent's latest** review, unioned | never reviewed — not "found nothing" |
| `status` | derived from `last_reviewed_sha` vs head, plus age | — |

The three deliberately differ, and the differences are the spec:

- Cost **sums** because the question is "what has this PR cost me", and every run spent
  real money, superseded or not.
- Findings **union each agent's latest** review because reading only the newest review
  would hide the other agents, while reading every review would count a re-run's findings
  twice.
- Score takes **one** review because an averaged or summed score means nothing.

## What the PR detail reads back

- `GET /pulls/:id/runs` returns every run, any status, newest first — including failed
  ones with their error. This is what the timeline renders.
- `GET /pulls/:id/reviews` returns reviews with their findings; the timeline matches them
  to runs by `run_id`, and a run whose review has no `run_id` simply shows no chips.
- `GET /runs/:id/trace` returns the single trace document, whose `stats` carry
  `duration_ms`, `tokens_in`, `tokens_out`, `cost_usd`, `findings` and `grounding`.

## Deleting a run

`reviews.run_id` has **no FK** to `agent_runs`, so deleting a run must explicitly delete
the review it produced. Findings cascade from `reviews`. Skipping this leaves orphaned
findings visible in the Review Runs list under a run that no longer exists.

## Tests that hold this down

- `test/reviews.it.test.ts` — the happy path end to end, including that `cost_usd` is
  persisted and that grounding dropped the hallucinated finding.
- `test/integration.it.test.ts` — the list aggregations: cost totals across runs and
  ignores failed ones; findings union agents without double-counting a re-run.
- `test/pulls-status.test.ts` — `deriveReviewStatus` and `rollupSeverities` as pure
  functions.
- `../../reviewer-core/test/run.test.ts` — score determinism and cost null-propagation.
