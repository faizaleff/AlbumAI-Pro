# ALB-134 — Adobe Marketplace Readiness

Status: **in progress — candidate assets, listing copy, and support/legal plan generated**

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
- exact three-part `1.2.1` candidate package and manifest version alignment;
- no network or process-launch permission;
- qualified eight-file CCX inventory with no zero-byte files; and
- safe upload filename `com.albumai.pro_PS.ccx`.

Blocking facts:

1. Adobe Console plugin ID match is not yet confirmed.
2. Publisher profile approval and EU trader-distribution decision are unknown.
3. Operator approval is recorded for the new Option 3 artwork, but the final
   publisher ownership confirmation is still required.
4. One to five 1360x800 marketplace screenshots are missing.
5. The local subtitle, description, proposed category, tags, and release notes
   are drafted but not operator-approved. Support email, help URL, approved
   privacy URL, approved terms URL, and commerce decision remain incomplete.
6. The Marketplace-specific install, minimum/maximum panel, workflow, and
   performance smoke has not been recorded.
7. A target CCX containing the final marketplace identity and artwork has not
   been qualified.

## Version decision

ALB-133 correctly refused an empty patch. ALB-134 found a concrete package and
review blocker: the immutable `v1.2.0` CCX contains placeholder icon artwork.
Replacing packaged artwork changes the distributed artifact, so Marketplace
readiness selects **`v1.2.1`** as the bounded patch target. The version is not
applied until the icon direction is approved. That approval is now recorded,
and the repository carries the `v1.2.1` Marketplace candidate identity; no tag
or release exists.

## Approved icon evidence

The operator approved Option 3: two interlocking photo frames with three
connected automation nodes. The built-in image generation workflow produced a
transparent 1254x1254 master, then deterministic downscaling created the
package 32/64 pixel assets and Marketplace 48/96/192 pixel assets.

- Master: `marketplace/assets/albumai-icon-master.png`
- Master SHA-256:
  `322ebed5dc0dac1c8b20683280c54a4d66641e76b52be482e090e17746613c4a`
- The artwork contains no text, UXP label, Adobe/Photoshop symbol, or Adobe
  asset. Publisher ownership confirmation remains a separate factual gate.

## Listing-copy draft

The English listing draft is stored in
`marketplace/LISTING_COPY_DRAFT.md` and mirrored into the readiness manifest.
It describes only repository-qualified behavior, keeps the offline posture
explicit, and makes no generative-AI or third-party-service claim. The proposed
`Productivity` category must still be confirmed against the live Console
choices. Copy approval remains separate from Adobe upload or submission.

## Support, legal, and media plan

`marketplace/SUPPORT_LEGAL_AND_MEDIA_PLAN.md` records the remaining factual
decisions without inventing an email address, public URL, commerce model,
publisher identity, or legal approval. Final screenshot capture is explicitly
deferred until both the product UI and permanent logo are approved. The future
shot list is planning evidence only, so `SCREENSHOTS_INVALID` remains blocked.

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
