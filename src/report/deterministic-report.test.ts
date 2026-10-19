import { describe, expect, it } from "vitest";

import { createDeterministicReport } from "./deterministic-report";
import type { AnalysisReportInput } from "./schema";

const input: AnalysisReportInput = {
  analysisId: "6d9ed0bc-536f-4c1f-b81c-70a350bb153a",
  candidates: [
    {
      id: "tempo-overview",
      category: "tempo",
      observation: "Your backswing took longer than your downswing.",
      whyItMayMatter:
        "Timing is useful when comparing the consistency of your own swings.",
      confidence: "high",
    },
    {
      id: "tracking-gap",
      category: "tracking-quality",
      observation: "The lead wrist was briefly obscured.",
      whyItMayMatter: "Treat hand-path evidence in that section with caution.",
      confidence: "low",
    },
  ],
};

describe("createDeterministicReport", () => {
  it("uses reliable candidates and preserves evidence identifiers", () => {
    const report = createDeterministicReport(input);

    expect(report.insights).toHaveLength(1);
    expect(report.insights[0]?.candidateId).toBe("tempo-overview");
    expect(report.insights[0]?.explanation).toContain("backswing");
  });

  it("retains one limitation when every candidate has low confidence", () => {
    const report = createDeterministicReport({
      ...input,
      candidates: [input.candidates[1]!],
    });

    expect(report.insights[0]?.candidateId).toBe("tracking-gap");
  });
});
