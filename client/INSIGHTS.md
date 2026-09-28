# INSIGHTS — client

Newest first. One entry = one surprise that cost time. Tag each entry `**Category:**`
with one of: **What Works**, **What Doesn't Work**, **Codebase Patterns**, **Tool &
Library Notes**, **Recurring Errors & Fixes**, **Session Notes** (2–5 takeaways when no
single entry fits), or **Open Questions**. Bug-shaped entries keep
**Symptom/Cause/Rule**; the rest use a single **Note** (or **Question**) — write it
"actionable cold" (specific enough to act on without re-investigating). Promote a
hardened rule into `CLAUDE.md` (one line) and mark it `→ promoted`. Cross-module
findings: `../INSIGHTS.md`.

---

## 2026-09-24 — `@testing-library/user-event` is NOT installed

**Category:** Tool & Library Notes

**Evidence:** `client/package.json:27-28` — only `jest-dom` and `react` are there.

**Note:** `CLAUDE.md` § Tests says "interact via `userEvent`", but the package is not in
`package.json` — only `@testing-library/jest-dom` and `@testing-library/react`. Importing
it fails at collection time with `Failed to resolve import "@testing-library/user-event"`,
which reads like a path bug rather than a missing dependency. Every existing test uses
`fireEvent` from `@testing-library/react`; follow that. `fireEvent.click` is synchronous,
so the tests need no `async`/`await` — dropping them is part of the conversion.

## 2026-09-24 — Hover popovers must be `position: fixed`, and JSDOM cannot tell you

**Category:** What Doesn't Work

**Evidence:** `client/src/components/findings-preview/styles.ts:13`.

**Note:** both hover-card anchors — the PR list's `s.tableCard` (`overflow: hidden`) and
the timeline's run rows — clip absolutely-positioned children. A card anchored with
`position: absolute` renders, passes every RTL assertion, and is invisible in the browser,
because **JSDOM has no layout engine and never clips anything**. `findings-preview/styles.ts`
therefore uses `position: fixed` with viewport coordinates from
`getBoundingClientRect()` (`anchorTo()`), clamped to `window.innerWidth`. Any new popover
must do the same, and its test proves nothing about visibility — check it in a browser.

## 2026-09-24 — `SeverityBadge` in compact mode renders no text at all

**Category:** Tool & Library Notes

**Note:** `SeverityBadge` (`vendor/ui/primitives/Badge.tsx:52`) has two traps for tests.
Non-compact, it renders the label as `Critical` and uppercases it via CSS
`textTransform`, so `getByText("CRITICAL")` fails on text the user plainly sees as
"CRITICAL". With `compact`, it renders **only** the icon and the count — no severity text
exists in the DOM at all. Query such chips by their wrapper's accessible name
(`getByRole("button", { name: /only CRITICAL/i })`), never by severity text.

## 2026-09-20 — A failed agent run never reaches the global error toast

**Symptom:** an agent fails mid-review; the run eventually shows `failed`, but the user
sees nothing until a reload.
**Cause:** runtime failures arrive as SSE events with `kind: "error"`. The global handlers
in `lib/providers.tsx` only see rejected queries and mutations — and the
`POST /pulls/:id/review` mutation already resolved when the run was queued.
**Evidence:** `client/src/lib/hooks/reviews.ts:189`.
**Rule:** `useRunEvents` calls `notify.error` itself for `kind === "error"`. Do not
simplify that away, and keep the `addEventListener` kind list
(`info`/`tool`/`result`/`error`) in sync with the server's — each SSE event is named
after its kind.

## 2026-09-20 — `EventSource.onerror` fires on a normal stream close

**Symptom:** treating `onerror` as a failure makes every completed run look broken.
**Cause:** the server ends the stream when the run finishes, and the browser surfaces
that close as an `error`. There is no separate "server closed" callback.
**Evidence:** `client/src/lib/hooks/reviews.ts:200`.
**Rule:** in `useRunEvents`, `onerror` closes the source and decrements the open count —
that is exactly how `running` flips to `false`. Authoritative status comes from polling
`/pulls/:id/runs`, not from the stream.
