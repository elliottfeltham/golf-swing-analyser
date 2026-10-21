export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export interface PoseFrame {
  timestampMs: number;
  landmarks: PoseLandmark[];
  worldLandmarks: PoseLandmark[];
}

export interface VideoMetadata {
  durationMs: number;
  width: number;
  height: number;
  aspectRatio: number;
  mimeType: string;
  fileSizeBytes: number;
}

export interface PoseSample {
  timestampMs: number;
  pose: PoseFrame | null;
}

export interface PoseSequence {
  metadata: VideoMetadata;
  model: "lite";
  targetSamplesPerSecond: 12;
  frames: PoseSample[];
  detectedFrameCount: number;
  usablePoseFramePercent: number;
}

export type ProcessingStage =
  "reading-video" | "loading-model" | "analysing" | "complete";

export interface ProcessingProgress {
  stage: ProcessingStage;
  completedFrames: number;
  totalFrames: number;
  percent: number;
}

export interface PoseModelOptions {
  modelAssetUrl: string;
  wasmBaseUrl: string;
  minPoseDetectionConfidence?: number;
  minPosePresenceConfidence?: number;
  minTrackingConfidence?: number;
}
