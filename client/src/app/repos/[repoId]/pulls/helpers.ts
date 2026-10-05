import type { FindingRecord, ReviewRecord } from "@devdigest/shared";
import { SIZE_MEDIUM_MAX, SIZE_SMALL_MAX, type PrMeta, type SizeInfo } from "./constants";

/** Bucket a PR into S/M/L by total changed lines. */
export function sizeOf(pr: PrMeta): SizeInfo {
  const lines = pr.additions + pr.deletions;
  const size = lines < SIZE_SMALL_MAX ? "S" : lines < SIZE_MEDIUM_MAX ? "M" : "L";
  return { size, lines };
}

/**
 * Findings of each agent's LATEST review, flattened.
 *
 * Mirrors the rule `GET /repos/:id/pulls` applies to `findings_counts`, so the
 * hover preview lists exactly the findings the column counted: a superseded
 * re-run's findings are dropped, but every agent still contributes.
 */
export function latestFindingsPerAgent(reviews: ReviewRecord[]): FindingRecord[] {
  const newestFirst = [...reviews]
    .filter((r) => r.kind === "review")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const seenAgents = new Set<string>();
  const out: FindingRecord[] = [];
  for (const r of newestFirst) {
    const key = r.agent_id ?? "none";
    if (seenAgents.has(key)) continue;
    seenAgents.add(key);
    out.push(...r.findings);
  }
  return out;
}

/** Compact relative time for the list's UPDATED column (e.g. "3h", "2d"). */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const m = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
