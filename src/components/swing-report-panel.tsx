"use client";

import { useEffect, useState } from "react";

import {
  ReportAllowanceSchema,
  ReportResponseSchema,
  type AnalysisReportInput,
  type ObservationCandidate,
  type ReportAllowanceResponse,
  type ReportResponse,
} from "@/report/schema";

type ReportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; response: ReportResponse }
  | { status: "error"; message: string };

const CATEGORY_LABELS: Record<ObservationCandidate["category"], string> = {
  tempo: "Timing",
  "pelvis-movement": "Pelvis",
  "arm-structure": "Arms",
  "lower-body": "Lower body",
  "body-tilt": "Body lines",
  "hand-path": "Hand path",
  "tracking-quality": "Tracking",
};

export function SwingReportPanel({
  input,
  onReviewEvidence,
}: {
  input: AnalysisReportInput | null;
  onReviewEvidence: (candidate: ObservationCandidate) => void;
}) {
  const [consented, setConsented] = useState(false);
  const [allowance, setAllowance] = useState<ReportAllowanceResponse>();
  const [state, setState] = useState<ReportState>({ status: "idle" });
  const [feedback, setFeedback] = useState<string>();
  useEffect(() => {
    if (!input) return;
    const controller = new AbortController();
    void fetch("/api/reports", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Allowance lookup failed.");
        const parsed = ReportAllowanceSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Allowance response was invalid.");
        setAllowance(parsed.data);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAllowance({
            aiAvailable: false,
            quotaAvailable: false,
            limit: 5,
            remaining: null,
            resetAt: nextUtcReset(),
          });
        }
      });
    return () => controller.abort();
  }, [input]);

  async function generateReport() {
    if (!input || !consented || state.status === "loading") return;
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? "The written report could not be built.",
        );
      }
      const parsed = ReportResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error("The report response could not be verified.");
      }
      setState({ status: "ready", response: parsed.data });
      setAllowance((current) => ({
        aiAvailable:
          parsed.data.source === "openrouter" || Boolean(current?.aiAvailable),
        quotaAvailable: parsed.data.allowance.remaining !== null,
        limit: parsed.data.allowance.limit,
        remaining: parsed.data.allowance.remaining,
        resetAt: parsed.data.allowance.resetAt,
      }));
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The written report could not be built.",
      });
    }
  }

  return (
    <section className="swing-report" aria-labelledby="swing-report-heading">
      <header className="report-heading">
        <div>
          <h3 id="swing-report-heading">Written swing review</h3>
          <p>
            Plain-language observations, each tied to a measured phase you can
            inspect in the video.
          </p>
        </div>
        <AllowanceStatus allowance={allowance} />
      </header>

      {!input ? (
        <div className="report-prerequisite">
          <strong>Three moments unlock the review.</strong>
          <p>
            Mark address, top, and impact in chronological order. Finish is
            useful, but optional.
          </p>
        </div>
      ) : state.status === "ready" ? (
        <ReportResult
          response={state.response}
          feedback={feedback}
          onFeedback={(value) => {
            setFeedback(value);
            saveFeedback(value, state.response.source);
          }}
          onReviewEvidence={onReviewEvidence}
        />
      ) : (
        <div className="report-consent-grid">
          <div className="report-privacy-copy">
            <h4>What leaves this device</h4>
            <p>
              Your video and raw pose landmarks stay in this browser. The
              written review sends only anonymous phase timings, body-pose
              measurements, and confidence information to the report API.
            </p>
            <p>
              When AI capacity is available, that reduced record is shared with
              OpenRouter and its selected model provider. It contains no name,
              account, image, or video frame.
            </p>
          </div>
          <div className="report-action-register">
            <label className="report-consent">
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
              />
              <span>
                I agree to send the reduced movement record for this written
                review.
              </span>
            </label>
            <button
              type="button"
              className="report-generate"
              disabled={!consented || state.status === "loading"}
              onClick={() => void generateReport()}
            >
              {state.status === "loading"
                ? "Building written review…"
                : allowance?.remaining === 0 ||
                    allowance?.aiAvailable === false ||
                    allowance?.quotaAvailable === false
                  ? "Build local written review"
                  : "Generate written review"}
            </button>
            {state.status === "loading" && (
              <div className="report-loading" role="status">
                <div aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <p>Checking evidence and preparing the report.</p>
              </div>
            )}
            {state.status === "error" && (
              <p className="report-error" role="alert">
                {state.message} Your measurements and video are still here;
                retry when ready.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AllowanceStatus({
  allowance,
}: {
  allowance: ReportAllowanceResponse | undefined;
}) {
  if (!allowance) {
    return <span className="allowance-status">Checking AI allowance…</span>;
  }
  if (!allowance.aiAvailable) {
    return <span className="allowance-status">Local report available</span>;
  }
  if (!allowance.quotaAvailable || allowance.remaining === null) {
    return <span className="allowance-status">AI temporarily unavailable</span>;
  }
  return (
    <span className="allowance-status">
      <strong>{allowance.remaining}</strong> of {allowance.limit} AI reviews
      remain today
    </span>
  );
}

function ReportResult({
  response,
  feedback,
  onFeedback,
  onReviewEvidence,
}: {
  response: ReportResponse;
  feedback: string | undefined;
  onFeedback: (value: string) => void;
  onReviewEvidence: (candidate: ObservationCandidate) => void;
}) {
  const candidates = new Map(
    response.candidates.map((candidate) => [candidate.id, candidate]),
  );
  return (
    <div className="report-result" aria-live="polite">
      <div className="report-summary">
        <span>
          {response.source === "openrouter"
            ? response.allowance.cacheHit
              ? "AI review · cached"
              : "AI-assisted review"
            : "Evidence-led local review"}
        </span>
        <p>{response.report.summary}</p>
        {response.source === "deterministic-fallback" && (
          <small>{fallbackMessage(response.fallbackReason)}</small>
        )}
      </div>

      <ol className="report-insights">
        {response.report.insights.map((insight, index) => {
          const candidate = candidates.get(insight.candidateId);
          if (!candidate) return null;
          return (
            <li key={insight.candidateId}>
              <article>
                <div className="insight-index">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <em>{CATEGORY_LABELS[candidate.category]}</em>
                </div>
                <div className="insight-copy">
                  <h4>{insight.title}</h4>
                  <p>{insight.explanation}</p>
                  <div className="insight-context">
                    <strong>Why review it</strong>
                    <p>{insight.whyItMayMatter}</p>
                  </div>
                  <button
                    type="button"
                    className="evidence-action"
                    onClick={() => onReviewEvidence(candidate)}
                  >
                    {insight.reviewAction}
                  </button>
                </div>
                <CandidateEvidence candidate={candidate} />
              </article>
            </li>
          );
        })}
      </ol>

      <details className="report-limitations">
        <summary>What this analysis cannot measure</summary>
        <ul>
          {response.report.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>

      <div className="report-feedback">
        <div>
          <strong>Was this review useful?</strong>
          <span>Your response stays in this browser.</span>
        </div>
        <div role="group" aria-label="Report feedback">
          {(
            [
              ["useful", "Useful"],
              ["not-useful", "Not useful"],
              ["inaccurate", "Inaccurate"],
              ["unclear", "Unclear"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={feedback === value}
              onClick={() => onFeedback(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CandidateEvidence({ candidate }: { candidate: ObservationCandidate }) {
  return (
    <dl className="candidate-evidence">
      <div>
        <dt>Confidence</dt>
        <dd>{confidenceLabel(candidate.confidence)}</dd>
      </div>
      {candidate.evidence.map((evidence, index) => (
        <div
          key={`${evidence.metricId}-${evidence.phaseId ?? "swing"}-${index}`}
        >
          <dt>
            {metricLabel(evidence.metricId)}
            {evidence.phaseId ? ` · ${evidence.phaseId}` : ""}
          </dt>
          <dd>{formatEvidence(evidence.value, evidence.unit)}</dd>
        </div>
      ))}
    </dl>
  );
}

function fallbackMessage(reason: ReportResponse["fallbackReason"]) {
  if (reason === "customer-limit") {
    return "Today’s personal AI allowance has been used. This report is built directly from the same measured evidence.";
  }
  if (reason === "global-limit") {
    return "Today’s shared AI capacity has been reached. This report is built directly from the same measured evidence.";
  }
  if (reason === "quota-unavailable") {
    return "The AI allowance service is unavailable, so no external model was called.";
  }
  if (reason === "not-configured") {
    return "AI generation is not configured. The measured evidence remains fully available.";
  }
  return "The AI response could not be safely verified, so this report uses the trusted measured evidence directly.";
}

function metricLabel(metricId: ObservationCandidate["metricIds"][number]) {
  const labels = {
    backswingDuration: "Backswing",
    downswingDuration: "Downswing",
    tempoRatio: "Tempo ratio",
    leadElbowFlexion: "Lead elbow",
    trailElbowFlexion: "Trail elbow",
    leadKneeFlexion: "Lead knee",
    trailKneeFlexion: "Trail knee",
    shoulderTilt: "Shoulder tilt",
    hipTilt: "Hip tilt",
    torsoSideBend: "Torso side-bend",
    pelvisShift: "Pelvis shift",
    handPosition: "Hand movement",
    poseAvailability: "Pose availability",
  } satisfies Record<ObservationCandidate["metricIds"][number], string>;
  return labels[metricId];
}

function formatEvidence(
  value: number,
  unit: ObservationCandidate["evidence"][number]["unit"],
) {
  if (unit === "degrees") return `${value.toFixed(1)}°`;
  if (unit === "milliseconds") return `${Math.round(value)} ms`;
  if (unit === "ratio") return `${value.toFixed(2)} : 1`;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)} ${unit.replace("-widths", " widths")}`;
}

function confidenceLabel(confidence: ObservationCandidate["confidence"]) {
  return confidence === "high"
    ? "Strong"
    : confidence === "medium"
      ? "Usable"
      : "Limited";
}

function saveFeedback(value: string, source: ReportResponse["source"]) {
  try {
    const key = "gsa-report-feedback";
    const previous = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    localStorage.setItem(
      key,
      JSON.stringify([
        ...previous.slice(-19),
        { value, source, recordedAt: new Date().toISOString() },
      ]),
    );
  } catch {
    // Feedback is optional; storage restrictions must not affect the report.
  }
}

function nextUtcReset() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}
