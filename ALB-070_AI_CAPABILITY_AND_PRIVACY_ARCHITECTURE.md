# ALB-070 — AI Capability and Privacy Architecture

Status: **SLICE 1 — CONTRACT IMPLEMENTATION**

Baseline: **`main` at `64e724c`**

Tracking: **GitHub issue #14**

## Decision

AlbumAI Pro targets local, in-plugin WebAssembly inference. ALB-070 and
ALB-071 do not send photos, crops, faces, embeddings, names, paths, tokens, or
host objects off-device. The production manifest gains no AI network or
telemetry domain.

An external companion process is not part of the initial architecture. Remote
inference and a companion may be reconsidered only through a later ADR that
defines consent, authentication, installation, updates, cost, retention, and
failure behavior.

No production model is selected by ALB-070. A model must pass separate runtime
and commercial-redistribution gates before it can enter the product.

## Canonical boundary

`PhotoWorkspaceService` remains the owner of per-photo analysis publication,
project scope, cache reconciliation, and persistence coordination. New AI code
is a narrow provider/policy dependency of that owner; it is not a second photo
engine, manager, facade, bootstrap, or state store. `AppController` may
orchestrate a future user action but does not own AI evidence.

Inference must not open Photoshop documents. Existing Photoshop access stays
behind the ALB-050 adapters.

## Slice 1 contract

`PhotoAiPolicy` defines:

- local-only consent with remote inference fixed off;
- capability status that fails closed;
- versioned per-photo score and evidence normalization;
- allowlisted reason codes instead of unsafe host errors;
- cache compatibility across photo and library revision, provider, model
  digest, preprocessing, signal versions, and aggregate policy;
- publication guards for consent, active request identity, current workspace,
  and the complete compatibility tuple;
- public-safe serialization that strips pixels, names, paths, tokens, entries,
  host objects, and user decisions.

Unknown schemas, malformed evidence, unsupported runtime, and invalid scores
produce unavailable evidence. They never fabricate a zero score or mutate a
user decision.

The reachable contract moves the reviewed production bundle ceiling from 550
KiB to 560 KiB. The measured Slice 1 bundle is 555 KiB. This allowance covers
policy code only; Slice 2 must establish a separate model/runtime package,
memory, and latency budget before any inference asset is admitted.

## Runtime feasibility gate

Slice 2 uses a tiny synthetic, non-production model to measure UXP production
build loading, preprocessing, cold/warm latency, memory release, cancellation,
and package cost on supported macOS and Windows hosts. Browser support is not
accepted as proof of Photoshop/UXP compatibility.

The spike is not a model-quality claim and does not ship a culling model.

## Licensing gate

Every model candidate requires an inventory containing its exact source,
weights license, runtime/code license, training-data disclosure, commercial-use
permission, redistribution duties, notices, and binary digest. Missing,
ambiguous, non-commercial, research-only, field-of-use, or incompatible terms
reject the candidate.

## Evidence sources

- Adobe UXP code samples document WebAssembly support and WebSocket-based
  communication with external helpers.
- Adobe UXP manifest v5 requires explicit network domains.
- Adobe UXP file access is sandboxed and user-granted.
- ONNX Runtime Web documents browser WebAssembly support but does not list
  Photoshop UXP as a certified host.

## Slice 1 verification

- `node tests/run-alb070-ai-policy-tests.js`
- `npm test`
- `npm run build:prod`
- `npm run package:verify`
- `git diff --check`

Photoshop runtime testing is not required for Slice 1. Runtime evidence begins
with the Slice 2 synthetic feasibility spike and uses disposable fixtures.
