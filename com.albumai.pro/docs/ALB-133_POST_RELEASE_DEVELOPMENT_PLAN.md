# ALB-133 — v1.2.0 Post-Release Development Plan

Status: **complete — next actionable milestone selected**

Date: 2026-09-01

## Baseline

- The current stable release is `v1.2.0`, published on 2026-08-31.
- ALB-132 verified the immutable tag target, release flags, asset sizes,
  digests, and fresh-download checksums.
- The package version, build identity, runtime revision, tag, and published
  artifacts remain unchanged by this planning milestone.
- The repository has no confirmed post-release product defect requiring a
  `v1.2.1` patch. A patch version will be opened only for a reproduced defect
  with a bounded fix and regression evidence.

## Post-release audit

The audit found documentation drift, not a runtime defect:

- the Roadmap current-release heading still named `1.1.2`; and
- the README direct-installer provenance paragraph still stopped at the
  `1.1.2` qualification records.

Both records now identify `v1.2.0` as the current stable release and preserve
the older release records as immutable history.

At the time of this audit, the only open GitHub product issue is
[`ALB-070`](https://github.com/faizaleff/AlbumAI-Pro/issues/14), the local-AI
capability and privacy architecture track. Its engineering gates exist, but a
real digest-pinned model/runtime candidate, licensing decision, and complete
macOS and Windows host evidence do not. It therefore remains blocked and does
not authorize model integration, bundling, or a production AI claim.

## Version decision

- Do not create an empty `v1.2.1` release.
- Keep `v1.2.0` immutable.
- Do not select or apply a new product version during ALB-133.
- Select the next version only after the next product/distribution scope and
  its artifact requirements are concrete.

## Selected next milestone

**ALB-134 — Adobe Marketplace Readiness** is the next actionable milestone.
It will prepare and validate the submission boundary for the already-qualified
AlbumAI Pro product without rewriting the published `v1.2.0` GitHub release.

ALB-134 must define, before any submission:

1. Adobe marketplace account and publisher prerequisites;
2. listing identity, product description, support/privacy/licensing links, and
   required visual assets;
3. the exact package/signing requirements and whether they require a new
   version rather than the immutable public `v1.2.0` artifacts;
4. deterministic checks for manifest, package, listing, and version
   consistency;
5. an approval boundary before uploading or submitting anything to Adobe; and
6. a separate record for Adobe review results and any requested remediation.

ALB-070 may continue only when a real candidate evidence packet is available.
Cloud collaboration, mobile proof review, and AI editing remain later product
phases and are not pulled into ALB-134.

## Verification boundary

ALB-133 changes planning and release documentation only. It does not change
plugin source, the production bundle, the manifest, or runtime behavior.
Deterministic documentation assertions are required; a Photoshop runtime
retest, package rebuild, CCX reinstall, tag change, or release-asset change is
neither required nor permitted for this milestone.
