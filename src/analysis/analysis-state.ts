import type {
  PoseSequence,
  ProcessingProgress,
  VideoMetadata,
} from "@/pose/types";

interface LocalVideo {
  file: File;
  objectUrl: string;
  runId: string;
}

export type AnalysisState =
  | { status: "idle" }
  | ({ status: "loading-video" } & LocalVideo)
  | ({
      status: "processing";
      metadata: VideoMetadata;
      progress: ProcessingProgress;
    } & LocalVideo)
  | ({ status: "ready"; sequence: PoseSequence } & LocalVideo)
  | ({ status: "cancelled"; metadata: VideoMetadata } & LocalVideo)
  | ({
      status: "error";
      message: string;
      retryable: boolean;
      metadata?: VideoMetadata;
    } & Partial<LocalVideo>);

export type AnalysisAction =
  | ({ type: "VIDEO_LOADING" } & LocalVideo)
  | ({ type: "PROCESSING_STARTED"; metadata: VideoMetadata } & LocalVideo)
  | { type: "PROGRESS_UPDATED"; runId: string; progress: ProcessingProgress }
  | ({ type: "PROCESSING_SUCCEEDED"; sequence: PoseSequence } & LocalVideo)
  | ({ type: "PROCESSING_CANCELLED"; metadata: VideoMetadata } & LocalVideo)
  | ({
      type: "PROCESSING_FAILED";
      message: string;
      retryable: boolean;
      metadata?: VideoMetadata;
    } & Partial<LocalVideo>)
  | { type: "RESET" };

export const initialAnalysisState: AnalysisState = { status: "idle" };

export function analysisReducer(
  state: AnalysisState,
  action: AnalysisAction,
): AnalysisState {
  if (action.type === "RESET") return initialAnalysisState;
  if (
    "runId" in action &&
    "runId" in state &&
    action.type !== "VIDEO_LOADING" &&
    action.runId !== state.runId
  ) {
    return state;
  }

  switch (action.type) {
    case "VIDEO_LOADING":
      return {
        status: "loading-video",
        file: action.file,
        objectUrl: action.objectUrl,
        runId: action.runId,
      };
    case "PROCESSING_STARTED":
      return {
        status: "processing",
        file: action.file,
        objectUrl: action.objectUrl,
        runId: action.runId,
        metadata: action.metadata,
        progress: {
          stage: "loading-model",
          completedFrames: 0,
          totalFrames: 0,
          percent: 0,
        },
      };
    case "PROGRESS_UPDATED":
      return state.status === "processing"
        ? { ...state, progress: action.progress }
        : state;
    case "PROCESSING_SUCCEEDED":
      return {
        status: "ready",
        file: action.file,
        objectUrl: action.objectUrl,
        runId: action.runId,
        sequence: action.sequence,
      };
    case "PROCESSING_CANCELLED":
      return {
        status: "cancelled",
        file: action.file,
        objectUrl: action.objectUrl,
        runId: action.runId,
        metadata: action.metadata,
      };
    case "PROCESSING_FAILED":
      return {
        status: "error",
        message: action.message,
        retryable: action.retryable,
        ...(action.file === undefined ? {} : { file: action.file }),
        ...(action.objectUrl === undefined
          ? {}
          : { objectUrl: action.objectUrl }),
        ...(action.runId === undefined ? {} : { runId: action.runId }),
        ...(action.metadata === undefined ? {} : { metadata: action.metadata }),
      };
  }
}
