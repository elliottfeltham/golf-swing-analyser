"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { isLandmarkUsable } from "@/analysis/geometry";
import {
  buildMeasuredSwingRecord,
  createMetricSeries,
  type Handedness,
  type MetricId,
  type PhaseId,
  type PhaseMarkers,
} from "@/analysis/measurements";
import type { PoseFrame, PoseSequence } from "@/pose/types";

const PHASES: Array<{ id: PhaseId; label: string; optional?: boolean }> = [
  { id: "address", label: "Address" },
  { id: "top", label: "Top" },
  { id: "impact", label: "Impact" },
  { id: "finish", label: "Finish", optional: true },
];

const CHART_METRICS: Array<{ id: MetricId; label: string }> = [
  { id: "leadElbowFlexion", label: "Lead elbow" },
  { id: "trailElbowFlexion", label: "Trail elbow" },
  { id: "shoulderTilt", label: "Shoulder tilt" },
  { id: "hipTilt", label: "Hip tilt" },
];

const METRIC_LABELS: Record<MetricId, string> = {
  leadElbowFlexion: "Lead elbow",
  trailElbowFlexion: "Trail elbow",
  leadKneeFlexion: "Lead knee",
  trailKneeFlexion: "Trail knee",
  shoulderTilt: "Shoulder tilt",
  hipTilt: "Hip tilt",
  torsoSideBend: "Torso side-bend",
  pelvisShift: "Pelvis shift",
};

export function SwingReview({
  objectUrl,
  sequence,
}: {
  objectUrl: string;
  sequence: PoseSequence;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number>(undefined);
  const firstDetectedIndex = Math.max(
    0,
    sequence.frames.findIndex(({ pose }) => pose !== null),
  );
  const initialTimestampRef = useRef(
    sequence.frames[firstDetectedIndex]!.timestampMs,
  );
  const [currentIndex, setCurrentIndex] = useState(firstDetectedIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [markers, setMarkers] = useState<PhaseMarkers>({});
  const [handedness, setHandedness] = useState<Handedness>("right");
  const [chartMetric, setChartMetric] = useState<MetricId>("leadElbowFlexion");
  const [overlays, setOverlays] = useState({
    skeleton: true,
    handPath: true,
    bodyLines: true,
  });

  const currentSample = sequence.frames[currentIndex]!;
  const record = useMemo(
    () => buildMeasuredSwingRecord(sequence, markers, handedness),
    [sequence, markers, handedness],
  );
  const chartData = useMemo(
    () => createMetricSeries(sequence, chartMetric, handedness),
    [sequence, chartMetric, handedness],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.currentTime = initialTimestampRef.current / 1_000;
  }, []); // The initial analysed frame is selected once when the player mounts.

  useEffect(
    () => () => {
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  function syncToVideo() {
    const video = videoRef.current;
    if (!video) return;
    setCurrentIndex(nearestFrameIndex(sequence, video.currentTime * 1_000));
    if (!video.paused && !video.ended) {
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(syncToVideo);
    } else {
      animationFrameRef.current = undefined;
    }
  }

  function stopPlaybackSync() {
    setIsPlaying(false);
    if (animationFrameRef.current !== undefined) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
  }

  function seekToFrame(index: number) {
    const nextIndex = Math.min(sequence.frames.length - 1, Math.max(0, index));
    const video = videoRef.current;
    if (video)
      video.currentTime = sequence.frames[nextIndex]!.timestampMs / 1_000;
    setCurrentIndex(nextIndex);
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  }

  return (
    <section className="review-workspace" aria-labelledby="review-heading">
      <header className="review-heading">
        <div>
          <h2 id="review-heading">Review the movement.</h2>
          <p>
            Scrub the analysed frames, mark the key moments, and inspect only
            measurements supported by readable landmarks.
          </p>
        </div>
        <div className="review-frame-index">
          <span>Frame</span>
          <strong>{String(currentIndex + 1).padStart(3, "0")}</strong>
          <time>{formatTimestamp(currentSample.timestampMs)}</time>
        </div>
      </header>

      <div className="review-grid">
        <div className="media-column">
          <div
            className="media-stage"
            style={{ aspectRatio: String(sequence.metadata.aspectRatio) }}
          >
            <video
              ref={videoRef}
              src={objectUrl}
              muted
              playsInline
              preload="auto"
              onEnded={stopPlaybackSync}
              onPause={stopPlaybackSync}
              onPlay={() => {
                setIsPlaying(true);
                syncToVideo();
              }}
              onSeeked={syncToVideo}
            />
            <PoseOverlay
              sequence={sequence}
              currentIndex={currentIndex}
              overlays={overlays}
            />
            {!currentSample.pose && (
              <div className="tracking-warning">
                Pose unavailable at this frame
              </div>
            )}
          </div>

          <div className="playback-controls">
            <button
              type="button"
              onClick={() => seekToFrame(currentIndex - 1)}
              disabled={currentIndex === 0}
              aria-label="Previous analysed frame"
            >
              −1
            </button>
            <button type="button" onClick={() => void togglePlayback()}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => seekToFrame(currentIndex + 1)}
              disabled={currentIndex === sequence.frames.length - 1}
              aria-label="Next analysed frame"
            >
              +1
            </button>
            <input
              aria-label="Analysed frame"
              type="range"
              min="0"
              max={sequence.frames.length - 1}
              value={currentIndex}
              onChange={(event) => seekToFrame(Number(event.target.value))}
            />
            <output>{formatTimestamp(currentSample.timestampMs)}</output>
          </div>

          <div className="overlay-controls" aria-label="Video overlays">
            {(Object.keys(overlays) as Array<keyof typeof overlays>).map(
              (key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={overlays[key]}
                    onChange={(event) =>
                      setOverlays((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  {key === "handPath"
                    ? "Hand path"
                    : key === "bodyLines"
                      ? "Body lines"
                      : "Skeleton"}
                </label>
              ),
            )}
          </div>
        </div>

        <aside className="evidence-panel">
          <div className="evidence-section handedness-control">
            <h3>Golfer setup</h3>
            <p>
              Choose handedness so lead and trail measurements map correctly.
            </p>
            <div role="group" aria-label="Golfer handedness">
              {(["right", "left"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={handedness === value}
                  onClick={() => setHandedness(value)}
                >
                  {value === "right" ? "Right-handed" : "Left-handed"}
                </button>
              ))}
            </div>
          </div>

          <div className="evidence-section phase-marker-panel">
            <h3>Mark key moments</h3>
            <p>Select a readable frame, then assign its phase.</p>
            <ol>
              {PHASES.map((phase, index) => {
                const timestamp = markers[phase.id];
                return (
                  <li
                    key={phase.id}
                    data-marked={timestamp !== undefined || undefined}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{phase.label}</strong>
                      <small>{phase.optional ? "Optional" : "Required"}</small>
                    </div>
                    <button
                      type="button"
                      disabled={!currentSample.pose}
                      onClick={() =>
                        setMarkers((current) => ({
                          ...current,
                          [phase.id]: currentSample.timestampMs,
                        }))
                      }
                    >
                      {timestamp === undefined
                        ? "Mark"
                        : formatTimestamp(timestamp)}
                    </button>
                  </li>
                );
              })}
            </ol>
            {!record.phaseOrderValid && (
              <p className="phase-order-error">
                Mark phases in chronological order: address, top, impact, then
                finish.
              </p>
            )}
          </div>

          <TempoSummary record={record} />
        </aside>
      </div>

      <PhaseRail
        markers={markers}
        currentTimestamp={currentSample.timestampMs}
        onSelect={(timestampMs) =>
          seekToFrame(nearestFrameIndex(sequence, timestampMs))
        }
      />

      <div className="measurement-workspace">
        <div className="measurement-register">
          <h3>Phase measurements</h3>
          {record.phases.length === 0 ? (
            <p className="measurement-empty">
              Mark address, top, and impact to build the measured swing record.
            </p>
          ) : (
            <PhaseMeasurementTable record={record} />
          )}
        </div>

        <div className="metric-chart-panel">
          <div className="metric-chart-heading">
            <div>
              <h3>Movement over time</h3>
              <p>Image-space angles from readable analysed frames.</p>
            </div>
            <select
              aria-label="Chart measurement"
              value={chartMetric}
              onChange={(event) =>
                setChartMetric(event.target.value as MetricId)
              }
            >
              {CHART_METRICS.map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>
          <div
            className="metric-chart"
            aria-label={`${METRIC_LABELS[chartMetric]} chart`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
              >
                <CartesianGrid stroke="#cbc6b9" vertical={false} />
                <XAxis
                  dataKey="timestampMs"
                  tickFormatter={(value: number) =>
                    `${(value / 1_000).toFixed(1)}s`
                  }
                  tick={{ fill: "#686a64", fontSize: 11 }}
                />
                <YAxis
                  unit="°"
                  width={42}
                  tick={{ fill: "#686a64", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value).toFixed(1)}°`,
                    METRIC_LABELS[chartMetric],
                  ]}
                  labelFormatter={(value) => formatTimestamp(Number(value))}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3157d5"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="measurement-disclosure">
        Angles, tilts, and paths are single-camera image-space observations—not
        full 3D rotation, club tracking, clubhead speed, or swing diagnosis.
      </p>
    </section>
  );
}

function PoseOverlay({
  sequence,
  currentIndex,
  overlays,
}: {
  sequence: PoseSequence;
  currentIndex: number;
  overlays: { skeleton: boolean; handPath: boolean; bodyLines: boolean };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () =>
      drawPoseOverlay(canvas, sequence, currentIndex, overlays);
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [sequence, currentIndex, overlays]);

  return <canvas ref={canvasRef} className="pose-overlay" aria-hidden="true" />;
}

function drawPoseOverlay(
  canvas: HTMLCanvasElement,
  sequence: PoseSequence,
  currentIndex: number,
  overlays: { skeleton: boolean; handPath: boolean; bodyLines: boolean },
) {
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.lineCap = "round";
  context.lineJoin = "round";

  if (overlays.handPath) {
    const path = sequence.frames
      .slice(0, currentIndex + 1)
      .flatMap(({ pose }) => {
        if (!pose) return [];
        const left = pose.landmarks[15];
        const right = pose.landmarks[16];
        if (!isLandmarkUsable(left) || !isLandmarkUsable(right)) return [];
        return [{ x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }];
      });
    if (path.length > 1) {
      context.beginPath();
      path.forEach((point, index) => {
        const x = point.x * bounds.width;
        const y = point.y * bounds.height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = "#3157d5";
      context.lineWidth = 3;
      context.stroke();
    }
  }

  const pose = sequence.frames[currentIndex]?.pose;
  if (!pose) return;
  if (overlays.skeleton)
    drawSkeleton(context, pose, bounds.width, bounds.height);
  if (overlays.bodyLines)
    drawBodyLines(context, pose, bounds.width, bounds.height);
}

const CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
] as const;

function drawSkeleton(
  context: CanvasRenderingContext2D,
  pose: PoseFrame,
  width: number,
  height: number,
) {
  context.strokeStyle = "#f2552c";
  context.lineWidth = 3;
  for (const [startIndex, endIndex] of CONNECTIONS) {
    const start = pose.landmarks[startIndex];
    const end = pose.landmarks[endIndex];
    if (!isLandmarkUsable(start) || !isLandmarkUsable(end)) continue;
    context.beginPath();
    context.moveTo(start.x * width, start.y * height);
    context.lineTo(end.x * width, end.y * height);
    context.stroke();
  }

  context.fillStyle = "#faf8f2";
  context.strokeStyle = "#171816";
  context.lineWidth = 1.5;
  for (const landmark of pose.landmarks) {
    if (!isLandmarkUsable(landmark)) continue;
    context.beginPath();
    context.arc(landmark.x * width, landmark.y * height, 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
}

function drawBodyLines(
  context: CanvasRenderingContext2D,
  pose: PoseFrame,
  width: number,
  height: number,
) {
  context.strokeStyle = "#faf8f2";
  context.lineWidth = 2;
  context.setLineDash([8, 6]);
  for (const [startIndex, endIndex] of [
    [11, 12],
    [23, 24],
  ] as const) {
    const start = pose.landmarks[startIndex];
    const end = pose.landmarks[endIndex];
    if (!isLandmarkUsable(start) || !isLandmarkUsable(end)) continue;
    context.beginPath();
    context.moveTo(start.x * width, start.y * height);
    context.lineTo(end.x * width, end.y * height);
    context.stroke();
  }
  context.setLineDash([]);
}

function TempoSummary({
  record,
}: {
  record: ReturnType<typeof buildMeasuredSwingRecord>;
}) {
  return (
    <div className="evidence-section tempo-summary">
      <h3>Tempo</h3>
      {record.timing ? (
        <dl>
          <div>
            <dt>Backswing</dt>
            <dd>{record.timing.backswingMs} ms</dd>
          </div>
          <div>
            <dt>Downswing</dt>
            <dd>{record.timing.downswingMs} ms</dd>
          </div>
          <div>
            <dt>Ratio</dt>
            <dd>{record.timing.tempoRatio.toFixed(2)} : 1</dd>
          </div>
        </dl>
      ) : (
        <p>Mark address, top, and impact in order to calculate tempo.</p>
      )}
    </div>
  );
}

function PhaseRail({
  markers,
  currentTimestamp,
  onSelect,
}: {
  markers: PhaseMarkers;
  currentTimestamp: number;
  onSelect: (timestampMs: number) => void;
}) {
  return (
    <nav className="phase-rail" aria-label="Marked swing phases">
      {PHASES.map((phase, index) => {
        const timestamp = markers[phase.id];
        const selected = timestamp === currentTimestamp;
        return (
          <button
            type="button"
            key={phase.id}
            disabled={timestamp === undefined}
            aria-current={selected ? "true" : undefined}
            onClick={() => timestamp !== undefined && onSelect(timestamp)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{phase.label}</strong>
            <time>
              {timestamp === undefined
                ? "Not marked"
                : formatTimestamp(timestamp)}
            </time>
          </button>
        );
      })}
    </nav>
  );
}

function PhaseMeasurementTable({
  record,
}: {
  record: ReturnType<typeof buildMeasuredSwingRecord>;
}) {
  const visibleMetrics: MetricId[] = [
    "leadElbowFlexion",
    "trailElbowFlexion",
    "leadKneeFlexion",
    "trailKneeFlexion",
    "shoulderTilt",
    "hipTilt",
    "torsoSideBend",
    "pelvisShift",
  ];
  return (
    <div className="phase-measurement-table" role="table">
      <div className="measurement-row measurement-header" role="row">
        <span role="columnheader">Measurement</span>
        {record.phases.map((phase) => (
          <span role="columnheader" key={phase.phase}>
            {phase.phase}
          </span>
        ))}
      </div>
      {visibleMetrics.map((metricId) => (
        <div className="measurement-row" role="row" key={metricId}>
          <strong role="rowheader">{METRIC_LABELS[metricId]}</strong>
          {record.phases.map((phase) => {
            const value = phase.metrics[metricId];
            return (
              <span role="cell" key={phase.phase}>
                {value === undefined
                  ? "—"
                  : metricId === "pelvisShift"
                    ? `${value.toFixed(2)} ${phase.pelvisShiftBasis === "shoulder-widths" ? "shoulder" : "stance"}`
                    : `${value.toFixed(1)}°`}
                {value !== undefined && (
                  <small>{phase.confidence[metricId] ?? "low"}</small>
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function nearestFrameIndex(sequence: PoseSequence, timestampMs: number) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  sequence.frames.forEach((frame, index) => {
    const frameDistance = Math.abs(frame.timestampMs - timestampMs);
    if (frameDistance < nearestDistance) {
      nearestDistance = frameDistance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function formatTimestamp(timestampMs: number) {
  const totalSeconds = timestampMs / 1_000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
}
