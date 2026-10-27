import { notFound } from "next/navigation";

import { SwingReview } from "@/components/swing-review";
import { E2E_POSE_SEQUENCE } from "@/testing/e2e-pose-sequence";

export default function E2EFixturePage() {
  if (process.env.E2E_FIXTURES !== "1") notFound();

  return (
    <main className="page-shell">
      <SwingReview objectUrl="" sequence={E2E_POSE_SEQUENCE} />
    </main>
  );
}
