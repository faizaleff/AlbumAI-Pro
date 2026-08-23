# ALB-115 Production Evaluation Evidence Packet

Status: implemented; no production model or runtime is approved.

## Root cause

ALB-113 creates an exact-file candidate inventory, ALB-114 creates digest-bound
macOS and Windows runtime compatibility evidence, and ALB-110 owns the final
technical gate. The repository did not own the assembly step that binds those
records to the same candidate and combines them with reviewed policy and host
performance evidence. Manual JSON assembly could pair measurements with the
wrong model or runtime while still appearing structurally complete.

## Decision

`scripts/PhotoAiProductionEvidencePacket.cjs` is an offline engineering tool.
It accepts only allowlisted, public-safe fields and creates a canonical ALB-110
gate input after verifying:

- the candidate evidence was produced from local files by ALB-113;
- model and runtime digests match the exact reviewed artifacts;
- ALB-114 compatibility evidence matches that runtime digest;
- macOS and Windows benchmark records are both present and unique;
- every benchmark record matches the same candidate, model, and runtime; and
- privacy, network, cancellation, stale-publication, and concurrency evidence
  is explicit and typed.

Missing, duplicate, malformed, or identity-mismatched evidence fails closed.
Negative evidence is preserved so ALB-110 can return `BLOCKED` or `REJECTED`;
the packet builder never converts a failed measurement into success.

## Inputs

Create a reviewed policy manifest:

```json
{
  "schemaVersion": 1,
  "privacyBoundaryPassed": true,
  "networkRequired": false,
  "cancellationPassed": true,
  "stalePublicationPassed": true,
  "concurrency": {
    "queueOwner": "PhotoWorkspaceService",
    "maximumActiveProjects": 1,
    "maximumModelInstances": 1,
    "maximumConcurrentInferences": 1,
    "maximumQueuedPhotos": 128,
    "duplicateRequestsReuseWork": true,
    "cancellationRequired": true,
    "stalePublicationGuardRequired": true
  }
}
```

Each host benchmark record must contain schema version, candidate/model/runtime
identity, platform, execution and Photoshop document-count facts, the five
ALB-110 timing measurements, and the three ALB-110 memory measurements. Run:

```text
npm run ai:production:evidence -- packet.json candidate.json compatibility.json policy.json macos-benchmark.json windows-benchmark.json
```

The output `gateInput` is the exact input for
`evaluatePhotoAiProductionGate`. `VERIFIED_EVIDENCE_PACKET` means only that the
evidence is canonical and identity-bound. The ALB-110 result remains the sole
technical eligibility decision and does not authorize product integration.

## Boundary

- No UI, manifest, network permission, production bundle, or model changes.
- No photo bytes, local paths, file tokens, filenames, embeddings, host
  objects, or raw errors are accepted into the packet.
- Output is non-overwriting and owner-readable only.
- Both supported hosts remain mandatory.
- ALB-070 remains pending until a real candidate passes every external and
  human-review gate.
