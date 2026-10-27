# Day 6 compatibility, security, and evaluation

Date: 27 October 2026

Day 6 hardens the MVP rather than adding product scope. Results below are
observations from the named fixtures, browsers, and development machine. They
are not accuracy, latency, or device-wide performance claims.

## Compatibility matrix

The routine Playwright suite exercises the landing and recovery states plus a
deterministic, evidence-linked analysis journey in five projects:

| Project          | Emulated environment       | Result |
| ---------------- | -------------------------- | ------ |
| Desktop Chromium | Playwright Desktop Chrome  | Pass   |
| Desktop Firefox  | Playwright Desktop Firefox | Pass   |
| Desktop WebKit   | Playwright Desktop Safari  | Pass   |
| Mobile Chromium  | Playwright Pixel 7         | Pass   |
| Mobile WebKit    | Playwright iPhone 14       | Pass   |

The full journey covers phase marking, consent, the reduced report payload,
report rendering, keyboard activation, evidence navigation, local feedback,
mobile overflow, and 44-pixel control heights. The deterministic E2E fixture is
available only when `E2E_FIXTURES=1`; the production build returns 404 for its
route.

A physical-phone upload and report check remains a manual release gate because
browser emulation cannot reproduce device video decoding, memory pressure, or
touch/browser chrome exactly. Record the phone, OS, browser, video format, and
outcome here before tagging `v0.1.0`.

## API and privacy boundary

The report endpoint now rejects non-JSON requests with 415 and bodies above 32
KiB with 413 before schema validation, quota reservation, or provider work.
Strict schemas continue to reject unknown fields, invalid ordering, and
out-of-range values.

Automated browser assertions verify that the report request contains only the
versioned reduced analysis record. It contains no filename, object URL, media
type, image, video bytes, or landmark arrays. The real MediaPipe fixture made no
cross-origin browser requests: video decoding, WASM, model loading, and pose
processing remained local.

The production build adds `nosniff`, clickjacking, referrer, and permissions
headers. A client-bundle scan checked 38 static assets and found no server
secret names or configured secret values. Enforced CSP remains a Day 7 release
check because MediaPipe requires a policy tested specifically for WebAssembly
and workers.

## Real processing observation

Environment: Apple Silicon macOS development machine, headless Playwright
Chromium, MediaPipe Tasks Vision 1.1.1 Lite, and the ignored 12-second 1920×1080
Pexels fixture documented in `test-fixtures/README.md`.

| Measurement                     | Observed result |
| ------------------------------- | --------------: |
| Model load                      |        392.8 ms |
| Complete processing             |     39,814.3 ms |
| Median frame inference          |         74.3 ms |
| 95th-percentile frame inference |        195.9 ms |
| Complete Playwright journey     |          43.0 s |

The production pipeline still samples at 12 frames per second, caps analysis at
240 frames, resizes to a maximum 960-pixel edge, and keeps one frame in flight.
Timing depends materially on browser, codec, hardware, video length, and
thermal state.

The built `.next/static/chunks` directory contained 23 JavaScript files totalling
1,594,039 bytes (1,557 KiB) uncompressed. This is a build artifact measurement,
not the compressed transfer size or code required on every route.

## Live OpenRouter evaluation

Three calls were made through `openrouter/free` using the balanced,
low-confidence-impact, and arm-change fixtures. The free router did not produce
a safely usable report in this run:

| Fixture               | Validator outcome                            | User-visible outcome          |
| --------------------- | -------------------------------------------- | ----------------------------- |
| Balanced right-handed | Rejected: response body was not valid JSON   | Deterministic evidence report |
| Low-confidence impact | Rejected: message content was not valid JSON | Deterministic evidence report |
| Arm-change dominant   | Rejected: response body was not valid JSON   | Deterministic evidence report |

No provider prose passed into the interface. This demonstrates the importance
of the deterministic fallback but does not establish live-model prose quality.
The adapter intentionally does not expose provider-specific model identity as
part of the product contract. The validation boundary was not weakened to make
free-router output pass.

## Quality gates and known limitations

- 100 unit, component, worker, schema, and API tests pass; three live-provider
  cases are opt-in.
- V8 coverage observed 58.64% statements, 56.21% branches, 60.28% functions,
  and 59.91% lines. Coverage is recorded, not presented as a quality guarantee.
- Routine Playwright: 17 passed and 8 intentionally skipped across five
  projects. The opt-in real-video Chromium journey also passed.
- Formatting, ESLint, strict TypeScript, production build, client-secret scan,
  and production dependency audit pass.
- Worker termination, stale-run rejection, abort handling, transferred-frame
  closure, object URL revocation, and replacement/unmount cleanup are covered
  by implementation and focused tests.
- The product remains face-on, single-camera, body-pose analysis. It cannot
  measure clubhead speed, club path, ball flight, true 3D rotation, impact
  quality, or validated swing quality.
- MOV/WebM acceptance still depends on the codecs available in the individual
  browser and operating system.
- The free OpenRouter route is operationally variable; the local report is a
  permanent product path, not merely an error screen.
