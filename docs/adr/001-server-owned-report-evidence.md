# ADR 001: Keep report evidence server-owned

- Status: accepted
- Date: 22 October 2026

## Context

The first integration spike accepted ready-made observation candidates from the
browser. That proved OpenRouter connectivity, but it allowed a caller to submit
arbitrary claims and have the application present them as analysed evidence.
Free-model availability and output quality can also vary.

## Decision

The public report endpoint accepts only a strictly validated, reduced
measurement record. A shared deterministic module builds and ranks all
observation candidates on the server. OpenRouter may explain those candidates
but may not create measurements, evidence, categories, or limitations.

Every generated insight must reference exactly one selected candidate ID. The
client will render numeric evidence from the returned candidate object rather
than from generated prose. Invalid provider output is discarded in full and
replaced by a deterministic report built from the same candidates.

## Consequences

- A forged request can alter its submitted measurements, but it cannot inject
  arbitrary report prose or expand the application's supported claims.
- AI and fallback reports share one evidence-link contract.
- Model variability affects wording rather than the measurements shown.
- The candidate catalogue and validator require maintenance when a new metric
  or report category is added.
- The model cannot provide open-ended coaching in the MVP; this is intentional
  until coaching rules have appropriate domain validation.
