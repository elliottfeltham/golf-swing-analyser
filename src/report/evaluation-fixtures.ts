import type { AnalysisReportInput, MetricConfidence } from "./schema";
import { BASE_REPORT_INPUT } from "./test-fixtures";

export interface ReportEvaluationFixture {
  name: string;
  input: AnalysisReportInput;
  expectedQualityWarning: boolean;
}

export const REPORT_EVALUATION_FIXTURES: ReportEvaluationFixture[] = [
  fixture("balanced-right-handed", false),
  fixture("left-handed", false, (input) => {
    input.handedness = "left";
  }),
  fixture("finish-marked", false, (input) => {
    input.phases.push({
      ...structuredClone(input.phases[2]!),
      phase: "finish",
      timestampMs: 1_100,
    });
    input.phaseHandPath.push({
      phase: "finish",
      normalizedX: 0.7,
      normalizedY: 1.1,
      confidence: "high",
    });
  }),
  fixture("medium-confidence", false, (input) => {
    setAllConfidence(input, "medium");
  }),
  fixture("low-impact-confidence", true, (input) => {
    input.quality.lowConfidencePhaseIds = ["impact"];
    for (const key of Object.keys(input.phases[2]!.confidence)) {
      input.phases[2]!.confidence[
        key as keyof (typeof input.phases)[number]["confidence"]
      ] = "low";
    }
  }),
  fixture("reduced-pose-availability", true, (input) => {
    input.quality.usablePoseFramePercent = 64;
  }),
  fixture("missing-hand-path", true, (input) => {
    input.phaseHandPath = [];
    input.quality.unavailableMetricIds = ["handPosition"];
  }),
  fixture("missing-pelvis", true, (input) => {
    for (const phase of input.phases) {
      delete phase.metrics.pelvisShift;
      delete phase.confidence.pelvisShift;
      delete phase.pelvisShiftBasis;
    }
    input.quality.unavailableMetricIds = ["pelvisShift"];
  }),
  fixture("arm-change-dominant", false, (input) => {
    input.phases[1]!.metrics.trailElbowFlexion = 35;
  }),
  fixture("lower-body-change-dominant", false, (input) => {
    input.phases[1]!.metrics.leadKneeFlexion = 80;
  }),
  fixture("body-lines-change-dominant", false, (input) => {
    input.phases[1]!.metrics.shoulderTilt = 70;
  }),
  fixture("hand-path-change-dominant", false, (input) => {
    input.phaseHandPath[1]!.normalizedX = -3;
    input.phaseHandPath[1]!.normalizedY = 3;
  }),
];

function fixture(
  name: string,
  expectedQualityWarning: boolean,
  mutate?: (input: AnalysisReportInput) => void,
): ReportEvaluationFixture {
  const input = structuredClone(BASE_REPORT_INPUT);
  mutate?.(input);
  return { name, input, expectedQualityWarning };
}

function setAllConfidence(
  input: AnalysisReportInput,
  confidence: MetricConfidence,
) {
  for (const phase of input.phases) {
    for (const key of Object.keys(phase.confidence)) {
      phase.confidence[key as keyof typeof phase.confidence] = confidence;
    }
  }
  for (const point of input.phaseHandPath) point.confidence = confidence;
}
