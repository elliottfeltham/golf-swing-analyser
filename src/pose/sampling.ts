export const TARGET_SAMPLES_PER_SECOND = 12 as const;
export const MAX_ANALYSED_FRAMES = 240;
export const MAX_INFERENCE_EDGE_PX = 960;

export interface FrameSize {
  width: number;
  height: number;
}

export function createSampleTimestamps(
  durationMs: number,
  samplesPerSecond = TARGET_SAMPLES_PER_SECOND,
  maximumFrames = MAX_ANALYSED_FRAMES,
): number[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return [];
  if (!Number.isFinite(samplesPerSecond) || samplesPerSecond <= 0) return [];
  if (!Number.isInteger(maximumFrames) || maximumFrames <= 0) return [];

  const frameCount = Math.min(
    maximumFrames,
    Math.max(1, Math.ceil((durationMs / 1_000) * samplesPerSecond)),
  );
  const finalTimestamp = Math.max(0, durationMs - 1);

  if (frameCount === 1) return [0];

  return Array.from({ length: frameCount }, (_, index) =>
    Math.round((finalTimestamp * index) / (frameCount - 1)),
  );
}

export function calculateInferenceSize(
  width: number,
  height: number,
  maximumEdge = MAX_INFERENCE_EDGE_PX,
): FrameSize {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(maximumEdge) ||
    maximumEdge <= 0
  ) {
    throw new Error("Video frame dimensions must be positive numbers.");
  }

  const scale = Math.min(1, maximumEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
