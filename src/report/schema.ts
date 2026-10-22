import { z } from "zod";

export const PhaseIdSchema = z.enum(["address", "top", "impact", "finish"]);
export const MetricConfidenceSchema = z.enum(["high", "medium", "low"]);
export const ReportMetricIdSchema = z.enum([
  "backswingDuration",
  "downswingDuration",
  "tempoRatio",
  "leadElbowFlexion",
  "trailElbowFlexion",
  "leadKneeFlexion",
  "trailKneeFlexion",
  "shoulderTilt",
  "hipTilt",
  "torsoSideBend",
  "pelvisShift",
  "handPosition",
  "poseAvailability",
]);

const measurementSchema = z.number().finite().min(-360).max(360);
const metricsSchema = z
  .object({
    leadElbowFlexion: measurementSchema.min(0).max(180).optional(),
    trailElbowFlexion: measurementSchema.min(0).max(180).optional(),
    leadKneeFlexion: measurementSchema.min(0).max(180).optional(),
    trailKneeFlexion: measurementSchema.min(0).max(180).optional(),
    shoulderTilt: measurementSchema.min(-180).max(180).optional(),
    hipTilt: measurementSchema.min(-180).max(180).optional(),
    torsoSideBend: measurementSchema.min(-180).max(180).optional(),
    pelvisShift: measurementSchema.min(-10).max(10).optional(),
  })
  .strict();

const confidenceSchema = z
  .object({
    leadElbowFlexion: MetricConfidenceSchema.optional(),
    trailElbowFlexion: MetricConfidenceSchema.optional(),
    leadKneeFlexion: MetricConfidenceSchema.optional(),
    trailKneeFlexion: MetricConfidenceSchema.optional(),
    shoulderTilt: MetricConfidenceSchema.optional(),
    hipTilt: MetricConfidenceSchema.optional(),
    torsoSideBend: MetricConfidenceSchema.optional(),
    pelvisShift: MetricConfidenceSchema.optional(),
  })
  .strict();

export const ReportPhaseSnapshotSchema = z
  .object({
    phase: PhaseIdSchema,
    timestampMs: z.number().finite().nonnegative().max(120_000),
    metrics: metricsSchema,
    confidence: confidenceSchema,
    pelvisShiftBasis: z.enum(["stance-widths", "shoulder-widths"]).optional(),
  })
  .strict();

export const PhaseHandPathPointSchema = z
  .object({
    phase: PhaseIdSchema,
    normalizedX: z.number().finite().min(-20).max(20),
    normalizedY: z.number().finite().min(-20).max(20),
    confidence: MetricConfidenceSchema,
  })
  .strict();

const phaseOrder = ["address", "top", "impact", "finish"] as const;

export const AnalysisReportInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    view: z.literal("face-on"),
    handedness: z.enum(["right", "left"]),
    phases: z.array(ReportPhaseSnapshotSchema).min(3).max(4),
    timing: z
      .object({
        backswingMs: z.number().finite().positive().max(120_000),
        downswingMs: z.number().finite().positive().max(120_000),
        tempoRatio: z.number().finite().positive().max(100),
      })
      .strict(),
    phaseHandPath: z.array(PhaseHandPathPointSchema).max(4),
    quality: z
      .object({
        usablePoseFramePercent: z.number().finite().min(0).max(100),
        lowConfidencePhaseIds: z.array(PhaseIdSchema).max(4),
        unavailableMetricIds: z.array(ReportMetricIdSchema).max(14),
      })
      .strict(),
  })
  .strict()
  .superRefine((input, context) => {
    const phases = input.phases.map(({ phase }) => phase);
    const uniquePhases = new Set(phases);
    if (uniquePhases.size !== phases.length) {
      context.addIssue({
        code: "custom",
        path: ["phases"],
        message: "Phase identifiers must be unique.",
      });
    }
    for (const phase of ["address", "top", "impact"] as const) {
      if (!uniquePhases.has(phase)) {
        context.addIssue({
          code: "custom",
          path: ["phases"],
          message: `${phase} is required.`,
        });
      }
    }
    const ordered = [...input.phases].sort(
      (left, right) => left.timestampMs - right.timestampMs,
    );
    const orderedIds = ordered.map(({ phase }) => phase);
    const expectedIds = phaseOrder.filter((phase) => uniquePhases.has(phase));
    if (orderedIds.some((phase, index) => phase !== expectedIds[index])) {
      context.addIssue({
        code: "custom",
        path: ["phases"],
        message: "Phases must be in chronological swing order.",
      });
    }
    const handPathPhases = input.phaseHandPath.map(({ phase }) => phase);
    if (new Set(handPathPhases).size !== handPathPhases.length) {
      context.addIssue({
        code: "custom",
        path: ["phaseHandPath"],
        message: "Hand-path phases must be unique.",
      });
    }
    if (handPathPhases.some((phase) => !uniquePhases.has(phase))) {
      context.addIssue({
        code: "custom",
        path: ["phaseHandPath"],
        message: "Hand-path points must reference a marked phase.",
      });
    }
    const timestamps = Object.fromEntries(
      input.phases.map(({ phase, timestampMs }) => [phase, timestampMs]),
    );
    const backswingMs = timestamps.top! - timestamps.address!;
    const downswingMs = timestamps.impact! - timestamps.top!;
    if (
      Math.abs(input.timing.backswingMs - backswingMs) > 1 ||
      Math.abs(input.timing.downswingMs - downswingMs) > 1 ||
      Math.abs(input.timing.tempoRatio - backswingMs / downswingMs) > 0.02
    ) {
      context.addIssue({
        code: "custom",
        path: ["timing"],
        message: "Timing must agree with the marked phase timestamps.",
      });
    }
  });

export const CandidateCategorySchema = z.enum([
  "tempo",
  "pelvis-movement",
  "arm-structure",
  "lower-body",
  "body-tilt",
  "hand-path",
  "tracking-quality",
]);

export const EvidenceUnitSchema = z.enum([
  "degrees",
  "milliseconds",
  "ratio",
  "stance-widths",
  "shoulder-widths",
  "percent",
]);

export const ObservationCandidateSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80),
    category: CandidateCategorySchema,
    phaseIds: z.array(PhaseIdSchema).max(4),
    metricIds: z.array(ReportMetricIdSchema).min(1).max(4),
    importance: z.number().int().min(0).max(100),
    confidence: MetricConfidenceSchema,
    observation: z.string().min(1).max(300),
    approvedContext: z.string().min(1).max(400),
    evidence: z
      .array(
        z
          .object({
            metricId: ReportMetricIdSchema,
            phaseId: PhaseIdSchema.optional(),
            value: z.number().finite(),
            unit: EvidenceUnitSchema,
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();

export const AiInsightSchema = z
  .object({
    candidateId: z.string().max(80),
    title: z.string().min(1).max(80),
    explanation: z.string().min(1).max(400),
    whyItMayMatter: z.string().min(1).max(400),
    reviewAction: z.string().min(1).max(180),
  })
  .strict();

export const GeneratedReportSchema = z
  .object({
    summary: z.string().min(1).max(300),
    insights: z.array(AiInsightSchema).min(1).max(4),
  })
  .strict();

export const SwingReportSchema = GeneratedReportSchema.extend({
  schemaVersion: z.literal(1),
  limitations: z.array(z.string().min(1).max(300)).min(1).max(6),
}).strict();

export type PhaseId = z.infer<typeof PhaseIdSchema>;
export type MetricConfidence = z.infer<typeof MetricConfidenceSchema>;
export type ReportMetricId = z.infer<typeof ReportMetricIdSchema>;
export type AnalysisReportInput = z.infer<typeof AnalysisReportInputSchema>;
export type CandidateCategory = z.infer<typeof CandidateCategorySchema>;
export type ObservationCandidate = z.infer<typeof ObservationCandidateSchema>;
export type GeneratedReport = z.infer<typeof GeneratedReportSchema>;
export type SwingReport = z.infer<typeof SwingReportSchema>;

export interface ReportResponse {
  report: SwingReport;
  candidates: ObservationCandidate[];
  source: "openrouter" | "deterministic-fallback";
  fallbackReason?:
    | "not-configured"
    | "provider-error"
    | "invalid-response"
    | "quota-unavailable"
    | "customer-limit"
    | "global-limit";
  allowance: {
    limit: number;
    remaining: number | null;
    resetAt: string;
    cacheHit: boolean;
  };
}

export interface ReportAllowanceResponse {
  aiAvailable: boolean;
  quotaAvailable: boolean;
  limit: number;
  remaining: number | null;
  resetAt: string;
}
