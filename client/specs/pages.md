# Spec — routes and what each one must show

**Status:** built. Behaviour that must stay true, not work to be done. Change the code and
this file together.

Every route below is reachable from the shell sidebar. Data arrives only through hooks in
`src/lib/hooks/*` — a component that calls `fetch` or builds a URL by hand is a bug.

## `/repos/:repoId/pulls` — Pull Requests

Source: `usePulls(repoId)` → `GET /repos/:id/pulls`, refetch every 60s and on focus.

Eight columns, in this order. **`GRID` and `COLUMN_KEYS` in `constants.ts` must stay in
sync** — a mismatch skews the whole table silently, and no test catches it.

| Column | Shows | When absent |
| --- | --- | --- |
| Pull request | title + `#number` | — |
| Author | avatar + login | — |
| Size | S/M/L + changed lines | — |
| Score | score ring | `—` (never reviewed) |
| Findings | one chip per non-zero severity, icon + count | `—` (never reviewed) |
| Status | needs review / reviewed / stale / merged / closed | — |
| Cost | total USD across all successful runs | `—` (no successful run) |
| Updated | relative time | `—` |

Required behaviour:

- Clicking a **row** opens the PR. Clicking a **findings chip** opens the PR at
  `?tab=findings&severity=<SEV>` and must **not** also fire the row's navigation —
  `stopPropagation` is load-bearing here, and there is a test that only one navigation
  happens.
- Hovering the findings cell opens a read-only preview card titled "N findings in this
  run", listing severity, title, category, `file:line`, confidence and a clamped
  rationale. **No buttons** — accept/dismiss belongs on the PR detail page only.
- The preview fetches lazily: `usePrReviews` is disabled until the first hover, then
  React Query caches it. Idle rows must cost nothing.
- The card is `position: fixed` with clamped viewport coordinates, because the list
  container clips overflow. JSDOM cannot catch a regression here — check it in a browser.
- `—` and `0` mean different things everywhere in this table: `—` is "we have nothing",
  `0`/`$0` would be a measured zero.

## `/repos/:repoId/pulls/:number` — PR detail

Tab state in `?tab=`, defaulting to `overview`. Three tabs: **Overview**, **Agent runs**
(internally `findings`), **Files changed**.

### Agent runs → Timeline

Runs and commits interleaved, newest first, DB-backed so it survives reload.

- The badge reflects the **review outcome**, not the run lifecycle: a finished run with
  blockers reads "rejected", never a green "done".
- A settled run shows severity chips (icon + count) matched to its review by `run_id`,
  plus blockers; hovering them opens the same preview card, scoped to **that run only**.
- A run whose review has no `run_id` falls back to the plain "N finding(s)" text rather
  than rendering an empty strip.
- Failed runs show their error inline. Cost appears under the timestamp for settled runs.

### Agent runs → Review runs

One accordion per review run. Header: agent, verdict, findings/blockers, score, cost,
timestamp, trace link. Expanded, in order:

1. **VerdictBanner** — verdict, summary, PR SCORE ring.
2. **Counter row** — read-only pills `N CRITICAL · N WARNING · N SUGGESTION`, only for
   severities this run actually found.
3. **Filter row** — three buttons, **Critical / Warning / Suggestion**, always all three.
   Clicking one shows only that severity; clicking it again clears. A filter matching
   nothing shows the empty state and stays pressed — it must not silently release itself.
4. **Finding cards** — each with Accept / Dismiss / Learn / Reply to author.

Invariants:

- A counter's number **equals** the number of cards its filter yields. Counts are taken
  over the post-hide-low list, so toggling "Hide low confidence" changes both together.
- Counting is a plain group-by over findings already in memory. **No LLM call** on page
  open or filter change.
- Each accordion filters independently — two runs on one PR do not share filter state.
- `?severity=` seeds the initial filter of every panel and is never written back.

### Trace drawer

Opened from a timeline run (`?trace=<runId>`). Tabs: Trace, Live log. Trace shows
Configuration, **Stats** (`DURATION · TOKENS · COST · FINDINGS` plus a grounding badge),
the run's **findings**, prompt assembly, tool calls and raw output.

## `/agents`, `/agents/:id` — Agents

List of agents with provider/model and enabled state; the editor covers prompt, model,
strategy and the CI gate. Saving bumps the agent's version — history is kept, so an old
run keeps pointing at the version that produced it.

## `/settings/:section`, `/onboarding`, `/`

Settings is section-routed (models, secrets, …). Secrets are write-only: the UI shows
whether a key exists, never its value, and a key saved here overrides `.env`. `/` and
`/onboarding` are client components that redirect into the active repo.

## Cross-cutting

- Query errors toast only on status `0` or ≥500. Expected 4xx stay silent so inline empty
  states can handle them. Mutations always toast.
- A network failure surfaces as `ApiError` with status `0`.
- A stale or unknown `:repoId` renders a friendly empty state, never a 404 error screen.
