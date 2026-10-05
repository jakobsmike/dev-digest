/* FindingsPanel — severity counters + hide-low-confidence + j/k navigation +
   FindingCard list, wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState, SEV, type Severity } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { FILTER_SEVERITIES, KEY_TO_ACTION, SEVERITY_ORDER } from "./constants";
import { severityCounts, visibleFindings } from "./helpers";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [focusIdx, setFocusIdx] = React.useState(0);

  // `?severity=` SEEDS the filter (so the PR list can deep-link into a filtered
  // view) but is never written back: each run's panel filters independently, and
  // one URL cannot hold a per-run filter.
  const urlSeverity = useSearchParams()?.get("severity") ?? null;
  const [severity, setSeverity] = React.useState<string | null>(
    urlSeverity && urlSeverity in SEVERITY_ORDER ? urlSeverity : null,
  );

  // Counts are over the post-hide-low list, so a chip's number is exactly how
  // many cards clicking it produces.
  const counted = React.useMemo(() => visibleFindings(findings, hideLow), [findings, hideLow]);
  const counts = React.useMemo(() => severityCounts(counted), [counted]);
  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, severity),
    [findings, hideLow, severity],
  );

  // The focused card moves under the cursor whenever the list changes, so reset
  // it — otherwise j/k points at an index that no longer exists. The filter is
  // NOT cleared when its severity has no findings: the three buttons are always
  // present, and a filter that silently released itself would read as a broken
  // button rather than as an empty result.
  React.useEffect(() => {
    setFocusIdx(0);
  }, [severity, hideLow]);

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  return (
    <div>
      {/* Counts first, read-only: "3 CRITICAL · 2 WARNING". Only severities the
          run actually found appear, so the row never claims a zero. */}
      <div style={s.toolbar}>
        {counts.length > 0 && (
          <div role="group" aria-label={t("panel.severityCounters")} style={s.counterGroup}>
            {counts.map(([sev, n]) => (
              <span key={sev} style={s.counterPill(SEV[sev as Severity].c, SEV[sev as Severity].bg)}>
                <span className="tnum">{n}</span> {sev}
              </span>
            ))}
          </div>
        )}
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      {/* Filters second, and always all three: a control that appears and
          disappears as findings are accepted is worse than one that filters to
          an empty list. */}
      <div role="group" aria-label={t("panel.severityFilters")} style={s.filterBar}>
        {FILTER_SEVERITIES.map((sev) => {
          const active = severity === sev;
          return (
            <button
              key={sev}
              type="button"
              aria-pressed={active}
              onClick={() => setSeverity(active ? null : sev)}
              style={s.filterButton(active, SEV[sev].c)}
            >
              {SEV[sev].label}
            </button>
          );
        })}
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
