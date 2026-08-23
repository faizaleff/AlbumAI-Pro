# ALB-111 Model Candidate Inventory and Licensing Gate

Status: implemented; no production candidate has been evaluated or approved.

## Root cause

ALB-110 approved technical budgets and deterministic classification, but its
licensing input was only a self-declared candidate state. It did not require an
exact source, digest-pinned artifact inventory, license evidence, training-data
disclosure, redistribution decision, notices, obligations, or recorded human
review. Package measurements were also caller-supplied and were not bound to
the reviewed artifacts.

## Decision

`scripts/PhotoAiCandidateInventory.js` is the engineering-only, fail-closed
candidate evidence gate. It does not ship in the Photoshop runtime and does not
interpret legal text. It verifies that a recorded human review is complete and
that every public-safe evidence field required by ALB-070 is present and
internally consistent.

An eligible record requires:

- bounded candidate identity and `LOCAL_WASM` provider kind;
- HTTPS evidence URLs without credentials, query strings, or fragments;
- exact MODEL, RUNTIME, GLUE, and NOTICES artifacts;
- SHA-256 digests and byte measurements for every artifact;
- a model descriptor digest matching the MODEL artifact digest;
- exact weights and code license identifiers and evidence URLs;
- disclosed training-data evidence;
- explicit commercial-use and redistribution permission;
- explicit absence of research-only and field-of-use restrictions;
- bounded attribution/notice obligations; and
- an approved, dated human review with accepted obligations and complete
  notices.

Missing or malformed evidence is `BLOCKED`. Explicit negative commercial,
redistribution, training-disclosure, research-only, field-of-use, or reviewer
decisions are `REJECTED`. Passing the record means only
`ELIGIBLE_FOR_TECHNICAL_EVALUATION`; it is not legal advice, model selection,
quality approval, runtime integration, or product authorization.

## ALB-110 integration

The production evaluation gate now evaluates the full candidate inventory
itself. The legacy self-declared state cannot authorize evaluation. Package
evidence is derived from the reviewed MODEL, RUNTIME, GLUE, and NOTICES
artifacts, preventing an unrelated caller-supplied package total from passing
the 32 MiB budget.

ALB-112 separately binds supported-host loader evidence to the digest of the
reviewed RUNTIME artifact. Licensing eligibility alone cannot authorize a
technically incompatible runtime.

## Runtime impact

- No UI changes.
- No production model or model weights.
- No manifest or network changes.
- No production runtime source changes.
- No Photoshop document access.
- No photo bytes, paths, tokens, entries, embeddings, or host objects.

ALB-070 remains pending until at least one real candidate completes this human
review contract and supplies the required macOS/Windows package, latency, and
memory evidence.
