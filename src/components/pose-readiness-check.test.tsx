import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processVideo: vi.fn(),
  waitForVideoData: vi.fn(),
  readVideoMetadata: vi.fn(),
}));

vi.mock("@/pose/process-video", () => ({
  processVideo: mocks.processVideo,
  isPoseProcessingCancelled: () => false,
}));

vi.mock("@/video/video-metadata", () => ({
  waitForVideoData: mocks.waitForVideoData,
  readVideoMetadata: mocks.readVideoMetadata,
}));

import { PoseReadinessCheck } from "./pose-readiness-check";

describe("PoseReadinessCheck resource cleanup", () => {
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL
      .mockReset()
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    revokeObjectURL.mockReset();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(
      () => undefined,
    );
    mocks.waitForVideoData.mockReset().mockResolvedValue(undefined);
    mocks.readVideoMetadata.mockReset().mockImplementation((_video, file) => ({
      durationMs: 1_000,
      width: 1_280,
      height: 720,
      aspectRatio: 16 / 9,
      mimeType: file.type,
      fileSizeBytes: file.size,
    }));
    mocks.processVideo
      .mockReset()
      .mockImplementation(() => new Promise(() => undefined));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("aborts stale work and revokes object URLs on replacement and unmount", async () => {
    const { container, unmount } = render(<PoseReadinessCheck />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, {
      target: {
        files: [new File(["first"], "first.mp4", { type: "video/mp4" })],
      },
    });
    await waitFor(() => expect(mocks.processVideo).toHaveBeenCalledTimes(1));
    const firstSignal = mocks.processVideo.mock.calls[0]![2]
      .signal as AbortSignal;

    fireEvent.change(input, {
      target: {
        files: [new File(["second"], "second.mp4", { type: "video/mp4" })],
      },
    });
    await waitFor(() => expect(mocks.processVideo).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");

    const secondSignal = mocks.processVideo.mock.calls[1]![2]
      .signal as AbortSignal;
    unmount();
    expect(secondSignal.aborted).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:second");
  });
});
