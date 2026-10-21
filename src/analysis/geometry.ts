import type { PoseLandmark } from "@/pose/types";

export const LANDMARK_VISIBILITY_THRESHOLD = 0.6;

export interface Point2D {
  x: number;
  y: number;
}

export function isLandmarkUsable(
  landmark: PoseLandmark | undefined,
  threshold = LANDMARK_VISIBILITY_THRESHOLD,
): landmark is PoseLandmark {
  return Boolean(
    landmark &&
    (landmark.visibility ?? 1) >= threshold &&
    (landmark.presence ?? 1) >= threshold,
  );
}

export function midpoint(first: Point2D, second: Point2D): Point2D {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export function distance(first: Point2D, second: Point2D) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function jointAngleDegrees(
  first: Point2D,
  vertex: Point2D,
  third: Point2D,
  width: number,
  height: number,
): number | null {
  const firstVector = {
    x: (first.x - vertex.x) * width,
    y: (first.y - vertex.y) * height,
  };
  const secondVector = {
    x: (third.x - vertex.x) * width,
    y: (third.y - vertex.y) * height,
  };
  const magnitude =
    Math.hypot(firstVector.x, firstVector.y) *
    Math.hypot(secondVector.x, secondVector.y);
  if (magnitude === 0) return null;

  const cosine =
    (firstVector.x * secondVector.x + firstVector.y * secondVector.y) /
    magnitude;
  return round(Math.acos(clamp(cosine, -1, 1)) * (180 / Math.PI), 1);
}

export function imageLineTiltDegrees(
  first: Point2D,
  second: Point2D,
  width: number,
  height: number,
) {
  const [imageLeft, imageRight] =
    first.x <= second.x ? [first, second] : [second, first];
  const run = Math.abs(imageRight.x - imageLeft.x) * width;
  const rise = (imageLeft.y - imageRight.y) * height;
  if (run === 0 && rise === 0) return null;
  return round(Math.atan2(rise, run) * (180 / Math.PI), 1);
}

export function torsoSideBendDegrees(
  shoulderMidpoint: Point2D,
  hipMidpoint: Point2D,
  width: number,
  height: number,
) {
  const horizontal = (shoulderMidpoint.x - hipMidpoint.x) * width;
  const vertical = (hipMidpoint.y - shoulderMidpoint.y) * height;
  if (horizontal === 0 && vertical === 0) return null;
  return round(Math.atan2(horizontal, vertical) * (180 / Math.PI), 1);
}

export function round(value: number, decimalPlaces = 1) {
  const multiplier = 10 ** decimalPlaces;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
