import type {
  CandidateCategory,
  ObservationCandidate,
  SwingReport,
} from "./schema";

export const REPORT_LIMITATIONS = [
  "This is a descriptive single-camera, image-space analysis, not a diagnosis or a measure of swing quality.",
  "Pose tracking can become less reliable when body parts are hidden, blurred, or outside the frame.",
  "The hand path follows the tracked wrists; it does not measure the golf club, clubhead speed, or ball flight.",
] as const;

export function createDeterministicReport(
  candidates: ObservationCandidate[],
): SwingReport {
  return {
    schemaVersion: 1,
    summary:
      "These are the clearest measured movements to review alongside your swing video.",
    insights: candidates.map((candidate) => ({
      candidateId: candidate.id,
      title: categoryHeading(candidate.category),
      explanation: candidate.observation,
      whyItMayMatter: candidate.approvedContext,
      reviewAction: reviewAction(candidate),
    })),
    limitations: [...REPORT_LIMITATIONS],
  };
}

function categoryHeading(category: CandidateCategory) {
  const headings = {
    tempo: "Swing timing",
    "pelvis-movement": "Pelvis movement",
    "arm-structure": "Arm structure",
    "lower-body": "Lower-body movement",
    "body-tilt": "Body lines",
    "hand-path": "Hand path",
    "tracking-quality": "Tracking limitation",
  } satisfies Record<CandidateCategory, string>;
  return headings[category];
}

function reviewAction(candidate: ObservationCandidate) {
  if (candidate.category === "tracking-quality") {
    return "Review the skeleton overlay around the affected phases before relying on those measurements.";
  }
  if (candidate.phaseIds.length === 1) {
    return `Review the video and measurements at ${candidate.phaseIds[0]}.`;
  }
  if (candidate.phaseIds.length > 1) {
    return `Compare ${candidate.phaseIds.join(", ")} in the video and phase measurements.`;
  }
  return "Review this measurement alongside the tracked video.";
}
