# ALB-112 Runtime Compatibility Gate

Status: implemented; no real runtime candidate has been evaluated or approved.

## Root cause

ALB-110 and ALB-111 verify budgets, host measurements, artifacts, licensing,
and human review, but they did not machine-check the loader contract of the
exact reviewed runtime artifact. A browser-oriented runtime could therefore
appear eligible even when its stock loader requires async WASM byte
instantiation, `fetch`, workers, or cross-origin isolation instead of the
synchronous constructor path available to the approved UXP architecture.

## Decision

`scripts/PhotoAiRuntimeCompatibility.js` is the engineering-only, fail-closed
runtime compatibility gate. It does not ship in the Photoshop runtime. Each
record binds evidence to the SHA-256 digest of one exact reviewed `RUNTIME`
artifact and requires separate macOS and Windows Photoshop/UXP results.

An eligible record requires:

- bounded runtime identity, version, digest, and the exact
  `LOCAL_BYTES_SYNC_WASM` loader kind;
- local runtime bytes accepted without a network or `fetch` dependency;
- successful synchronous `WebAssembly.Module` construction;
- successful synchronous `WebAssembly.Instance` construction;
- no required async byte instantiation, worker, or cross-origin isolation;
- unchanged Photoshop document count; and
- complete, non-duplicated evidence for both macOS and Windows.

Missing, malformed, duplicated, or ambiguous evidence is `BLOCKED`. An
unsupported loader kind, failed synchronous constructor path, or explicit
async, fetch, worker, or cross-origin requirement is `REJECTED`. Passing means
only `ELIGIBLE_FOR_TECHNICAL_EVALUATION`; it does not select a runtime or model
and does not authorize integration or redistribution.

## ALB-110 integration

The production evaluation gate evaluates the compatibility record itself and
compares its runtime digest to the digest-pinned `RUNTIME` artifact produced by
ALB-111. A missing compatibility record blocks evaluation, an incompatible
record rejects the candidate, and a digest mismatch blocks the inconsistent
evidence. A caller-provided compatibility status cannot bypass these checks.

## Runtime impact

- No UI changes.
- No runtime/model files or weights.
- No production source-graph changes.
- No manifest, network, or Photoshop document changes.
- No photo bytes, paths, UXP entries, host objects, or unsafe errors.

ALB-070 remains pending until a real digest-pinned runtime supplies this exact
host evidence along with all other licensing and quantitative gates.
