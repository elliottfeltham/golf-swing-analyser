import { describe, expect, it } from "vitest";

import {
  createDeterministicReport,
  REPORT_LIMITATIONS,
} from "./deterministic-report";
import { TEMPO_CANDIDATE } from "./test-fixtures";

describe("createDeterministicReport", () => {
  it("preserves the trusted evidence identifier and produces the full report shape", () => {
    const report = createDeterministicReport([TEMPO_CANDIDATE]);

    expect(report.schemaVersion).toBe(1);
    expect(report.insights[0]).toMatchObject({
      candidateId: TEMPO_CANDIDATE.id,
      title: "Swing timing",
      explanation: TEMPO_CANDIDATE.observation,
    });
    expect(report.limitations).toEqual(REPORT_LIMITATIONS);
  });

  it("keeps limitations server-owned and explicit", () => {
    const report = createDeterministicReport([TEMPO_CANDIDATE]);
    expect(report.limitations.join(" ")).toMatch(/single-camera/i);
    expect(report.limitations.join(" ")).toMatch(/clubhead speed/i);
  });
});
