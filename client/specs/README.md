# client/specs/ — web-local feature specs

Work that lives **inside this package only** — a new screen or panel needing no server
change. Anything that also touches the API or the engine goes in `../../specs/`.

Format and lifecycle: `../../specs/README.md`. Delete a spec once it ships.

Worth writing when it can answer, before any code exists:

- which route owns it, and whether components are route-private (`_components/`) or
  shared (`src/components/`)
- which hooks it needs, and whether any endpoint is missing
- which query keys it reads, and what a write must invalidate
- which `@devdigest/ui` primitives it uses — and whether one is missing
- what the loading, empty and error states look like
- which strings go into `messages/en`
