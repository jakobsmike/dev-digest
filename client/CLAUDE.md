# client/ — `@devdigest/web`

Next 15 (App Router) + React 19. The studio UI: repos, PR list, diff, findings, agents,
settings. `README.md` has the route map — not repeated here.

## Component convention

A component is a **folder**, not a file:

```
ComponentName/
├── ComponentName.tsx    the component
├── styles.ts            co-located CSSProperties objects, exported as `s`
├── constants.ts         literals, option lists, grid templates
├── helpers.ts           pure transforms
└── index.ts             re-export — import the folder, never the .tsx directly
```

Route-private components live under `_components/` next to the `page.tsx` that uses
them; shared ones in `src/components/`. Nest `_components/` inside a component folder
for its own private children.

## Rules

- **Styling**: co-located `styles.ts` objects typed `CSSProperties`, using design tokens
  as CSS variables (`var(--border)`, `var(--text-secondary)`). Tailwind is imported via
  the design system's `styles.css`, but style objects are the idiom here — match the
  surrounding files rather than introducing utility classes.
- **`@devdigest/ui` is vendored** (`src/vendor/ui/`). Consume its primitives, kit and
  shell. Do not refactor it, and do not restyle around it — add a variant there if one
  is genuinely missing. It also ships components for features the starter does not have
  (`LiveLogStream`, `ExportWizardSteps`, `AutoTriggerStatus`) — their presence means nothing.
- **Data access**: React Query hooks in `src/lib/hooks/*` on top of `lib/api.ts`. Never
  call `fetch` from a component, and never build a URL by hand. See `docs/data-fetching.md`.
- **Types come from `@devdigest/shared`** (`src/vendor/shared/` — a copy of the server's).
  When a contract changes, the server copy changes first. See `../docs/contracts.md`.
- **Strings live in `messages/en`** (next-intl). No hardcoded user-facing text.
- **Client components**: anything with hooks, state or browser APIs needs `"use client"`.
  Most of this app is client-side; `page.tsx` files are typically client components too.

## Tests

`pnpm test` — vitest + jsdom + React Testing Library. `fetch` is mocked; there is no API,
no DB and no browser. Test what the user sees: render, interact via `userEvent`, assert
on roles and text. See `../TESTING.md`.

## Gotchas

- The client's `vendor/shared` copy **has drifted** from the server's: it lacks
  `'openrouter'` in `Provider`, `AgentManifest`, `CommitFilesPayload` and `sessionId`,
  while the UI already offers OpenRouter. A nonsensical type error is usually this.
- `API_BASE` comes from `NEXT_PUBLIC_API_BASE` (default `http://localhost:3001`), injected
  through `next.config.mjs`. A network failure surfaces as `ApiError` with status `0`.
- Query errors toast only on status `0` or ≥500; expected 4xx stay silent so inline empty
  states can handle them. Mutations always toast.

## Read when

- Adding a route or page → `README.md` § UI route map.
- Fetching data, streaming a run, or invalidating a query → `docs/data-fetching.md`.
- Reaching for a UI primitive → `src/vendor/ui/README.md` (the design system documents itself).
- Changing a request/response shape → `../docs/contracts.md`.
- Writing tests → `../TESTING.md`.
