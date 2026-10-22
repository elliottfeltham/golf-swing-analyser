import { describe, expect, it } from "vitest";

import { buildObservationCandidates } from "./candidate-builder";
import { BASE_REPORT_INPUT } from "./test-fixtures";

describe("buildObservationCandidates", () => {
  it("selects three deterministic primary observations with unique categories", () => {
    const first = buildObservationCandidates(BASE_REPORT_INPUT);
    const second = buildObservationCandidates(
      structuredClone(BASE_REPORT_INPUT),
    );

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first[0]?.category).toBe("tempo");
    expect(new Set(first.map(({ category }) => category)).size).toBe(3);
    expect(first.every(({ confidence }) => confidence !== "low")).toBe(true);
  });

  it("keeps evidence numeric and tied to marked phases", () => {
    const candidates = buildObservationCandidates(BASE_REPORT_INPUT);
    const arm = candidates.find(({ category }) => category === "arm-structure");

    expect(arm?.id).toBe("arm-structure-trail-elbow-flexion-address-top");
    expect(arm?.phaseIds).toEqual(["address", "top"]);
    expect(arm?.evidence).toEqual([
      {
        metricId: "trailElbowFlexion",
        phaseId: "address",
        value: 158,
        unit: "degrees",
      },
      {
        metricId: "trailElbowFlexion",
        phaseId: "top",
        value: 76,
        unit: "degrees",
      },
    ]);
  });

  it("excludes low-confidence metric changes", () => {
    const input = structuredClone(BASE_REPORT_INPUT);
    for (const phase of input.phases) {
      phase.confidence.trailElbowFlexion = "low";
      phase.confidence.leadElbowFlexion = "low";
    }

    expect(
      buildObservationCandidates(input).some(
        ({ category }) => category === "arm-structure",
      ),
    ).toBe(false);
  });

  it("adds a tracking warning after the primary observations", () => {
    const input = structuredClone(BASE_REPORT_INPUT);
    input.quality.usablePoseFramePercent = 62;
    input.quality.lowConfidencePhaseIds = ["impact"];
    input.quality.unavailableMetricIds = ["handPosition"];

    const candidates = buildObservationCandidates(input);
    expect(candidates).toHaveLength(4);
    expect(candidates.at(-1)).toMatchObject({
      id: "tracking-quality",
      confidence: "low",
      phaseIds: ["impact"],
    });
  });

  it("never describes wrist tracking as club tracking", () => {
    const handPath = buildObservationCandidates(BASE_REPORT_INPUT).find(
      ({ category }) => category === "hand-path",
    );
    if (handPath) {
      expect(handPath.observation).toContain("wrist midpoint");
      expect(handPath.observation).not.toMatch(/club path|clubhead/i);
    }
  });
});
