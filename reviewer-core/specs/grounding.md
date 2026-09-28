# Spec — grounding and scoring

**Status:** built. Behaviour that must stay true, not work to be done. These are the two
invariants that make a review trustworthy; weakening either silently degrades every
downstream number.

## Grounding

**Every finding must cite lines that exist in the diff.** `groundFindings` drops the ones
that do not.

- A finding is kept when its `file` appears in the diff **and** its `start_line`..`end_line`
  intersects at least one hunk of that file.
- A finding whose `kind` is in `FULL_FILE_KINDS` (e.g. `secret_leak`, `lethal_trifecta`)
  needs only the **file** to be present. These are claims about a file, not a line, and
  holding them to a line match would drop correct findings.
- A dropped finding is never discarded silently: it lands in `ReviewOutcome.dropped` with
  a reason, and the run trace shows it.
- `ReviewOutcome.grounding` is a human-readable ratio — `"3/4 passed"` — and is persisted
  on both the run row and the trace.

Why this is not optional: the model is the only thing producing line numbers, and a
plausible-looking citation to a line that was never touched is the single most damaging
output this system can produce. The gate is the difference between "the model says" and
"the diff shows".

## Scoring

**The model's score is read and thrown away.** `scoreFromFindings` recomputes it from the
findings that survived grounding, using a fixed per-severity penalty.

- A review with zero surviving findings scores **100**, regardless of what the model
  claimed.
- The score can never disagree with the list rendered beside it, because it is derived
  from exactly that list.
- Grounding runs **before** scoring, so a dropped hallucination cannot lower the score.

Worked example, from `test/run.test.ts`: the model returns two findings and a
self-reported score of 38. Grounding drops the one citing line 999. One `CRITICAL`
survives, penalty 35, so the review scores **65** — not 38.

## Blockers are not computed here

`countBlockers(findings, failOn)` is exported from this package but expresses the
**agent's CI gate**, not a severity tally: it counts findings whose severity rank meets
`ciFailOn` (`never` / `critical` / `warning` / `any`). The server persists that number on
the run row and the timeline colours on it.

Do not confuse it with the three other notions of "how many" in this repo:

| Number | Where | Means |
| --- | --- | --- |
| `countBlockers` | here | findings that trip the agent's gate |
| `rollupSeverities` | `server/src/modules/pulls/status.ts` | raw per-severity tally for the PR list |
| `severityCounts` | `client/.../FindingsPanel/helpers.ts` | per-severity tally of what the user can currently see |

## Cost accounting

`ReviewOutcome.costUsd` is the sum over chunks, and **null is contagious**: one chunk with
an unknown cost makes the whole run's cost `null`. Never substitute `0` — the server and
the UI both treat `null` as "unknown" and `0` as "free", and they are shown differently.

## Tests that hold this down

`test/run.test.ts`:

- single-pass grounds and drops the hallucinated finding, grounding reads `1/2 passed`
- a clean approve scores 100 despite a nonsense model score
- map-reduce sums chunk costs
- one unpriced chunk makes the whole run's cost null
- `checkCancelled` throwing aborts before the model call
- `sessionId` is forwarded on every chunk call
