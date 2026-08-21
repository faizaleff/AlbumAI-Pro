# AlbumAI Pro 1.1.1

- Status: release candidate
- Version: 1.1.1
- Runtime identity: `ALB-098-v1.1.1-patch-v1`
- Release package: `AlbumAI-Pro-1.1.1.zip`
- Direct installer: `com.albumai.pro_PS.ccx`

## What changed

This patch aligns the direct-install package with one exact source and release
provenance. It removes stale hardcoded `v1.0.1` panel badges, displays the
canonical `v1.1.1` identity, and verifies UXP Developer Tool CCX files before
installation or distribution.

The qualified photo library, manual slot assignment, A-B-A-B multi-template
album design, Photoshop replacement, transactional output, recovery, and proof
workflows are unchanged from the stable 1.1.0 release line.

## Installation

The end-user artifact is `com.albumai.pro_PS.ccx`. Open it with Creative Cloud
Desktop, approve the local third-party plugin prompt, restart Photoshop, and
open AlbumAI Pro from the Plugins menu. Existing projects may require their
photo folder to be selected again after reinstall because UXP persistent folder
tokens are installation-scoped.

The ZIP is retained as reproducible development evidence; end users should use
the CCX installer.

## Verification state

- Deterministic tests, architecture, regression, hardening, production build,
  package, distribution, dependency, and audit gates: PASS.
- Production bundle SHA-256:
  `62a2fc71bc402b9895d60207cb7b587b3eee0a01fb8ae5abf9fc5e414b635fc8`.
- Reproducible `AlbumAI-Pro-1.1.1.zip`: 192,736 bytes; SHA-256
  `2cfe0237d468ed3a140b4fab725887ca4ab7f06df2f48d247d1d4dba24548ee9`.
- Verified `com.albumai.pro_PS.ccx`: 188,473 bytes; SHA-256
  `ec50eed854563ee445fec4772b6400a17e53211bf55a4cb6c1b02f6107b2cd3d`.
- UXP Developer Tool CCX package verification: PASS.
- Creative Cloud installation and installed Photoshop startup: PASS.
- Existing REC005 project reopen, six-photo library restore, four-sheet
  multi-template storyboard, and persisted assignments: PASS.
- Registered templates: 2 ready, 0 blocking; recovery compatibility:
  Compatible.
- Full album rerender: not required because the patch changes release and
  display identity only.

Final release links will be recorded only after the approval-gated tag and
release are created.
