# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is an amateur golfer reviewing a recorded practice swing. The
full workflow must work on mobile at the range, while the analysis workspace is
optimized for the greater space and precision available on a laptop or desktop.

## Product Purpose

Golf Swing Analyser turns a face-on swing video into an inspectable movement
record. A golfer can review pose tracking, mark key swing phases, inspect
body-pose measurements over time, and read a concise natural-language report
that links every observation back to visible evidence.

Success means the golfer can move from a local video to a clear, honest review
without specialist hardware, understand what the body-pose data describes, and
verify the report against the annotated video and charts.

## Positioning

The product combines private, in-browser video processing with evidence-linked
explanation. It does not present opaque scores or pretend that single-camera
body-pose estimation can measure the golf club, ball flight, or validated swing
quality.

## Operating Context

- The golfer records or receives a short face-on swing video with the full body
  visible.
- They may begin on a phone at the range and continue reviewing on the same
  device, but detailed inspection is expected to be most comfortable on a
  laptop or desktop.
- The core workflow is upload, local processing, phase review, movement
  inspection, and evidence-linked written analysis.
- The user needs clear processing progress, tracking-quality feedback, precise
  timeline navigation, and graceful recovery when pose data is incomplete.

## Capabilities and Constraints

- Video decoding, frame sampling, and pose estimation run in the browser using
  MediaPipe Pose Landmarker.
- Uploaded video and raw pose landmarks remain on the user's device.
- A reduced set of anonymous measurements and confidence information may be
  sent to OpenRouter only when the user requests the written report.
- The MVP supports face-on recorded swings and responsive desktop and mobile
  browsers.
- The system may describe pose-derived joint angles, relative positions,
  movement trends, hand path, body tilt, and tracking quality.
- Clubhead speed, clubface position, ball flight, shot outcome, and validated
  swing-quality diagnosis are explicitly outside the MVP's measured
  capabilities.
- Automatic swing-phase detection may assist the user, but manual correction
  remains available and authoritative.
- Each customer may request up to five AI-assisted swing analyses per UTC day;
  a deterministic evidence summary remains available when the model or quota
  service is unavailable.
- TypeScript strict mode, accessibility, responsive behavior, automated tests,
  continuous integration, and deployment reproducibility are product-quality
  requirements.

## Brand Commitments

- Product name: Golf Swing Analyser.
- Voice: precise, calm, candid, and understandable to a golfer; never
  diagnostic, boastful, or falsely authoritative.
- The product should feel like a modern sports-performance instrument rather
  than an academic demo or a generic SaaS dashboard.
- No existing color palette, logo, or visual theme is fixed.

## Evidence on Hand

- The implementation plan is at `docs/implementation-plan.md`.
- The Day 1 technical validation is at `docs/day-1-validation.md`.
- A licensed development swing video and its provenance are documented at
  `test-fixtures/README.md`; the video itself is intentionally not committed.
- The current interface is a technical foundation, not approved visual
  authority.
- There are no customer testimonials, accuracy studies, coaching credentials,
  or validated performance claims. Future work must not fabricate them.

## Product Principles

1. Evidence before interpretation: every written observation must link back to
   something the golfer can inspect.
2. Honest measurement: distinguish image-space body-pose estimates from club,
   ball, and real-world performance metrics.
3. The swing is the interface: video and movement evidence take visual priority
   over decorative dashboard furniture.
4. Progressive clarity: make the first useful action obvious, then reveal
   technical detail as the golfer asks for it.
5. Local by default: keep personal video processing on-device and make any
   external data transfer explicit.

## Accessibility & Inclusion

The interface must be fully keyboard operable, preserve visible focus states,
meet WCAG 2.2 AA contrast targets, support reduced motion, avoid color-only
meaning, and remain usable under browser zoom and at narrow mobile widths.
