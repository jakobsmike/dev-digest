/**
 * The counter chips and the list they filter are computed by these two
 * functions, so the contract that matters is that they agree: a chip reading
 * "2" must always produce exactly 2 cards, whatever else is toggled.
 */
import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { severityCounts, visibleFindings } from "./helpers";

function finding(o: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "WARNING",
    category: "bug",
    title: "t",
    file: "src/a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "r",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

const FINDINGS: FindingRecord[] = [
  finding({ id: "s1", severity: "SUGGESTION" }),
  finding({ id: "c1", severity: "CRITICAL" }),
  finding({ id: "w1", severity: "WARNING" }),
  finding({ id: "c2", severity: "CRITICAL", confidence: 0.2 }), // dropped by hide-low
];

describe("severityCounts", () => {
  it("orders severest first, whatever order the findings arrive in", () => {
    expect(severityCounts(FINDINGS)).toEqual([
      ["CRITICAL", 2],
      ["WARNING", 1],
      ["SUGGESTION", 1],
    ]);
  });

  it("omits severities with no findings rather than showing a zero", () => {
    const counts = severityCounts([finding({ id: "c1", severity: "CRITICAL" })]);
    expect(counts).toEqual([["CRITICAL", 1]]);
    expect(counts.map(([sev]) => sev)).not.toContain("WARNING");
  });

  it("is empty for no findings", () => {
    expect(severityCounts([])).toEqual([]);
  });
});

describe("visibleFindings", () => {
  it("sorts by severity", () => {
    expect(visibleFindings(FINDINGS, false).map((f) => f.id)).toEqual(["c1", "c2", "w1", "s1"]);
  });

  it("drops low-confidence findings when asked", () => {
    expect(visibleFindings(FINDINGS, true).map((f) => f.id)).toEqual(["c1", "w1", "s1"]);
  });

  it("narrows to one severity", () => {
    expect(visibleFindings(FINDINGS, false, "CRITICAL").map((f) => f.id)).toEqual(["c1", "c2"]);
  });

  it("applies the severity filter on top of hide-low, not instead of it", () => {
    expect(visibleFindings(FINDINGS, true, "CRITICAL").map((f) => f.id)).toEqual(["c1"]);
  });
});

describe("counts and list agree", () => {
  // The bug this guards: counting the full list while the panel renders the
  // hide-low list, so a chip says 2 and clicking it yields 1 card.
  it.each([false, true])("every chip's number equals its card count (hideLow=%s)", (hideLow) => {
    for (const [sev, n] of severityCounts(visibleFindings(FINDINGS, hideLow))) {
      expect(visibleFindings(FINDINGS, hideLow, sev)).toHaveLength(n);
    }
  });
});
