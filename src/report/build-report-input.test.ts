import { describe, expect, it } from "vitest";

import type { MeasuredSwingRecord } from "@/analysis/measurements";
import { buildAnalysisReportInput } from "./build-report-input";

const record: MeasuredSwingRecord = {
  handedness: "right",
  phaseOrderValid: true,
  timing: { backswingMs: 500, downswingMs: 250, tempoRatio: 2 },
  phases: [
    {
      phase: "address",
      timestampMs: 0,
      metrics: { leadElbowFlexion: 160 },
      confidence: { leadElbowFlexion: "high" },
    },
    {
      phase: "top",
      timestampMs: 500,
      metrics: { leadElbowFlexion: 145 },
      confidence: { leadElbowFlexion: "medium" },
    },
    {
      phase: "impact",
      timestampMs: 750,
      metrics: {},
      confidence: {},
    },
  ],
  handPath: [
    {
      timestampMs: 0,
      x: 0.5,
      y: 0.5,
      normalizedX: 0,
      normalizedY: 0.4,
      confidence: "high",
    },
    {
      timestampMs: 500,
      x: 0.4,
      y: 0.2,
      normalizedX: -0.4,
      normalizedY: 1.2,
      confidence: "medium",
    },
  ],
};

describe("buildAnalysisReportInput", () => {
  it("reduces a measured record without landmarks or full path data", () => {
    const input = buildAnalysisReportInput(record, 82.5);

    expect(input).toMatchObject({
      schemaVersion: 1,
      view: "face-on",
      quality: {
        usablePoseFramePercent: 82.5,
        lowConfidencePhaseIds: ["impact"],
      },
    });
    expect(input?.phaseHandPath).toHaveLength(2);
    expect(input?.quality.unavailableMetricIds).toContain("handPosition");
    expect(JSON.stringify(input)).not.toContain("landmarks");
  });

  it("returns null until the required ordered phases and timing exist", () => {
    expect(
      buildAnalysisReportInput(
        { ...record, timing: undefined, phaseOrderValid: false },
        90,
      ),
    ).toBeNull();
  });
});
