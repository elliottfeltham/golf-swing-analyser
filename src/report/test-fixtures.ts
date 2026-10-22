import type { AnalysisReportInput, ObservationCandidate } from "./schema";

export const BASE_REPORT_INPUT: AnalysisReportInput = {
  schemaVersion: 1,
  view: "face-on",
  handedness: "right",
  phases: [
    {
      phase: "address",
      timestampMs: 0,
      metrics: {
        leadElbowFlexion: 162,
        trailElbowFlexion: 158,
        leadKneeFlexion: 168,
        trailKneeFlexion: 166,
        shoulderTilt: 2,
        hipTilt: 1,
        torsoSideBend: 3,
        pelvisShift: 0,
      },
      confidence: allConfidence("high"),
      pelvisShiftBasis: "stance-widths",
    },
    {
      phase: "top",
      timestampMs: 600,
      metrics: {
        leadElbowFlexion: 148,
        trailElbowFlexion: 76,
        leadKneeFlexion: 150,
        trailKneeFlexion: 158,
        shoulderTilt: 11,
        hipTilt: 4,
        torsoSideBend: 8,
        pelvisShift: 0.16,
      },
      confidence: allConfidence("high"),
      pelvisShiftBasis: "stance-widths",
    },
    {
      phase: "impact",
      timestampMs: 800,
      metrics: {
        leadElbowFlexion: 155,
        trailElbowFlexion: 132,
        leadKneeFlexion: 160,
        trailKneeFlexion: 152,
        shoulderTilt: 7,
        hipTilt: 6,
        torsoSideBend: 12,
        pelvisShift: -0.1,
      },
      confidence: allConfidence("high"),
      pelvisShiftBasis: "stance-widths",
    },
  ],
  timing: { backswingMs: 600, downswingMs: 200, tempoRatio: 3 },
  phaseHandPath: [
    { phase: "address", normalizedX: 0, normalizedY: 0.4, confidence: "high" },
    { phase: "top", normalizedX: -0.5, normalizedY: 1.5, confidence: "high" },
    {
      phase: "impact",
      normalizedX: 0.15,
      normalizedY: 0.25,
      confidence: "high",
    },
  ],
  quality: {
    usablePoseFramePercent: 96,
    lowConfidencePhaseIds: [],
    unavailableMetricIds: [],
  },
};

export const TEMPO_CANDIDATE: ObservationCandidate = {
  id: "tempo-address-top-impact",
  category: "tempo",
  phaseIds: ["address", "top", "impact"],
  metricIds: ["backswingDuration", "downswingDuration", "tempoRatio"],
  importance: 100,
  confidence: "high",
  observation: "The marked backswing lasted six hundred milliseconds.",
  approvedContext: "Tempo can be compared between the golfer's own swings.",
  evidence: [{ metricId: "tempoRatio", value: 3, unit: "ratio" }],
};

function allConfidence(confidence: "high" | "medium" | "low") {
  return {
    leadElbowFlexion: confidence,
    trailElbowFlexion: confidence,
    leadKneeFlexion: confidence,
    trailKneeFlexion: confidence,
    shoulderTilt: confidence,
    hipTilt: confidence,
    torsoSideBend: confidence,
    pelvisShift: confidence,
  } as const;
}
