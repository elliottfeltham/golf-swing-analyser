import { describe, expect, it } from "vitest";

import { calculateInferenceSize, createSampleTimestamps } from "./sampling";

describe("createSampleTimestamps", () => {
  it("samples a short clip at twelve frames per second", () => {
    const timestamps = createSampleTimestamps(1_000);

    expect(timestamps).toHaveLength(12);
    expect(timestamps[0]).toBe(0);
    expect(timestamps.at(-1)).toBe(999);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  it("caps long clips and distributes samples across the duration", () => {
    const timestamps = createSampleTimestamps(60_000);

    expect(timestamps).toHaveLength(240);
    expect(timestamps[0]).toBe(0);
    expect(timestamps.at(-1)).toBe(59_999);
    expect(new Set(timestamps).size).toBe(240);
  });

  it("returns no timestamps for invalid durations", () => {
    expect(createSampleTimestamps(0)).toEqual([]);
    expect(createSampleTimestamps(Number.NaN)).toEqual([]);
  });
});

describe("calculateInferenceSize", () => {
  it.each([
    [1_920, 1_080, { width: 960, height: 540 }],
    [1_080, 1_920, { width: 540, height: 960 }],
    [1_200, 1_200, { width: 960, height: 960 }],
    [640, 480, { width: 640, height: 480 }],
  ])("scales %sx%s proportionally", (width, height, expected) => {
    expect(calculateInferenceSize(width, height)).toEqual(expected);
  });

  it("rejects invalid dimensions", () => {
    expect(() => calculateInferenceSize(0, 1_080)).toThrow(
      "Video frame dimensions must be positive numbers.",
    );
  });
});
