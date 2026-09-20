# docs/ — cross-cutting deep dives

Detail true across packages, too long for a `CLAUDE.md`. Loaded on demand from the root
`../CLAUDE.md` § Read when. Package-specific detail goes in that package's `docs/`.

| File | Read when |
|---|---|
| `architecture.md` | Changing the review flow end to end, cross-package wiring, or the composition root. |
| `contracts.md` | Changing a request/response shape, or anything in `@devdigest/shared`. |
| `agent-prompts/` | Writing a reviewer's system prompt, or changing what the model sees. |

Adding one: give it a **trigger**, not a topic, and add the matching
`<trigger> → docs/<file>.md` line to `../CLAUDE.md` — a doc nothing links to is
never read. Never restate `README.md`; link its section.
