# Changelog

All notable changes to AlbumAI Pro will be documented in this file.

## [1.0.0] - 2026-07-29

### Added

- Project-based batch template processing
- Smart Object photo replacement
- Sequential photo assignment
- Template registry and persisted ordering
- Photo browser with selection and preview
- Auto Save for processed PSD files
- JPEG export
- Safe batch cancellation
- Recovery and resume support
- Failed-template retry
- Missing-template detection and recovery
- Invalid PSD handling
- Live batch progress and outcome summaries
- Production release build and clean packaging

### Improved

- Template status refresh after retry
- No-photo batch preflight
- Document cleanup and live-document tracking
- Project persistence and atomic recovery checkpoints
- Production bundle size and release structure

### Known limitations

- `allowCodeGenerationFromStrings` remains required by the current UXP HTML loading path
- `copy-webpack-plugin` emits a non-blocking webpack deprecation warning
- Browser thumbnail producer can log bounded-cache diagnostic messages
