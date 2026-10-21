# Day 2 production pose pipeline

Date: 21 October 2026

This record documents the production pose-sequence pipeline that replaces the
Day 1 readiness benchmark in the user journey. The original Full/Lite benchmark
remains in the repository as technical evidence, but the application now uses
the Lite model selected by the Day 1 spike.

## Processing contract

- Sample 12 frames per second, capped at 240 frames.
- Distribute capped samples across the complete video duration.
- Downscale frames proportionally to a maximum 960-pixel edge without upscaling.
- Transfer one `ImageBitmap` at a time to the MediaPipe Web Worker.
- Prefer the GPU delegate and retry model initialization with CPU when needed.
- Store every scheduled timestamp, using `null` when no pose is detected.
- Keep the video, frames, object URL, and complete pose sequence in the browser.
- Dispose workers, bitmaps, event listeners, and replaced object URLs.

The result is a typed `PoseSequence` containing source metadata, ordered pose
samples, the detected-frame count, and pose availability percentage. This is
the input for the synchronized player and measurement work scheduled for Day 3.

## User-facing behaviour

The processing record distinguishes video decoding, model loading, and pose
analysis. Frame progress is determinate after metadata is available. Users can
cancel an active run, retry a cancelled or recoverable failed run, or replace
the recording. Zero detected poses is a completed result with recording
guidance rather than an application error.

## Verification

Automated tests cover timestamp generation, the 240-frame cap, proportional
resizing, metadata validation, stale state updates, cancellation, missing-pose
retention, one-frame-in-flight processing, progress, and cleanup. The browser
suite covers the initial surface and unsupported-file recovery.

Real-device processing times and pose availability remain dependent on the
recording, codec, browser, and hardware. They must be measured with a real
face-on swing before adding performance figures here; no accuracy or universal
speed claim is made.

The opt-in production-pipeline smoke test passed with the existing 12-second
1920×1080 golf fixture in headless Chromium on 21 October 2026. The complete
test took 47.3 seconds, including browser and page setup; this is a development
observation, not a promised processing time.
