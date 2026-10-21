import { describe, expect, it } from "vitest";

import {
  buildMeasuredSwingRecord,
  calculateHandPath,
  validatePhaseOrder,
} from "./measurements";
import type { PoseFrame, PoseLandmark, PoseSequence } from "@/pose/types";

describe("measurement pipeline", () => {
  it("builds handedness-aware phase measurements and tempo", () => {
    const sequence = makeSequence();
    const record = buildMeasuredSwingRecord(
      sequence,
      { address: 0, top: 500, impact: 800, finish: 1_000 },
      "right",
    );

    expect(record.phaseOrderValid).toBe(true);
    expect(record.timing).toEqual({
      backswingMs: 500,
      downswingMs: 300,
      tempoRatio: 1.67,
    });
    expect(record.phases[0]?.metrics.leadElbowFlexion).toBe(90);
    expect(record.phases[1]?.metrics.pelvisShift).toBe(0.25);
    expect(record.phases[1]?.pelvisShiftBasis).toBe("stance-widths");
  });

  it("does not calculate tempo for phases in the wrong order", () => {
    const record = buildMeasuredSwingRecord(
      makeSequence(),
      { address: 500, top: 0, impact: 800 },
      "right",
    );

    expect(record.phaseOrderValid).toBe(false);
    expect(record.timing).toBeUndefined();
  });

  it("falls back to shoulder-width normalization when ankles are hidden", () => {
    const sequence = makeSequence();
    sequence.frames[0]!.pose!.landmarks[27]!.visibility = 0.2;
    sequence.frames[0]!.pose!.landmarks[28]!.visibility = 0.2;
    const record = buildMeasuredSwingRecord(
      sequence,
      { address: 0, top: 500, impact: 800 },
      "right",
    );

    expect(record.phases[1]?.pelvisShiftBasis).toBe("shoulder-widths");
  });

  it("creates a normalized hand path and omits unreliable wrists", () => {
    const sequence = makeSequence();
    sequence.frames[2]!.pose!.landmarks[15]!.visibility = 0.2;
    const path = calculateHandPath(sequence);

    expect(path).toHaveLength(3);
    expect(path[0]).toMatchObject({ timestampMs: 0, normalizedX: 0 });
    expect(path.some(({ timestampMs }) => timestampMs === 800)).toBe(false);
  });

  it("validates required phase order while allowing an omitted finish", () => {
    expect(validatePhaseOrder({ address: 0, top: 500, impact: 800 })).toBe(
      true,
    );
    expect(
      validatePhaseOrder({ address: 0, top: 500, impact: 800, finish: 700 }),
    ).toBe(false);
  });
});

function makeSequence(): PoseSequence {
  return {
    metadata: {
      durationMs: 1_001,
      width: 1_000,
      height: 1_000,
      aspectRatio: 1,
      mimeType: "video/mp4",
      fileSizeBytes: 1,
    },
    model: "lite",
    targetSamplesPerSecond: 12,
    frames: [0, 500, 800, 1_000].map((timestampMs, index) => ({
      timestampMs,
      pose: makePose(timestampMs, index === 0 ? 0 : 0.1),
    })),
    detectedFrameCount: 4,
    usablePoseFramePercent: 100,
  };
}

function makePose(timestampMs: number, hipShift: number): PoseFrame {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
    presence: 0.95,
  }));
  const set = (index: number, x: number, y: number) => {
    landmarks[index] = { x, y, z: 0, visibility: 0.95, presence: 0.95 };
  };

  set(11, 0.3, 0.25);
  set(12, 0.7, 0.25);
  set(13, 0.3, 0.45);
  set(14, 0.7, 0.45);
  set(15, 0.5, 0.45);
  set(16, 0.5, 0.45);
  set(23, 0.4 + hipShift, 0.55);
  set(24, 0.6 + hipShift, 0.55);
  set(25, 0.4 + hipShift, 0.75);
  set(26, 0.6 + hipShift, 0.75);
  set(27, 0.3, 0.95);
  set(28, 0.7, 0.95);

  return { timestampMs, landmarks, worldLandmarks: landmarks };
}
