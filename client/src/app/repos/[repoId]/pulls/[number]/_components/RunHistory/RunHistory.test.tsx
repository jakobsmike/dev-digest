/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, ReviewRecord, RunSummary } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[], reviews: ReviewRecord[] = []) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunHistory runs={runs} reviews={reviews} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

function finding(o: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded Stripe secret key",
    file: "src/config.ts",
    start_line: 12,
    end_line: 12,
    rationale: "Line 12 contains a literal sk_live_ string.",
    suggestion: null,
    confidence: 0.98,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "rv1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

function review(runId: string, findings: FindingRecord[]): ReviewRecord {
  return {
    id: `rv-${runId}`,
    pr_id: "pr1",
    agent_id: "a1",
    run_id: runId,
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: "request_changes",
    summary: "s",
    score: 38,
    model: "deepseek/deepseek-v4-flash",
    grounding: "2/2 passed",
    created_at: "2026-06-11T18:44:34.000Z",
    findings,
  };
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — run cost", () => {
  it("shows what a settled run cost, next to when it ran", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95, cost_usd: 0.0412 })]);
    expect(screen.getByText("$0.0412")).toBeInTheDocument();
  });

  it("shows nothing when the run's cost is unknown", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95, cost_usd: null })]);
    expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
  });

  it("shows no cost for a run still in flight", () => {
    // A running row has no settled numbers yet — cost included.
    renderRuns([run({ status: "running", score: null, blockers: null, cost_usd: 0.0412 })]);
    expect(screen.queryByText("$0.0412")).not.toBeInTheDocument();
  });
});

describe("RunHistory — severity chips + hover preview", () => {
  const FINDINGS = [
    finding({ id: "f1", severity: "CRITICAL" }),
    finding({ id: "f2", severity: "CRITICAL", title: "Lethal trifecta", file: "src/api/webhooks.ts", start_line: 61 }),
    finding({
      id: "f3",
      severity: "WARNING",
      title: "Retry-After header omitted",
      category: "bug",
      file: "src/middleware/ratelimit.ts",
      start_line: 52,
    }),
  ];
  const settled = run({ status: "done", findings_count: 3, blockers: 2, score: 38 });

  /** The chips row is what the pointer hovers to open the card. */
  const chipsRow = () => screen.getByText(/2 blockers/).closest("div")!;

  it("falls back to the plain count when no review is matched to the run", () => {
    // Runs whose review has not loaded (or a failed run that produced none)
    // must still read sensibly rather than render an empty strip.
    renderRuns([settled]);
    expect(chipsRow()).toHaveTextContent("3 finding(s)");
  });

  it("shows a chip per severity once the run's review is matched by run_id", () => {
    renderRuns([settled], [review("run-1", FINDINGS)]);
    // SeverityBadge in compact mode renders the count only, no label.
    const row = chipsRow();
    expect(row).toHaveTextContent("2"); // two CRITICAL
    expect(row).toHaveTextContent("1"); // one WARNING
    expect(row).not.toHaveTextContent("3 finding(s)");
  });

  it("keeps the blocker count alongside the chips", () => {
    renderRuns([settled], [review("run-1", FINDINGS)]);
    expect(screen.getByText(/2 blockers/)).toBeInTheDocument();
  });

  it("opens the run's findings on hover and closes on leave", () => {
    renderRuns([settled], [review("run-1", FINDINGS)]);

    expect(screen.queryByText("Lethal trifecta")).not.toBeInTheDocument();

    fireEvent.mouseEnter(chipsRow());
    expect(screen.getByText("3 findings in this run")).toBeInTheDocument();
    expect(screen.getByText("Lethal trifecta")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();

    fireEvent.mouseLeave(chipsRow());
    expect(screen.queryByText("Lethal trifecta")).not.toBeInTheDocument();
  });

  it("previews only the hovered run, not another run's findings", () => {
    renderRuns(
      [settled, run({ run_id: "run-2", ran_at: "2026-06-11T17:00:00.000Z", status: "done", findings_count: 1, score: 90 })],
      [
        review("run-1", FINDINGS),
        review("run-2", [finding({ id: "g1", severity: "WARNING", title: "Only in run two" })]),
      ],
    );

    fireEvent.mouseEnter(chipsRow());

    expect(screen.getByText("Lethal trifecta")).toBeInTheDocument();
    expect(screen.queryByText("Only in run two")).not.toBeInTheDocument();
  });
});
