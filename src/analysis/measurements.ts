import {
  distance,
  imageLineTiltDegrees,
  isLandmarkUsable,
  jointAngleDegrees,
  midpoint,
  round,
  torsoSideBendDegrees,
} from "./geometry";
import type { PoseFrame, PoseLandmark, PoseSequence } from "@/pose/types";

export type Handedness = "right" | "left";
export type PhaseId = "address" | "top" | "impact" | "finish";
export type MetricConfidence = "high" | "medium" | "low";
export type MetricId =
  | "leadElbowFlexion"
  | "trailElbowFlexion"
  | "leadKneeFlexion"
  | "trailKneeFlexion"
  | "shoulderTilt"
  | "hipTilt"
  | "torsoSideBend"
  | "pelvisShift";

export type PhaseMarkers = Partial<Record<PhaseId, number>>;

export interface PhaseSnapshot {
  phase: PhaseId;
  timestampMs: number;
  metrics: Partial<Record<MetricId, number>>;
  confidence: Partial<Record<MetricId, MetricConfidence>>;
  pelvisShiftBasis?: "stance-widths" | "shoulder-widths";
}

export interface HandPathPoint {
  timestampMs: number;
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
}

export interface MeasuredSwingRecord {
  handedness: Handedness;
  phases: PhaseSnapshot[];
  handPath: HandPathPoint[];
  timing?: {
    backswingMs: number;
    downswingMs: number;
    tempoRatio: number;
  };
  phaseOrderValid: boolean;
}

export interface MetricSeriesPoint {
  timestampMs: number;
  value: number;
}

const PHASE_ORDER: PhaseId[] = ["address", "top", "impact", "finish"];

const INDEX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export function buildMeasuredSwingRecord(
  sequence: PoseSequence,
  markers: PhaseMarkers,
  handedness: Handedness,
): MeasuredSwingRecord {
  const phaseOrderValid = validatePhaseOrder(markers);
  const addressPose = poseAtTimestamp(sequence, markers.address);
  const phases = PHASE_ORDER.flatMap((phase) => {
    const timestampMs = markers[phase];
    if (timestampMs === undefined) return [];
    const pose = poseAtTimestamp(sequence, timestampMs);
    return [
      createPhaseSnapshot(
        phase,
        timestampMs,
        pose,
        addressPose,
        sequence,
        handedness,
      ),
    ];
  });

  const address = markers.address;
  const top = markers.top;
  const impact = markers.impact;
  const timing =
    phaseOrderValid &&
    address !== undefined &&
    top !== undefined &&
    impact !== undefined
      ? {
          backswingMs: top - address,
          downswingMs: impact - top,
          tempoRatio: round((top - address) / (impact - top), 2),
        }
      : undefined;

  return {
    handedness,
    phases,
    handPath: calculateHandPath(sequence),
    ...(timing === undefined ? {} : { timing }),
    phaseOrderValid,
  };
}

export function validatePhaseOrder(markers: PhaseMarkers) {
  const required = [markers.address, markers.top, markers.impact];
  if (required.some((value) => value === undefined)) return true;
  const [address, top, impact] = required as [number, number, number];
  if (!(address < top && top < impact)) return false;
  return markers.finish === undefined || impact < markers.finish;
}

export function poseAtTimestamp(
  sequence: PoseSequence,
  timestampMs: number | undefined,
) {
  if (timestampMs === undefined) return null;
  return (
    sequence.frames.find((sample) => sample.timestampMs === timestampMs)
      ?.pose ?? null
  );
}

export function calculateHandPath(sequence: PoseSequence): HandPathPoint[] {
  return sequence.frames.flatMap(({ timestampMs, pose }) => {
    if (!pose) return [];
    const leftWrist = pose.landmarks[INDEX.leftWrist];
    const rightWrist = pose.landmarks[INDEX.rightWrist];
    const leftShoulder = pose.landmarks[INDEX.leftShoulder];
    const rightShoulder = pose.landmarks[INDEX.rightShoulder];
    const leftHip = pose.landmarks[INDEX.leftHip];
    const rightHip = pose.landmarks[INDEX.rightHip];
    if (
      !isLandmarkUsable(leftWrist) ||
      !isLandmarkUsable(rightWrist) ||
      !isLandmarkUsable(leftShoulder) ||
      !isLandmarkUsable(rightShoulder) ||
      !isLandmarkUsable(leftHip) ||
      !isLandmarkUsable(rightHip)
    ) {
      return [];
    }

    const handMidpoint = midpoint(leftWrist, rightWrist);
    const hipMidpoint = midpoint(leftHip, rightHip);
    const shoulderWidth = distance(leftShoulder, rightShoulder);
    if (shoulderWidth === 0) return [];
    return [
      {
        timestampMs,
        x: handMidpoint.x,
        y: handMidpoint.y,
        normalizedX: round((handMidpoint.x - hipMidpoint.x) / shoulderWidth, 3),
        normalizedY: round((hipMidpoint.y - handMidpoint.y) / shoulderWidth, 3),
      },
    ];
  });
}

export function createMetricSeries(
  sequence: PoseSequence,
  metricId: MetricId,
  handedness: Handedness,
): MetricSeriesPoint[] {
  return sequence.frames.flatMap(({ timestampMs, pose }) => {
    if (!pose) return [];
    const snapshot = createPhaseSnapshot(
      "address",
      timestampMs,
      pose,
      pose,
      sequence,
      handedness,
    );
    const value = snapshot.metrics[metricId];
    return value === undefined ? [] : [{ timestampMs, value }];
  });
}

function createPhaseSnapshot(
  phase: PhaseId,
  timestampMs: number,
  pose: PoseFrame | null,
  addressPose: PoseFrame | null,
  sequence: PoseSequence,
  handedness: Handedness,
): PhaseSnapshot {
  if (!pose) return { phase, timestampMs, metrics: {}, confidence: {} };
  const leadSide = handedness === "right" ? "left" : "right";
  const trailSide = leadSide === "left" ? "right" : "left";
  const metricEntries: Array<[MetricId, number | null, PoseLandmark[]]> = [
    [
      "leadElbowFlexion",
      limbAngle(pose, leadSide, "elbow", sequence),
      limbLandmarks(pose, leadSide, "elbow"),
    ],
    [
      "trailElbowFlexion",
      limbAngle(pose, trailSide, "elbow", sequence),
      limbLandmarks(pose, trailSide, "elbow"),
    ],
    [
      "leadKneeFlexion",
      limbAngle(pose, leadSide, "knee", sequence),
      limbLandmarks(pose, leadSide, "knee"),
    ],
    [
      "trailKneeFlexion",
      limbAngle(pose, trailSide, "knee", sequence),
      limbLandmarks(pose, trailSide, "knee"),
    ],
    [
      "shoulderTilt",
      lineMetric(pose, "shoulder", sequence),
      pair(pose, "shoulder"),
    ],
    ["hipTilt", lineMetric(pose, "hip", sequence), pair(pose, "hip")],
    ["torsoSideBend", torsoMetric(pose, sequence), torsoLandmarks(pose)],
  ];

  const pelvis = pelvisShift(pose, addressPose);
  if (pelvis) {
    metricEntries.push(["pelvisShift", pelvis.value, pelvis.landmarks]);
  }

  const metrics: PhaseSnapshot["metrics"] = {};
  const confidence: PhaseSnapshot["confidence"] = {};
  for (const [metricId, value, landmarks] of metricEntries) {
    if (
      value === null ||
      !landmarks.every((landmark) => isLandmarkUsable(landmark))
    ) {
      continue;
    }
    metrics[metricId] = value;
    confidence[metricId] = confidenceFor(landmarks);
  }

  return {
    phase,
    timestampMs,
    metrics,
    confidence,
    ...(pelvis ? { pelvisShiftBasis: pelvis.basis } : {}),
  };
}

function limbAngle(
  pose: PoseFrame,
  side: "left" | "right",
  joint: "elbow" | "knee",
  sequence: PoseSequence,
) {
  const landmarks = limbLandmarks(pose, side, joint);
  if (!landmarks.every((landmark) => isLandmarkUsable(landmark))) return null;
  return jointAngleDegrees(
    landmarks[0]!,
    landmarks[1]!,
    landmarks[2]!,
    sequence.metadata.width,
    sequence.metadata.height,
  );
}

function limbLandmarks(
  pose: PoseFrame,
  side: "left" | "right",
  joint: "elbow" | "knee",
) {
  const indices =
    joint === "elbow"
      ? side === "left"
        ? [INDEX.leftShoulder, INDEX.leftElbow, INDEX.leftWrist]
        : [INDEX.rightShoulder, INDEX.rightElbow, INDEX.rightWrist]
      : side === "left"
        ? [INDEX.leftHip, INDEX.leftKnee, INDEX.leftAnkle]
        : [INDEX.rightHip, INDEX.rightKnee, INDEX.rightAnkle];
  return indices.map((index) => pose.landmarks[index]!);
}

function pair(pose: PoseFrame, kind: "shoulder" | "hip") {
  return kind === "shoulder"
    ? [
        pose.landmarks[INDEX.leftShoulder]!,
        pose.landmarks[INDEX.rightShoulder]!,
      ]
    : [pose.landmarks[INDEX.leftHip]!, pose.landmarks[INDEX.rightHip]!];
}

function lineMetric(
  pose: PoseFrame,
  kind: "shoulder" | "hip",
  sequence: PoseSequence,
) {
  const landmarks = pair(pose, kind);
  if (!landmarks.every((landmark) => isLandmarkUsable(landmark))) return null;
  return imageLineTiltDegrees(
    landmarks[0]!,
    landmarks[1]!,
    sequence.metadata.width,
    sequence.metadata.height,
  );
}

function torsoLandmarks(pose: PoseFrame) {
  return [
    pose.landmarks[INDEX.leftShoulder]!,
    pose.landmarks[INDEX.rightShoulder]!,
    pose.landmarks[INDEX.leftHip]!,
    pose.landmarks[INDEX.rightHip]!,
  ];
}

function torsoMetric(pose: PoseFrame, sequence: PoseSequence) {
  const landmarks = torsoLandmarks(pose);
  if (!landmarks.every((landmark) => isLandmarkUsable(landmark))) return null;
  return torsoSideBendDegrees(
    midpoint(landmarks[0]!, landmarks[1]!),
    midpoint(landmarks[2]!, landmarks[3]!),
    sequence.metadata.width,
    sequence.metadata.height,
  );
}

function pelvisShift(pose: PoseFrame, addressPose: PoseFrame | null) {
  if (!addressPose) return null;
  const currentHips = pair(pose, "hip");
  const addressHips = pair(addressPose, "hip");
  const addressAnkles = [
    addressPose.landmarks[INDEX.leftAnkle]!,
    addressPose.landmarks[INDEX.rightAnkle]!,
  ];
  const addressShoulders = pair(addressPose, "shoulder");
  if (
    ![...currentHips, ...addressHips].every((landmark) =>
      isLandmarkUsable(landmark),
    )
  ) {
    return null;
  }

  const stanceUsable = addressAnkles.every((landmark) =>
    isLandmarkUsable(landmark),
  );
  const basisLandmarks = stanceUsable ? addressAnkles : addressShoulders;
  if (!basisLandmarks.every((landmark) => isLandmarkUsable(landmark)))
    return null;
  const basisWidth = Math.abs(basisLandmarks[1]!.x - basisLandmarks[0]!.x);
  if (basisWidth === 0) return null;
  const shift =
    midpoint(currentHips[0]!, currentHips[1]!).x -
    midpoint(addressHips[0]!, addressHips[1]!).x;
  return {
    value: round(shift / basisWidth, 3),
    basis: stanceUsable
      ? ("stance-widths" as const)
      : ("shoulder-widths" as const),
    landmarks: [...currentHips, ...addressHips, ...basisLandmarks],
  };
}

function confidenceFor(landmarks: PoseLandmark[]): MetricConfidence {
  const minimum = Math.min(
    ...landmarks.map((landmark) =>
      Math.min(landmark.visibility ?? 1, landmark.presence ?? 1),
    ),
  );
  return minimum >= 0.8 ? "high" : minimum >= 0.7 ? "medium" : "low";
}
