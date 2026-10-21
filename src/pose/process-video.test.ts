import { describe, expect, it, vi } from "vitest";

import { PoseProcessingCancelledError, processVideo } from "./process-video";
import type { PoseFrame, VideoMetadata } from "./types";

const metadata: VideoMetadata = {
  durationMs: 1_000,
  width: 1_920,
  height: 1_080,
  aspectRatio: 16 / 9,
  mimeType: "video/mp4",
  fileSizeBytes: 1_024,
};

const pose: PoseFrame = {
  timestampMs: 0,
  landmarks: [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }],
  worldLandmarks: [{ x: 0, y: 0, z: 0, visibility: 0.9 }],
};

describe("processVideo", () => {
  it("returns an ordered sequence and retains missing detections", async () => {
    let calls = 0;
    let inFlight = 0;
    let maximumInFlight = 0;
    const dispose = vi.fn();
    const progress = vi.fn();

    const sequence = await processVideo(
      {} as HTMLVideoElement,
      metadata,
      { signal: new AbortController().signal, onProgress: progress },
      {
        createClient: () => ({
          initialise: vi.fn().mockResolvedValue(undefined),
          analyseFrame: vi.fn(async (_frame, timestampMs) => {
            inFlight += 1;
            maximumInFlight = Math.max(maximumInFlight, inFlight);
            await Promise.resolve();
            inFlight -= 1;
            calls += 1;
            return calls % 3 === 0 ? null : { ...pose, timestampMs };
          }),
          dispose,
        }),
        createFrame: vi.fn().mockResolvedValue({} as ImageBitmap),
        seek: vi.fn().mockResolvedValue(undefined),
        assetOrigin: () => "https://example.test",
      },
    );

    expect(sequence.frames).toHaveLength(12);
    expect(sequence.detectedFrameCount).toBe(8);
    expect(sequence.usablePoseFramePercent).toBe(66.7);
    expect(sequence.frames.map(({ timestampMs }) => timestampMs)).toEqual(
      [...sequence.frames]
        .map(({ timestampMs }) => timestampMs)
        .sort((a, b) => a - b),
    );
    expect(sequence.frames.some(({ pose: result }) => result === null)).toBe(
      true,
    );
    expect(maximumInFlight).toBe(1);
    expect(progress).toHaveBeenLastCalledWith({
      stage: "complete",
      completedFrames: 12,
      totalFrames: 12,
      percent: 100,
    });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("stops before frame inference when cancelled", async () => {
    const controller = new AbortController();
    const dispose = vi.fn();
    const analyseFrame = vi.fn();

    await expect(
      processVideo(
        {} as HTMLVideoElement,
        metadata,
        {
          signal: controller.signal,
          onProgress: ({ stage }) => {
            if (stage === "analysing") controller.abort();
          },
        },
        {
          createClient: () => ({
            initialise: vi.fn().mockResolvedValue(undefined),
            analyseFrame,
            dispose,
          }),
          createFrame: vi.fn(),
          seek: vi.fn(),
          assetOrigin: () => "https://example.test",
        },
      ),
    ).rejects.toBeInstanceOf(PoseProcessingCancelledError);

    expect(analyseFrame).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
  });
});
