import { PoseWorkerClient } from "./pose-worker-client";

export type PoseModelVariant = "Full" | "Lite";

export interface PoseBenchmarkResult {
  model: PoseModelVariant;
  modelLoadMs: number;
  averageInferenceMs: number;
  sampledFrames: number;
  detectedFrames: number;
  landmarkCount: number;
  firstDetectionTimestampMs?: number;
}

const SAMPLE_POSITIONS = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85] as const;

export async function benchmarkVideoModel(
  video: HTMLVideoElement,
  model: PoseModelVariant,
): Promise<PoseBenchmarkResult> {
  const client = new PoseWorkerClient();
  const origin = window.location.origin;
  const modelFile =
    model === "Full"
      ? "pose_landmarker_full.task"
      : "pose_landmarker_lite.task";

  try {
    const loadStartedAt = performance.now();
    await client.initialise({
      wasmBaseUrl: `${origin}/mediapipe/wasm`,
      modelAssetUrl: `${origin}/mediapipe/models/${modelFile}`,
    });
    const modelLoadMs = performance.now() - loadStartedAt;

    const sampleTimes = SAMPLE_POSITIONS.map((position) =>
      Math.min(video.duration * position, Math.max(0, video.duration - 0.05)),
    );
    const inferenceDurations: number[] = [];
    let detectedFrames = 0;
    let landmarkCount = 0;
    let firstDetectionTimestampMs: number | undefined;

    for (const sampleTime of sampleTimes) {
      await seekVideo(video, sampleTime);
      const frame = await createImageBitmap(video);
      const inferenceStartedAt = performance.now();
      const pose = await client.analyseFrame(frame, sampleTime * 1_000);
      inferenceDurations.push(performance.now() - inferenceStartedAt);

      if (pose) {
        detectedFrames += 1;
        landmarkCount = pose.landmarks.length;
        firstDetectionTimestampMs ??= pose.timestampMs;
      }
    }

    return {
      model,
      modelLoadMs,
      averageInferenceMs:
        inferenceDurations.reduce((total, duration) => total + duration, 0) /
        inferenceDurations.length,
      sampledFrames: sampleTimes.length,
      detectedFrames,
      landmarkCount,
      ...(firstDetectionTimestampMs === undefined
        ? {}
        : { firstDetectionTimestampMs }),
    };
  } finally {
    client.dispose();
  }
}

function seekVideo(video: HTMLVideoElement, timestampSeconds: number) {
  return new Promise<void>((resolve, reject) => {
    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("The browser could not seek within this video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", handleSuccess);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("seeked", handleSuccess, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = timestampSeconds;
  });
}
