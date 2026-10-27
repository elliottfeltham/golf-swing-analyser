import { describe, expect, it } from "vitest";

import { buildObservationCandidates } from "./candidate-builder";
import { REPORT_EVALUATION_FIXTURES } from "./evaluation-fixtures";
import {
  AnalysisReportInputSchema,
  ObservationCandidateSchema,
} from "./schema";
import { createDeterministicReport } from "./deterministic-report";

describe("report evaluation fixtures", () => {
  it("contains twelve named, valid measurement scenarios", () => {
    expect(REPORT_EVALUATION_FIXTURES).toHaveLength(12);
    expect(
      new Set(REPORT_EVALUATION_FIXTURES.map(({ name }) => name)).size,
    ).toBe(12);
    for (const fixture of REPORT_EVALUATION_FIXTURES) {
      expect(
        AnalysisReportInputSchema.safeParse(fixture.input).success,
        fixture.name,
      ).toBe(true);
    }
  });

  it.each(REPORT_EVALUATION_FIXTURES)(
    "$name produces mechanically grounded candidates",
    ({ input, expectedQualityWarning }) => {
      const candidates = buildObservationCandidates(input);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.length).toBeLessThanOrEqual(4);
      expect(new Set(candidates.map(({ id }) => id)).size).toBe(
        candidates.length,
      );
      expect(new Set(candidates.map(({ category }) => category)).size).toBe(
        candidates.length,
      );
      expect(
        candidates.some(({ category }) => category === "tracking-quality"),
      ).toBe(expectedQualityWarning);
      for (const candidate of candidates) {
        expect(ObservationCandidateSchema.safeParse(candidate).success).toBe(
          true,
        );
        if (candidate.category !== "tracking-quality") {
          expect(candidate.confidence).not.toBe("low");
        }
      }

      const report = createDeterministicReport(candidates);
      expect(report.insights.map(({ candidateId }) => candidateId)).toEqual(
        candidates.map(({ id }) => id),
      );
      expect(report.limitations.join(" ")).toMatch(/single-camera/i);
      expect(report.limitations.join(" ")).toMatch(/clubhead speed/i);
    },
  );
});
