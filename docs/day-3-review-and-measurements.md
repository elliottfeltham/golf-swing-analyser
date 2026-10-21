# Day 3 review and measurement workspace

Date: 21 October 2026

Day 3 turns the timestamped pose sequence into an inspectable golfer-facing
record. The video remains the visual authority: measurements, phase markers,
and charts link back to analysed frames rather than replacing the footage.

## Review workflow

- Synchronized video and Canvas overlay for the nearest analysed frame.
- Accessible play, pause, previous-frame, next-frame, and range controls.
- Independent skeleton, hand-path, and shoulder/hip-line overlay toggles.
- Manual address, top, impact, and optional finish markers.
- Right- or left-handed mapping for lead and trail limbs.
- Phase rail for returning to each marked timestamp.

## Measurements

The browser calculates lead/trail elbow and knee angles, shoulder and hip tilt,
torso side-bend, pelvis shift, hand path, backswing time, downswing time, and
tempo ratio. Coordinates are corrected for the source aspect ratio. Pelvis
shift is normalized by address stance width when reliable, otherwise by
shoulder width with the fallback labelled in the interface.

Landmarks below 0.6 visibility or presence are excluded. Values retain a
metric-specific confidence label. Missing measurements are displayed as
unavailable rather than interpolated. Finish remains optional, while address,
top, and impact must be chronologically ordered before tempo is calculated.

## Limitations

All angles, tilts, and paths are single-camera image-space observations. They
are not measurements of full 3D body rotation, the golf club, clubhead speed,
ball flight, or swing quality. The application does not yet generate the final
natural-language report from these measurements.

## Verification

Pure unit tests cover known joint angles, aspect-ratio correction, line tilt,
torso side-bend, confidence filtering, phase ordering, tempo, handedness,
stance/shoulder normalization, and hand-path missingness. The opt-in real-video
test verifies successful processing, the review workspace, Canvas overlay,
phase marking, measurement display, and chart rendering against the local golf
fixture.
