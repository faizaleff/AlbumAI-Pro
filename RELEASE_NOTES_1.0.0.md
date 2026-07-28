# AlbumAI Pro 1.0.0

- Version: 1.0.0
- Release date: 2026-07-29
- Git tag: `v1.0.0`
- Release commit: `c67697e`
- SHA-256: `cdca26a1bab367fec93b4b608ebd0e2f8ef011e17b6c38be8a4ace616fcc9e38`

## Installation

1. Extract `AlbumAI-Pro-1.0.0.zip`.
2. Open Adobe UXP Developer Tool.
3. Add the extracted `manifest.json`.
4. Load the AlbumAI Pro plugin in Photoshop.
5. Open the AlbumAI Browser panel from Photoshop's Plugins menu.

The release archive places `manifest.json` at its root and contains the production bundle, HTML entry point, license notice, and required icons.

## Main features

- Project-based batch processing of ordered PSD templates
- Smart Object photo replacement with sequential photo assignment
- Persisted template registry, ordering, status, and missing-template recovery
- Photo browsing, preview, and selection
- Automatic saving of processed PSD files and JPEG export
- Live batch progress and per-template outcome summaries
- Cooperative batch cancellation with safe document cleanup
- Persisted recovery checkpoints and interrupted-batch resume
- Deterministic retry of failed templates without rerunning successful templates
- Invalid PSD and missing-template handling
- Production-optimized release bundle and clean package structure

## Known limitations

- `allowCodeGenerationFromStrings` remains required by the current UXP HTML loading path.
- `copy-webpack-plugin` emits a non-blocking webpack deprecation warning during builds.
- The browser thumbnail producer can log bounded-cache diagnostic messages.
