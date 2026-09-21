# Multi-spread drafts and isolated template previews

- Pending drafts no longer disable template selection, spread navigation or Add spread.
- Each template has its own Add spread action passing its explicit template ID.
- Apply all validates all pending draft bases and photo references, commits the complete sheet set once, then renders the nonempty changed sheets sequentially. A render failure stops processing; committed assignments remain available for retry.
- Every pending spread displays the compact refresh affordance, even when another spread is selected.
- Template preview opens a temporary file copy and closes only that copy. An unrelated unsaved Photoshop document no longer blocks empty-spread previews. The prior active document is restored.
- Empty spreads prefer available template pixels over a stale filled-spread composite.

Validation: ALB-081 181 assertions, ALB-083 245 assertions, production build passed. Installed files updated and Photoshop restarted with user approval after applying the user draft and saving the album. Source PSD was not saved.

Live verification after restart:
- Saved brush spread restored successfully.
- Existing empty 02.psd spread generated both main preview and thumbnail while the unrelated 01.psd remained unsaved.
- Dragged a photo into an empty slot; switched spreads and returned: pending draft remained visible.
- Added a 03.psd spread using its template-card action while the other draft remained pending. The new empty layout and thumbnail appeared.
- Removed only the test-created spread and discarded only the test-created draft, then saved the restored album.
- Apply all count appeared correctly. Multi-spread Apply all rendering has automated coverage but was not exercised end-to-end in this live pass.
