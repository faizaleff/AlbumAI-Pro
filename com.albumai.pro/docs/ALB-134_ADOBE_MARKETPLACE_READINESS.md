# ALB-134 — Adobe Marketplace Readiness

Status: **in progress — baseline audited and fail-closed gate implemented**

Date: 2026-09-01

## Objective

Prepare an Adobe Creative Cloud Marketplace submission without uploading,
submitting, rewriting, or replacing the immutable `v1.2.0` GitHub release.
Every external Adobe action remains behind an explicit operator approval.

## Official requirements reviewed

The baseline was checked against Adobe's current Developer Distribution
overview and Photoshop UXP submission checklist:

- https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/submission/overview
- https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/submission/how-submit
- https://developer.adobe.com/photoshop/uxp/2021/distribution/submission-checklist/

Adobe requires a reviewed publisher profile; listing name, subtitle, support
email, help URL, English description, categories and tags; privacy and terms
links; a free/paid commerce decision; three marketplace icons; version release
notes; screenshots; and a `.ccx` package. The Photoshop checklist currently
specifies 48, 96, and 192 pixel listing icons under 1 MiB and between one and
five 1360x800 screenshots under 5 MiB. The Developer Distribution form remains
the final authority if its live fields differ.

The package must use the Adobe Console plugin ID, a single Photoshop host,
three-part version, complete non-zero package inventory, required manifest
icons, and a `.ccx` filename no longer than 45 characters without an embedded
version number. Submission and publication are separate approval boundaries.

## Baseline result

The repository-owned command below currently returns `BLOCKED` by design:

```text
npm run marketplace:readiness
```

Passing technical facts:

- manifest v5 with one Photoshop host;
- Photoshop minimum version `24.0.0`, above Adobe's minimum UXP requirement;
- exact three-part `1.2.0` package and manifest version alignment;
- no network or process-launch permission;
- qualified eight-file CCX inventory with no zero-byte files; and
- safe upload filename `com.albumai.pro_PS.ccx`.

Blocking facts:

1. Adobe Console plugin ID match is not yet confirmed.
2. Publisher profile approval and EU trader-distribution decision are unknown.
3. The packaged icons are the generic `UXP` sample/placeholder artwork. Adobe's
   checklist explicitly rejects placeholder or sample-project icons.
4. Unique owned plugin artwork and the 48/96/192 marketplace icon set are
   missing.
5. One to five 1360x800 marketplace screenshots are missing.
6. Subtitle, support email, help URL, description, category, tags, approved
   privacy URL, approved terms URL, commerce decision, and release notes are
   incomplete.
7. The Marketplace-specific install, minimum/maximum panel, workflow, and
   performance smoke has not been recorded.
8. A target CCX containing the final marketplace identity and artwork has not
   been qualified.

## Version decision

ALB-133 correctly refused an empty patch. ALB-134 found a concrete package and
review blocker: the immutable `v1.2.0` CCX contains placeholder icon artwork.
Replacing packaged artwork changes the distributed artifact, so Marketplace
readiness selects **`v1.2.1`** as the bounded patch target. The version is not
applied until the owned icon direction and listing boundary are approved.

## Delivery slices

1. **ALB-134.1 — readiness gate:** implemented here. Keep the gate `BLOCKED`
   until evidence exists; never infer approval from missing data.
2. **ALB-134.2 — identity and listing assets:** approve unique icon direction,
   create package/listing icons and screenshots, and approve public listing,
   support, privacy, terms, commerce, and publisher-profile facts.
3. **ALB-134.3 — v1.2.1 qualification:** apply one coherent version/build
   boundary, build the exact CCX, verify inventory/digests, install it, and run
   the Marketplace-specific Photoshop smoke.
4. **ALB-134.4 — Adobe Console draft:** confirm the Console plugin ID and
   publisher profile, then create and preview a draft. Do not submit.
5. **ALB-134.5 — submission:** only after a separate explicit approval, submit
   with manual publication selected and record Adobe's submission identifiers.

## Safety boundary

- No Adobe upload, draft creation, submission, or publication in ALB-134.1.
- No private publisher or trader details are stored in the repository.
- `v1.2.0` source tag and published ZIP/CCX remain immutable.
- `--require-ready` exits non-zero while any blocker remains.
