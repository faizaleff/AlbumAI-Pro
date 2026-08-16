# ALB-070 — AI Capability and Privacy Architecture

Status: **SLICE 2 — UXP WASM FEASIBILITY SPIKE**

Baseline: **`main` at `609079d`**

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

The reachable contract moved the reviewed production bundle ceiling from 550
KiB to 560 KiB. The current main bundle is 571,588 bytes. Slice 2's synthetic
diagnostic produces a 578,058-byte bundle, an increment of 6,470 bytes
(1.132%). A separate 566 KiB ceiling admits only this diagnostic with 1,526
bytes of headroom. Production model/runtime assets remain blocked pending the
Slice 3 package, memory, latency, and licensing decision.

## Runtime feasibility gate

Slice 2 uses a tiny synthetic, non-production model to measure UXP production
build loading, preprocessing, cold/warm latency, memory release, cancellation,
and package cost on supported macOS and Windows hosts. Browser support is not
accepted as proof of Photoshop/UXP compatibility.

The production-reachable diagnostic is exposed only in the developer console
as `globalThis.__ALBUMAI_ALB070_RUN_WASM_FEASIBILITY__()`. It uses generated
16×16 RGBA pixels and an embedded 68-byte module that returns the RGB mean.
The report is bounded, contains no pixels or source identity, is always marked
non-publishable, and retains no WASM instance or memory reference after the
run. JavaScript cannot prove host garbage collection, so host memory
reclamation is a mandatory macOS/Windows runtime observation rather than an
automated claim.

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
- `node tests/run-alb070-wasm-feasibility-tests.js`
- `npm test`
- `npm run build:prod`
- `npm run package:verify`
- `git diff --check`

Photoshop runtime evidence for Slice 2 is recorded separately in
`ALB-070_WASM_FEASIBILITY_REPORT.md`. Automated harness evidence and real UXP
host evidence must never be presented as equivalent.
