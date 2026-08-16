# ALB-070 — Quantitative Host Evidence Harness (Slice 3)

Status: **IMPLEMENTED — RUNTIME QUALIFICATION PENDING**

Tracking: **GitHub issue #14**

## Outcome

AlbumAI Pro now exposes a developer-only quantitative series hook that runs
the existing disposable WebAssembly feasibility probe up to 20 times and
returns one bounded aggregate report. This removes manual transcription across
20 console calls while preserving the probe's privacy and ownership boundary.

The implementation is evidence infrastructure only. It does not approve local
AI production viability, select a runtime or model, expose an AI user
interface, or publish evidence into a Photo or project.

## Contract

Run from the Photoshop developer console:

```text
await globalThis.__ALBUMAI_ALB070_RUN_WASM_SERIES__({ runs: 20, warmRuns: 10 })
```

The returned report contains:

- normalized requested, completed, successful, limited, and failed counts;
- the first run's exact bounded measurements;
- sample count, minimum, maximum, and average for validation, preprocessing,
  cold instantiation, first inference, and warm inference;
- the maximum reported WASM memory size;
- cancellation, reference-release, publication, and document-open invariants.

Work is capped at 20 probes and 25 warm inferences per probe. The series stops
at the first cancellation, limitation, or failure. Every output remains
`publishable: false`, contains no fixture bytes or host references, and reports
zero Photoshop documents opened by the diagnostic.

## Manual host evidence still required

Run the production build on each supported Photoshop/UXP host. Save the
bounded series report and independently record Photoshop host-process memory
before the series, at peak, after idle, and after plugin unload. The diagnostic
cannot measure host-process memory and `retainedWasmReferences: false` is not
evidence that the host reclaimed memory.

Windows exact timing fields and host-process memory observations remain open.
Production concurrency, runtime/model package, latency, memory, and licensing
budgets also remain blocked in the viability ADR.

## Verification

The dedicated tests cover deterministic aggregation, the 20-run ceiling,
immediate cancellation, fail-fast unsupported-host behavior, public-safe
serialization, and the production-reachable developer hook. Full repository
tests, architecture checks, production build, and package verification are
required before review.

The measured production bundle is 580,521 bytes. The fail-on-warning ceiling
is narrowly raised by 2 KiB, from 566 KiB to 568 KiB, leaving 1,111 bytes of
headroom. The reproducible release ZIP is 162,362 bytes, a 602-byte increase
over Slice 2. This does not admit a production runtime or model asset.
