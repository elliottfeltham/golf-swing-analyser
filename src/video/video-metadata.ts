import type { VideoMetadata } from "@/pose/types";

export class VideoMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoMetadataError";
  }
}

export function readVideoMetadata(
  video: Pick<HTMLVideoElement, "duration" | "videoWidth" | "videoHeight">,
  file: Pick<File, "size" | "type">,
): VideoMetadata {
  const durationMs = video.duration * 1_000;
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new VideoMetadataError("The video has no readable duration.");
  }

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new VideoMetadataError("The video has no readable frame dimensions.");
  }

  return {
    durationMs,
    width,
    height,
    aspectRatio: width / height,
    mimeType: file.type,
    fileSizeBytes: file.size,
  };
}

export function waitForVideoData(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadeddata", handleSuccess);
      video.removeEventListener("error", handleError);
      signal.removeEventListener("abort", handleAbort);
    };
    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(
        new VideoMetadataError("The browser could not decode this video."),
      );
    };
    const handleAbort = () => {
      cleanup();
      reject(signal.reason);
    };

    video.addEventListener("loadeddata", handleSuccess, { once: true });
    video.addEventListener("error", handleError, { once: true });
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}
