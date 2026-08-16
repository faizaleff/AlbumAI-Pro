# ALB-070 — Local WASM Production Viability ADR (Draft)

Status: **PENDING — QUANTITATIVE HOST EVIDENCE AND SLICE 3 GATES INCOMPLETE**

Tracking: **GitHub issue #14, Slice 3 preparation**

Evidence dependency: **`ALB-070_WASM_FEASIBILITY_REPORT.md`**

## Decision status

No production-viability decision has been made. The eventual recorded outcome
must be exactly one of `PASS`, `LIMITATION`, or `FAIL`. This draft remains
`PENDING` while the Windows timing and host-process memory observations and the
concurrency, production package, latency, memory, and licensing gates are not
closed.

Automated Node execution, browser WebAssembly support, or a simulated host
cannot substitute for real Photoshop/UXP evidence. A successful bounded probe
also cannot substitute for the required quantitative timing and host-process
memory observations.

## Question

Can AlbumAI Pro support local, in-plugin WebAssembly inference on every
supported Photoshop/UXP host while preserving its privacy boundary and meeting
explicit concurrency, package, latency, memory, licensing, cancellation, and
failure-fallback requirements?

This ADR decides architecture viability only. It does not select a production
model, claim model quality, authorize an AI user interface, or publish AI
evidence into a project.

## Fixed constraints

- inference remains local and the production manifest gains no AI network or
  telemetry domain;
- a companion process and remote inference remain outside the initial
  architecture;
- `PhotoWorkspaceService` remains the owner of per-photo publication, project
  scope, cache reconciliation, and persistence coordination;
- AI inference never opens a Photoshop document;
- pixels, crops, tensors, embeddings, names, paths, tokens, entries, host
  objects, and unsafe errors never enter logs or public reports;
- consent, active-request identity, current-workspace identity, and the full
  evidence compatibility tuple must all pass before future publication;
- cancellation and unsupported capability fail closed without fabricating a
  score or mutating a user decision;
- a production model must independently pass the inventory and licensing gate
  before technical integration or redistribution.

## Evidence baseline

| Evidence | Current result | Decision use |
| --- | --- | --- |
| Automated synthetic probe | PASS in the dedicated Node harness | Contract and failure-path evidence only; not host compatibility |
| macOS Photoshop/UXP | `PASS_WITH_MEMORY_LIMITATION` | Real-host evidence; synchronous constructors work, host memory reclamation remains inconclusive |
| Windows Photoshop/UXP | `PASS_WITH_EVIDENCE_LIMITATION` | Real-host execution, cancellation, unchanged document count, and 20 repeated runs recorded; exact timing and host-process memory observations remain missing |
| Synthetic package increment | 6,470-byte bundle increase and 1,665-byte release-ZIP increase on current `main` | Diagnostic cost only; not a production runtime/model budget result |
| Synthetic latency | 3 ms preprocessing, 1 ms cold instantiation, 0 ms first/warm inference on the recorded macOS run | Feasibility characterization only; not representative model performance |
| Synthetic WASM memory | One fixed 65,536-byte page per run | Fixture invariant only; not a production model or host-process memory claim |
| Model inventory and licensing | No candidates evaluated | Blocks any model integration or redistribution claim |

The detailed evidence and the exact macOS limitation are recorded in
`ALB-070_WASM_FEASIBILITY_REPORT.md` and are not reinterpreted here.

## Decision matrix

| Dimension | Required evidence or rule | Current state | Gate |
| --- | --- | --- | --- |
| Supported hosts | The production build executes the bounded probe on real supported macOS and Windows Photoshop/UXP hosts | Bounded execution recorded on both hosts; quantitative Windows evidence incomplete | BLOCKED |
| WASM API compatibility | The chosen runtime path must work with UXP's synchronous `WebAssembly.Module` and `WebAssembly.Instance` constructors; async byte instantiation is not assumed | Synchronous path executed on both hosts | PASS |
| Safety and privacy | Local-only execution, no new network domain, no Photoshop documents opened, bounded safe reports, and no sensitive values retained or logged | Contract and both host probes pass | PASS |
| Cancellation and fallback | Cancellation is checked between bounded phases; unsupported, cancelled, stale, or invalid work produces non-publishable unavailable evidence | Contract and both host probes pass; production-provider design pending | BLOCKED |
| Concurrency | One explicit upper bound, queue/duplicate-request behavior, cancellation ownership, and stale-publication rejection are documented and testable | No production inference concurrency policy approved | BLOCKED |
| Package budget | Runtime, model, notices, and glue costs are measured separately and together against an approved production-package ceiling | Synthetic diagnostic only; production ceiling and candidate costs pending | BLOCKED |
| Latency budget | Representative preprocessing, cold start, first inference, warm inference, and bounded-batch measurements pass an approved budget on every supported host | Synthetic macOS result recorded; Windows timing values and representative thresholds pending | BLOCKED |
| Memory budget | WASM allocation, retained references, repeated-run host observation, and recovery after cancellation/failure pass an approved budget on every supported host | Synthetic page known on both hosts; macOS reclamation inconclusive; Windows host-process observations missing | BLOCKED |
| Licensing and redistribution | A complete candidate inventory passes every hard rejection rule with exact artifact and license evidence | No candidates evaluated | BLOCKED |
| Model quality | Quality metrics and product thresholds are defined and evaluated under ALB-071 or a later approved task | Outside this ADR | NOT_SCORED |

Quantitative production package, latency, and memory thresholds must be
approved before a representative candidate is scored. Synthetic-fixture values
must not be promoted into those thresholds merely because they are small.

## Concurrency decision inputs

Slice 3 must record all of the following before choosing a concurrency limit:

1. the owner of the inference queue and cancellation token;
2. the maximum simultaneous model instances and inferences;
3. behavior for duplicate requests for the same photo and compatibility tuple;
4. behavior when the project, folder, photo revision, provider, or model digest
   changes during queued or active work;
5. memory and latency evidence at the proposed limit on each supported host;
6. cleanup behavior after success, cancellation, unsupported capability, and
   failure.

Until that decision is recorded, production inference concurrency is not
approved.

## Outcome rules

### `PASS`

Record `PASS` only when every mandatory dimension is closed on real supported
hosts, no hard licensing or privacy rejection applies, and all approved
budgets pass without an unresolved qualification.

### `LIMITATION`

Record `LIMITATION` only when the local WASM architecture is safe and usable
within an explicit, testable boundary, but one or more accepted constraints
remain. The record must name each constraint, its user-visible fallback, the
supported-host scope, and the work required to remove it. A missing required
host test is `PENDING`, not a limitation.

### `FAIL`

Record `FAIL` when a mandatory supported host cannot execute the required
runtime path, a hard privacy or licensing rule cannot be satisfied, or the
architecture cannot meet an approved package, latency, memory, cancellation,
or bounded-concurrency requirement.

## Completion checklist

- [x] Real Windows Photoshop/UXP production-load and bounded probe execution is
      recorded.
- [x] The Windows run confirms the document count is unchanged and exercises
      cancellation plus 20 repeated probe executions.
- [ ] Exact Windows preprocessing, cold-instantiation, first-inference, and
      warm-inference timing values are recorded.
- [ ] Windows host-process memory before, peak, idle, and post-unload
      observations are recorded without claiming reclamation from reference
      release alone.
- [ ] macOS and Windows evidence remain distinct from automated harness results.
- [ ] A bounded production concurrency policy is approved.
- [ ] Production package, latency, and memory thresholds are approved.
- [ ] At least one representative runtime/model package is measured against
      the technical budgets without being selected for product use.
- [ ] Each evaluated candidate has a complete model and licensing inventory.
- [ ] The final outcome cites every accepted limitation or rejection reason.
- [ ] A separate approval authorizes any production model selection or ALB-071
      integration work.

## Consequences of the eventual outcome

- `PASS`: ALB-071 may propose a separately reviewed local-provider slice using
  an eligible, digest-pinned candidate; no candidate is selected by this ADR.
- `LIMITATION`: subsequent work must preserve the recorded host and operational
  boundary and expose a safe unavailable fallback.
- `FAIL`: production local-WASM integration stops. Remote inference or a
  companion process may be reconsidered only through a new ADR covering
  consent, authentication, installation, updates, cost, retention, security,
  and failure behavior.

## Delivery guardrail

The Slice 2 diagnostic is merged after bounded execution passed on both hosts.
That merge records feasibility only; it does not approve production viability
or waive the missing Windows timing and host-process memory observations. This
Slice 3 preparation does not change production runtime behavior.
