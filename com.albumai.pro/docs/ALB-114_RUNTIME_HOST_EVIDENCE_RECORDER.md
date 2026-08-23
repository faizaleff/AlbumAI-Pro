# ALB-114 Runtime Host Evidence Recorder

Status: implemented; no runtime candidate has been approved.

## Root cause

ALB-113 measures exact candidate files and ALB-112 evaluates macOS and Windows
runtime compatibility records, but the repository did not own the Photoshop
host-side measurement step between them. Host facts could only be transcribed
manually, with no enforced digest binding to the exact ALB-113 `RUNTIME`
artifact.

## Decision

`scripts/PhotoAiRuntimeHostEvidence.psjs` is a standalone engineering script.
It is not part of the plugin bundle or production source graph. On each target
host it:

- reads a small reviewed recorder manifest, ALB-113 verified evidence, and the
  exact local WASM runtime through UXP file pickers;
- recomputes SHA-256 and byte length before executing any WASM constructor;
- rejects a digest or size mismatch;
- measures synchronous `WebAssembly.Module` and `WebAssembly.Instance` support;
- verifies that the Photoshop document count did not change;
- records that this measured path used no async instantiation, fetch, worker,
  or cross-origin isolation; and
- creates a new public-safe JSON file without overwriting an existing file.

The generic recorder refuses modules with imports. Such candidates require a
separately reviewed, candidate-specific glue recorder; the generic tool never
fabricates import objects or treats an unreviewed loader as passing.

## Recorder manifest

Create a local JSON file such as:

```json
{
  "schemaVersion": 1,
  "runtimeId": "reviewed-runtime-id",
  "runtimeVersion": "1.0.0",
  "loaderKind": "LOCAL_BYTES_SYNC_WASM"
}
```

Run `PhotoAiRuntimeHostEvidence.psjs` from UXP Developer Tool **Debug Script**
or Photoshop **File > Scripts > Browse**. Repeat with the same exact ALB-113
evidence and runtime artifact on macOS and Windows.

Merge the two non-overwriting records from an engineering checkout:

```text
npm run ai:runtime:host-evidence -- compatibility.json macos.json windows.json
```

The merged output is the ALB-112 `runtimeCompatibility` input. Missing,
duplicate, malformed, or digest-mismatched records fail closed. A passing
record means only `ELIGIBLE_FOR_TECHNICAL_EVALUATION`; it does not select or
approve a model/runtime.

## Boundary

- No UI, manifest, network permission, production runtime, or model changes.
- No user photos or Photoshop document contents are read.
- No local paths, file contents, tokens, host objects, or raw errors are
  written to evidence.
- Both macOS and Windows evidence remain mandatory.

ALB-070 remains pending until a real candidate passes licensing, compatibility,
quality, and human-review gates.
