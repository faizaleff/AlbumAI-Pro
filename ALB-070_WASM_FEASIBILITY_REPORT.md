# ALB-070 — UXP WebAssembly Feasibility Report

Status: **AUTOMATED HARNESS IMPLEMENTED — PHOTOSHOP RUNTIME PENDING**

Baseline: **`main` at `20241ee`**

Tracking: **GitHub issue #14, Slice 2**

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
memory size, reference release, and absence of UXP/Photoshop imports.

Production bundle measurement:

| Measurement | Bytes |
| --- | ---: |
| Slice 1 `dist/index.js` | 567,866 |
| Slice 2 `dist/index.js` | 574,336 |
| Synthetic diagnostic increment | 6,470 (1.139%) |
| Slice 2 ceiling | 575,488 (562 KiB) |
| Remaining headroom | 1,152 |
| Slice 1 reproducible release ZIP | 161,213 |
| Slice 2 reproducible release ZIP | 162,847 |
| Release ZIP increment | 1,634 (1.014%) |

This narrow increase does not admit a production runtime or model asset.

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
7. Run the hook 20 times, allow the host to idle, and record memory before,
   peak, and after. Do not claim reclamation solely from
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
| macOS Photoshop/UXP | PENDING | Production load, bounded report, cold/warm latency, unchanged document count, repeated-run memory observation, cancellation |
| Windows Photoshop/UXP | PENDING | Production load, bounded report, cold/warm latency, unchanged document count, repeated-run memory observation, cancellation |

## Decision rule

Slice 2 remains `PENDING` until both host rows have evidence. Slice 3 records
`PASS`, `LIMITATION`, or `FAIL` and freezes supported hosts, concurrency,
package, latency, and memory budgets. No production model or AI UI may proceed
from Node harness results alone.
