/**
 * PRRow — the Cost cell. Cost is the price of the PR's LATEST run, so it is
 * absent exactly as often as the score ring is: a PR nobody has reviewed, and a
 * run on a model with no known pricing, both read as an em dash rather than $0.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

// The hover preview fetches through TanStack Query; there is no QueryClient in
// these tests and no API to reach, so the hook is stubbed. `reviews` is what the
// preview would render once hovered.
let reviews: unknown[] = [];
vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: () => ({ data: reviews }),
}));

import { PRRow } from "./PRRow";

afterEach(() => {
  cleanup();
  push.mockClear();
  reviews = [];
});

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    id: "pr1",
    number: 482,
    title: "Add Stripe webhook handler",
    author: "marisa.koch",
    branch: "feat/stripe",
    base: "main",
    head_sha: "a1b2c3d",
    additions: 40,
    deletions: 2,
    files_count: 3,
    status: "reviewed",
    opened_at: "2026-06-10T10:00:00.000Z",
    updated_at: "2026-06-11T18:44:34.000Z",
    score: 87,
    cost_usd: null,
    findings_counts: null,
    ...o,
  };
}

function renderRow(meta: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={meta} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow — cost cell", () => {
  it("shows what the latest run cost, in cents-visible precision", () => {
    renderRow(pr({ cost_usd: 0.0412 }));
    expect(screen.getByText("$0.0412")).toBeInTheDocument();
  });

  it("drops to two decimals once a PR has cost more than a dollar", () => {
    renderRow(pr({ cost_usd: 1.2345 }));
    expect(screen.getByText("$1.23")).toBeInTheDocument();
  });

  it("shows an em dash for a PR with no priced run", () => {
    renderRow(pr({ cost_usd: null, score: null }));
    expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
    // The score ring, the findings cell and the cost cell each render one.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});

describe("PRRow — findings cell", () => {
  const chip = (severity: string) =>
    screen.getByRole("link", { name: new RegExp(`${severity} findings`, "i") });

  it("shows a chip per severity the PR has findings in", () => {
    renderRow(pr({ findings_counts: { critical: 3, warning: 5, suggestion: 2 } }));
    expect(chip("CRITICAL")).toHaveTextContent("3");
    expect(chip("WARNING")).toHaveTextContent("5");
    expect(chip("SUGGESTION")).toHaveTextContent("2");
  });

  it("omits a severity with no findings rather than showing a zero", () => {
    renderRow(pr({ findings_counts: { critical: 0, warning: 1, suggestion: 0 } }));
    expect(chip("WARNING")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /CRITICAL/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /SUGGESTION/i })).not.toBeInTheDocument();
  });

  it("reads as an em dash when the PR was never reviewed", () => {
    renderRow(pr({ findings_counts: null }));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("distinguishes 'reviewed, found nothing' from 'never reviewed'", () => {
    // All-zero counts still mean the PR HAS been reviewed, so no chips — but
    // the row must not claim an unreviewed PR either. Both render no links;
    // the score ring is what tells them apart.
    renderRow(pr({ findings_counts: { critical: 0, warning: 0, suggestion: 0 }, score: 100 }));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("a chip opens the PR with that severity already filtered", () => {
    renderRow(pr({ findings_counts: { critical: 3, warning: 0, suggestion: 0 } }));
    fireEvent.click(chip("CRITICAL"));
    expect(push).toHaveBeenCalledWith("/repos/repo-1/pulls/482?tab=findings&severity=CRITICAL");
  });

  it("clicking a chip does not also trigger the row's own navigation", () => {
    renderRow(pr({ findings_counts: { critical: 3, warning: 0, suggestion: 0 } }));
    fireEvent.click(chip("CRITICAL"));
    // One push, not two — the row handler must be stopped.
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("PRRow — findings hover preview", () => {
  const review = (findings: unknown[]) => ({
    id: "rv1",
    pr_id: "pr1",
    agent_id: "a1",
    run_id: "run1",
    kind: "review",
    verdict: "request_changes",
    summary: "s",
    score: 61,
    model: "gpt-4.1",
    created_at: "2026-06-11T10:00:00.000Z",
    findings,
  });
  const finding = (o: Record<string, unknown>) => ({
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret committed",
    file: "src/config.ts",
    start_line: 12,
    end_line: 12,
    rationale: "A literal sk_live_… key is committed; rotate it immediately.",
    suggestion: null,
    confidence: 0.97,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "rv1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  });

  const hoverFindingsCell = () => {
    fireEvent.mouseEnter(screen.getByRole("link", { name: /CRITICAL findings/i }).parentElement!);
  };

  it("stays hidden until the findings cell is hovered", () => {
    reviews = [review([finding({})])];
    renderRow(pr({ findings_counts: { critical: 1, warning: 0, suggestion: 0 } }));
    expect(screen.queryByText("Hardcoded secret committed")).not.toBeInTheDocument();
  });

  it("opens on hover with each finding's title, location and confidence", () => {
    reviews = [review([finding({})])];
    renderRow(pr({ findings_counts: { critical: 1, warning: 0, suggestion: 0 } }));

    hoverFindingsCell();

    expect(screen.getByText("Hardcoded secret committed")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();
    expect(screen.getByText("97% conf")).toBeInTheDocument();
    expect(screen.getByText(/rotate it immediately/)).toBeInTheDocument();
  });

  it("heads the card with the finding count", () => {
    reviews = [
      review([finding({}), finding({ id: "f2", severity: "WARNING", title: "N+1 query" })]),
    ];
    renderRow(pr({ findings_counts: { critical: 1, warning: 1, suggestion: 0 } }));

    hoverFindingsCell();

    expect(screen.getByText("2 findings in this run")).toBeInTheDocument();
  });

  it("closes again when the pointer leaves", () => {
    reviews = [review([finding({})])];
    renderRow(pr({ findings_counts: { critical: 1, warning: 0, suggestion: 0 } }));

    const cell = screen.getByRole("link", { name: /CRITICAL findings/i }).parentElement!;
    fireEvent.mouseEnter(cell);
    expect(screen.getByText("Hardcoded secret committed")).toBeInTheDocument();

    fireEvent.mouseLeave(cell);
    expect(screen.queryByText("Hardcoded secret committed")).not.toBeInTheDocument();
  });
});
