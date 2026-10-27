import type { PoseFrame, PoseLandmark, PoseSequence } from "@/pose/types";

const FRAME_TIMESTAMPS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export const E2E_POSE_SEQUENCE: PoseSequence = {
  metadata: {
    durationMs: 900,
    width: 1280,
    height: 720,
    aspectRatio: 16 / 9,
    mimeType: "video/mp4",
    fileSizeBytes: 1_024,
  },
  model: "lite",
  targetSamplesPerSecond: 12,
  frames: FRAME_TIMESTAMPS.map((timestampMs, index) => ({
    timestampMs,
    pose: createPose(index / (FRAME_TIMESTAMPS.length - 1), timestampMs),
  })),
  detectedFrameCount: FRAME_TIMESTAMPS.length,
  usablePoseFramePercent: 100,
  diagnostics: {
    modelLoadMs: 120,
    totalProcessingMs: 1_250,
    medianInferenceMs: 38,
    p95InferenceMs: 52,
  },
};

function createPose(progress: number, timestampMs: number): PoseFrame {
  const landmarks = Array.from({ length: 33 }, () => landmark(0.5, 0.5));
  const lift = Math.sin(progress * Math.PI) * 0.24;
  const lateral = Math.sin(progress * Math.PI * 2) * 0.05;

  set(landmarks, 11, 0.42 + lateral, 0.3 - lift * 0.08);
  set(landmarks, 12, 0.58 + lateral, 0.3 + lift * 0.08);
  set(landmarks, 13, 0.38 + lateral, 0.45 - lift * 0.65);
  set(landmarks, 14, 0.62 + lateral, 0.45 - lift * 0.45);
  set(landmarks, 15, 0.39 + lateral, 0.6 - lift * 1.25);
  set(landmarks, 16, 0.61 + lateral, 0.6 - lift * 1.15);
  set(landmarks, 23, 0.45 + lateral * 0.5, 0.58);
  set(landmarks, 24, 0.55 + lateral * 0.5, 0.58);
  set(landmarks, 25, 0.43 + lateral * 0.25, 0.75);
  set(landmarks, 26, 0.57 + lateral * 0.25, 0.75);
  set(landmarks, 27, 0.42, 0.92);
  set(landmarks, 28, 0.58, 0.92);

  return {
    timestampMs,
    landmarks,
    worldLandmarks: landmarks.map((point) => ({ ...point })),
  };
}

function landmark(x: number, y: number): PoseLandmark {
  return { x, y, z: 0, visibility: 0.99, presence: 0.99 };
}

function set(landmarks: PoseLandmark[], index: number, x: number, y: number) {
  landmarks[index] = landmark(x, y);
}
