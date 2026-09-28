# client/ — UI architecture: where the Server/Client boundary actually sits

Next 15 App Router, React 19. This explains how the app is assembled; the route map is in
`../README.md` and data fetching has its own document, `data-fetching.md`.

## The boundary is unusually high, and that is deliberate

Almost everything here is a Client Component. Today only three files are server
components:

| File | Kind | Why |
| --- | --- | --- |
| `app/layout.tsx` | server | shell, fonts, `<Providers>` — no state of its own |
| `app/agents/page.tsx` | server | a two-line route entry that renders `<AgentsListView>` |
| `app/settings/[section]/page.tsx` | server | same shape — thin entry over a client view |

Every other `page.tsx` carries `"use client"`. That is not laziness: this is a
**local-first studio** where the API lives on `:3001` in a separate process, every screen
polls or streams, and there is no session on the Next server worth rendering against.
Server-rendering a PR list that must refetch every 60s and open an `EventSource` buys
nothing and costs a hydration boundary in the middle of the interactive part.

The pattern to copy when adding a route is the `agents` one: a thin server `page.tsx`
whose only job is to render a colocated `"use client"` view. It keeps the option of
server-side work open without forcing it.

**Anything with hooks, state, `useSearchParams` or browser APIs needs `"use client"`.**
That includes the deep parts of the tree — `FindingsPanel` reads `useSearchParams` to
seed its severity filter, so it is a client component even though nothing above it needed
to be.

## Component = folder, not file

```
ComponentName/
├── ComponentName.tsx    the component
├── styles.ts            CSSProperties objects, exported as `s`
├── constants.ts         literals, option lists, grid templates
├── helpers.ts           pure transforms (unit-testable without React)
└── index.ts             re-export — import the folder, never the .tsx
```

- **Route-private** components live in `_components/` beside the `page.tsx` that uses
  them. `_components/` can nest: `RunTraceDrawer/_components/TraceBody/`.
- **Shared** components live in `src/components/` — that is the bar for promotion. When
  the PR list and the PR detail timeline both needed the findings hover card, it moved to
  `src/components/findings-preview/` rather than being imported across route folders.

Putting pure logic in `helpers.ts` is what makes it testable: `FindingsPanel/helpers.ts`
(`visibleFindings`, `severityCounts`) has its own unit test with no DOM at all, and the
RTL test then only has to prove the wiring.

## Three style systems, and which one to use

1. **Co-located `styles.ts`** — the idiom. `CSSProperties` objects using design tokens as
   CSS variables (`var(--border)`, `var(--crit)`). A style that depends on state is a
   function: `s.row(hover)`, `s.filterButton(active, color)`.
2. **Design-system primitives** — `@devdigest/ui` in `src/vendor/ui/`. Consume them;
   never restyle around them. If a variant is genuinely missing, add it there.
3. **Tailwind** — imported by the design system's `styles.css` and essentially unused in
   app code. Do not introduce utility classes into a file that uses style objects.

`src/vendor/ui/**` is **do not touch**. It also ships components for features this
starter does not have (`LiveLogStream`, `ExportWizardSteps`, `AutoTriggerStatus`), so the
presence of a component there means nothing about whether the feature exists.

Colour is never the only signal: `SeverityBadge` always pairs its colour with an icon, and
in `compact` mode it drops the *label*, not the icon.

## Types and strings

- Types come from `@devdigest/shared` (`src/vendor/shared/`) — a **copy** of the server's.
  The server copy is canonical; change it first, mirror here in the same commit. The
  copies have drifted before, and the failure mode is a runtime Zod parse error, not a
  compile error. See `../../docs/contracts.md`.
- All user-facing text lives in `messages/en/*.json` (next-intl), keyed by screen area.
  A missing key throws at render, which is the cheapest test that a new string was wired.

## State: URL vs local

| State | Where | Why |
| --- | --- | --- |
| PR list status filter | URL `?status=` | shareable, survives reload |
| PR detail tab, open trace | URL `?tab=`, `?trace=` | same, and deep-linkable |
| PR list search text, sort | `useState` | transient, not worth a URL |
| Severity filter in a run's findings | `useState`, **seeded** from `?severity=` | one URL cannot hold a per-run filter, but the PR list still needs to deep-link into a filtered view |

`page.tsx` exposes a generic `setParam(key, value \| null)` — adding a new URL-backed
control needs no new plumbing.

## Read next

- Fetching, polling, SSE, cache invalidation → `data-fetching.md`
- What each route must show → `../specs/pages.md`
- The primitives inventory → `../src/vendor/ui/README.md`
- Contract changes → `../../docs/contracts.md`
