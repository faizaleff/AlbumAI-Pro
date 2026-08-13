# ALB-070 — Model Candidate Inventory and Licensing Gate

Status: **TEMPLATE — NO CANDIDATES EVALUATED OR SELECTED**

Tracking: **GitHub issue #14, Slice 3 preparation**

## Purpose

This document defines the evidence required before a runtime or model artifact
may enter technical evaluation for AlbumAI Pro. It is an engineering gate, not
legal advice, a model-quality result, or approval to ship.

Create one immutable inventory record per exact candidate version and artifact
set. A new upstream version, file, digest, license, runtime dependency, or
preprocessing implementation requires a new record or an explicitly linked
revision. Do not silently carry an earlier result forward.

## Candidate lifecycle

| State | Meaning |
| --- | --- |
| `NOT_EVALUATED` | No evidence review has started |
| `EVIDENCE_INCOMPLETE` | One or more required identity, provenance, license, or disclosure fields are missing |
| `LICENSE_REJECTED` | A hard licensing or redistribution rejection rule applies |
| `TECHNICALLY_BLOCKED` | Licensing evidence is sufficient to continue, but a required host, privacy, package, latency, memory, API, or concurrency gate is missing |
| `ELIGIBLE_FOR_TECHNICAL_EVALUATION` | The artifact may enter a bounded non-production spike; it is not selected or approved to ship |
| `TECHNICALLY_REJECTED` | Measured evidence violates a mandatory technical or privacy rule |
| `ELIGIBLE_FOR_SEPARATE_SELECTION_REVIEW` | All inventory and approved technical gates pass; a separate decision is still required before product integration or redistribution |

Only `ELIGIBLE_FOR_TECHNICAL_EVALUATION` permits a bounded candidate spike.
Only `ELIGIBLE_FOR_SEPARATE_SELECTION_REVIEW` permits a later selection
proposal. Neither state selects a model.

## Required candidate record

Copy this table for each candidate. Use canonical URLs and exact terms rather
than search-result summaries or repository names alone.

| Field | Required value |
| --- | --- |
| Candidate record ID | Stable AlbumAI identifier |
| Review state | One lifecycle value from this document |
| Intended signal | Narrow proposed use such as blur or composition; not a product-quality claim |
| Publisher / rights provider | Legal or project entity providing the artifact |
| Canonical source | Exact authoritative source URL |
| Upstream version | Release, tag, commit, or immutable version identifier |
| Artifact files | Exact filenames and roles for weights, graph, labels, preprocessing, runtime, and notices |
| Artifact size | Bytes for every file plus compressed and installed totals |
| Artifact digest | SHA-256 for every redistributed or evaluated file |
| Retrieval date | ISO date on which the exact artifact and terms were reviewed |
| Weights license | Exact name/version, canonical URL, and included license-file path or digest |
| Runtime/code license | Exact license for runtime, loader, operators, and required libraries |
| Pre/postprocessing license | Exact license for copied or adapted transforms, tokenizers, labels, or utilities |
| Transitive obligations | Required notices, source offers, attribution, relinking, disclosure, or other redistribution duties |
| Commercial-use permission | Exact supporting term and scope |
| Redistribution permission | Exact supporting term for bundling the artifact in AlbumAI Pro |
| Modification/derivative terms | Conditions that apply to conversion, quantization, pruning, fine-tuning, or repackaging |
| Field-of-use / acceptable-use terms | Full applicable restrictions or `NONE_FOUND` with evidence |
| Patent / trademark terms | Applicable grants, restrictions, or unresolved questions |
| Training-data disclosure | Canonical disclosure source and known scope/limitations |
| Required notices | Exact notice files and proposed package locations |
| Model format | Format, opset/schema version, precision, and required operators |
| Runtime identity | Exact runtime name, version, source, license, and digest |
| UXP initialization requirements | Whether synchronous constructors are supported and whether any async-only startup is required |
| Runtime feature requirements | Memory growth, maximum pages, SIMD, threads, shared memory, filesystem, dynamic code, or other host requirements |
| Runtime network behavior | Every download, telemetry, update, or remote lookup; expected value is `NONE` |
| Input contract | Dimensions, channels, normalization, crop behavior, and bounded source bytes |
| Output contract | Bounded signals and evidence; no pixels, embeddings, identity, or unsafe errors |
| Persistence/cache plan | Version and digest keys, invalidation behavior, and proof that sensitive values are excluded |
| Supported-host evidence | Links to separate real macOS and Windows Photoshop/UXP results |
| Package measurement | Runtime, model, notices, glue, and combined production-package deltas |
| Latency measurement | Preprocessing, cold start, first inference, warm inference, and bounded batch on each supported host |
| Memory measurement | WASM allocation, instance count, retained references, and repeated-run host observation on each supported host |
| Concurrency proposal | Queue owner, maximum instances/inferences, cancellation, request deduplication, and stale-publication handling |
| Open questions | Every unresolved factual, technical, licensing, or disclosure issue |
| Evidence reviewers | Engineering reviewer and, where required, qualified licensing/legal reviewer |
| Decision and reasons | Lifecycle result plus allowlisted reason codes and supporting evidence |

`NONE`, `NOT_APPLICABLE`, and `NONE_FOUND` are valid only when the record
explains the investigation and cites the evidence. Blank fields are missing
evidence.

## Hard licensing and provenance rejection rules

Reject a candidate as `LICENSE_REJECTED` when any of these rules applies:

- the canonical artifact source or exact upstream version cannot be established;
- the weights license, runtime/code license, or required preprocessing license
  is missing or ambiguous;
- commercial use is absent, non-commercial, research-only, evaluation-only, or
  otherwise outside AlbumAI Pro's intended distribution;
- field-of-use or acceptable-use terms are incompatible with the proposed
  product use;
- redistribution, modification, conversion, or notice obligations cannot be
  satisfied by the production package and release process;
- required component licenses conflict with one another or with AlbumAI Pro's
  distribution terms;
- the exact files do not match the recorded digests or the reviewed source;
- training-data disclosure is missing or too incomplete for the required review;
- a required qualified review leaves the commercial or redistribution right
  unresolved.

Do not infer permission from public availability, an open repository, a model
card, a framework license, or the license of adjacent source code. Weights,
runtime, preprocessing, data disclosures, and bundled dependencies are
reviewed separately.

## Technical and privacy blocking rules

A candidate is `TECHNICALLY_BLOCKED` while required evidence is missing. It is
`TECHNICALLY_REJECTED` after measured evidence proves that any mandatory rule
cannot be met.

- Real Photoshop/UXP evidence is missing for macOS or Windows.
- The runtime depends on async-only WASM byte instantiation or another API not
  supported by the approved UXP path.
- The runtime or artifact downloads code, weights, configuration, updates, or
  telemetry at execution time.
- The combined runtime/model/notices package exceeds the approved ceiling.
- Representative cold, warm, batch, or cancellation latency exceeds an
  approved budget.
- WASM allocation, instance count, retained references, or repeated-run host
  behavior exceeds an approved memory budget.
- Concurrency, cancellation ownership, request deduplication, or stale-result
  rejection is unbounded or undefined.
- The implementation opens Photoshop documents for inference.
- Pixels, crops, tensors, embeddings, names, paths, tokens, entries, host
  objects, or unsafe errors can escape through logs, reports, caches, or
  persistence.
- Unsupported, stale, malformed, cancelled, or failed work can fabricate a
  score, mutate a user decision, or publish compatible-looking evidence.

## Allowlisted reason codes

Use one or more of these codes in the candidate record. Additions require a
reviewed update to this gate so downstream reports never expose arbitrary
errors.

### Licensing and provenance

- `SOURCE_UNVERIFIED`
- `ARTIFACT_VERSION_UNPINNED`
- `ARTIFACT_DIGEST_MISMATCH`
- `WEIGHTS_LICENSE_MISSING`
- `CODE_LICENSE_MISSING`
- `PREPROCESSING_LICENSE_MISSING`
- `LICENSE_TERMS_AMBIGUOUS`
- `COMMERCIAL_USE_NOT_PERMITTED`
- `RESEARCH_OR_EVALUATION_ONLY`
- `FIELD_OF_USE_INCOMPATIBLE`
- `REDISTRIBUTION_INCOMPATIBLE`
- `MODIFICATION_TERMS_INCOMPATIBLE`
- `NOTICE_OBLIGATION_UNSATISFIABLE`
- `COMPONENT_LICENSE_CONFLICT`
- `TRAINING_DATA_DISCLOSURE_INCOMPLETE`
- `QUALIFIED_REVIEW_REQUIRED`

### Technical and privacy

- `HOST_MATRIX_INCOMPLETE`
- `UXP_RUNTIME_UNSUPPORTED`
- `SYNC_WASM_PATH_UNSUPPORTED`
- `NETWORK_DEPENDENCY_REQUIRED`
- `PACKAGE_BUDGET_UNAPPROVED`
- `PACKAGE_BUDGET_EXCEEDED`
- `LATENCY_BUDGET_UNAPPROVED`
- `LATENCY_BUDGET_EXCEEDED`
- `MEMORY_BUDGET_UNAPPROVED`
- `MEMORY_BUDGET_EXCEEDED`
- `CONCURRENCY_POLICY_UNAPPROVED`
- `CONCURRENCY_UNBOUNDED`
- `CANCELLATION_UNSAFE`
- `STALE_PUBLICATION_UNSAFE`
- `PHOTOSHOP_DOCUMENT_ACCESS_REQUIRED`
- `PRIVACY_BOUNDARY_VIOLATION`
- `FAILURE_FALLBACK_UNSAFE`

## Review sequence

1. Pin the exact candidate source, version, files, sizes, and SHA-256 digests.
2. Complete the separate weights, runtime/code, preprocessing, dependency, and
   training-data fields.
3. Apply every hard licensing and provenance rejection rule before executing
   candidate code or adding candidate files to a product branch.
4. If eligible, propose a bounded non-production technical spike with no user
   photos, no project mutation, no network, and no Photoshop document access.
5. Approve quantitative package, latency, memory, and concurrency thresholds
   before scoring the candidate.
6. Record separate real macOS and Windows Photoshop/UXP evidence.
7. Mark the candidate `ELIGIBLE_FOR_SEPARATE_SELECTION_REVIEW` only when all
   required evidence and approved technical gates pass.

## Current inventory

No model or runtime candidate has been evaluated, rejected, selected, bundled,
or approved by this preparatory slice.
