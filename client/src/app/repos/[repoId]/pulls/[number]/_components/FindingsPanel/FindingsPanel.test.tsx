import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

const searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(() => {
  cleanup();
  searchParams.delete("severity");
});

function finding(o: Partial<FindingRecord> & { id: string; title: string }): FindingRecord {
  return {
    severity: "CRITICAL",
    category: "security",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
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
  finding({ id: "f1", title: "Hardcoded secret", severity: "CRITICAL" }),
  finding({ id: "f2", title: "Unhandled rejection", severity: "WARNING" }),
  finding({ id: "f3", title: "Magic number", severity: "SUGGESTION" }),
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// The three filter buttons carry the severity's own label ("Critical"), which
// CSS does not uppercase here — unlike SeverityBadge, whose label is uppercased
// in CSS and so cannot be matched on textContent.
const filterBtn = (label: string) => screen.getByRole("button", { name: label });
/** The read-only counter row, e.g. "2 CRITICAL". */
const counters = () => screen.getByRole("group", { name: "Findings by severity" });

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

describe("FindingsPanel — severity counters (read-only row)", () => {
  it("shows a pill per severity present, severest first, with its count", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(counters()).toHaveTextContent("1 CRITICAL");
    expect(counters()).toHaveTextContent("1 WARNING");
    expect(counters()).toHaveTextContent("1 SUGGESTION");
  });

  it("omits a severity with no findings instead of showing a zero", () => {
    renderWithIntl(<FindingsPanel findings={[FINDINGS[0]!]} prId="pr1" />);
    expect(counters()).toHaveTextContent("1 CRITICAL");
    expect(counters()).not.toHaveTextContent("WARNING");
    expect(counters()).not.toHaveTextContent("SUGGESTION");
  });

  it("renders no counter row at all when there are no findings", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.queryByRole("group", { name: "Findings by severity" })).not.toBeInTheDocument();
  });

  it("a pill's number equals the cards its filter yields, even with hide-low on", () => {
    renderWithIntl(
      <FindingsPanel
        findings={[...FINDINGS, finding({ id: "f4", title: "Low confidence critical", confidence: 0.2 })]}
        prId="pr1"
      />,
    );
    expect(counters()).toHaveTextContent("2 CRITICAL");

    fireEvent.click(screen.getByRole("switch")); // hide low confidence

    expect(counters()).toHaveTextContent("1 CRITICAL");
    fireEvent.click(filterBtn("Critical"));
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.queryByText("Low confidence critical")).not.toBeInTheDocument();
  });
});

describe("FindingsPanel — severity filter buttons", () => {
  it("always offers all three, even for severities this run did not find", () => {
    renderWithIntl(<FindingsPanel findings={[FINDINGS[0]!]} prId="pr1" />);
    expect(filterBtn("Critical")).toBeInTheDocument();
    expect(filterBtn("Warning")).toBeInTheDocument();
    expect(filterBtn("Suggestion")).toBeInTheDocument();
  });

  it("clicking one leaves only that severity's findings", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);

    fireEvent.click(filterBtn("Critical"));

    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.queryByText("Unhandled rejection")).not.toBeInTheDocument();
    expect(screen.queryByText("Magic number")).not.toBeInTheDocument();
  });

  it("marks the active button pressed and clears it on a second click", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);

    fireEvent.click(filterBtn("Critical"));
    expect(filterBtn("Critical")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(filterBtn("Critical"));
    expect(filterBtn("Critical")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Unhandled rejection")).toBeInTheDocument();
    expect(screen.getByText("Magic number")).toBeInTheDocument();
  });

  it("keeps a filter that matches nothing rather than silently releasing it", () => {
    // A button that undid itself would read as broken; an empty list does not.
    renderWithIntl(<FindingsPanel findings={[FINDINGS[0]!]} prId="pr1" />);

    fireEvent.click(filterBtn("Suggestion"));

    expect(filterBtn("Suggestion")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });

  it("seeds the filter from ?severity= so the PR list can deep-link in", () => {
    searchParams.set("severity", "WARNING");
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);

    expect(screen.getByText("Unhandled rejection")).toBeInTheDocument();
    expect(screen.queryByText("Hardcoded secret")).not.toBeInTheDocument();
  });

  it("ignores a ?severity= value that is not a severity", () => {
    searchParams.set("severity", "BOGUS");
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);

    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("Magic number")).toBeInTheDocument();
  });
});
