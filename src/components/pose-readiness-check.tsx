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

  async function handleFile(file: File) {
    setErrorMessage(undefined);
    setResults([]);

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

  return (
    <section
      aria-labelledby="readiness-heading"
      className="mt-12 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/80 shadow-2xl shadow-emerald-950/20"
    >
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400 uppercase">
            Technical proof
          </p>
          <h2 id="readiness-heading" className="mt-3 text-2xl font-semibold">
            Check pose tracking on your video
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            This early build samples six frames with both MediaPipe models to
            verify browser decoding and pose detection. The video remains on
            this device and is not uploaded.
          </p>

          <label className="mt-6 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/60 px-6 text-center transition hover:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-400">
            <span className="font-medium text-slate-100">
              {isBusy ? "Checking your video…" : "Choose a swing video"}
            </span>
            <span className="mt-2 text-xs text-slate-400">
              MP4, MOV, or WebM · up to 150 MB
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
          <video
            ref={videoRef}
            className="hidden"
            muted
            playsInline
            preload="metadata"
          />
        </div>

        <div
          className="flex min-h-56 items-center rounded-2xl bg-slate-950 p-6"
          aria-live="polite"
        >
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
      <div className="w-full">
        <p className="font-semibold text-emerald-400">Pose tracking verified</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {results.map((result) => (
            <BenchmarkCard key={result.model} result={result} />
          ))}
        </div>
      </div>
    );
  }

  if (status === "no-pose") {
    return (
      <div>
        <p className="font-semibold text-amber-300">
          No pose found in the sampled frames
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Try a face-on recording with the golfer’s full body visible and good
          lighting.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div>
        <p className="font-semibold text-rose-300">Check could not complete</p>
        <p className="mt-3 text-sm leading-6 text-slate-400">{errorMessage}</p>
      </div>
    );
  }

  const message =
    status === "loading-video"
      ? "Reading video metadata…"
      : status === "idle"
        ? "Your result will appear here."
        : `${activeModel ?? "Pose"} model: loading and analysing frames…`;

  return <p className="text-sm text-slate-400">{message}</p>;
}

function BenchmarkCard({ result }: { result: PoseBenchmarkResult }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="font-semibold text-white">{result.model}</p>
      <dl className="mt-3 space-y-2 text-xs text-slate-400">
        <div className="flex justify-between gap-4">
          <dt>Pose frames</dt>
          <dd className="text-slate-200">
            {result.detectedFrames}/{result.sampledFrames}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Landmarks</dt>
          <dd className="text-slate-200">{result.landmarkCount || "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Average frame</dt>
          <dd className="text-slate-200">
            {result.averageInferenceMs.toFixed(0)} ms
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Model load</dt>
          <dd className="text-slate-200">{result.modelLoadMs.toFixed(0)} ms</dd>
        </div>
      </dl>
    </div>
  );
}
