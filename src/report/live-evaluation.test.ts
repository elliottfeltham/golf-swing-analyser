import { describe, expect, it } from "vitest";

import { buildObservationCandidates } from "./candidate-builder";
import { REPORT_EVALUATION_FIXTURES } from "./evaluation-fixtures";
import {
  InvalidReportResponseError,
  requestOpenRouterReport,
} from "./openrouter";

const RUN_LIVE_EVALUATION =
  process.env.RUN_LIVE_REPORT_EVAL === "1" &&
  Boolean(process.env.OPENROUTER_API_KEY);

const liveCases = [
  "balanced-right-handed",
  "low-impact-confidence",
  "arm-change-dominant",
] as const;

describe.skipIf(!RUN_LIVE_EVALUATION)(
  "live OpenRouter report evaluation",
  () => {
    it.each(liveCases)(
      "returns a grounded report for %s",
      async (name) => {
        const fixture = REPORT_EVALUATION_FIXTURES.find(
          (candidate) => candidate.name === name,
        );
        expect(fixture).toBeDefined();
        const candidates = buildObservationCandidates(fixture!.input);
        try {
          const report = await requestOpenRouterReport(
            candidates,
            process.env.OPENROUTER_API_KEY!,
          );
          expect(report.insights).toHaveLength(candidates.length);
          expect(
            new Set(report.insights.map(({ candidateId }) => candidateId)),
          ).toEqual(new Set(candidates.map(({ id }) => id)));
          console.info(
            `[live-report-evaluation:${name}] ${JSON.stringify({ outcome: "validated", candidates, report })}`,
          );
        } catch (error) {
          expect(error).toBeInstanceOf(InvalidReportResponseError);
          console.info(
            `[live-report-evaluation:${name}] ${JSON.stringify({ outcome: "rejected", reason: error instanceof Error ? error.message : "Unknown provider failure" })}`,
          );
        }
      },
      30_000,
    );
  },
);
