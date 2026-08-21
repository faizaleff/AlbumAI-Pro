# AlbumAI Pro 1.1.0

- Version: 1.1.0
- Release date: 2026-08-21
- Package: `AlbumAI-Pro-1.1.0.zip`
- Package size: 192,731 bytes
- SHA-256: `52eb9d8afe903a546ba65ab11a0a53dbdbeee763c423b431db12bd67b1f0a0dc`
- Runtime identity: `ALB-094-bundle-v1`

## Installation

1. Verify the ZIP against the SHA-256 value above.
2. Extract `AlbumAI-Pro-1.1.0.zip`.
3. Open Adobe UXP Developer Tool.
4. Add the extracted `manifest.json`.
5. Load AlbumAI Pro in Photoshop 2026.
6. Open **Plugins > AlbumAI Browser**.

The archive contains exactly the production license, HTML entry point, generated
bundle, bundle license notice, manifest, and four required icons. Source, tests,
dependencies, stale bundles, staging files, backups, and platform metadata are
excluded.

## Highlights

- Register multiple PSD templates and map them across an ordered album.
- Assign Library photos to exact Smart Object slots, including reuse of one
  photo in multiple slots, with save/reopen persistence.
- Render four A-B-A-B spreads through the existing safe Photoshop execution
  pipeline.
- Export deterministic `Spread_01.jpg` through `Spread_04.jpg` outputs.
- Detect stale UXP bundles through the current runtime identity and enforce one
  canonical generated `dist/index.js`.

## Qualification

- ALB-092 manual assignment and persistence: PASS.
- ALB-093 full album batch render and transactional JPEG export: PASS.
- ALB-094 runtime identity and two-slot smoke render: PASS.
- Architecture verification: 239 assertions PASS.
- Regression verification: 964 assertions PASS.
- Hardening verification: 89 assertions PASS.
- Production bundle: 716,650 bytes with zero warnings.
- Reproducible package verification: PASS.

## Compatibility note

The built-in UXP `sp-dropdown` control may emit Adobe's deprecation warning.
It remains functional and is retained because the compatible `sp-picker`
migration is not consistently supported across the current Photoshop UXP
widget/SWC boundary. The warning does not affect album execution or output.
