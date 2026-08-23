# ALB-107 Picker Deprecation Migration

## Root cause

The shared `UxpDropdown` adapter still rendered Adobe's deprecated `sp-dropdown`
widget. Four instances of that shared adapter were visible in the Import workspace,
so UXP emitted the same deprecation warning four times.

## Minimal fix

- Render the built-in `sp-picker` widget from the existing shared adapter.
- Preserve the existing option menu, controlled `selectedIndex`, change mapping,
  disabled state, accessibility attributes, and optional click propagation guard.
- Keep the adapter API and every caller unchanged.
- Do not add Spectrum Web Component dependencies or permissions.

## Verification

- ALB-107 regression coverage prevents `sp-dropdown` from returning.
- `npm test`: PASS, including architecture and regression verification.
- Hardening verification: PASS (89 assertions).
- Production build: PASS with no webpack warnings.
- Bundle identity: PASS (`717678` bytes) with runtime revision
  `ALB-107-picker-deprecation-migration-v1`.
- Runtime acceptance: PASS. Photoshop loaded runtime revision
  `ALB-107-picker-deprecation-migration-v1`; selector changes persisted through
  verified project saves, and the UXP console contained no
  `sp-dropdown is deprecated` warning or runtime error.
