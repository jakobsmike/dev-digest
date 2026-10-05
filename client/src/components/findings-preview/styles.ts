import type { CSSProperties } from "react";

/** Co-located styles for FindingsPreviewCard. */
export const CARD_WIDTH = 400;
export const CARD_MAX_HEIGHT = 460;

export const s = {
  // Fixed, not absolute: both anchors sit inside containers that clip overflow
  // (the PR list's tableCard, the timeline's rows), so an absolutely-positioned
  // card would be silently cut off. JSDOM has no layout engine and would not
  // catch that in a test.
  card: (top: number, left: number): CSSProperties => ({
    position: "fixed",
    top,
    left,
    zIndex: 60,
    width: CARD_WIDTH,
    maxHeight: CARD_MAX_HEIGHT,
    overflowY: "auto",
    padding: 14,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  }),
  title: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  item: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  itemLast: { borderBottom: "none", paddingBottom: 0, marginBottom: 0 } satisfies CSSProperties,
  head: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  itemTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  meta: { display: "flex", alignItems: "center", gap: 10, fontSize: 12 } satisfies CSSProperties,
  file: { color: "var(--accent)" } satisfies CSSProperties,
  conf: { color: "var(--text-muted)" } satisfies CSSProperties,
  rationale: {
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "var(--text-secondary)",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } satisfies CSSProperties,
} as const;
