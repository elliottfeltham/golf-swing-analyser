import { describe, expect, it } from "vitest";

import { analysisReducer, initialAnalysisState } from "./analysis-state";

const file = new File(["video"], "swing.mp4", { type: "video/mp4" });
const metadata = {
  durationMs: 1_000,
  width: 1_920,
  height: 1_080,
  aspectRatio: 16 / 9,
  mimeType: "video/mp4",
  fileSizeBytes: file.size,
};

describe("analysisReducer", () => {
  it("moves from loading to processing and updates progress", () => {
    const loading = analysisReducer(initialAnalysisState, {
      type: "VIDEO_LOADING",
      file,
      objectUrl: "blob:swing",
      runId: "run-1",
    });
    const processing = analysisReducer(loading, {
      type: "PROCESSING_STARTED",
      file,
      objectUrl: "blob:swing",
      runId: "run-1",
      metadata,
    });
    const progressed = analysisReducer(processing, {
      type: "PROGRESS_UPDATED",
      runId: "run-1",
      progress: {
        stage: "analysing",
        completedFrames: 6,
        totalFrames: 12,
        percent: 50,
      },
    });

    expect(progressed).toMatchObject({
      status: "processing",
      progress: { completedFrames: 6, percent: 50 },
    });
  });

  it("ignores progress from a superseded run", () => {
    const current = analysisReducer(initialAnalysisState, {
      type: "PROCESSING_STARTED",
      file,
      objectUrl: "blob:swing",
      runId: "current",
      metadata,
    });

    expect(
      analysisReducer(current, {
        type: "PROGRESS_UPDATED",
        runId: "stale",
        progress: {
          stage: "analysing",
          completedFrames: 10,
          totalFrames: 12,
          percent: 83,
        },
      }),
    ).toBe(current);
  });

  it("preserves the local video when processing is cancelled", () => {
    const state = analysisReducer(initialAnalysisState, {
      type: "PROCESSING_CANCELLED",
      file,
      objectUrl: "blob:swing",
      runId: "run-1",
      metadata,
    });

    expect(state).toMatchObject({
      status: "cancelled",
      file,
      objectUrl: "blob:swing",
      metadata,
    });
  });
});
