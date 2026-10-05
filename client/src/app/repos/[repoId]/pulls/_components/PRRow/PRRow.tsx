/* PRRow — one clickable row in the PR list table. Ported from screen_dashboard.jsx. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon, Avatar, Badge, CircularScore, SeverityBadge } from "@devdigest/ui";
import type { PrMeta } from "@/lib/types";
import { formatCost } from "@/lib/cost";
import { usePrReviews } from "@/lib/hooks/reviews";
import { FindingsPreviewCard, anchorTo } from "@/components/findings-preview";
import { FINDINGS_SEVERITIES, SIZE_COLOR, STATUS_META } from "../../constants";
import { latestFindingsPerAgent, relativeTime, sizeOf } from "../../helpers";
import { s } from "../../styles";

export function PRRow({ pr, repoId }: { pr: PrMeta; repoId: string }) {
  const t = useTranslations("prReview");
  const router = useRouter();
  const [h, setH] = React.useState(false);
  const st = STATUS_META[pr.status] ?? STATUS_META.needs_review!;
  const { size, lines } = sizeOf(pr);
  const reviewed = pr.score != null; // null score ⇒ PR has never been reviewed
  const counts = pr.findings_counts ?? null; // null ⇒ never reviewed (≠ reviewed, found nothing)
  // Viewport coords of the hover card, null while hidden. The findings are
  // fetched lazily — the query only fires once the cell is first hovered, and
  // TanStack Query caches it from then on, so idle rows cost nothing.
  const [preview, setPreview] = React.useState<{ top: number; left: number } | null>(null);
  const { data: reviews } = usePrReviews(preview ? pr.id : null);
  const previewFindings = React.useMemo(() => latestFindingsPerAgent(reviews ?? []), [reviews]);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={() => router.push(`/repos/${repoId}/pulls/${pr.number}`)}
      style={s.row(h)}
    >
      <div style={s.rowTitleCell}>
        <Icon.GitPullRequest size={15} style={s.rowIcon(st.c)} />
        <div style={s.rowTitleWrap}>
          <div style={s.rowTitle(h)}>{pr.title}</div>
          <span className="mono" style={s.rowNumber}>
            #{pr.number}
          </span>
        </div>
      </div>
      <div style={s.authorCell}>
        <Avatar name={pr.author} size={18} />
        {pr.author}
      </div>
      <div>
        <Badge
          color={SIZE_COLOR[size]}
          bg="transparent"
          style={s.sizeBadgeBorder(SIZE_COLOR[size]!)}
        >
          {size} · {lines}
        </Badge>
      </div>
      <div style={s.scoreCell}>
        {reviewed ? (
          <CircularScore score={pr.score!} size={34} stroke={3} />
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
      <div
        style={s.findingsCell}
        onMouseEnter={(e) => counts && setPreview(anchorTo(e.currentTarget))}
        onMouseLeave={() => setPreview(null)}
      >
        {counts == null ? (
          <span style={s.muted}>—</span>
        ) : (
          FINDINGS_SEVERITIES.map(({ key, sev }) =>
            counts[key] > 0 ? (
              <span
                key={key}
                role="link"
                tabIndex={0}
                aria-label={t("list.findingsBySeverity", { count: counts[key], severity: sev })}
                // The whole row navigates to the PR; these jump to the same PR
                // with that severity already selected, so the row's handler must
                // not also fire.
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/repos/${repoId}/pulls/${pr.number}?tab=findings&severity=${sev}`);
                }}
                style={s.findingsChip}
              >
                <SeverityBadge severity={sev} count={counts[key]} compact />
              </span>
            ) : null,
          )
        )}
        {preview && previewFindings.length > 0 && (
          <FindingsPreviewCard
            findings={previewFindings}
            title={t("list.findingsPreviewTitle", { count: previewFindings.length })}
            top={preview.top}
            left={preview.left}
          />
        )}
      </div>
      <div>
        <Badge dot color={st.c} bg="transparent">
          {t(`list.status.${st.labelKey}`)}
        </Badge>
      </div>
      <div className="mono" style={s.costCell}>
        {pr.cost_usd == null ? (
          <span style={s.muted}>—</span>
        ) : (
          formatCost(pr.cost_usd)
        )}
      </div>
      <div style={s.updatedCell}>{relativeTime(pr.updated_at)}</div>
    </div>
  );
}
