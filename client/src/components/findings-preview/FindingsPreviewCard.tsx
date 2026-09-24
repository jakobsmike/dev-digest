/* FindingsPreviewCard — the hover popover listing a PR's (or a run's) findings:
   severity, title, category, file:line, confidence and a clamped rationale.
   Shared by the PR list's FINDINGS column and the PR detail timeline. */
"use client";

import React from "react";
import { Icon, SeverityBadge, CategoryTag, type Severity, type Category } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { CARD_WIDTH, s } from "./styles";

/** Severity display order, severest first. Mirrors the `Severity` contract. */
export const PREVIEW_SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const;

/** Findings severest-first; unknown severities sort last rather than vanish. */
export function sortBySeverity(findings: FindingRecord[]): FindingRecord[] {
  const rank = (sev: string) => {
    const i = PREVIEW_SEVERITIES.indexOf(sev as (typeof PREVIEW_SEVERITIES)[number]);
    return i === -1 ? PREVIEW_SEVERITIES.length : i;
  };
  return [...findings].sort((a, b) => rank(a.severity) - rank(b.severity));
}

/**
 * Where to put the card so it stays on screen: below the anchor, left-aligned
 * with it, nudged back inside the viewport when the anchor sits near the edge.
 */
export function anchorTo(el: Element): { top: number; left: number } {
  const r = el.getBoundingClientRect();
  return {
    top: r.bottom + 6,
    left: Math.max(8, Math.min(r.left, window.innerWidth - CARD_WIDTH - 8)),
  };
}

export function FindingsPreviewCard({
  findings,
  title,
  top,
  left,
}: {
  findings: FindingRecord[];
  /** Translated header, e.g. "8 findings" / "3 findings in this run". */
  title: string;
  /** Viewport coordinates of the card's top-left corner. */
  top: number;
  left: number;
}) {
  const sorted = React.useMemo(() => sortBySeverity(findings), [findings]);
  if (sorted.length === 0) return null;
  return (
    // The anchors are inside clickable rows; a click on the card itself must not
    // navigate away.
    <div style={s.card(top, left)} onClick={(e) => e.stopPropagation()}>
      <div style={s.title}>
        <Icon.AlertOctagon size={12} />
        {title}
      </div>
      {sorted.map((f, i) => (
        <div key={f.id} style={i === sorted.length - 1 ? { ...s.item, ...s.itemLast } : s.item}>
          <div style={s.head}>
            <SeverityBadge severity={f.severity as Severity} compact />
            <span style={s.itemTitle}>{f.title}</span>
            <CategoryTag category={f.category as Category} />
          </div>
          <div style={s.meta}>
            <span className="mono" style={s.file}>
              {f.file}:{f.start_line}
            </span>
            <span style={s.conf}>{Math.round(f.confidence * 100)}% conf</span>
          </div>
          <div style={s.rationale}>{f.rationale}</div>
        </div>
      ))}
    </div>
  );
}
