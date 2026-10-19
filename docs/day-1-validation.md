# Day 1 technical validation

Date: 19 October 2026

This record captures the initial external-dependency spike. Results are development measurements from one machine and one test video; they are not model-accuracy claims or production performance guarantees.

## Browser pose inference

Fixture: [Pexels video 6573612](https://www.pexels.com/video/golf-swing-6573612/), a 12-second 1920×1080 golf video by Kindel Media. The fixture is downloaded locally and excluded from Git. Attribution, license, and checksum are recorded in [`test-fixtures/README.md`](../test-fixtures/README.md).

Environment:

- Apple Silicon macOS development machine.
- Headless Playwright Chromium.
- MediaPipe Tasks Vision 1.1.1.
- Six evenly spaced frames sampled from 10% to 85% of the video duration.
- GPU delegate requested inside a dedicated Web Worker.

Observed results:

| Model | Frames with a pose | Landmarks | Model load | Mean inference per 1080p frame |
| ----- | -----------------: | --------: | ---------: | -----------------------------: |
| Full  |                1/6 |        33 |     411 ms |                       1,393 ms |
| Lite  |                4/6 |        33 |     133 ms |                       1,269 ms |

Conclusions:

- Uploaded MP4 decoding, seeking, `ImageBitmap` transfer, worker execution, local WASM/model loading, and `detectForVideo` all work end to end.
- A single midpoint frame was not a sufficient readiness test; bounded multi-frame sampling is retained.
- Lite is the provisional MVP default because it loaded faster and detected more sampled poses in this fixture.
- Full remains available for further comparison. A larger, face-on fixture set and real-device profiling are required before making broader quality claims.
- Full-resolution inference is too slow for every source frame on this test environment. The production pipeline must downscale frames and use a bounded sampling rate.

## OpenRouter

The protected `/api/reports` route made one live call using `openrouter/free` and a fixed two-candidate measurement payload.

Observed result:

- The response source was `openrouter` rather than the deterministic fallback.
- Output matched the runtime schema.
- Both insights referenced valid candidate identifiers.
- The response introduced no new measurements, coaching instructions, clubhead-speed claims, or diagnoses.
- The API key remained server-only in `.env.local`.

This proves connectivity and structured response handling. It does not validate report quality across models; fixture-based evaluation remains scheduled for Day 4.

## Deployment

The production build passes locally and the first protected Vercel deployment is available at:

https://golf-swing-analyser.vercel.app

Smoke-test results:

- Homepage returned HTTP 200.
- The 5,777,746-byte Lite model asset returned HTTP 200.
- The report route returned a validated deterministic fallback because no production OpenRouter secret is configured.

Vercel Authentication currently protects the deployment. The OpenRouter key intentionally remains local until customer and global quota enforcement is implemented, preventing an unrestricted deployed endpoint from consuming the shared allowance.
