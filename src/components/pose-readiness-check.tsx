"use client";

import { useRef, useState } from "react";

import {
  benchmarkVideoModel,
  type PoseBenchmarkResult,
  type PoseModelVariant,
} from "@/pose/benchmark-video";
import { validateVideoFile } from "@/video/validate-video-file";

type CheckStatus =
  | "idle"
  | "loading-video"
  | "loading-model"
  | "analysing"
  | "success"
  | "no-pose"
  | "error";

function waitForMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("The browser could not decode this video."));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleSuccess);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("loadedmetadata", handleSuccess, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

export function PoseReadinessCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CheckStatus>("idle");
  const [activeModel, setActiveModel] = useState<PoseModelVariant>();
  const [results, setResults] = useState<PoseBenchmarkResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [selectedFileName, setSelectedFileName] = useState<string>();
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File) {
    setErrorMessage(undefined);
    setResults([]);
    setSelectedFileName(file.name);

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setStatus("error");
      setErrorMessage(validation.message);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const objectUrl = URL.createObjectURL(file);

    try {
      setStatus("loading-video");
      video.src = objectUrl;
      video.load();
      await waitForMetadata(video);

      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        throw new Error("The video has no readable duration.");
      }

      const benchmarkResults: PoseBenchmarkResult[] = [];
      for (const model of ["Full", "Lite"] as const) {
        setActiveModel(model);
        setStatus(
          benchmarkResults.length === 0 ? "loading-model" : "analysing",
        );
        const result = await benchmarkVideoModel(video, model);
        benchmarkResults.push(result);
        setResults([...benchmarkResults]);
      }

      setStatus(
        benchmarkResults.some((result) => result.detectedFrames > 0)
          ? "success"
          : "no-pose",
      );
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "The pose check failed.",
      );
    } finally {
      setActiveModel(undefined);
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    }
  }

  const isBusy = ["loading-video", "loading-model", "analysing"].includes(
    status,
  );

  const statusLabel = getStatusLabel(status, activeModel);

  return (
    <section aria-labelledby="readiness-heading" className="readiness-station">
      <header className="station-header">
        <div>
          <h2 id="readiness-heading">Analyse a face-on swing.</h2>
          <p>
            The readiness check decodes your video and samples six frames with
            both MediaPipe pose models. It is a bounded technical check, not the
            finished swing report.
          </p>
        </div>
        <div className="station-index" aria-label="Workflow stage one">
          <span>Readiness</span>
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
              if (!isBusy) setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const file = event.dataTransfer.files[0];
              if (file && !isBusy) void handleFile(file);
            }}
          >
            <span className="upload-icon" aria-hidden="true">
              <UploadIcon />
            </span>
            <span className="upload-action">
              {isBusy ? "Checking your video…" : "Choose swing video"}
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
              disabled={isBusy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
          </label>

          <div className="file-register" aria-label="Selected video">
            <span>Local file</span>
            <strong>{selectedFileName ?? "No video selected"}</strong>
            <em>Browser only</em>
          </div>

          <SampleRail status={status} />

          <video
            ref={videoRef}
            className="hidden"
            muted
            playsInline
            preload="metadata"
          />
        </div>

        <div
          className="readiness-register"
          aria-live="polite"
          aria-busy={isBusy}
        >
          <div className="register-heading">
            <span>Readiness record</span>
            <strong>{statusLabel}</strong>
          </div>
          <StatusContent
            status={status}
            activeModel={activeModel}
            results={results}
            errorMessage={errorMessage}
          />
        </div>
      </div>
    </section>
  );
}

function StatusContent({
  status,
  activeModel,
  results,
  errorMessage,
}: {
  status: CheckStatus;
  activeModel?: PoseModelVariant;
  results: PoseBenchmarkResult[];
  errorMessage?: string;
}) {
  if (status === "success") {
    return (
      <div className="status-content status-success">
        <StatusMark kind="success" />
        <h3>Pose signal found.</h3>
        <p>
          At least one sampled frame returned body landmarks. Compare the model
          records below before continuing to full analysis.
        </p>
        <BenchmarkTable results={results} />
      </div>
    );
  }

  if (status === "no-pose") {
    return (
      <div className="status-content status-warning">
        <StatusMark kind="warning" />
        <h3>No pose in the sample.</h3>
        <p>
          Try another face-on recording with the golfer’s full body visible,
          even lighting, and less empty footage around the swing.
        </p>
        <BenchmarkTable results={results} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="status-content status-error">
        <StatusMark kind="error" />
        <h3>Check could not complete.</h3>
        <p>{errorMessage}</p>
        <span className="recovery-note">
          The selected file remains on your device. Choose another video to try
          again.
        </span>
      </div>
    );
  }

  const heading =
    status === "loading-video"
      ? "Reading the recording."
      : status === "idle"
        ? "Ready for a recording."
        : `Checking with ${activeModel ?? "the pose"} model.`;

  const message =
    status === "loading-video"
      ? "Checking the file duration, orientation, and browser decoding support."
      : status === "idle"
        ? "Choose one short, face-on swing video. The technical result will be recorded here."
        : "Model loading and frame inference can take a moment, especially on mobile devices.";

  return (
    <div className="status-content status-neutral">
      <StatusMark kind={status === "idle" ? "idle" : "working"} />
      <h3>{heading}</h3>
      <p>{message}</p>
      <StageList status={status} />
    </div>
  );
}

function BenchmarkTable({ results }: { results: PoseBenchmarkResult[] }) {
  return (
    <div
      className="benchmark-table"
      role="table"
      aria-label="Pose model results"
    >
      <div className="benchmark-row benchmark-header" role="row">
        <span role="columnheader">Model</span>
        <span role="columnheader">Pose frames</span>
        <span role="columnheader">Frame time</span>
      </div>
      {results.map((result) => (
        <div className="benchmark-row" role="row" key={result.model}>
          <strong role="cell">{result.model}</strong>
          <span role="cell">
            {result.detectedFrames}/{result.sampledFrames}
            <small>{result.landmarkCount || "—"} landmarks</small>
          </span>
          <span role="cell">
            {result.averageInferenceMs.toFixed(0)} ms
            <small>{result.modelLoadMs.toFixed(0)} ms load</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function SampleRail({ status }: { status: CheckStatus }) {
  const isWorking = ["loading-video", "loading-model", "analysing"].includes(
    status,
  );
  const isFinished = ["success", "no-pose"].includes(status);

  return (
    <div className="sample-rail" aria-label="Six-frame readiness sample">
      <div className="sample-rail-heading">
        <span>Bounded frame sample</span>
        <em>
          {isFinished ? "Complete" : isWorking ? "In progress" : "Waiting"}
        </em>
      </div>
      <ol>
        {[1, 2, 3, 4, 5, 6].map((frame) => (
          <li
            key={frame}
            data-active={isWorking || undefined}
            data-complete={isFinished || undefined}
          >
            <span>{String(frame).padStart(2, "0")}</span>
            <i aria-hidden="true" />
          </li>
        ))}
      </ol>
      <p>Six timestamps across the clip. No full report is generated yet.</p>
    </div>
  );
}

function StageList({ status }: { status: CheckStatus }) {
  const stages = [
    {
      label: "Video decode",
      state:
        status === "idle"
          ? "waiting"
          : status === "loading-video"
            ? "active"
            : "complete",
    },
    {
      label: "Model load",
      state: ["idle", "loading-video"].includes(status)
        ? "waiting"
        : status === "loading-model"
          ? "active"
          : ["analysing", "success", "no-pose"].includes(status)
            ? "complete"
            : "waiting",
    },
    {
      label: "Pose sample",
      state:
        status === "analysing"
          ? "active"
          : ["success", "no-pose"].includes(status)
            ? "complete"
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

function getStatusLabel(status: CheckStatus, activeModel?: PoseModelVariant) {
  if (status === "idle") return "Waiting";
  if (status === "loading-video") return "Reading file";
  if (status === "loading-model") return `Loading ${activeModel ?? "model"}`;
  if (status === "analysing") return `Running ${activeModel ?? "model"}`;
  if (status === "success") return "Pose found";
  if (status === "no-pose") return "No pose";
  return "Needs attention";
}
