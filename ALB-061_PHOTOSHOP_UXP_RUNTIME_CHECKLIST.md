# ALB-061 — Photoshop/UXP Runtime Qualification

Status: **READY TO RUN — AUTOMATED QUALIFICATION PASSED**

Use only disposable copied projects and photo folders. Never rename, move, or
delete original customer photographs during these scenarios.

## Fixture

Create a disposable folder containing:

- two byte-identical copies of one supported JPEG;
- one visually similar but byte-different JPEG with the same dimensions;
- at least five unrelated supported JPEGs;
- for the stale-work scenario, a second disposable folder with different
  photos.

Record the total photo count and exact copied pair before loading AlbumAI.

## RT-01 — Exact duplicate evidence and filter

1. Load the production `dist` plugin in Photoshop.
2. Create/open a disposable AlbumAI project and import the fixture folder.
3. Select **Find Duplicates** once and wait for the terminal summary.
4. Confirm the summary reports one group and two duplicate photos.
5. Enable **Duplicates only** and confirm only the copied pair remains.
6. Confirm the visually similar but byte-different JPEG is excluded.
7. Disable the filter and confirm the full library returns.

Pass: grouping is exact and explainable; no photo is modified, moved, deleted,
hidden, rejected, selected, rated, or favourited by analysis.

## RT-02 — Persistence and invalidation

1. Save and close the disposable project, then reopen it.
2. Confirm the duplicate summary and filter are restored.
3. Replace one copied file with different bytes, keeping its filename.
4. Refresh the photo folder.
5. Confirm prior evidence is marked stale and **Find Duplicates** is offered.
6. Run analysis again and confirm the former pair is no longer grouped.

Pass: unchanged evidence survives reopen; a source revision change invalidates
it before reuse.

## RT-03 — Stale-work rejection

1. Use a disposable folder large enough that duplicate analysis remains active
   for several seconds.
2. Start **Find Duplicates**.
3. While it is active, change to the second disposable photo folder.
4. Wait for all work to settle.

Pass: no result from the previous folder is published or persisted; the UI
reports stale analysis or the new folder's not-run state.

## RT-04 — Cache and host isolation

1. Browse the fixture in Icons and List views, scroll end-to-end, preview
   several photos, refresh the same folder, and return to the first photos.
2. In the UXP developer console run:

   `globalThis.__ALBUMAI_ALB042_RUNTIME_SUMMARY__()`

3. Capture the returned object after work is idle.

Pass:

- `thumbnailCacheEntries` is at most 250;
- `activeBrowserDecodes`, `activePreviewDecodes`, and `pendingJobs` are 0;
- `photoshopDocumentsOpenedByBrowser` is 0;
- object-URL counts do not grow continuously after repeated navigation and
  same-folder refresh.

## Evidence record

For each scenario record: Photoshop version, plugin build/commit, fixture photo
count, observed duplicate group/photo counts, runtime summary, PASS/FAIL, and
any limitation. Runtime PASS, automated PASS, limitation, and not-run are kept
distinct.
