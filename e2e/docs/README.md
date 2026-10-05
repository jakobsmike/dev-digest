# e2e/docs/ — deep dives **and** feature specs

Two roles, because `../specs/` is the agent-browser flow directory (`*.flow.json`, read
by `run.ts`) and cannot hold prose.

- **Deep dives** — detail too long for `../CLAUDE.md`.
- **Feature specs** — planned flows, named `spec-<name>.md`, deleted once the flow ships.
  Format: `../../specs/README.md`.

Contents:

- `flows.md` — the execution model, how to write a flow that does not rot, and how to
  debug one when it breaks.

Flow format and env knobs: `../README.md`. Suite strategy: `../../TESTING.md`.
