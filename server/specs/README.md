# server/specs/ — server-local feature specs

Specs for work that lives **inside this package only** — a new module, a new route
group, a schema addition. Anything that also changes the client or the engine belongs
in the repo-root `../../specs/` instead.

Format and lifecycle: see `../../specs/README.md`. Archive a spec once it ships.

A server spec is worth writing when it can answer, before any code exists:

- which module owns it (new folder, or an existing `modules/<name>/`)
- which routes it adds, with their Zod request/response schemas
- which tables it reads or writes, and whether a migration is needed
- which adapters it needs from the container, and what the mock returns in tests
- what happens when repo-intel is unindexed or a provider key is missing
