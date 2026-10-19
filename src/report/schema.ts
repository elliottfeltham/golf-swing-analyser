import { z } from "zod";

export const ReportCandidateSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(64),
  category: z.enum([
    "tempo",
    "pelvis",
    "arm-structure",
    "lower-body",
    "body-lines",
    "hand-path",
    "tracking-quality",
  ]),
  observation: z.string().min(1).max(240),
  whyItMayMatter: z.string().min(1).max(300),
  confidence: z.enum(["high", "medium", "low"]),
  evidenceTimestampMs: z.number().nonnegative().finite().optional(),
});

export const AnalysisReportInputSchema = z.object({
  analysisId: z.string().uuid(),
  candidates: z.array(ReportCandidateSchema).min(1).max(8),
});

export const ReportInsightSchema = z.object({
  candidateId: z.string().max(64),
  heading: z.string().min(1).max(80),
  explanation: z.string().min(1).max(400),
});

export const SwingReportSchema = z.object({
  summary: z.string().min(1).max(300),
  insights: z.array(ReportInsightSchema).min(1).max(4),
  disclaimer: z.string().min(1).max(240),
});

export type AnalysisReportInput = z.infer<typeof AnalysisReportInputSchema>;
export type SwingReport = z.infer<typeof SwingReportSchema>;

export interface ReportResponse {
  report: SwingReport;
  source: "openrouter" | "deterministic-fallback";
  fallbackReason?: "not-configured" | "provider-error" | "invalid-response";
}
