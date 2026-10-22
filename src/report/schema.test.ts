import { describe, expect, it } from "vitest";

import { AnalysisReportInputSchema } from "./schema";
import { BASE_REPORT_INPUT } from "./test-fixtures";

describe("AnalysisReportInputSchema", () => {
  it("accepts a bounded reduced measurement record", () => {
    expect(AnalysisReportInputSchema.parse(BASE_REPORT_INPUT)).toEqual(
      BASE_REPORT_INPUT,
    );
  });

  it.each([
    [
      "missing a required phase",
      () => ({
        ...BASE_REPORT_INPUT,
        phases: BASE_REPORT_INPUT.phases.slice(1),
      }),
    ],
    [
      "duplicates a phase",
      () => ({
        ...BASE_REPORT_INPUT,
        phases: [...BASE_REPORT_INPUT.phases, BASE_REPORT_INPUT.phases[0]],
      }),
    ],
    [
      "uses invalid phase order",
      () => ({
        ...BASE_REPORT_INPUT,
        phases: BASE_REPORT_INPUT.phases.map((phase) =>
          phase.phase === "top" ? { ...phase, timestampMs: 900 } : phase,
        ),
      }),
    ],
    [
      "contains an out-of-range measurement",
      () => ({
        ...BASE_REPORT_INPUT,
        phases: BASE_REPORT_INPUT.phases.map((phase) =>
          phase.phase === "top"
            ? {
                ...phase,
                metrics: { ...phase.metrics, leadElbowFlexion: 300 },
              }
            : phase,
        ),
      }),
    ],
    [
      "contains client-authored candidates",
      () => ({ ...BASE_REPORT_INPUT, candidates: [{ id: "injected" }] }),
    ],
    [
      "uses timing that disagrees with its markers",
      () => ({
        ...BASE_REPORT_INPUT,
        timing: { ...BASE_REPORT_INPUT.timing, backswingMs: 900 },
      }),
    ],
  ])("rejects input that %s", (_label, buildInput) => {
    expect(AnalysisReportInputSchema.safeParse(buildInput()).success).toBe(
      false,
    );
  });
});
