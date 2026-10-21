import { describe, expect, it } from "vitest";

import { readVideoMetadata } from "./video-metadata";

describe("readVideoMetadata", () => {
  it("normalises decoded browser metadata", () => {
    expect(
      readVideoMetadata(
        { duration: 2.5, videoWidth: 1_920, videoHeight: 1_080 },
        { size: 42_000, type: "video/mp4" },
      ),
    ).toEqual({
      durationMs: 2_500,
      width: 1_920,
      height: 1_080,
      aspectRatio: 16 / 9,
      mimeType: "video/mp4",
      fileSizeBytes: 42_000,
    });
  });

  it("rejects missing duration", () => {
    expect(() =>
      readVideoMetadata(
        { duration: 0, videoWidth: 1_920, videoHeight: 1_080 },
        { size: 1, type: "video/mp4" },
      ),
    ).toThrow("The video has no readable duration.");
  });

  it("rejects missing dimensions", () => {
    expect(() =>
      readVideoMetadata(
        { duration: 1, videoWidth: 0, videoHeight: 1_080 },
        { size: 1, type: "video/mp4" },
      ),
    ).toThrow("The video has no readable frame dimensions.");
  });
});
