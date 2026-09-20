# reviewer-core/specs/ — engine-local feature specs

Work that lives **inside the engine only** — a new prompt slot, grounding rule, or reduce
strategy. Almost every engine change also has a caller change, so most specs belong in
`../../specs/`; use this folder only when nothing outside `src/` moves.

Format and lifecycle: `../../specs/README.md`. Delete a spec once it ships.

Worth writing when it can answer, before any code exists:

- which `ReviewInput` field carries the input, and what the caller resolves to fill it
  (the engine does no I/O — it cannot fetch anything itself)
- where the section lands in the user message, and that the prompt stays byte-identical
  when the input is absent
- what the grounding gate does with the findings it produces
- whether `Review` / `Finding` in `@devdigest/shared` changes — if so it is not
  engine-local, and the spec belongs at the root
- what the stubbed `LLMProvider` returns in the test
