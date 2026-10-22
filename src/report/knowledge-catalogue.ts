import type { CandidateCategory } from "./schema";

export const KNOWLEDGE_CATALOGUE = {
  tempo:
    "Tempo is useful as a repeatable timing baseline when the golfer compares their own swings. It does not determine swing quality by itself.",
  "pelvis-movement":
    "This describes horizontal pelvis movement relative to the address position in the face-on image. It is useful for reviewing when that movement occurs.",
  "arm-structure":
    "Comparing elbow measurements between marked phases can show how the visible arm shape changes during the swing.",
  "lower-body":
    "Comparing knee measurements between marked phases can show how the visible lower-body shape changes during the swing.",
  "body-tilt":
    "Shoulder, hip, and torso measurements describe image-plane body lines, not full three-dimensional rotation.",
  "hand-path":
    "The midpoint of the tracked wrists shows how hand position changes relative to body width. It does not measure the club or clubhead.",
  "tracking-quality":
    "Reduced pose availability or landmark confidence limits how strongly the affected measurements should be interpreted.",
} satisfies Record<CandidateCategory, string>;
