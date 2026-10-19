import type { AnalysisReportInput, SwingReport } from "./schema";

const DISCLAIMER =
  "This report describes visible body movement from one camera angle. It is not a diagnosis or a measure of swing quality.";

export function createDeterministicReport(
  input: AnalysisReportInput,
): SwingReport {
  const selectedCandidates = input.candidates
    .filter((candidate) => candidate.confidence !== "low")
    .slice(0, 3);
  const candidates =
    selectedCandidates.length > 0
      ? selectedCandidates
      : input.candidates.slice(0, 1);

  return {
    summary:
      "Here are the clearest measured movements to review alongside your swing video.",
    insights: candidates.map((candidate) => ({
      candidateId: candidate.id,
      heading: categoryHeading(candidate.category),
      explanation: `${candidate.observation} ${candidate.whyItMayMatter}`,
    })),
    disclaimer: DISCLAIMER,
  };
}

function categoryHeading(
  category: AnalysisReportInput["candidates"][number]["category"],
) {
  const headings = {
    tempo: "Swing timing",
    pelvis: "Pelvis movement",
    "arm-structure": "Arm structure",
    "lower-body": "Lower-body movement",
    "body-lines": "Body position",
    "hand-path": "Hand path",
    "tracking-quality": "Tracking limitation",
  } satisfies Record<typeof category, string>;

  return headings[category];
}
