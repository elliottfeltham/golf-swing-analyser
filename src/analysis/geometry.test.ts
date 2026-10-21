import { describe, expect, it } from "vitest";

import {
  imageLineTiltDegrees,
  isLandmarkUsable,
  jointAngleDegrees,
  torsoSideBendDegrees,
} from "./geometry";

describe("pose geometry", () => {
  it("calculates a known right angle", () => {
    expect(
      jointAngleDegrees(
        { x: 0.5, y: 0.2 },
        { x: 0.5, y: 0.5 },
        { x: 0.8, y: 0.5 },
        1_000,
        1_000,
      ),
    ).toBe(90);
  });

  it("corrects angles for the source aspect ratio", () => {
    expect(
      jointAngleDegrees(
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 0 },
        1_920,
        1_080,
      ),
    ).toBe(121.3);
  });

  it("reports image-line tilt with a stable sign", () => {
    expect(
      imageLineTiltDegrees(
        { x: 0.2, y: 0.5 },
        { x: 0.8, y: 0.4 },
        1_000,
        1_000,
      ),
    ).toBe(9.5);
  });

  it("calculates torso side bend from vertical", () => {
    expect(
      torsoSideBendDegrees(
        { x: 0.6, y: 0.3 },
        { x: 0.5, y: 0.7 },
        1_000,
        1_000,
      ),
    ).toBe(14);
  });

  it("filters landmarks below visibility or presence thresholds", () => {
    expect(isLandmarkUsable({ x: 0, y: 0, z: 0, visibility: 0.6 })).toBe(true);
    expect(isLandmarkUsable({ x: 0, y: 0, z: 0, presence: 0.59 })).toBe(false);
  });
});
