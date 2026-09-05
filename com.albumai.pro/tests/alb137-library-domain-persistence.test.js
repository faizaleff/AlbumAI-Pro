import assert from "assert";
import fs from "fs";
import path from "path";

import PhotoWorkspaceService from "../src/services/PhotoWorkspaceService";
import SelectionEngine from "../src/core/SelectionEngine";
import PhotoLibraryHistory, {
    PhotoLibraryHistoryKind
} from "../src/services/PhotoLibraryHistory";
import {
    createPhotoDecisionLookup,
    normalizePhotoBrowserPreferences,
    normalizePhotoEventChapters,
    normalizePhotoStoryOrder,
    queryPhotoBrowser,
    updatePhotoDecision
} from "../src/services/PhotoBrowserModel";
import {
    applyBurstReview,
    CullingFilterMode,
    CullingStatus,
    filterPhotosByCulling,
    normalizePhotoBurstReviews,
    summarizeCulling
} from "../src/services/PhotoCullingService";
import {
    createPhotoGroupingRevision,
    createCameraIdentityLookup,
    groupPhotosByBurst
} from "../src/services/PhotoGroupingEngine";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-137 Slice 1: ${name}`);
}

function fixture({
    photos = [
        {
            id: "/photos/one.jpg",
            name: "one.jpg",
            file: { nativePath: "/photos/one.jpg" }
        },
        {
            id: "/photos/two.jpg",
            name: "two.jpg",
            file: { nativePath: "/photos/two.jpg" }
        },
        {
            id: "/photos/three.jpg",
            name: "three.jpg",
            file: { nativePath: "/photos/three.jpg" }
        }
    ]
} = {}) {
    let failSave = false;
    const initialStoryOrder = normalizePhotoStoryOrder({}, photos);
    let metadata = {
        id: "project-one",
        name: "Project One",
        schemaVersion: 1,
        photoCount: photos.length,
        photoDecisions: {},
        photoDuplicateEvidence: {},
        photoStoryOrder: initialStoryOrder,
        photoEventChapters: normalizePhotoEventChapters({}, photos)
    };
    const workspace = {
        cache: {
            metadata: {
                createFile: async () => ({
                    write: async () => {
                        return;
                    }
                })
            }
        }
    };
    const saved = [];
    const projectEngine = {
        isOpen: () => true,
        getProject: () => ({ metadata, workspace }),
        updateMetadata(values) {
            metadata = { ...metadata, ...values };
        }
    };
    const projectService = {
        saveProject: async (values, options) => {
            saved.push({ values, options });
            metadata = { ...metadata, ...values };
            if (failSave) {
                throw new Error("Injected save failure.");
            }
        }
    };
    const service = new PhotoWorkspaceService({
        library: {
            getPhotos: () => photos,
            load() {},
            get length() {
                return photos.length;
            }
        },
        selection: { clear: () => {} },
        projectEngine,
        projectService,
        localFileSystem: {},
        importFolder: async () => null,
        thumbnailService: { clear: async () => {} },
        thumbnailQueue: { clear: () => {} },
        refreshService: { refresh: () => {} },
        performance: {
            trace: () => {},
            timestamp: () => Date.now(),
            beginFolderLoad: () => {},
            markPickerComplete: () => {}
        }
    });
    return {
        service,
        photos,
        metadata: () => metadata,
        initialStoryOrder,
        saved,
        fail: value => { failSave = value; }
    };
}

async function run() {
    await test("keeps source-folder actions visible above the scrollable Library workspace", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        const styleSource = fs.readFileSync(
            path.join(process.cwd(), "src/styles.css"),
            "utf8"
        );
        assert.match(componentSource, /photo-library-source-actions/);
        assert.match(componentSource, />\s*Change Folder\s*</);
        assert.match(
            styleSource,
            /\.photo-library-source-actions\s*\{[\s\S]*?display:\s*flex;/
        );
    });

    await test("contains Burst Review controls inside the available plugin panel", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        const styleSource = fs.readFileSync(
            path.join(process.cwd(), "src/styles.css"),
            "utf8"
        );
        assert.match(
            styleSource,
            /\.photo-preview-dialog\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*0;/
        );
        assert.doesNotMatch(styleSource, /\.photo-preview-dialog\s*\{[\s\S]*?height:\s*calc\(100%/);
        assert.match(
            styleSource,
            /\.photo-burst-review \.photo-preview-stage\s*\{[\s\S]*?min-height:\s*100px;/
        );
        assert.match(
            styleSource,
            /\.photo-burst-frame\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?appearance:\s*none;/
        );
        assert.match(
            styleSource,
            /\.photo-burst-frame \.photo-image-container\s*\{[\s\S]*?height:\s*64px\s*!important;/
        );
        assert.match(
            componentSource,
            /<div[\s\S]*?className=\{`photo-burst-frame[\s\S]*?role="option"[\s\S]*?<PhotoImage/
        );
        assert.match(componentSource, /photo-preview-zoom-controls/);
        assert.match(
            componentSource,
            /\(!isPreviewOpen && !activeBurstGroup\)[\s\S]*?previewScale <= 1/
        );
    });

    await test("previews the visible Library when no temporary selection exists", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.match(
            componentSource,
            /selectedPhotoIds\.size\s*\?\s*visiblePhotos\.filter\([\s\S]*?:\s*visiblePhotos/
        );
        assert.match(
            componentSource,
            /if \(!previewPhotos\.length\) return;[\s\S]*?previewSelectedSet\(\)/
        );
    });

    await test("uses the approved compact comparison, unrated and five-star filter", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.match(componentSource, /PHOTO_RATING_COMPARISON_OPTIONS/);
        assert.match(componentSource, /photo-rating-unrated/);
        assert.match(componentSource, /photo-rating-stars/);
        assert.doesNotMatch(componentSource, /PHOTO_RATING_FILTER_OPTIONS/);
    });

    await test("keeps List headers visible and wires approved sortable columns", async () => {
        const gridSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/ThumbnailGrid.jsx"),
            "utf8"
        );
        const styleSource = fs.readFileSync(
            path.join(process.cwd(), "src/styles.css"),
            "utf8"
        );
        for (const field of ["name", "created", "type", "rating", "camera", "event"]) {
            assert.match(gridSource, new RegExp(`\\[\\"${field}\\"`));
        }
        assert.match(gridSource, /onClick=\{\(\) => onSortChange\?\.\(field\)\}/);
        assert.match(styleSource, /\.photo-list-header\s*\{[\s\S]*?flex:\s*0 0 28px;/);
    });

    await test("accepts selected photo drops on persistent event targets", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.match(componentSource, /const handleEventDrop = useCallback/);
        assert.match(componentSource, /onDrop=\{event => handleEventDrop\(event, chapter\.chapterId\)\}/);
        assert.match(componentSource, /App\.assignPhotosToEventChapter\(chapterId, targets\)/);
    });

    await test("shows dynamic Single and Burst photo types plus collapsible file properties", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.match(componentSource, /label: "Single Photos"/);
        assert.match(componentSource, /label: "Burst Frames"/);
        assert.match(componentSource, /selectedPhotoKindKeys/);
        assert.match(componentSource, /File Properties/);
        assert.match(componentSource, /aria-expanded=\{inspectorFileOpen\}/);
    });

    await test("persists bounded thumbnail size and wires the bottom size control", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.strictEqual(normalizePhotoBrowserPreferences({}).thumbnailSize, 104);
        assert.strictEqual(normalizePhotoBrowserPreferences({ thumbnailSize: 12 }).thumbnailSize, 84);
        assert.strictEqual(normalizePhotoBrowserPreferences({ thumbnailSize: 999 }).thumbnailSize, 144);
        assert.match(componentSource, /photo-thumbnail-size-control/);
        assert.match(componentSource, /thumbnailSize=\{preferences\.thumbnailSize\}/);
    });

    await test("reconciles story-order cache when photos are removed from source", async () => {
        const state = fixture();
        state.service.reconcilePhotoStoryOrderCache(state.photos.slice(0, 2));
        assert.deepStrictEqual(
            state.service.getPhotoStoryOrder().items,
            state.initialStoryOrder.items.slice(0, 2)
        );
        assert.deepStrictEqual(
            state.metadata().photoStoryOrder,
            state.initialStoryOrder
        );
    });

    await test("persists story-order move and rolls back on persistence failure", async () => {
        const state = fixture();
        await state.service.updatePhotoStoryOrder(
            state.photos[0],
            state.photos[2],
            [state.photos[0]]
        );
        const previous = state.service.getPhotoStoryOrder();
        const moved = await state.service.updatePhotoStoryOrder(
            state.photos[0],
            state.photos[2],
            [state.photos[0]]
        );
        assert.deepStrictEqual(
            moved.items,
            [state.initialStoryOrder.items[1], state.initialStoryOrder.items[0], state.initialStoryOrder.items[2]]
        );
        assert.strictEqual(state.saved.at(-1).options.reason, "PHOTO_STORY_ORDER_UPDATE");

        state.fail(true);
        await assert.rejects(
            () => state.service.updatePhotoStoryOrder(
                state.photos[1],
                state.photos[2],
                [state.photos[1]]
            ),
            /Injected save failure/
        );
        assert.deepStrictEqual(
            state.service.getPhotoStoryOrder().items,
            previous.items
        );
        assert.deepStrictEqual(
            state.metadata().photoStoryOrder.items,
            previous.items
        );
    });

    await test("creates, renames, assigns and removes photos in event chapters", async () => {
        const state = fixture();
        const created = await state.service.createPhotoEventChapter([state.photos[0]]);
        const [chapter] = created.items;
        assert.strictEqual(created.items.length, 1);
        assert.deepStrictEqual(
            chapter.photoKeys,
            [state.initialStoryOrder.items[0]]
        );

        const renamed = await state.service.renamePhotoEventChapter(
            chapter.chapterId,
            "Wedding Day"
        );
        assert.strictEqual(renamed.items[0].name, "Wedding Day");

        const assigned = await state.service.assignPhotosToEventChapter(
            chapter.chapterId,
            [state.photos[1], state.photos[2]]
        );
        assert.deepStrictEqual(
            assigned.items[0].photoKeys,
            [...state.initialStoryOrder.items]
        );

        const removed = await state.service.removePhotosFromEventChapters([
            state.photos[1]
        ]);
        assert.deepStrictEqual(
            removed.items[0].photoKeys,
            [state.initialStoryOrder.items[0], state.initialStoryOrder.items[2]]
        );

        const emptied = await state.service.removePhotosFromEventChapters([
            state.photos[0],
            state.photos[2]
        ]);
        const deleted = await state.service.deleteEmptyPhotoEventChapter(
            chapter.chapterId
        );
        assert.strictEqual(deleted.items.length, 0);

        assert.strictEqual(state.saved.at(-1).options.reason, "PHOTO_EVENT_CHAPTER_DELETE");
    });

    await test("restores event chapters for undo and rolls back a failed restore", async () => {
        const state = fixture();
        const empty = state.service.getPhotoEventChapters();
        await state.service.createPhotoEventChapter([state.photos[0]]);
        const created = state.service.getPhotoEventChapters();
        const restored = await state.service.savePhotoEventChapters(
            empty,
            "PHOTO_LIBRARY_EVENT_UNDO"
        );
        assert.strictEqual(restored.items.length, 0);
        assert.strictEqual(state.saved.at(-1).options.reason, "PHOTO_LIBRARY_EVENT_UNDO");

        state.fail(true);
        await assert.rejects(
            () => state.service.savePhotoEventChapters(
                created,
                "PHOTO_LIBRARY_EVENT_REDO"
            ),
            /Injected save failure/
        );
        assert.deepStrictEqual(state.service.getPhotoEventChapters(), restored);
    });

    await test("folder remove persists reset story-order and event chapter state", async () => {
        const state = fixture();
        await state.service.createPhotoEventChapter([state.photos[0], state.photos[1]]);
        await state.service.updatePhotoStoryOrder(state.photos[1], state.photos[2], [state.photos[1]]);
        await state.service.removePhotos();
        const lastSave = state.saved.at(-1);
        assert.deepStrictEqual(lastSave.values.photoCount, 0);
        assert.deepStrictEqual(lastSave.values.photoStoryOrder, normalizePhotoStoryOrder());
        assert.deepStrictEqual(
            lastSave.values.photoEventChapters,
            normalizePhotoEventChapters()
        );
        assert.deepStrictEqual(state.service.getPhotoStoryOrder(), normalizePhotoStoryOrder());
        assert.deepStrictEqual(state.service.getPhotoEventChapters(), normalizePhotoEventChapters());
    });

    await test("uses included-by-default review semantics without losing legacy KEEP data", async () => {
        const photos = fixture().photos;
        let decisions = updatePhotoDecision({}, photos[0], {
            culling: CullingStatus.KEEP
        });
        decisions = updatePhotoDecision(decisions, photos[1], {
            culling: CullingStatus.REJECT
        });
        const lookup = createPhotoDecisionLookup(decisions);
        assert.deepStrictEqual(
            filterPhotosByCulling(
                photos,
                CullingFilterMode.INCLUDED,
                lookup
            ).map(photo => photo.id),
            [photos[0].id, photos[2].id]
        );
        assert.deepStrictEqual(
            summarizeCulling(photos, lookup).included,
            2
        );
        assert.strictEqual(lookup(photos[0]).culling, CullingStatus.KEEP);
    });

    await test("assigns stable automatic C-number camera identities", async () => {
        const photos = [
            { id: "b", cameraMake: "Nikon", cameraModel: "Z8" },
            { id: "a", cameraMake: "Canon", cameraModel: "R5" },
            { id: "c", cameraMake: "Canon", cameraModel: "R5" }
        ];
        const identity = createCameraIdentityLookup(photos);
        assert.strictEqual(identity(photos[1]).tag, "C1");
        assert.strictEqual(identity(photos[2]).tag, "C1");
        assert.strictEqual(identity(photos[0]).tag, "C2");
        assert.notStrictEqual(identity(photos[0]).color, identity(photos[1]).color);
    });

    await test("invalidates temporal grouping when asynchronous metadata mutates photo models", async () => {
        const photos = [
            { id: "burst-a", dateTaken: null },
            { id: "burst-b", dateTaken: null },
            { id: "burst-c", dateTaken: null }
        ];
        const before = createPhotoGroupingRevision(photos);
        assert.strictEqual(groupPhotosByBurst(photos).length, 0);
        photos.forEach((photo, index) => {
            photo.dateTaken = 1_700_000_000_000 + index * 250;
        });
        const after = createPhotoGroupingRevision(photos);
        assert.notStrictEqual(after, before);
        assert.strictEqual(groupPhotosByBurst(photos).length, 1);
    });

    await test("supports professional rating operators with legacy preference compatibility", async () => {
        const photos = [0, 1, 3, 5].map(rating => ({
            id: `rating-${rating}`,
            name: `rating-${rating}.jpg`,
            rating
        }));
        assert.strictEqual(
            normalizePhotoBrowserPreferences({ minimumRating: 3 }).ratingFilter.mode,
            "atLeast"
        );
        assert.deepStrictEqual(
            queryPhotoBrowser(photos, {
                ratingFilter: { mode: "exact", value: 3 }
            }).photos.map(photo => photo.rating),
            [3]
        );
        assert.deepStrictEqual(
            queryPhotoBrowser(photos, {
                ratingFilter: { mode: "atMost", value: 1 }
            }).photos.map(photo => photo.rating),
            [0, 1]
        );
        assert.deepStrictEqual(
            queryPhotoBrowser(photos, {
                ratingFilter: { mode: "unrated", value: 0 }
            }).photos.map(photo => photo.rating),
            [0]
        );
    });

    await test("supports replace, toggle, range and additive range selection deterministically", async () => {
        const photos = [1, 2, 3, 4, 5].map(number => ({
            id: `p${number}`,
            selected: false
        }));
        const selection = new SelectionEngine({ getPhotos: () => photos });
        selection.setOrderedPhotos(photos);
        selection.handleClick(photos[1]);
        selection.handleClick(photos[3], { shiftKey: true });
        assert.deepStrictEqual([...selection.selectedIds()], ["p2", "p3", "p4"]);
        selection.handleClick(photos[0], { metaKey: true, shiftKey: true });
        assert.deepStrictEqual([...selection.selectedIds()], ["p2", "p3", "p4", "p1"]);
        selection.handleClick(photos[2], { ctrlKey: true });
        assert.deepStrictEqual([...selection.selectedIds()], ["p2", "p4", "p1"]);
        selection.replace(["p5", "missing"], "p5");
        assert.deepStrictEqual([...selection.selectedIds()], ["p5"]);
    });

    await test("undoes and redoes mixed Library actions in chronological order", async () => {
        const history = new PhotoLibraryHistory({ limit: 4 });
        const current = {
            [PhotoLibraryHistoryKind.SELECTION]: ["p3"],
            [PhotoLibraryHistoryKind.DECISION]: { version: 2 },
            [PhotoLibraryHistoryKind.EVENT]: { version: 2 }
        };

        history.push(PhotoLibraryHistoryKind.SELECTION, ["p1"]);
        history.push(PhotoLibraryHistoryKind.DECISION, { version: 1 });
        history.push(PhotoLibraryHistoryKind.EVENT, { version: 1 });

        const eventUndo = history.undo(kind => current[kind]);
        assert.strictEqual(eventUndo.kind, PhotoLibraryHistoryKind.EVENT);
        assert.deepStrictEqual(eventUndo.snapshot, { version: 1 });
        current[eventUndo.kind] = eventUndo.snapshot;

        const decisionUndo = history.undo(kind => current[kind]);
        assert.strictEqual(decisionUndo.kind, PhotoLibraryHistoryKind.DECISION);
        assert.deepStrictEqual(decisionUndo.snapshot, { version: 1 });
        current[decisionUndo.kind] = decisionUndo.snapshot;

        const decisionRedo = history.redo(kind => current[kind]);
        assert.strictEqual(decisionRedo.kind, PhotoLibraryHistoryKind.DECISION);
        assert.deepStrictEqual(decisionRedo.snapshot, { version: 2 });
        current[decisionRedo.kind] = decisionRedo.snapshot;

        history.push(PhotoLibraryHistoryKind.SELECTION, ["p2"]);
        assert.strictEqual(history.redo(kind => current[kind]), null);
    });

    await test("deduplicates identical selection checkpoints and enforces its history limit", async () => {
        const history = new PhotoLibraryHistory({ limit: 2 });
        const sameSelection = (left, right) =>
            left.length === right.length &&
            left.every((id, index) => id === right[index]);

        assert.strictEqual(history.push(
            PhotoLibraryHistoryKind.SELECTION,
            ["p1"],
            { equals: sameSelection }
        ), true);
        assert.strictEqual(history.push(
            PhotoLibraryHistoryKind.SELECTION,
            ["p1"],
            { equals: sameSelection }
        ), false);
        history.push(PhotoLibraryHistoryKind.DECISION, { version: 1 });
        history.push(PhotoLibraryHistoryKind.EVENT, { version: 1 });
        assert.strictEqual(history.undoStack.length, 2);
        assert.strictEqual(history.undoStack[0].kind, PhotoLibraryHistoryKind.DECISION);
    });

    await test("applies multi-pick burst review and rejects only unselected frames", async () => {
        const photos = [0, 1, 2, 3, 4].map(index => ({
            id: `burst-${index}`,
            name: `burst-${index}.jpg`,
            file: { nativePath: `/photos/burst-${index}.jpg` },
            dateTaken: 1000 + index * 200,
            qualityScore: index === 2 ? 0.95 : 0.5
        }));
        const bursts = groupPhotosByBurst(photos, 3000);
        const result = applyBurstReview({
            value: normalizePhotoBurstReviews(),
            photos,
            bursts,
            groupId: bursts[0].groupId,
            selectedPhotos: [photos[1], photos[2]],
            decisions: {},
            updateDecisionFn: updatePhotoDecision,
            appliedAt: "2026-09-04T00:00:00.000Z"
        });
        const lookup = createPhotoDecisionLookup(result.decisions);
        assert.strictEqual(result.reviews.items[0].reviewed, true);
        assert.strictEqual(result.reviews.items[0].selectedPhotoKeys.length, 2);
        assert.strictEqual(lookup(photos[0]).culling, CullingStatus.REJECT);
        assert.notStrictEqual(lookup(photos[1]).culling, CullingStatus.REJECT);
        assert.notStrictEqual(lookup(photos[2]).culling, CullingStatus.REJECT);
        assert.strictEqual(lookup(photos[4]).culling, CullingStatus.REJECT);
    });

    console.info(
        `ALB-137 slice 1 persistence tests complete: ${assertions} assertions.`
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
