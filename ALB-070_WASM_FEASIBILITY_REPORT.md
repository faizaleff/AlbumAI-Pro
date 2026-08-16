# ALB-070 — UXP WebAssembly Feasibility Report

Status: **HOST EXECUTION PASS — QUANTITATIVE MEMORY EVIDENCE INCOMPLETE**

Baseline: **`main` at `6f9dce0`**

Tracking: **GitHub issue #14, Slices 2–3**

## Scope

This spike tests only whether AlbumAI Pro's production bundle can validate,
instantiate, execute, cancel, and release references to a tiny synthetic WASM
module. It is not a quality test and does not contain a culling model or
learned weights.

The fixture is generated in memory: 16×16 RGBA, 1,024 bytes. Preprocessing
reduces it to a three-value normalized RGB tensor. The embedded 68-byte module
has one fixed 64 KiB memory page and returns the tensor's RGB mean.

## Safety boundary

- user folders and photos are never read;
- no Photoshop document API is imported or called;
- no path, filename, token, entry, pixel buffer, or tensor is logged or
  returned;
- the result is always `publishable: false`;
- no Photo, rating, favourite, duplicate, selection, output, or recovery state
  is mutated;
- no network or telemetry permission is added;
- warm work is bounded to 25 runs and cancellation is checked between phases
  and warm iterations;
- quantitative collection is bounded to 20 probes and stops at the first
  cancellation, limitation, or failure;
- the WASM instance and memory references do not escape the diagnostic.

## Automated evidence

Run:

```text
npm run test:alb070:wasm
npm run build:prod
npm run package:verify
```

The automated suite verifies deterministic fixture generation, bounded tensor
preprocessing, real WASM validation/instantiation, cold and warm measurements,
cancellation, malformed runtime/fixture failure, safe serialization, one-page
memory size, reference release, 20-run timing aggregation, fail-fast series
behavior, and absence of UXP/Photoshop imports.

Production bundle measurement:

| Measurement | Bytes |
| --- | ---: |
| Pre-Slice 2 `main` `dist/index.js` | 571,588 |
| Merged Slice 2 `dist/index.js` | 578,058 |
| Synthetic diagnostic increment | 6,470 (1.132%) |
| Slice 3 bounded series `dist/index.js` | 580,523 |
| Bounded series increment over Slice 2 | 2,465 (0.426%) |
| Slice 3 ceiling | 581,632 (568 KiB) |
| Remaining headroom | 1,109 |
| Pre-Slice 2 `main` reproducible release ZIP | 160,095 |
| Merged Slice 2 reproducible release ZIP | 161,760 |
| Release ZIP increment | 1,665 (1.040%) |
| Slice 3 reproducible release ZIP | 162,363 |
| Bounded series ZIP increment over Slice 2 | 603 (0.373%) |

The Slice 3 package measurement is recorded after package verification below.
These narrow increases do not admit a production runtime or model asset.

Automated Node execution is harness evidence only. It is not proof of UXP
compatibility.

## macOS compatibility finding

Photoshop 27.4.0 UXP on Apple Silicon exposes `WebAssembly.validate`,
`WebAssembly.instantiate`, `WebAssembly.Module`, and `WebAssembly.Instance`.
Runtime characterization found that `WebAssembly.instantiate(bytes)` remains
pending even for the eight-byte empty module, while synchronous
`new WebAssembly.Module(bytes)` plus `new WebAssembly.Instance(module, {})`
completes. The actual 68-byte AlbumAI synthetic module executed through the
synchronous path with score `0.5` and one 65,536-byte memory page.

The probe therefore requires the synchronous constructors and never calls the
async byte-instantiation API. Async-only runtimes fail closed as unsupported.

## macOS runtime evidence

Host: Photoshop 27.4.0 UXP on Apple Silicon, loaded from the production `dist`
build through UXP Developer Tool. No user project or photo folder was opened.

| Check | Observed result |
| --- | --- |
| Capability / module validation | PASS |
| Synchronous module instantiation | PASS |
| Synthetic score | `0.5` |
| Preprocessing | 3 ms |
| Cold instantiation | 1 ms |
| First inference / 10 warm runs | 0 ms / 0 ms |
| WASM memory per run | 65,536 bytes (one fixed page) |
| Publication | `publishable: false` |
| Retained WASM references | `false` |
| Photoshop documents opened by probe | 0 |
| Explicit cancellation | `LIMITATION`, reason `CANCELLED`, before module validation / instantiation |
| Repeated execution | 20 / 20 PASS; maximum reported WASM memory 65,536 bytes |

The observed Photoshop process memory was 2.21 GB before the repeated run,
2.30 GB after 20 runs and idle, 2.28 GB after the debug console closed, and
2.30 GB after the plugin unloaded. This process-level measurement is not
sufficient to attribute the change to WASM: debugger logging, UXP, JIT, and
Photoshop caches are confounding factors. The probe releases its own
references, but host memory reclamation remains **INCONCLUSIVE** rather than a
confirmed leak or a confirmed reclamation result.

## Windows runtime evidence

Host: Photoshop 27.9.1 (Debug) on Windows, loaded from the production `dist`
build through UXP Developer Tools on 2026-08-15.

| Check | Observed result |
| --- | --- |
| Production build / plugin load | PASS; webpack 5.109.2, zero warnings |
| Capability / module validation | PASS |
| Synchronous module instantiation | PASS |
| Synthetic score | `0.5` |
| Warm runs | 10 |
| WASM memory per run | 65,536 bytes (one fixed page) |
| Publication | `publishable: false` |
| Retained WASM references | `false` |
| Photoshop documents opened by probe | 0 |
| Explicit cancellation | `LIMITATION`, reason `CANCELLED`; `cancellationObserved: true` |
| Repeated execution | 20 / 20 PASS; 0 Photoshop documents; 65,536-byte WASM memory |

The recorded Windows summary does not include the returned preprocessing,
cold-instantiation, first-inference, or warm-inference timing values. It also
does not include the required host-process memory before, peak, idle, and
post-unload observations. As on macOS, `retainedWasmReferences: false` proves
only that the diagnostic does not retain its own references; host memory
reclamation remains **INCONCLUSIVE**.

## Photoshop/UXP procedure

Use a disposable AlbumAI Pro development install. Do not open a user project
or user photo folder for this procedure.

1. Load the production `dist` build in UXP Developer Tool.
2. Open Photoshop's developer console and record Photoshop, UXP, OS, CPU, and
   available-memory details without including a username or filesystem path.
3. Record the number of open Photoshop documents.
4. Run:

   ```text
   await globalThis.__ALBUMAI_ALB070_RUN_WASM_FEASIBILITY__({ warmRuns: 10 })
   ```

5. Save only the returned bounded report.
6. Confirm the open-document count is unchanged and no document tab appeared.
7. Record Photoshop host-process memory immediately before the series, then
   run the bounded quantitative hook once:

   ```text
   await globalThis.__ALBUMAI_ALB070_RUN_WASM_SERIES__({ runs: 20, warmRuns: 10 })
   ```

   Save its `firstRunMeasurements`, aggregate `timing`, completed/success
   counts, and `maximumWasmMemoryBytes`. Record host-process memory at peak,
   after idle, and after plugin unload. The hook does not measure host-process
   memory; do not claim reclamation solely from
   `retainedWasmReferences: false`.
8. Repeat once with cancellation requested and confirm the report is a
   non-publishable `LIMITATION` with reason `CANCELLED`:

   ```text
   await globalThis.__ALBUMAI_ALB070_RUN_WASM_FEASIBILITY__({ isCancelled: () => true })
   ```
9. Repeat the same procedure on supported macOS and Windows Photoshop hosts.

## Runtime matrix

| Host | Status | Required evidence |
| --- | --- | --- |
| macOS Photoshop/UXP | PASS_WITH_MEMORY_LIMITATION | Production load, bounded report, cold/warm latency, unchanged document count, repeated-run memory observation, and cancellation completed. Host memory reclamation remains inconclusive. |
| Windows Photoshop/UXP | PASS_WITH_EVIDENCE_LIMITATION | Production load, bounded execution, unchanged document count, cancellation, and 20 repeated runs completed. Exact timing fields and host-process repeated-run memory observations remain to be recorded. |

## Decision rule

Slice 2 has real-host execution evidence on macOS and Windows, but remains
`PENDING` until the missing Windows timing and host-process memory observations
are recorded. Slice 3 must then record `PASS`, `LIMITATION`, or `FAIL` for host
support, concurrency, package, latency, and memory budgets. No production model
or AI UI may proceed from synthetic probe results alone.
