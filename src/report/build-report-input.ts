import type {
  MeasuredSwingRecord,
  MetricId,
  PhaseId,
} from "@/analysis/measurements";
import {
  AnalysisReportInputSchema,
  type AnalysisReportInput,
  type ReportMetricId,
} from "./schema";

const POSE_METRICS: MetricId[] = [
  "leadElbowFlexion",
  "trailElbowFlexion",
  "leadKneeFlexion",
  "trailKneeFlexion",
  "shoulderTilt",
  "hipTilt",
  "torsoSideBend",
  "pelvisShift",
];

export function buildAnalysisReportInput(
  record: MeasuredSwingRecord,
  usablePoseFramePercent: number,
): AnalysisReportInput | null {
  if (!record.phaseOrderValid || !record.timing) return null;

  const markedPhases = new Set(record.phases.map(({ phase }) => phase));
  if (
    !markedPhases.has("address") ||
    !markedPhases.has("top") ||
    !markedPhases.has("impact")
  ) {
    return null;
  }

  const phaseHandPath = record.phases.flatMap(({ phase, timestampMs }) => {
    const point = record.handPath.find(
      (candidate) => candidate.timestampMs === timestampMs,
    );
    return point
      ? [
          {
            phase,
            normalizedX: point.normalizedX,
            normalizedY: point.normalizedY,
            confidence: point.confidence,
          },
        ]
      : [];
  });

  const lowConfidencePhaseIds = record.phases.flatMap((phase) => {
    const confidences = Object.values(phase.confidence);
    return confidences.length === 0 || confidences.includes("low")
      ? [phase.phase]
      : [];
  });
  const unavailableMetricIds: ReportMetricId[] = POSE_METRICS.filter(
    (metricId) =>
      record.phases.every((phase) => phase.metrics[metricId] === undefined),
  );
  if (phaseHandPath.length < record.phases.length) {
    unavailableMetricIds.push("handPosition");
  }

  const candidate = {
    schemaVersion: 1 as const,
    view: "face-on" as const,
    handedness: record.handedness,
    phases: record.phases,
    timing: record.timing,
    phaseHandPath,
    quality: {
      usablePoseFramePercent,
      lowConfidencePhaseIds: unique(lowConfidencePhaseIds),
      unavailableMetricIds: unique(unavailableMetricIds),
    },
  };

  const parsed = AnalysisReportInputSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export type { PhaseId };
