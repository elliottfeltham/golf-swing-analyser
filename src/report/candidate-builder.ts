import type { MetricConfidence, MetricId } from "@/analysis/measurements";
import { KNOWLEDGE_CATALOGUE } from "./knowledge-catalogue";
import type {
  AnalysisReportInput,
  CandidateCategory,
  ObservationCandidate,
  PhaseId,
} from "./schema";

const METRIC_GROUPS: Array<{
  category: CandidateCategory;
  metrics: MetricId[];
  baseImportance: number;
}> = [
  {
    category: "arm-structure",
    metrics: ["leadElbowFlexion", "trailElbowFlexion"],
    baseImportance: 72,
  },
  {
    category: "lower-body",
    metrics: ["leadKneeFlexion", "trailKneeFlexion"],
    baseImportance: 68,
  },
  {
    category: "body-tilt",
    metrics: ["shoulderTilt", "hipTilt", "torsoSideBend"],
    baseImportance: 64,
  },
];

const METRIC_LABELS: Record<MetricId, string> = {
  leadElbowFlexion: "Lead elbow angle",
  trailElbowFlexion: "Trail elbow angle",
  leadKneeFlexion: "Lead knee angle",
  trailKneeFlexion: "Trail knee angle",
  shoulderTilt: "Shoulder-line tilt",
  hipTilt: "Hip-line tilt",
  torsoSideBend: "Torso side-bend",
  pelvisShift: "Pelvis position",
};

export function buildObservationCandidates(
  input: AnalysisReportInput,
): ObservationCandidate[] {
  const primary = [
    buildTempoCandidate(input),
    buildPelvisCandidate(input),
    ...METRIC_GROUPS.map((group) => buildChangeCandidate(input, group)),
    buildHandPathCandidate(input),
  ]
    .filter(
      (candidate): candidate is ObservationCandidate => candidate !== null,
    )
    .sort(
      (left, right) =>
        right.importance - left.importance || left.id.localeCompare(right.id),
    )
    .slice(0, 3);

  const quality = buildQualityCandidate(input);
  return quality ? [...primary, quality] : primary;
}

function buildTempoCandidate(input: AnalysisReportInput): ObservationCandidate {
  const { backswingMs, downswingMs, tempoRatio } = input.timing;
  return {
    id: "tempo-address-top-impact",
    category: "tempo",
    phaseIds: ["address", "top", "impact"],
    metricIds: ["backswingDuration", "downswingDuration", "tempoRatio"],
    importance: 100,
    confidence: "high",
    observation: `The marked backswing lasted ${format(backswingMs)} ms and the marked downswing lasted ${format(downswingMs)} ms, giving a ${format(tempoRatio)} to one tempo ratio.`,
    approvedContext: KNOWLEDGE_CATALOGUE.tempo,
    evidence: [
      {
        metricId: "backswingDuration",
        value: backswingMs,
        unit: "milliseconds",
      },
      {
        metricId: "downswingDuration",
        value: downswingMs,
        unit: "milliseconds",
      },
      { metricId: "tempoRatio", value: tempoRatio, unit: "ratio" },
    ],
  };
}

function buildPelvisCandidate(
  input: AnalysisReportInput,
): ObservationCandidate | null {
  const best = input.phases
    .filter(
      (phase) =>
        phase.phase !== "address" &&
        phase.metrics.pelvisShift !== undefined &&
        isReliable(phase.confidence.pelvisShift),
    )
    .sort(
      (left, right) =>
        Math.abs(right.metrics.pelvisShift ?? 0) -
          Math.abs(left.metrics.pelvisShift ?? 0) ||
        phaseRank(left.phase) - phaseRank(right.phase),
    )[0];
  const value = best?.metrics.pelvisShift;
  const confidence = best?.confidence.pelvisShift;
  if (!best || value === undefined || !isReliable(confidence)) return null;

  const basis = best.pelvisShiftBasis ?? "shoulder-widths";
  return {
    id: `pelvis-${best.phase}`,
    category: "pelvis-movement",
    phaseIds: ["address", best.phase],
    metricIds: ["pelvisShift"],
    importance: Math.min(92, 78 + Math.round(Math.abs(value) * 20)),
    confidence,
    observation: `At ${phaseLabel(best.phase)}, the pelvis midpoint was ${format(Math.abs(value))} ${basis} ${value < 0 ? "left" : "right"} of its address position in the image.`,
    approvedContext: KNOWLEDGE_CATALOGUE["pelvis-movement"],
    evidence: [
      {
        metricId: "pelvisShift",
        phaseId: best.phase,
        value,
        unit: basis,
      },
    ],
  };
}

function buildChangeCandidate(
  input: AnalysisReportInput,
  group: (typeof METRIC_GROUPS)[number],
): ObservationCandidate | null {
  const phases = [...input.phases].sort(
    (left, right) => phaseRank(left.phase) - phaseRank(right.phase),
  );
  let best:
    | {
        metricId: MetricId;
        from: AnalysisReportInput["phases"][number];
        to: AnalysisReportInput["phases"][number];
        fromValue: number;
        toValue: number;
        confidence: Exclude<MetricConfidence, "low">;
        magnitude: number;
      }
    | undefined;

  for (const metricId of group.metrics) {
    for (let index = 0; index < phases.length - 1; index += 1) {
      const from = phases[index]!;
      const to = phases[index + 1]!;
      const fromValue = from.metrics[metricId];
      const toValue = to.metrics[metricId];
      const fromConfidence = from.confidence[metricId];
      const toConfidence = to.confidence[metricId];
      if (
        fromValue === undefined ||
        toValue === undefined ||
        !isReliable(fromConfidence) ||
        !isReliable(toConfidence)
      ) {
        continue;
      }
      const magnitude = Math.abs(toValue - fromValue);
      if (!best || magnitude > best.magnitude) {
        best = {
          metricId,
          from,
          to,
          fromValue,
          toValue,
          confidence: lowerConfidence(fromConfidence, toConfidence),
          magnitude,
        };
      }
    }
  }
  if (!best || best.magnitude < 0.1) return null;

  return {
    id: `${group.category}-${kebab(best.metricId)}-${best.from.phase}-${best.to.phase}`,
    category: group.category,
    phaseIds: [best.from.phase, best.to.phase],
    metricIds: [best.metricId],
    importance: Math.min(
      89,
      group.baseImportance + Math.round(best.magnitude / 5),
    ),
    confidence: best.confidence,
    observation: `${METRIC_LABELS[best.metricId]} changed from ${format(best.fromValue)} degrees at ${phaseLabel(best.from.phase)} to ${format(best.toValue)} degrees at ${phaseLabel(best.to.phase)}.`,
    approvedContext: KNOWLEDGE_CATALOGUE[group.category],
    evidence: [
      {
        metricId: best.metricId,
        phaseId: best.from.phase,
        value: best.fromValue,
        unit: "degrees",
      },
      {
        metricId: best.metricId,
        phaseId: best.to.phase,
        value: best.toValue,
        unit: "degrees",
      },
    ],
  };
}

function buildHandPathCandidate(
  input: AnalysisReportInput,
): ObservationCandidate | null {
  let best:
    | {
        from: (typeof input.phaseHandPath)[number];
        to: (typeof input.phaseHandPath)[number];
        distance: number;
        confidence: Exclude<MetricConfidence, "low">;
      }
    | undefined;
  const points = [...input.phaseHandPath].sort(
    (left, right) => phaseRank(left.phase) - phaseRank(right.phase),
  );
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    if (!isReliable(from.confidence) || !isReliable(to.confidence)) continue;
    const distance = Math.hypot(
      to.normalizedX - from.normalizedX,
      to.normalizedY - from.normalizedY,
    );
    if (!best || distance > best.distance) {
      best = {
        from,
        to,
        distance,
        confidence: lowerConfidence(from.confidence, to.confidence),
      };
    }
  }
  if (!best || best.distance < 0.01) return null;

  return {
    id: `hand-path-${best.from.phase}-${best.to.phase}`,
    category: "hand-path",
    phaseIds: [best.from.phase, best.to.phase],
    metricIds: ["handPosition"],
    importance: Math.min(84, 66 + Math.round(best.distance * 10)),
    confidence: best.confidence,
    observation: `The tracked wrist midpoint moved ${format(best.distance)} shoulder-widths between ${phaseLabel(best.from.phase)} and ${phaseLabel(best.to.phase)} in the image.`,
    approvedContext: KNOWLEDGE_CATALOGUE["hand-path"],
    evidence: [
      {
        metricId: "handPosition",
        phaseId: best.to.phase,
        value: round(best.distance, 3),
        unit: "shoulder-widths",
      },
    ],
  };
}

function buildQualityCandidate(
  input: AnalysisReportInput,
): ObservationCandidate | null {
  const hasWarning =
    input.quality.usablePoseFramePercent < 70 ||
    input.quality.lowConfidencePhaseIds.length > 0 ||
    input.quality.unavailableMetricIds.length > 0;
  if (!hasWarning) return null;

  const phaseText = input.quality.lowConfidencePhaseIds.length
    ? ` Low-confidence measurements affect ${input.quality.lowConfidencePhaseIds.map(phaseLabel).join(", ")}.`
    : "";
  const unavailableText = input.quality.unavailableMetricIds.length
    ? ` Some requested measurements were unavailable.`
    : "";
  return {
    id: "tracking-quality",
    category: "tracking-quality",
    phaseIds: input.quality.lowConfidencePhaseIds,
    metricIds: ["poseAvailability"],
    importance: 100,
    confidence: "low",
    observation: `A usable pose was available in ${format(input.quality.usablePoseFramePercent)} percent of sampled frames.${phaseText}${unavailableText}`,
    approvedContext: KNOWLEDGE_CATALOGUE["tracking-quality"],
    evidence: [
      {
        metricId: "poseAvailability",
        value: input.quality.usablePoseFramePercent,
        unit: "percent",
      },
    ],
  };
}

function isReliable(
  confidence: MetricConfidence | undefined,
): confidence is Exclude<MetricConfidence, "low"> {
  return confidence === "high" || confidence === "medium";
}

function lowerConfidence(
  left: Exclude<MetricConfidence, "low">,
  right: Exclude<MetricConfidence, "low">,
) {
  return left === "medium" || right === "medium" ? "medium" : "high";
}

function phaseRank(phase: PhaseId) {
  return ["address", "top", "impact", "finish"].indexOf(phase);
}

function phaseLabel(phase: PhaseId) {
  return phase === "top" ? "the top" : phase;
}

function kebab(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function format(value: number) {
  return String(round(value, Number.isInteger(value) ? 0 : 2));
}
