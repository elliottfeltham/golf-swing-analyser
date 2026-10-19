"use client";

import { useRef, useState } from "react";

import { PoseWorkerClient } from "@/pose/pose-worker-client";
import { validateVideoFile } from "@/video/validate-video-file";

type CheckStatus =
  | "idle"
  | "loading-video"
  | "loading-model"
  | "analysing"
  | "success"
  | "no-pose"
  | "error";

interface CheckResult {
  landmarkCount: number;
  sampledAtSeconds: number;
}

function waitForMediaEvent(
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "seeked",
) {
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
      video.removeEventListener(eventName, handleSuccess);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener(eventName, handleSuccess, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

export function PoseReadinessCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CheckStatus>("idle");
  const [result, setResult] = useState<CheckResult>();
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleFile(file: File) {
    setErrorMessage(undefined);
    setResult(undefined);

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setStatus("error");
      setErrorMessage(validation.message);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let client: PoseWorkerClient | undefined;
    const objectUrl = URL.createObjectURL(file);

    try {
      setStatus("loading-video");
      video.src = objectUrl;
      video.load();
      await waitForMediaEvent(video, "loadedmetadata");

      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        throw new Error("The video has no readable duration.");
      }

      const sampledAtSeconds = Math.min(
        video.duration / 2,
        Math.max(0, video.duration - 0.05),
      );
      video.currentTime = sampledAtSeconds;
      await waitForMediaEvent(video, "seeked");

      setStatus("loading-model");
      client = new PoseWorkerClient();
      const origin = window.location.origin;
      await client.initialise({
        wasmBaseUrl: `${origin}/mediapipe/wasm`,
        modelAssetUrl: `${origin}/mediapipe/models/pose_landmarker_full.task`,
      });

      setStatus("analysing");
      const frame = await createImageBitmap(video);
      const pose = await client.analyseFrame(frame, sampledAtSeconds * 1_000);

      if (!pose) {
        setStatus("no-pose");
        return;
      }

      setResult({
        landmarkCount: pose.landmarks.length,
        sampledAtSeconds,
      });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "The pose check failed.",
      );
    } finally {
      client?.dispose();
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
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400 uppercase">
            Technical proof
          </p>
          <h2 id="readiness-heading" className="mt-3 text-2xl font-semibold">
            Check pose tracking on your video
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            This early build samples one frame to verify browser decoding and
            MediaPipe pose detection. The video remains on this device and is
            not uploaded.
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
            result={result}
            errorMessage={errorMessage}
          />
        </div>
      </div>
    </section>
  );
}

function StatusContent({
  status,
  result,
  errorMessage,
}: {
  status: CheckStatus;
  result?: CheckResult;
  errorMessage?: string;
}) {
  if (status === "success" && result) {
    return (
      <div>
        <p className="font-semibold text-emerald-400">Pose detected</p>
        <p className="mt-3 text-3xl font-semibold text-white">
          {result.landmarkCount} landmarks
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Found in the frame at {result.sampledAtSeconds.toFixed(2)} seconds.
          This proves the browser-to-worker inference path; full video
          processing comes next.
        </p>
      </div>
    );
  }

  if (status === "no-pose") {
    return (
      <div>
        <p className="font-semibold text-amber-300">
          No pose found in the sampled frame
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

  const messages = {
    idle: "Your result will appear here.",
    "loading-video": "Reading video metadata…",
    "loading-model": "Loading the pose model…",
    analysing: "Analysing the sampled frame…",
  } satisfies Record<
    Exclude<CheckStatus, "success" | "no-pose" | "error">,
    string
  >;

  return (
    <p className="text-sm text-slate-400">
      {status === "success" ? "Pose detected." : messages[status]}
    </p>
  );
}
