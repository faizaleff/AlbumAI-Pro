# AlbumAI Pro 1.0.1 Roadmap

## Release goal

A focused maintenance release for stability, usability, diagnostics, and packaging improvements after v1.0.0.

## Priority 1 — Bug fixes

- Investigate bounded-cache diagnostic messages in the photo browser
- Review thumbnail decode and refresh edge cases
- Improve failed-template retry consistency
- Verify missing-template recovery across project reloads
- Review cancellation behavior during active save or export
- Validate cleanup of Photoshop document references after failures

## Priority 2 — Stability improvements

- Reduce unnecessary browser thumbnail work
- Improve batch recovery checkpoint validation
- Add clearer handling for invalid or unreadable PSD files
- Improve project-state validation during startup
- Add stronger guards around duplicate batch execution
- Review atomic file-write error reporting

## Priority 3 — User experience

- Improve empty-state messages
- Improve batch completion summary wording
- Make retry and recovery actions clearer
- Improve template and photo selection feedback
- Add clearer status messages during Auto Save and JPEG export
- Review progress reporting for long-running batches

## Priority 4 — Build and repository

- Review the current UXP HTML loading dependency on allowCodeGenerationFromStrings
- Investigate the copy-webpack-plugin deprecation warning
- Add a repeatable release verification checklist
- Add a checksum generation script
- Add a clean release packaging script
- Review whether com.albumai.pro.zip should remain tracked

## Out of scope

- Major UI redesign
- New placement algorithms
- Cloud sync
- Licensing and payments
- Adobe Marketplace submission
- Large architecture refactors

## Release acceptance criteria

- No regression in the v1.0.0 core workflow
- Production build succeeds
- Release ZIP contains only required plugin files
- Batch processing, retry, recovery, Auto Save, and JPEG export pass manual verification
- No leaked live Photoshop document references after completion
- Git working tree is clean
- Changelog and release notes are updated
