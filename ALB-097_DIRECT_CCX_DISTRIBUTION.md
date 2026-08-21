# ALB-097 — Direct CCX Distribution Readiness

Status: **DIRECT CCX QUALIFIED — PACKAGE, INSTALL, AND STARTUP PASS**

## Root gap

AlbumAI Pro 1.1.0 is published as a reproducible ZIP, but that artifact is a
development/runtime bundle. End users should not need Node.js or UXP Developer
Tool to install the plugin. Adobe distributes UXP plugins as `.ccx` packages
installed by Creative Cloud Desktop.

## Locked distribution boundary

- Version and runtime remain `1.1.0` / `ALB-094-bundle-v1`.
- The direct-distribution ID remains `com.albumai.pro`.
- The package targets one host: Photoshop (`PS`).
- The manifest remains v5 and gains no network permission.
- The CCX contains exactly the eight production `dist` files.
- AlbumAI does not create a hand-made CCX. Use the Adobe UXP Developer Tool
  `Package` action with `dist/manifest.json`.
- Marketplace ID is not approved. Adobe Developer Distribution portal identity,
  listing, review, and any multi-channel ID decision are separate gates.

Adobe references:

- https://developer.adobe.com/photoshop/uxp/guides/distribution/packaging-your-plugin/
- https://developer.adobe.com/photoshop/uxp/2022/guides/distribution/distribution-options/

## Automated preflight

Run from `com.albumai.pro/`:

```text
npm run distribution:verify
```

The verifier requires aligned package/lock/source/dist versions, the direct
plugin ID, manifest v5, one Photoshop host, no network permission, the exact
eight-file dist inventory, and the qualified runtime bundle identity and hash.

After UXP Developer Tool creates the artifact, verify the actual package:

```text
npm run distribution:verify -- --ccx /absolute/path/to/AlbumAI-Pro.ccx
```

The CCX verifier reads the ZIP structure, rejects unsafe/extra/duplicate paths,
checks the embedded manifest, and requires the embedded `index.js` to be the
qualified production bundle.

## Manual package and install gate

1. Build and verify the clean production `dist`.
2. In UXP Developer Tool, ensure only
   `/Users/eff/Documents/AlbumAI/com.albumai.pro/dist/manifest.json` is loaded.
3. Use the plugin flyout menu → **Package** and save the `.ccx` outside the
   repository after verification.
4. Run the CCX verifier above and record filename, size, and SHA-256.
5. Unload the development plugin and close Photoshop.
6. Double-click the `.ccx`; Creative Cloud Desktop should offer **Install
   locally** for this direct package.
7. Require the CCX verifier to report embedded runtime identity
   `ALB-094-bundle-v1` and the qualified production-bundle checksum.
8. Restart Photoshop and confirm AlbumAI Pro opens from the installed package,
   both panel badges show `v1.1.0`, and an existing project loads. Re-authorize
   its photo folder after reinstall if the prior UXP persistent token is no
   longer available.
9. Confirm photos/previews, the four-sheet A-B-A-B storyboard, registered
   `01.psd` / `02.psd` templates, and saved slot assignments restore. A full
   render is not required because packaging does not alter the already-qualified
   execution path.

## Acceptance result

- UXP Developer Tool package: **PASS**
- Qualified artifact: `com.albumai.pro_PS.ccx`
- Artifact size: `188471` bytes
- Artifact SHA-256:
  `0befdef555f24082cb0b041bb2877845440641920be0301b883fef0c3cb1c6d8`
- Embedded runtime build: `ALB-094-bundle-v1`
- Embedded runtime SHA-256:
  `7b1583af9f4753fd834048313a3ead334ebc9ed10f7958d93190d2b8a54af74f`
- Creative Cloud Desktop local installation, version `1.1.0`: **PASS**
- Installed package runtime: **PASS**
- Visible `v1.1.0` identity, project open, photo-folder reauthorization,
  thumbnails/preview, four sheets, two registered templates, and persisted slot
  assignments: **PASS**
- Full render rerun: **NOT REQUIRED** for this packaging/display-identity change

The previously published GitHub `v1.1.0` ZIP and its recorded checksum remain
immutable development-release evidence. The direct-install CCX is a separately
qualified distribution artifact and must retain the CCX checksum above.
