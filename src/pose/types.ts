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

export interface PoseModelOptions {
  modelAssetUrl: string;
  wasmBaseUrl: string;
  minPoseDetectionConfidence?: number;
  minPosePresenceConfidence?: number;
  minTrackingConfidence?: number;
}
