import { describe, expect, it } from "vitest";

import {
  MAX_VIDEO_FILE_SIZE_BYTES,
  validateVideoFile,
} from "./validate-video-file";

describe("validateVideoFile", () => {
  it.each(["video/mp4", "video/quicktime", "video/webm"])(
    "accepts a supported %s file",
    (type) => {
      expect(validateVideoFile({ type, size: 1_024 })).toEqual({ valid: true });
    },
  );

  it("rejects unsupported media types", () => {
    expect(validateVideoFile({ type: "image/jpeg", size: 1_024 })).toEqual({
      valid: false,
      message: "Choose an MP4, MOV, or WebM video that your browser can play.",
    });
  });

  it("rejects files above the size limit", () => {
    expect(
      validateVideoFile({
        type: "video/mp4",
        size: MAX_VIDEO_FILE_SIZE_BYTES + 1,
      }),
    ).toEqual({
      valid: false,
      message:
        "Choose a video smaller than 150 MB for this browser-based check.",
    });
  });
});
