# e2e/ — how a flow runs, and how to debug one

Deep dive on the runner. The flow JSON format and env knobs are in `../README.md`; suite
strategy across the repo is in `../../TESTING.md`.

## Why there is no test framework here

`agent-browser` is a CDP automation **CLI**, not a test runner. Rather than wrap it in
Playwright or vitest, this package adds the thinnest possible convention: a flow is a JSON
list of CLI invocations, and `run.ts` shells out to them in order.

That buys two things worth the austerity:

- **No LLM, no API key, no flake budget.** Every flow targets read-only seeded data. A
  failure means the UI changed, not that a model answered differently today.
- **The assertion is the command.** `wait --text "#482"` *is* the assertion: agent-browser
  exits non-zero when the condition never holds, and a non-zero exit fails the step and
  the flow. `run.ts` adds only light substring checks (`stdoutContains`) on top.

## Execution model

- `run.ts` reads `../specs/*.flow.json`, filtered on that suffix and sorted **lexically** —
  which is why flows are numbered `01-`, `02-`, … Anything else in `specs/` (this
  package's prose specs, for instance) is ignored by the runner.
- All commands of all flows share **one browser session**: the agent-browser daemon keeps
  the page alive between invocations. Flows therefore are not isolated from each other —
  a flow that navigates somewhere leaves the next one there.
- `{BASE}` in any argument is substituted with `E2E_BASE_URL` (default
  `http://localhost:3000`) by `resolveArgs`.
- Each command gets `E2E_STEP_TIMEOUT` ms (default 60000). A hung selector costs a minute,
  so prefer `wait --text` on something specific over a bare `wait --load`.

## Writing a flow that does not rot

- **Anchor on user-visible text, not structure.** `find text "Add rate limiting to public
  API endpoints" click` survives a refactor that renames a component; a CSS path does not.
- **Wait on the URL after every navigation** (`wait --url "/pulls/482"`). Without it the
  next command races the route change and fails somewhere unrelated.
- **Label every step.** The label is what the failure report prints; `"seeded run
  accordion shows its verdict"` localises a break far faster than the raw command.
- **Encode what the UI does by default.** `04-pr-findings.flow.json` relies on the newest
  run's accordion being open on load (FindingsTab passes `defaultOpen` to the first run)
  and says so in its `description` — so when that default changes, the flow's own text
  explains why it broke.
- **Assume the seeded DB.** Flows are written against `acme/payments-api` PR #482 as the
  first repo, guaranteed by the CI workflow and by `scripts/dev.sh` locally.

## Debugging a failure

1. Read the step `label` in the summary — it names the user-facing thing that did not
   appear.
2. Re-run with the app already open in a normal browser and perform the steps by hand. A
   flow failure is usually a genuine UI change, not a runner problem.
3. If `wait --text` fails on text you can see, suspect **CSS-transformed text**:
   `SeverityBadge` renders `Critical` and uppercases it in CSS, so the DOM text is not
   what the screen shows.
4. If a screenshot looks truncated, the window is too small rather than the page being
   broken — the shell scrolls in an inner `<main style={{overflow:"auto"}}>`, so the
   window itself never scrolls. Enlarge the viewport instead of scrolling.

## Read next

- Flow format, env, running locally → `../README.md`
- What the suite must cover → `../specs/coverage.md`
- Repo-wide test strategy and the CI split → `../../TESTING.md`
