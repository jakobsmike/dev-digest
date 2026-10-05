import type { FindingRecord } from "@devdigest/shared";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

/**
 * Optionally drop low-confidence findings, narrow to one severity, and sort by
 * severity. `severity` is applied AFTER the confidence filter so the counter
 * chips (which count the post-hide-low list) stay in step with the list.
 */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severity: string | null = null,
): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  if (severity) shown = shown.filter((f) => f.severity === severity);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

/**
 * Findings per severity, severest first, omitting severities with none.
 *
 * Feed this the list the user can actually see (i.e. after hide-low, before the
 * severity filter): a chip's number is then exactly how many cards clicking it
 * produces, and a chip that would filter to nothing never appears.
 */
export function severityCounts(findings: FindingRecord[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const f of findings) counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
  return [...counts.entries()].sort(
    ([a], [b]) => (SEVERITY_ORDER[a] ?? 9) - (SEVERITY_ORDER[b] ?? 9),
  );
}
