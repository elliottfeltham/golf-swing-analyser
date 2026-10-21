"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import {
  analysisReducer,
  initialAnalysisState,
  type AnalysisState,
} from "@/analysis/analysis-state";
import { isPoseProcessingCancelled, processVideo } from "@/pose/process-video";
import type { VideoMetadata } from "@/pose/types";
import { validateVideoFile } from "@/video/validate-video-file";
import { readVideoMetadata, waitForVideoData } from "@/video/video-metadata";
import { SwingReview } from "@/components/swing-review";

export function PoseReadinessCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortControllerRef = useRef<AbortController>(null);
  const objectUrlRef = useRef<string>(undefined);
  const [state, dispatch] = useReducer(analysisReducer, initialAnalysisState);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  function replaceCurrentVideo() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = undefined;

    const video = videoRef.current;
    if (video) {
      video.removeAttribute("src");
      video.load();
    }
  }

  async function handleFile(file: File) {
    replaceCurrentVideo();
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      dispatch({
        type: "PROCESSING_FAILED",
        message: validation.message,
        retryable: false,
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    await runAnalysis(file, objectUrl);
  }

  async function runAnalysis(file: File, objectUrl: string) {
    const video = videoRef.current;
    if (!video) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const runId = crypto.randomUUID();
    let metadata: VideoMetadata | undefined;

    dispatch({ type: "VIDEO_LOADING", file, objectUrl, runId });

    try {
      video.src = objectUrl;
      video.load();
      await waitForVideoData(video, controller.signal);
      metadata = readVideoMetadata(video, file);

      dispatch({
        type: "PROCESSING_STARTED",
        file,
        objectUrl,
        runId,
        metadata,
      });

      const sequence = await processVideo(video, metadata, {
        signal: controller.signal,
        onProgress: (progress) =>
          dispatch({ type: "PROGRESS_UPDATED", runId, progress }),
      });

      dispatch({
        type: "PROCESSING_SUCCEEDED",
        file,
        objectUrl,
        runId,
        sequence,
      });
    } catch (error) {
      if (controller.signal.aborted || isPoseProcessingCancelled(error)) {
        if (metadata) {
          dispatch({
            type: "PROCESSING_CANCELLED",
            file,
            objectUrl,
            runId,
            metadata,
          });
        }
        return;
      }

      dispatch({
        type: "PROCESSING_FAILED",
        file,
        objectUrl,
        runId,
        ...(metadata === undefined ? {} : { metadata }),
        message:
          error instanceof Error ? error.message : "Pose processing failed.",
        retryable: metadata !== undefined,
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }

  const isBusy = ["loading-video", "processing"].includes(state.status);
  const fileName = "file" in state ? state.file?.name : undefined;

  return (
    <>
      <section
        aria-labelledby="readiness-heading"
        className="readiness-station"
      >
        <header className="station-header">
          <div>
            <h2 id="readiness-heading">Analyse a face-on swing.</h2>
            <p>
              The analyser decodes your video and builds a bounded pose sequence
              with MediaPipe Lite. Every frame stays in this browser.
            </p>
          </div>
          <div className="station-index" aria-label="Workflow stage one">
            <span>Pose sequence</span>
            <strong>01</strong>
          </div>
        </header>

        <div className="station-grid">
          <div className="upload-workspace">
            <label
              className="upload-field"
              data-dragging={isDragging || undefined}
              data-busy={isBusy || undefined}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) void handleFile(file);
              }}
            >
              <span className="upload-icon" aria-hidden="true">
                <UploadIcon />
              </span>
              <span className="upload-action">
                {isBusy ? "Building pose sequence…" : "Choose swing video"}
              </span>
              <span className="upload-instruction">
                or drop one file anywhere in this field
              </span>
              <span className="upload-limits">
                MP4, MOV, or WebM <i aria-hidden="true" /> up to 150 MB
              </span>
              <input
                className="sr-only"
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = "";
                }}
              />
            </label>

            <div className="file-register" aria-label="Selected video">
              <span>Local file</span>
              <strong>{fileName ?? "No video selected"}</strong>
              <em>Browser only</em>
            </div>

            <ProgressRail state={state} />

            <video
              ref={videoRef}
              className="hidden"
              muted
              playsInline
              preload="auto"
            />
          </div>

          <div
            className="readiness-register"
            aria-live="polite"
            aria-busy={isBusy}
          >
            <div className="register-heading">
              <span>Processing record</span>
              <strong>{getStatusLabel(state)}</strong>
            </div>
            <StatusContent
              state={state}
              onCancel={() => abortControllerRef.current?.abort()}
              onRetry={() => {
                if ("file" in state && state.file && state.objectUrl) {
                  void runAnalysis(state.file, state.objectUrl);
                }
              }}
            />
          </div>
        </div>
      </section>
      {state.status === "ready" && state.sequence.detectedFrameCount > 0 && (
        <SwingReview
          key={state.runId}
          objectUrl={state.objectUrl}
          sequence={state.sequence}
        />
      )}
    </>
  );
}

function StatusContent({
  state,
  onCancel,
  onRetry,
}: {
  state: AnalysisState;
  onCancel: () => void;
  onRetry: () => void;
}) {
  if (state.status === "ready") {
    const { sequence } = state;
    const hasPose = sequence.detectedFrameCount > 0;
    return (
      <div
        className={
          hasPose
            ? "status-content status-success"
            : "status-content status-warning"
        }
      >
        <StatusMark kind={hasPose ? "success" : "warning"} />
        <h3>{hasPose ? "Pose sequence ready." : "No readable pose found."}</h3>
        <p>
          {hasPose
            ? "The timestamped sequence is ready for synchronized playback and measurement work."
            : "Try a face-on recording with the golfer’s full body visible, even lighting, and less empty footage."}
        </p>
        <SequenceSummary state={state} />
      </div>
    );
  }

  if (state.status === "cancelled") {
    return (
      <div className="status-content status-warning">
        <StatusMark kind="warning" />
        <h3>Processing cancelled.</h3>
        <p>
          The local recording is still available. Restart when you are ready.
        </p>
        <ActionButton onClick={onRetry}>Retry analysis</ActionButton>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="status-content status-error">
        <StatusMark kind="error" />
        <h3>Analysis could not complete.</h3>
        <p>{state.message}</p>
        {state.retryable ? (
          <ActionButton onClick={onRetry}>Retry analysis</ActionButton>
        ) : (
          <span className="recovery-note">
            Choose another supported video to continue.
          </span>
        )}
      </div>
    );
  }

  const progress = state.status === "processing" ? state.progress : undefined;
  const heading =
    state.status === "idle"
      ? "Ready for a recording."
      : state.status === "loading-video"
        ? "Reading the recording."
        : progress?.stage === "loading-model"
          ? "Loading pose model."
          : "Mapping the movement.";
  const message =
    state.status === "idle"
      ? "Choose one short, face-on swing video. The pose sequence will be recorded here."
      : state.status === "loading-video"
        ? "Checking duration, dimensions, orientation, and browser decoding support."
        : progress?.stage === "loading-model"
          ? "Preparing the local MediaPipe Lite model. No video data leaves this device."
          : `${progress?.completedFrames ?? 0} of ${progress?.totalFrames ?? 0} frames analysed.`;

  return (
    <div className="status-content status-neutral">
      <StatusMark kind={state.status === "idle" ? "idle" : "working"} />
      <h3>{heading}</h3>
      <p>{message}</p>
      <StageList state={state} />
      {state.status === "processing" && (
        <ActionButton onClick={onCancel} tone="quiet">
          Cancel processing
        </ActionButton>
      )}
    </div>
  );
}

function SequenceSummary({
  state,
}: {
  state: Extract<AnalysisState, { status: "ready" }>;
}) {
  const { sequence } = state;
  return (
    <dl className="sequence-summary">
      <div>
        <dt>Pose frames</dt>
        <dd>
          {sequence.detectedFrameCount}/{sequence.frames.length}
        </dd>
      </div>
      <div>
        <dt>Availability</dt>
        <dd>{sequence.usablePoseFramePercent.toFixed(1)}%</dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd>{(sequence.metadata.durationMs / 1_000).toFixed(1)} s</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>
          {sequence.metadata.width} × {sequence.metadata.height}
        </dd>
      </div>
    </dl>
  );
}

function ProgressRail({ state }: { state: AnalysisState }) {
  const progress = state.status === "processing" ? state.progress : undefined;
  const isComplete = state.status === "ready";
  const percent = isComplete ? 100 : (progress?.percent ?? 0);

  return (
    <div className="sample-rail" aria-label="Pose sequence progress">
      <div className="sample-rail-heading">
        <span>Bounded pose sequence</span>
        <em>
          {isComplete
            ? "Complete"
            : progress?.stage === "analysing"
              ? `${progress.completedFrames}/${progress.totalFrames}`
              : state.status === "idle"
                ? "Waiting"
                : getStatusLabel(state)}
        </em>
      </div>
      <ol>
        {[1, 2, 3, 4, 5, 6].map((segment) => {
          const threshold = (segment / 6) * 100;
          const complete = percent >= threshold;
          const active = !complete && percent >= ((segment - 1) / 6) * 100;
          return (
            <li
              key={segment}
              data-active={active || undefined}
              data-complete={complete || undefined}
            >
              <span>{String(segment).padStart(2, "0")}</span>
              <i aria-hidden="true" />
            </li>
          );
        })}
      </ol>
      <p>
        12 samples per second, capped at 240. Missing poses stay visible in the
        record.
      </p>
    </div>
  );
}

function StageList({ state }: { state: AnalysisState }) {
  const processingStage =
    state.status === "processing" ? state.progress.stage : undefined;
  const finished = state.status === "ready";
  const stages = [
    {
      label: "Video decode",
      state:
        state.status === "idle"
          ? "waiting"
          : state.status === "loading-video"
            ? "active"
            : "complete",
    },
    {
      label: "Model load",
      state: finished
        ? "complete"
        : processingStage === "loading-model"
          ? "active"
          : processingStage === "analysing" || processingStage === "complete"
            ? "complete"
            : "waiting",
    },
    {
      label: "Pose sequence",
      state: finished
        ? "complete"
        : processingStage === "analysing"
          ? "active"
          : "waiting",
    },
  ];

  return (
    <ol className="stage-list">
      {stages.map((stage) => (
        <li key={stage.label} data-state={stage.state}>
          <span aria-hidden="true" />
          {stage.label}
          <em>{stage.state}</em>
        </li>
      ))}
    </ol>
  );
}

function ActionButton({
  children,
  onClick,
  tone = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "primary" | "quiet";
}) {
  return (
    <button
      className="station-action"
      data-tone={tone}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function StatusMark({
  kind,
}: {
  kind: "idle" | "working" | "success" | "warning" | "error";
}) {
  return (
    <span className="status-mark" data-kind={kind} aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none" stroke="currentColor">
        <path d="M5 11V5h6M25 5h6v6M31 25v6h-6M11 31H5v-6" />
        {kind === "success" ? (
          <path d="m11 18 4.5 4.5L25 13" />
        ) : kind === "error" ? (
          <path d="m12 12 12 12M24 12 12 24" />
        ) : kind === "warning" ? (
          <path d="M18 11v9m0 4v1" />
        ) : (
          <path d="M11 18h14M18 11v14" />
        )}
      </svg>
    </span>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor">
      <path d="M6 12V6h6M28 6h6v6M34 28v6h-6M12 34H6v-6" />
      <path d="M20 28V13m0 0-6 6m6-6 6 6" />
    </svg>
  );
}

function getStatusLabel(state: AnalysisState) {
  if (state.status === "idle") return "Waiting";
  if (state.status === "loading-video") return "Reading file";
  if (state.status === "processing") {
    return state.progress.stage === "loading-model"
      ? "Loading model"
      : `${state.progress.percent}% complete`;
  }
  if (state.status === "ready") {
    return state.sequence.detectedFrameCount > 0 ? "Sequence ready" : "No pose";
  }
  if (state.status === "cancelled") return "Cancelled";
  return "Needs attention";
}
