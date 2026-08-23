# ALB-110 AI Production Evaluation Gate

Status: implemented; external candidate evidence remains blocked.

## Decision

AlbumAI Pro may evaluate a future local-WASM photo-analysis candidate only
after bounded public-safe evidence passes one deterministic gate. Passing this
gate does not select a model, enable AI culling, or authorize product rollout.

The gate is pure engineering policy under `scripts/PhotoAiProductionGate.js`;
it is not shipped in the Photoshop runtime bundle. `PhotoWorkspaceService`
remains the sole future queue and publication owner. The gate accepts no photo
bytes, paths, UXP entries, Photoshop document references, or network results.

## Production concurrency policy

| Limit | Approved value |
| --- | ---: |
| Active photo projects | 1 |
| Loaded model instances | 1 |
| Concurrent inference operations | 1 |
| Queued photos | 128 |

Duplicate requests must reuse work. Cancellation and stale-publication guards
are mandatory. Increasing any limit requires a new architecture review.

## Evaluation budgets

| Evidence | Maximum |
| --- | ---: |
| Package delta | 32 MiB |
| Preprocessing | 250 ms/photo |
| Cold start | 3000 ms |
| First inference | 1500 ms/photo |
| Warm inference | 500 ms/photo |
| Batch of 20 | 15000 ms |
| WASM memory | 256 MiB |
| Host peak memory delta | 768 MiB |
| Host idle memory delta | 192 MiB |

Exact macOS and Windows evidence is required. Missing measurements block the
candidate; exceeding a budget rejects it. A network dependency is a hard
rejection. Incomplete licensing, privacy, cancellation, concurrency, package,
or host evidence is blocking and cannot be interpreted as success.

## Current project state

The synthetic WASM feasibility probe remains useful evidence, but it is not a
model evaluation. No commercial candidate has completed licensing review, and
Windows timing and memory evidence is incomplete. Therefore ALB-070 remains
blocked from model selection and production integration.
