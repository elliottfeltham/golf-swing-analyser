import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildObservationCandidates } from "@/report/candidate-builder";
import { createDeterministicReport } from "@/report/deterministic-report";
import type { ReportResponse } from "@/report/schema";
import { BASE_REPORT_INPUT } from "@/report/test-fixtures";
import { SwingReportPanel } from "./swing-report-panel";

const candidates = buildObservationCandidates(BASE_REPORT_INPUT);
const reportResponse: ReportResponse = {
  report: createDeterministicReport(candidates),
  candidates,
  source: "openrouter",
  allowance: {
    limit: 5,
    remaining: 4,
    resetAt: "2026-10-23T00:00:00.000Z",
    cacheHit: false,
  },
};

describe("SwingReportPanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("requires the measured phases before offering a report", () => {
    render(
      <SwingReportPanel input={null} onReviewEvidence={() => undefined} />,
    );

    expect(screen.getByText("Three moments unlock the review.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /written review/i }),
    ).not.toBeInTheDocument();
  });

  it("requires consent, generates the report, and links back to evidence", async () => {
    const onReviewEvidence = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "POST"
          ? Response.json(reportResponse)
          : Response.json({
              aiAvailable: true,
              quotaAvailable: true,
              limit: 5,
              remaining: 5,
              resetAt: "2026-10-23T00:00:00.000Z",
            }),
      ),
    );

    render(
      <SwingReportPanel
        input={BASE_REPORT_INPUT}
        onReviewEvidence={onReviewEvidence}
      />,
    );

    const generate = screen.getByRole("button", {
      name: "Generate written review",
    });
    expect(generate).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I agree to send the reduced movement record/i,
      }),
    );
    expect(generate).toBeEnabled();
    fireEvent.click(generate);

    await screen.findByText("AI-assisted review");
    expect(screen.getByText(reportResponse.report.summary)).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(candidates.length);
    fireEvent.click(
      screen.getAllByRole("button", { name: /compare|review/i })[0]!,
    );
    expect(onReviewEvidence).toHaveBeenCalledWith(candidates[0]);
  });

  it("labels a quota fallback honestly and stores feedback locally", async () => {
    const fallback: ReportResponse = {
      ...reportResponse,
      source: "deterministic-fallback",
      fallbackReason: "customer-limit",
      allowance: { ...reportResponse.allowance, remaining: 0 },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "POST"
          ? Response.json(fallback)
          : Response.json({
              aiAvailable: true,
              quotaAvailable: true,
              limit: 5,
              remaining: 0,
              resetAt: "2026-10-23T00:00:00.000Z",
            }),
      ),
    );

    render(
      <SwingReportPanel
        input={BASE_REPORT_INPUT}
        onReviewEvidence={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Build local written review" }),
      ).toBeVisible(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Build local written review" }),
    );

    await screen.findByText("Evidence-led local review");
    expect(
      screen.getByText(/personal AI allowance has been used/i),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Useful" }));
    expect(screen.getByRole("button", { name: "Useful" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem("gsa-report-feedback")).toContain("useful");
  });
});
