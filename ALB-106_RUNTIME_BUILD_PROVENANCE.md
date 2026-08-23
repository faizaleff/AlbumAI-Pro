# ALB-106 — Runtime Build Provenance

## Objective

Distinguish the current post-release development bundle from the immutable
published v1.1.1 bundle without rewriting release history or changing the
plugin version.

## Root cause

The published release build ID (`ALB-098-v1.1.1-patch-v1`) correctly remains
immutable. Subsequent support and maintenance slices changed the local runtime,
but version, build ID, and support ID remained identical. A stale installed
bundle and the current local bundle could therefore report the same identity.

## Minimal fix

- Preserve the published version and build ID.
- Add `ALB-106-runtime-provenance-v1` as a separate Runtime Revision ID.
- Show it in the existing Project Health diagnostics.
- Include it in copied Summary and Debug Log output.
- Log it at plugin startup and require it in production bundle verification.
- Add no UI workflow, network request, or new permission.

## Runtime acceptance

After reloading the local `dist/manifest.json`, Project Health, Copy Summary,
Copy Debug Log, and the UXP console must report:

`Runtime Revision: ALB-106-runtime-provenance-v1`

The existing release build ID must remain `ALB-098-v1.1.1-patch-v1`.
