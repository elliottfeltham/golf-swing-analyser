import { PoseWorkerClient } from "./pose-worker-client";
import {
  calculateInferenceSize,
  createSampleTimestamps,
  TARGET_SAMPLES_PER_SECOND,
} from "./sampling";
import type {
  PoseFrame,
  PoseSequence,
  ProcessingProgress,
  VideoMetadata,
} from "./types";

export class PoseProcessingCancelledError extends Error {
  constructor() {
    super("Video processing was cancelled.");
    this.name = "PoseProcessingCancelledError";
  }
}

interface PoseClient {
  initialise(options: {
    wasmBaseUrl: string;
    modelAssetUrl: string;
  }): Promise<void>;
  analyseFrame(
    frame: ImageBitmap,
    timestampMs: number,
  ): Promise<PoseFrame | null>;
  dispose(): void;
}

export interface ProcessVideoOptions {
  signal: AbortSignal;
  onProgress: (progress: ProcessingProgress) => void;
}

interface ProcessVideoDependencies {
  createClient: () => PoseClient;
  createFrame: (
    video: HTMLVideoElement,
    width: number,
    height: number,
  ) => Promise<ImageBitmap>;
  seek: (
    video: HTMLVideoElement,
    timestampMs: number,
    signal: AbortSignal,
  ) => Promise<void>;
  assetOrigin: () => string;
  now: () => number;
}

const defaultDependencies: ProcessVideoDependencies = {
  createClient: () => new PoseWorkerClient(),
  createFrame: (video, width, height) =>
    createImageBitmap(video, 0, 0, video.videoWidth, video.videoHeight, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "medium",
    }),
  seek: seekVideo,
  assetOrigin: () => window.location.origin,
  now: () => performance.now(),
};

export async function processVideo(
  video: HTMLVideoElement,
  metadata: VideoMetadata,
  options: ProcessVideoOptions,
  dependencies: ProcessVideoDependencies = defaultDependencies,
): Promise<PoseSequence> {
  throwIfAborted(options.signal);

  const timestamps = createSampleTimestamps(metadata.durationMs);
  const inferenceSize = calculateInferenceSize(metadata.width, metadata.height);
  const client = dependencies.createClient();
  const frames: PoseSequence["frames"] = [];
  const totalFrames = timestamps.length;
  const inferenceDurations: number[] = [];
  const processingStartedAt = dependencies.now();

  const abortClient = () => client.dispose();
  options.signal.addEventListener("abort", abortClient, { once: true });

  try {
    options.onProgress({
      stage: "loading-model",
      completedFrames: 0,
      totalFrames,
      percent: 0,
    });

    const origin = dependencies.assetOrigin();
    const modelLoadStartedAt = dependencies.now();
    await client.initialise({
      wasmBaseUrl: `${origin}/mediapipe/wasm`,
      modelAssetUrl: `${origin}/mediapipe/models/pose_landmarker_lite.task`,
    });
    const modelLoadMs = dependencies.now() - modelLoadStartedAt;
    throwIfAborted(options.signal);

    options.onProgress({
      stage: "analysing",
      completedFrames: 0,
      totalFrames,
      percent: 0,
    });

    for (const [index, timestampMs] of timestamps.entries()) {
      throwIfAborted(options.signal);
      await dependencies.seek(video, timestampMs, options.signal);
      throwIfAborted(options.signal);

      const frame = await dependencies.createFrame(
        video,
        inferenceSize.width,
        inferenceSize.height,
      );
      let pose: PoseFrame | null;

      try {
        const inferenceStartedAt = dependencies.now();
        pose = await client.analyseFrame(frame, timestampMs);
        inferenceDurations.push(dependencies.now() - inferenceStartedAt);
      } catch (error) {
        if (options.signal.aborted) throw new PoseProcessingCancelledError();
        throw error;
      }

      frames.push({ timestampMs, pose });
      const completedFrames = index + 1;
      options.onProgress({
        stage: "analysing",
        completedFrames,
        totalFrames,
        percent: Math.round((completedFrames / totalFrames) * 100),
      });
    }

    const detectedFrameCount = frames.filter(
      ({ pose }) => pose !== null,
    ).length;
    const sequence: PoseSequence = {
      metadata,
      model: "lite",
      targetSamplesPerSecond: TARGET_SAMPLES_PER_SECOND,
      frames,
      detectedFrameCount,
      usablePoseFramePercent:
        totalFrames === 0
          ? 0
          : Math.round((detectedFrameCount / totalFrames) * 1_000) / 10,
      diagnostics: {
        modelLoadMs: roundDuration(modelLoadMs),
        totalProcessingMs: roundDuration(
          dependencies.now() - processingStartedAt,
        ),
        medianInferenceMs: roundDuration(percentile(inferenceDurations, 0.5)),
        p95InferenceMs: roundDuration(percentile(inferenceDurations, 0.95)),
      },
    };

    options.onProgress({
      stage: "complete",
      completedFrames: totalFrames,
      totalFrames,
      percent: 100,
    });
    return sequence;
  } finally {
    options.signal.removeEventListener("abort", abortClient);
    client.dispose();
  }
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return sorted[index]!;
}

function roundDuration(value: number) {
  return Math.round(value * 10) / 10;
}

export function isPoseProcessingCancelled(error: unknown) {
  return error instanceof PoseProcessingCancelledError;
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new PoseProcessingCancelledError();
}

function seekVideo(
  video: HTMLVideoElement,
  timestampMs: number,
  signal: AbortSignal,
) {
  throwIfAborted(signal);
  const timestampSeconds = timestampMs / 1_000;

  if (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    Math.abs(video.currentTime - timestampSeconds) < 0.001
  ) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", handleSuccess);
      video.removeEventListener("error", handleError);
      signal.removeEventListener("abort", handleAbort);
    };
    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("The browser could not seek within this video."));
    };
    const handleAbort = () => {
      cleanup();
      reject(new PoseProcessingCancelledError());
    };

    video.addEventListener("seeked", handleSuccess, { once: true });
    video.addEventListener("error", handleError, { once: true });
    signal.addEventListener("abort", handleAbort, { once: true });
    video.currentTime = timestampSeconds;
  });
}
