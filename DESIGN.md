---
name: Golf Swing Analyser
description: A frame-first sports analysis instrument built around observable swing evidence.
colors:
  archive-bone: "#F2EFE6"
  paper: "#FAF8F2"
  carbon: "#171816"
  video-black: "#0B0C0B"
  signal-vermilion: "#F2552C"
  evidence-cobalt: "#3157D5"
  graphite: "#686A64"
  frame-grey: "#A7A397"
  rule: "#CBC6B9"
  success: "#2F7254"
  warning: "#A7651F"
  danger: "#A33B35"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.75rem, 7vw, 6.5rem)"
    fontWeight: 700
    lineHeight: 0.88
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2rem, 4vw, 4rem)"
    fontWeight: 650
    lineHeight: 0.95
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.01em"
  body:
    fontFamily: "IBM Plex Sans, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.075em"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.015em"
rounded:
  none: "0"
  hairline: "2px"
  control: "4px"
  overlay: "8px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
  4xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.signal-vermilion}"
    textColor: "{colors.carbon}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.carbon}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
    height: "44px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.carbon}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "48px"
  phase-active:
    backgroundColor: "{colors.signal-vermilion}"
    textColor: "{colors.carbon}"
    typography: "{typography.label}"
    rounded: "{rounded.hairline}"
    padding: "8px 10px"
  evidence-link:
    backgroundColor: "transparent"
    textColor: "{colors.evidence-cobalt}"
    typography: "{typography.data}"
    rounded: "{rounded.hairline}"
    padding: "4px 0"
---

# Design System: Golf Swing Analyser

## Overview

**Creative North Star: “The Motion Contact Sheet”**

Golf Swing Analyser is a contemporary sports-analysis instrument built around
one simple truth: a useful observation must point back to a visible moment in
the golfer's swing. The interface borrows the sequencing discipline of
photographic contact sheets, the direct annotation of a coach's grease pencil,
and the precision of sports-science notation. It does not imitate old film or
decorate the product with nostalgia. Those references provide structure:
ordered frames, decisive selections, exact timestamps, and evidence that can be
traced.

The selected swing frame is always the visual authority. Data, charts, and
natural-language explanation support it in a strict hierarchy. The system is
editorial rather than card-based: surfaces are composed with fields, rules,
registers, and sequence strips. A small amount of signal color identifies the
single active moment. The experience should feel as confident as a major sports
brand, as restrained as premium golf equipment, and as useful as professional
performance software without copying any of them.

The selected compositional reference is
`.impeccable/mocks/decision/motion-contact-sheet.png`. It establishes hierarchy
and character, not literal content or unsupported capabilities. This document
is the design contract for the product. The initial upload and processing-
readiness surface now implements it; future analysis screens should extend the
same frame-first language without inventing capabilities the product cannot yet
support.

**Key Characteristics:**

- Frame-first composition with the swing video as the dominant evidence field.
- Warm technical paper against carbon-black media rather than a uniformly dark
  dashboard.
- Condensed sports typography for phases and sequence numbers; calm, highly
  legible prose and tabular data.
- Almost-square geometry, fine rules, and deliberate alignment instead of
  floating rounded cards.
- One vermilion active state at a time, with cobalt reserved for evidence links
  and analytical reference.
- Honest uncertainty: missing or low-confidence data remains visible and never
  masquerades as a complete measurement.

## Colors

The palette pairs warm photographic paper with a carbon-black media field. It
is mostly neutral so video remains truthful; two disciplined signal colors
carry interaction and evidence.

### Primary

- **Archive Bone** (`#F2EFE6`): the main application canvas and quiet workspace
  ground. It gives the tool a tactile, editorial character without simulating
  aged paper.
- **Carbon** (`#171816`): primary text, structural navigation, and high-contrast
  controls.
- **Signal Vermilion** (`#F2552C`): the current playhead, selected phase,
  primary action, and active annotation only.

### Secondary

- **Evidence Cobalt** (`#3157D5`): links from prose or charts back to frames,
  focus relationships, and secondary analytical traces. It never competes with
  the active vermilion moment.

### Neutral

- **Paper** (`#FAF8F2`): raised reading surfaces and form fields.
- **Video Black** (`#0B0C0B`): video letterboxing, media controls, and dark
  viewing environments.
- **Graphite** (`#686A64`): secondary prose and labels.
- **Frame Grey** (`#A7A397`): inactive frames, disabled states, and secondary
  plot lines.
- **Rule** (`#CBC6B9`): separators, chart grids, and input borders.

### Semantic

- **Success** (`#2F7254`): successful completion and strong tracking quality.
- **Warning** (`#A7651F`): low confidence, partial tracking, or a recoverable
  processing problem.
- **Danger** (`#A33B35`): invalid input or failed processing. It does not replace
  explanatory error copy.

### Named Rules

**The One Active Moment Rule.** Vermilion identifies only the current action,
frame, or phase. If several areas glow vermilion simultaneously, none of them
is meaningfully active.

**The Evidence Link Rule.** Cobalt means “show me the supporting evidence.” It
must not be used as decorative blue or as a generic secondary accent.

**The Honest Video Rule.** Do not tint uploaded footage or place decorative
color washes over it. Overlays use high-contrast lines, small labels, and local
scrims only where legibility requires them.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow and sans-serif fallbacks)  
**Body Font:** IBM Plex Sans (with Arial and sans-serif fallbacks)  
**Data Font:** IBM Plex Mono (with ui-monospace and monospace fallbacks)

**Character:** The condensed family provides the vertical energy of scoreboard
type and the economy required by frame labels. IBM Plex Sans keeps instructions
and analysis calm and credible. IBM Plex Mono makes timestamps, angles, frame
numbers, and confidence values align without turning all text into an
engineering console.

### Hierarchy

- **Display** (700, `clamp(2.75rem, 7vw, 6.5rem)`, 0.88): rare, short statements
  on upload or completion screens and oversized frame numbers. Never use it for
  paragraph-length marketing copy.
- **Headline** (650, `clamp(2rem, 4vw, 4rem)`, 0.95): screen titles and the main
  result statement.
- **Title** (650, `1.5rem`, 1): panel titles, insight headings, and modal titles.
- **Body** (400, `1rem`, 1.5): instructions and explanations, normally limited
  to 68 characters per line.
- **Label** (650, `0.8125rem`, 0.075em tracking): phases, control labels, section
  identifiers, and short status text. Uppercase is permitted only for these
  functional labels.
- **Data** (500, `0.8125rem`, 1.3): timestamps, angles, relative measurements,
  confidence, frame counts, and chart axes.

### Named Rules

**The Two-Voice Rule.** Barlow Condensed names and sequences; IBM Plex explains.
IBM Plex Mono is only for machine-like values. Do not add a fourth type voice.

**Numbers Carry Context.** A value is never displayed without its unit, phase,
or plain-language label. Large numerals support inspection; they are not
decoration.

## Layout

The interface uses a 12-column desktop grid with a maximum working width of
`1600px` and `24px–32px` gutters. The analysis workspace gives 8–9 columns to
the selected video/frame and 3–4 columns to its evidence register. The sequence
rail spans beneath both or beneath the media field depending on available
height. The frame, evidence register, and rail align to shared vertical rules.

Spacing follows a 4px base with deliberate jumps: `4`, `8`, `12`, `16`, `24`,
`32`, `48`, and `64px`. Dense controls use the lower half of the scale; screen
structure uses `24px` and above. Dividers are structural and may run for long
distances. Avoid wrapping every group in its own container.

### Screen Topology

1. **Upload:** A left-aligned recording guide and a decisive upload field share
   the first viewport. Replace the generic three-card explanation with one
   numbered preparation strip: full body visible, face-on view, stable camera.
   Privacy and format guidance sit directly below the action.
2. **Processing:** Preserve the uploaded video's identity. A contact strip fills
   progressively as frames are sampled; a compact status register names the
   current operation, elapsed time, cancellation, and recoverable problems.
   Progress may be coarse but must never pretend to be exact.
3. **Phase review:** Promote one frame at a time and guide the user through
   Address, Top, Impact, and Finish. Manual phase correction uses the same
   sequence rail as analysis, so learning transfers.
4. **Analysis:** The selected frame/video dominates. The evidence register holds
   the current phase, tracking quality, measurements, charts, and linked
   observations. Tabs may change the register; they must never replace or hide
   the primary media context unexpectedly.
5. **Written report:** Use a readable editorial column, not a chat bubble. Each
   observation begins with its linked phase/frame reference and ends with a
   specific review action that returns the user to the evidence.

### Responsive Behaviour

- **Large desktop (`≥1280px`):** media and evidence remain side-by-side; the
  sequence rail stays visible without horizontal page scrolling.
- **Tablet and small desktop (`768–1279px`):** use an 8-column grid. Evidence may
  move below the media, but the active phase summary remains adjacent to
  playback. Charts simplify labels before shrinking text.
- **Mobile (`<768px`):** one column. Video appears first, followed by persistent
  compact playback controls, a horizontally scrollable phase strip, and the
  evidence register. Do not squeeze the desktop sidebar beside the video.
  Lower-priority metadata collapses into disclosure rows.
- Touch targets are at least `44×44px`. Fine frame stepping remains possible
  with previous/next frame buttons and does not depend on dragging a tiny
  playhead.
- At `200%` browser zoom, content reflows without losing controls or forcing
  two-dimensional page scrolling.

**The Frame-First Rule.** At every breakpoint, the selected frame and its
playback controls precede charts, measurements, and generated prose.

**The Priority-Drop Rule.** When width is scarce, remove or disclose secondary
columns in this order: file metadata, supplementary measurements, chart legend,
then nonessential navigation. Never shrink the evidence itself below readable
size.

## Elevation & Depth

The system is flat by default. Depth comes from tonal contrast, media against
paper, long rules, and content order—not layers of shadows. Persistent panels
do not float. A shadow is allowed only for temporary UI that genuinely sits
above the workspace, such as a menu, dialog, or scrub-preview thumbnail.

### Shadow Vocabulary

- **Temporary Overlay** (`0 12px 32px rgb(23 24 22 / 0.18)`): menus, dialogs,
  and thumbnail previews only.
- **Focus Halo** (`0 0 0 3px rgb(49 87 213 / 0.28)`): keyboard focus support
  around controls where an outline alone would be lost.

**The Flat-By-Default Rule.** If a border, alignment, or tonal field can express
the relationship, do not add a shadow.

## Shapes

The form language is rectilinear and photographic. Full surfaces have square
corners. Selected frames may use `2px` registration corners; controls and fields
use `4px`; only temporary overlays may reach `8px`. Pills are reserved for
binary status tags whose text is genuinely short. They are not a default button
shape.

Hairline rules and L-shaped crop/registration marks are signature geometry.
They should indicate selection, alignment, or evidence—not decorate empty
space. Circular shapes are reserved for pose landmarks, playheads, radio
controls, and status indicators whose semantics are naturally point-like.

## Components

### Application Header

- A compact horizontal rule containing the wordmark, current session title or
  file name, tracking status, and one “New analysis” action.
- It remains visually quieter than the media. Avoid oversized navigation,
  notification furniture, profile avatars, and empty product sections in the
  account-free MVP.
- On mobile, keep the wordmark and active task; move secondary actions to a
  labelled menu.

### Buttons

- **Primary:** vermilion fill, carbon text, `4px` radius, label typography, and
  at least `44px` height. Use once per decision area.
- **Secondary:** transparent or paper fill, carbon text, 1px carbon border.
- **Evidence action:** cobalt text with a timestamp or frame reference; it
  seeks the media and moves focus to the relevant evidence state.
- **Hover:** invert the primary action to carbon/paper or underline evidence
  links. Never communicate state through color alone.
- **Focus:** 2px cobalt outline with 2px offset. Focus remains visible over both
  bone and black surfaces.
- **Disabled:** retain the label at AA-readable contrast and explain why the
  action is unavailable when the reason is not obvious.

### Upload Field

- A broad ruled field, not a rounded dashed card. Pair a bold “Choose video”
  action with accepted formats, size limit, privacy statement, and recording
  guidance.
- Drag state uses a single vermilion registration frame and explicit “Release
  to analyse” text.
- Invalid files remain named in the field while the error explains format,
  size, or decoding failure and offers the next action.

### Processing Register

- Shows the real stages: reading video, loading model, sampling frames,
  detecting pose, deriving movement data.
- A sequence of small frame cells fills as usable samples become available.
- Indeterminate work uses restrained moving registration marks, not a fake
  percentage. Cancellation and retry are always labelled.

### Media Stage

- The video or selected still is the largest object on the analysis screen.
- Overlay layers have explicit toggles: skeleton, hand path, body lines, and
  confidence. Do not include club tracking until the product can support it.
- Controls remain readable against variable footage using a local black scrim,
  never a full-video tint.
- Portrait and landscape recordings use letterboxing deliberately; the overlay
  transforms with the rendered video bounds, not the container bounds.

### Sequence Rail

- The signature navigation component. It combines timestamped thumbnails,
  phase markers, a playhead, and fine frame stepping in one horizontal system.
- Every frame cell has a stable identity. Selection adds vermilion registration
  corners and a readable label; hover/focus reveals timestamp and tracking
  quality.
- Phase identity is redundant: number, label, position, and selected shape all
  reinforce it so color is not required.
- On mobile, the rail scrolls horizontally with the selected frame brought into
  view; it does not shrink into illegibility.

### Evidence Register

- A ruled reading column tied to the selected timestamp. It contains the phase
  title, tracking status, relevant measurements, observation candidates, and
  report output.
- Each insight exposes an evidence link, limitation where applicable, and a
  review action. Generated prose never occupies the screen without the
  supporting phase reference.
- Confidence uses plain language—strong, usable, limited, unavailable—with the
  underlying numeric value available on demand when it aids debugging.

### Charts and Measurements

- Default to a single trace or a small number of directly labelled traces.
  Vermilion marks the active timestamp; cobalt identifies the evidence-linked
  series; grey supports comparison.
- Use direct labels before legends. Grid lines use Rule at low visual weight.
- Angle and relative-position values always state their unit and camera-space
  limitation. Do not display normative “good ranges” without a validated source.
- When data is missing, break the line and label the gap. Do not interpolate a
  confident-looking curve through absent landmarks.

### Feedback, Empty, and Error States

- Empty states explain the next physical action: how to record, upload, or mark
  a phase. They do not use generic illustrations.
- Success states show the newly available evidence rather than confetti.
- Warnings preserve the user's work and identify what remains usable.
- Errors name what failed, what was kept, and the next safe action. Technical
  details may sit in a disclosure for debugging.

### Motion

- State changes use `160ms` with an ease-out curve; panel disclosure may use
  `240ms`. Page content is visible by default and does not wait for entrance
  animation.
- Scrubbing updates the selected frame immediately. Registration corners may
  travel to the new frame, but the motion never delays evidence.
- Processing frames reveal in sequence because that motion communicates actual
  progress.
- Under `prefers-reduced-motion: reduce`, remove travel, parallax, and animated
  interpolation while keeping every state change understandable.

## Do's and Don'ts

### Do

- **Do** make the golfer's video or selected frame the largest and highest
  contrast object in the workspace.
- **Do** connect every measurement and written observation to a phase,
  timestamp, or frame.
- **Do** use vermilion sparingly for the single active state and cobalt only for
  evidence relationships.
- **Do** use long rules, sequence numbers, and alignment to organize dense
  information without creating a grid of cards.
- **Do** preserve uncertainty, missing landmarks, and tracking limitations in
  the interface.
- **Do** design desktop and mobile as related compositions with different
  information priority, not as the same grid at different widths.
- **Do** use real product states and truthful body-pose metrics in screenshots,
  demos, and tests.

### Don't

- **Don't** return to the generic dark SaaS formula of glowing green accents,
  large rounded cards, gradient backgrounds, glass panels, and pill-shaped
  controls.
- **Don't** put a giant marketing headline above the actual task when a user is
  ready to upload or analyse a swing.
- **Don't** distribute every datum into an equally weighted card. Promote one
  frame and one question at a time.
- **Don't** imitate analog film with grain, scratches, sepia, sprocket-hole
  decoration, or fake handwritten type. The contact-sheet influence is
  structural.
- **Don't** invent clubhead speed, ball flight, club tracking, ideal ranges,
  coaching diagnoses, or accuracy claims.
- **Don't** let generated prose outrank or obscure the evidence from which it
  was derived.
- **Don't** use color, hover, animation, or drag gestures as the only way to
  understand or operate a control.
- **Don't** add navigation for accounts, teams, libraries, comparisons, or
  other post-MVP features before those destinations exist.
