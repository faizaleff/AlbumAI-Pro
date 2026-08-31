# ALB-131 Installed Runtime Smoke

Date: 2026-08-31
Result: PASS

## Installed identity

- Product: AlbumAI Pro
- Plugin ID: `com.albumai.pro`
- Version: `1.2.0`
- Build ID: `ALB-131-v1.2.0-release-v1`
- Runtime revision: `ALB-131-v1.2.0-publication-ready-v1`
- Network access: not requested; offline by default

## Bounded workflow

1. Installed `com.albumai.pro_PS.ccx` through Creative Cloud Desktop by
   replacing the installed ALB-130 candidate.
2. Creative Cloud confirmed `AlbumAI Pro is now installed` and reported
   version `1.2.0`.
3. Opened `ALB-127-Storyboard-Typography-Test.psd` in Photoshop.
4. Applied Title typography to the editable `CAPTION` layer with text
   `ALB-131 Release Smoke`.
5. Visually confirmed the expected title text and styling on the canvas.
6. Performed one grouped Undo and visually confirmed the original
   `TITLE` / `Caption` fixture state with no dirty-document marker.

## Evidence

- `installed-runtime-summary.txt`
- `installed-runtime-debug.txt`
- `installed-typography-applied.jpeg`
- `installed-typography-restored.jpeg`

The recovery `CLEANUP_FAILED` state visible in diagnostics is preserved
historical evidence from the earlier v1.1.2 export-failure test. The ALB-131
smoke neither invoked output processing nor changed that recovery record.
