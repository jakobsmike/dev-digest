# specs/ — what we are about to build

A spec describes **work that does not exist yet**. It is task-scoped input for an
implementation session, not documentation of the system.

- This folder holds **cross-cutting** specs — features that touch more than one package,
  such as the L01–L08 course lessons (see `../README.md` § What you build in the course).
- A spec that lives inside one package belongs in that package's `specs/` instead.
- `e2e/` has no feature-spec folder: `e2e/specs/` is already the agent-browser flow
  directory, hard-coded in `e2e/run.ts`. Feature specs for e2e go in `e2e/docs/`.

Once a spec has shipped, archive or delete it. A stale spec is worse than no spec,
because an agent cannot tell it from a live one.

## Suggested shape

```markdown
# L0X — <feature name>

## Goal
One paragraph: what a user can do after this ships that they cannot do today.

## Scope
- In: …
- Out: …

## Touches
Which packages and modules, and which existing contracts change.

## Acceptance
Observable checks. "The prompt is byte-identical when the flag is off" beats
"works correctly".
```
