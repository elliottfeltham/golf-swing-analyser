import Link from "next/link";

import { PoseReadinessCheck } from "@/components/pose-readiness-check";

export default function HomePage() {
  return (
    <div className="app-frame">
      <header className="site-header">
        <Link
          className="wordmark"
          href="/"
          aria-label="Golf Swing Analyser home"
        >
          Golf Swing <span>Analyser</span>
        </Link>
        <div className="header-status" aria-label="Application status">
          <span className="status-dot" aria-hidden="true" />
          Local processing
        </div>
      </header>

      <main className="page-shell">
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <h1 id="page-title">See the movement behind every frame.</h1>
            <p>
              Upload a face-on swing. The analyser samples the recording on your
              device, checks body-pose tracking, and prepares the evidence for
              frame-by-frame review.
            </p>
            <div className="privacy-line">
              <LockIcon />
              <span>
                Your video stays in this browser. No footage is uploaded.
              </span>
            </div>
          </div>

          <aside className="recording-guide" aria-labelledby="guide-title">
            <h2 id="guide-title">Record for readable tracking.</h2>
            <ol>
              <li>
                <span>01</span>
                <p>
                  <strong>Face the camera.</strong> Keep the lens square to the
                  golfer, not behind the target line.
                </p>
              </li>
              <li>
                <span>02</span>
                <p>
                  <strong>Show the full body.</strong> Hands, feet, and club
                  path need room to stay inside the frame.
                </p>
              </li>
              <li>
                <span>03</span>
                <p>
                  <strong>Hold the camera still.</strong> Use even light and a
                  short clip containing one swing.
                </p>
              </li>
            </ol>
          </aside>
        </section>

        <PoseReadinessCheck />

        <footer className="capability-note">
          <span>Current capability</span>
          <p>
            This build verifies browser video decoding and body-pose detection.
            It does not infer clubhead speed, ball flight, or swing quality.
          </p>
        </footer>
      </main>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect x="5" y="10" width="14" height="10" rx="1" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
