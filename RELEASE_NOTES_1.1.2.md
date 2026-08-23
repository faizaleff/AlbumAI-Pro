# AlbumAI Pro 1.1.2

- Status: release candidate — not published
- Version: 1.1.2
- Build ID: `ALB-108-v1.1.2-patch-v1`
- Runtime revision: `ALB-108-v1.1.2-release-candidate-v1`
- Release package: `AlbumAI-Pro-1.1.2.zip`
- Direct installer: `com.albumai.pro_PS.ccx`

## What changed

This patch preserves completed recovery state when one photo is intentionally
reused, restores the inspector's independent scroll region, exposes exact
installed-runtime provenance, and replaces deprecated UXP dropdown widgets with
supported picker widgets.

Album design, manual slot assignment, A-B-A-B template mapping, Photoshop Smart
Object replacement, transactional output, and offline-default behavior remain
unchanged.

## Installation

The end-user artifact is `com.albumai.pro_PS.ccx`. Open it with Creative Cloud
Desktop, approve the local third-party plugin prompt, restart Photoshop, and
open AlbumAI Pro from the Plugins menu. Existing projects may require their
photo folder to be selected again because UXP folder tokens are scoped to the
installed plugin package.

## Verification state

- Automated tests, architecture, regression, hardening, warning-free production
  build, bundle identity, reproducible ZIP, and direct-distribution preflight:
  PASS.
- Production bundle: 717,674 bytes; SHA-256
  `5fc1de71ffb03f21a9f732905a4fb7344a87aae53dc93cf50ae6375cda15fc63`.
- Reproducible `AlbumAI-Pro-1.1.2.zip`: 193,058 bytes; SHA-256
  `eb06188e3eb7e06d04ba12a2cb70b046c6836489c28b36aba3ff8ab9e55c4f3f`.
- UXP Developer Tool `com.albumai.pro_PS.ccx`: verified PASS, 188,813 bytes;
  SHA-256
  `e8c574ba2effa46cd93479f5b5134bed8483861f3c53bcb76021ed91f4868816`.
- Creative Cloud installation and installed Photoshop runtime qualification:
  PASS. Both visible badges reported `v1.1.2`; runtime identity matched the
  candidate; REC005 restored its A-B-A-B sheets and persisted assignments;
  inspector scrolling and supported selector interaction passed.
- Git tag and GitHub release: not created; explicit approval required.
