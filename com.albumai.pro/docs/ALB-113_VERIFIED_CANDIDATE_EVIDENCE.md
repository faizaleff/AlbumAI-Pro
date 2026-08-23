# ALB-113 Verified Candidate Evidence Builder

Status: implemented; no real model or runtime candidate has been evaluated.

## Root cause

ALB-111 and ALB-112 fail closed when candidate or runtime evidence is missing,
but their artifact byte counts and SHA-256 digests were still supplied by a
caller. There was no repository-owned tool that measured the exact local files
and emitted the immutable inventory consumed by those gates.

## Decision

`scripts/PhotoAiCandidateEvidenceBuilder.cjs` is an engineering-only, offline
evidence builder. Given a reviewed manifest plus exact local MODEL, RUNTIME,
GLUE, and NOTICES files, it:

- rejects unknown schemas, missing or duplicate artifact kinds, directories,
  symbolic links, unsafe evidence URLs, and malformed review data;
- streams each regular file once and computes its byte size and SHA-256 digest;
- verifies file identity before and after hashing so a changed artifact fails;
- derives the candidate model digest from the measured MODEL artifact;
- omits local paths and file contents from the public-safe output; and
- creates a new mode-0600 evidence file without overwriting existing evidence.

Run it only from an engineering checkout:

```text
npm run ai:candidate:evidence -- reviewed-manifest.json verified-evidence.json
```

The generated `candidateInventory` is the input to ALB-111. Its measured
RUNTIME digest is also the identity that ALB-112 loader evidence must match.
The builder records facts; ALB-111 still owns licensing/review classification,
so explicit negative facts are preserved and rejected there.

## Boundary

- No UI or production runtime changes.
- No model selection, download, execution, or bundling.
- No network access or Photoshop document access.
- No user photos, project data, tokens, UXP entries, or host objects.
- A verified evidence file does not approve licensing, compatibility, quality,
  model selection, product integration, or redistribution.

ALB-070 remains pending until a real candidate uses this builder and passes all
ALB-111, ALB-112, and ALB-110 human and quantitative gates.
