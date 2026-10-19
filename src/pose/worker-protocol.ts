import type { PoseFrame, PoseModelOptions } from "./types";

export type PoseWorkerRequest =
  | {
      type: "INITIALISE";
      requestId: string;
      options: PoseModelOptions;
    }
  | {
      type: "ANALYSE_FRAME";
      requestId: string;
      frame: ImageBitmap;
      timestampMs: number;
    };

export type PoseWorkerResponse =
  | { type: "READY"; requestId: string }
  | { type: "FRAME_RESULT"; requestId: string; result: PoseFrame | null }
  | { type: "ERROR"; requestId: string; message: string };
