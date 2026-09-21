import assert from "assert";

import PhotoWorkspaceService, {
    PhotoFolderChangeStatus,
    remapAlbumPhotoReferences
} from "../src/services/PhotoWorkspaceService";
import {
    importPhotoFolder,
    isBrowserRenderableImage
} from "../src/services/FolderService";
import {
    canConfirmPhotoFolderChange,
    canStartPhotoFolderChange,
    createIdlePhotoFolderChangeState,
    photoFolderChangeMessage,
    photoFolderChangeCommitOptions,
    photoFolderChangePreparationFailureState,
    upgradePhotoFolderChangeForRecovery,
    shouldResetPhotoPreview
} from "../src/components/photoFolderChangeMessages";
import {
    readCurrentRecoveryState,
    recoveryPanelStateKey
} from "../src/components/recoveryPanelState";

const silentPerformance = {
    beginFolderLoad() {},
    markPickerComplete() {},
    markPublishRequested() {},
    recordPersistence() {},
    trace() {},
    timestamp: () => Date.now()
};

function folder(name, nativePath = `/${name}`) {
    return {
        name,
        nativePath,
        async getEntries() {
            return [];
        }
    };
}

function staged(candidate, {
    totalFiles = 1,
    recognizedImages = 1,
    browserRenderableImages = 1,
    images = [{ id: `${candidate.name}-1`, name: "one.jpg" }]
} = {}) {
    return {
        folder: candidate,
        images,
        statistics: {
            totalFiles,
            recognizedImages,
            browserRenderableImages,
            unsupportedRecognizedImages:
                recognizedImages - browserRenderableImages
        }
    };
}

function harness({
    sourceFolder = folder("old"),
    initialPhotos = [{ id: "old-1", name: "old.jpg" }],
    importFolder = async candidate => staged(candidate),
    token = "persistent-token",
    saveFailure = null,
    clearFailure = null,
    initialBatchRecovery = null
} = {}) {
    const library = {
        photos: initialPhotos,
        loadCalls: 0,
        getPhotos() {
            return this.photos;
        },
        load(photos) {
            this.loadCalls++;
            this.photos = photos;
        }
    };
    const selection = {
        clearCalls: 0,
        clear() {
            this.clearCalls++;
        },
        retainAvailable() {}
    };
    const project = {
        metadata: {
            name: "Project",
            photoCount: initialPhotos.length,
            photoSource: {
                name: sourceFolder.name,
                token: "old-token"
            },
            templateRegistry: [{ id: "template-1" }],
            batchRecovery: initialBatchRecovery,
            updatedAt: "before"
        },
        workspace: {
            cache: {
                metadata: {
                    async createFile() {
                        return { async write() {} };
                    }
                }
            }
        }
    };
    const projectEngine = {
        isOpen: () => true,
        getProject: () => ({
            metadata: { ...project.metadata },
            workspace: project.workspace
        }),
        updateMetadata(values) {
            project.metadata = {
                ...project.metadata,
                ...values
            };
            return this.getProject();
        }
    };
    const saves = [];
    const projectService = {
        async saveProject(values, options) {
            projectEngine.updateMetadata({
                ...values,
                updatedAt: "during-save"
            });
            saves.push({ values, options });
            if (saveFailure) throw saveFailure;
            return projectEngine.getProject();
        }
    };
    const lifecycle = {
        clears: [],
        activations: [],
        invalidatePhoto() {},
        hasCachedThumbnails: () => false,
        restoreCachedThumbnail() {},
        async clear(options) {
            this.clears.push(options);
            if (clearFailure) throw clearFailure;
        },
        activateWorkspace(generation) {
            this.activations.push(generation);
        }
    };
    const queue = {
        clears: [],
        activations: [],
        batches: [],
        clear(options) {
            this.clears.push(options);
        },
        activateGeneration(generation) {
            this.activations.push(generation);
        },
        addBatch(photos, priority) {
            this.batches.push({ photos, priority });
        },
        addPriority() {},
        setVisible() {},
        setViewport() {}
    };
    const refresh = {
        calls: 0,
        refresh() {
            this.calls++;
        }
    };
    let tokenCalls = 0;
    const service = new PhotoWorkspaceService({
        library,
        selection,
        projectEngine,
        projectService,
        importFolder,
        thumbnailService: lifecycle,
        thumbnailQueue: queue,
        refreshService: refresh,
        performance: silentPerformance,
        localFileSystem: {
            async getFolder() {
                return null;
            },
            async createPersistentToken() {
                tokenCalls++;
                if (token instanceof Error) throw token;
                return token;
            }
        }
    });
    // Transaction tests isolate background inspection; its phase publications
    // and cache writes have dedicated metadata tests.
    const metadataStarts = [];
    service.startMetadataExtraction = (photos, generation) => {
        metadataStarts.push({ photos, generation });
        return Promise.resolve();
    };
    service.sourceFolder = sourceFolder;
    return {
        service,
        metadataStarts,
        library,
        selection,
        project,
        saves,
        lifecycle,
        queue,
        refresh,
        tokenCalls: () => tokenCalls
    };
}

async function run() {
    let count = 0;
    async function test(name, callback) {
        await callback();
        count++;
        console.log(`PASS ${name}`);
    }

    await test("browser-renderable classification matches embedded JPEG support", async () => {
        assert.strictEqual(
            isBrowserRenderableImage("portrait.JPG"),
            true
        );
        assert.strictEqual(
            isBrowserRenderableImage({ name: "portrait.jpeg" }),
            true
        );
        assert.strictEqual(
            isBrowserRenderableImage("portrait.png"),
            false
        );
    });

    await test("UI status contract maps failures and resets Preview only after replacement", async () => {
        const statuses = [
            PhotoFolderChangeStatus.EMPTY_FOLDER,
            PhotoFolderChangeStatus.UNSUPPORTED_ONLY,
            PhotoFolderChangeStatus.INACCESSIBLE,
            PhotoFolderChangeStatus.TOKEN_FAILURE,
            PhotoFolderChangeStatus.SAVE_FAILURE,
            PhotoFolderChangeStatus.SUPERSEDED,
            PhotoFolderChangeStatus.BLOCKED_ACTIVE_BATCH,
            PhotoFolderChangeStatus.RECOVERY_DECISION_REQUIRED,
            PhotoFolderChangeStatus.INVALID_TRANSACTION,
            PhotoFolderChangeStatus.COMMIT_FAILURE
        ];
        statuses.forEach(status => {
            assert.ok(photoFolderChangeMessage({ status }).length > 0);
        });
        assert.ok(photoFolderChangeMessage({
            status: PhotoFolderChangeStatus.SAME_FOLDER
        }).includes("refreshed"));
        assert.strictEqual(
            shouldResetPhotoPreview({ status: PhotoFolderChangeStatus.SUCCESS }),
            true
        );
        [
            PhotoFolderChangeStatus.CANCELLED,
            PhotoFolderChangeStatus.SAME_FOLDER,
            PhotoFolderChangeStatus.SAVE_FAILURE,
            PhotoFolderChangeStatus.SUPERSEDED
        ].forEach(status => assert.strictEqual(
            shouldResetPhotoPreview({ status }),
            false
        ));
    });

    await test("EMPTY_FOLDER prepare result releases the UI and shows an external status message", async () => {
        const result = {
            status: PhotoFolderChangeStatus.EMPTY_FOLDER,
            transactionId: 44
        };
        assert.strictEqual(
            photoFolderChangeMessage(result),
            "The selected folder contains no supported photos."
        );
        assert.deepStrictEqual(
            photoFolderChangePreparationFailureState(result),
            {
                busy: false,
                prepared: null,
                clearRecovery: false,
                message: "The selected folder contains no supported photos.",
                error: null
            }
        );
    });

    await test("Change Photo Folder supports both loaded and disconnected existing workspaces", async () => {
        const idle = { busy: false, prepared: null };
        assert.strictEqual(canStartPhotoFolderChange({
            projectId: "project-a",
            folderLoaded: false,
            hasFolderReference: false,
            isLoading: false,
            photoFolderChange: idle
        }), false);
        assert.strictEqual(canStartPhotoFolderChange({
            projectId: "project-a",
            folderLoaded: false,
            hasFolderReference: true,
            isLoading: false,
            photoFolderChange: idle
        }), true);
        assert.strictEqual(canStartPhotoFolderChange({
            projectId: "project-a",
            folderLoaded: true,
            isLoading: false,
            photoFolderChange: idle
        }), true);
        assert.strictEqual(canStartPhotoFolderChange({
            projectId: null,
            folderLoaded: false,
            isLoading: false,
            photoFolderChange: idle
        }), false);
    });

    await test("project workspace release clears transient folder-change feedback and confirmation", async () => {
        const stale = {
            busy: true,
            prepared: { transactionId: 45, folderName: "candidate" },
            clearRecovery: true,
            message: "The selected folder contains no supported photos.",
            error: "stale error"
        };
        const cleared = createIdlePhotoFolderChangeState();
        assert.notDeepStrictEqual(cleared, stale);
        assert.deepStrictEqual(cleared, {
            busy: false,
            prepared: null,
            clearRecovery: false,
            message: null,
            error: null
        });
        assert.strictEqual(canStartPhotoFolderChange({
            projectId: null,
            folderLoaded: false,
            isLoading: false,
            photoFolderChange: cleared
        }), false);
        assert.strictEqual(canStartPhotoFolderChange({
            projectId: "project-b",
            folderLoaded: true,
            isLoading: false,
            photoFolderChange: cleared
        }), true);
    });

    await test("album placements remap only unique filename matches after a folder move", async () => {
        const album = {
            sheets: [{
                id: "spread-1",
                slots: [
                    { slotId: "01", photoId: "/old/Reception/One.JPG", cropFocus: "top" },
                    { slotId: "02", photoId: "/old/Reception/Two.JPG", cropFocus: "center" },
                    { slotId: "03", photoId: "/old/Reception/duplicate.jpg", cropFocus: "center" },
                    { slotId: "04", photoId: "/old/Reception/missing.jpg", cropFocus: "bottom" }
                ]
            }]
        };
        const result = remapAlbumPhotoReferences(album, [
            { id: "/new/One.JPG", name: "One.JPG" },
            { id: "/new/Two.JPG", name: "Two.JPG" },
            { id: "/new/a/duplicate.jpg", name: "duplicate.jpg" },
            { id: "/new/b/duplicate.jpg", name: "duplicate.jpg" }
        ]);

        assert.strictEqual(result.changed, true);
        assert.strictEqual(result.remapped, 2);
        assert.strictEqual(result.album.sheets[0].slots[0].photoId, "/new/One.JPG");
        assert.strictEqual(result.album.sheets[0].slots[0].cropFocus, "top");
        assert.strictEqual(result.album.sheets[0].slots[1].photoId, "/new/Two.JPG");
        assert.strictEqual(result.album.sheets[0].slots[2].photoId, "/old/Reception/duplicate.jpg");
        assert.strictEqual(result.album.sheets[0].slots[3].photoId, "/old/Reception/missing.jpg");
        assert.strictEqual(album.sheets[0].slots[0].photoId, "/old/Reception/One.JPG",
            "the persisted input remains immutable until save");
    });

    await test("album placement repair refuses weak or encoded-basename guesses", async () => {
        const weak = {
            sheets: [{ slots: [{ slotId: "01", photoId: "/old/IMG_0001.JPG" }] }]
        };
        const weakResult = remapAlbumPhotoReferences(weak, [
            { id: "/different-shoot/IMG_0001.JPG", name: "IMG_0001.JPG" }
        ]);
        assert.strictEqual(weakResult.changed, false);
        assert.strictEqual(weakResult.album, weak);

        const encoded = {
            sheets: [{ slots: [
                { slotId: "01", photoId: "/old/A%20B.jpg" },
                { slotId: "02", photoId: "/old/C%2FD.jpg" }
            ] }]
        };
        const encodedResult = remapAlbumPhotoReferences(encoded, [
            { id: "/new/A B.jpg", name: "A B.jpg" },
            { id: "/new/D.jpg", name: "D.jpg" }
        ]);
        assert.strictEqual(encodedResult.changed, false);
        assert.strictEqual(encodedResult.album, encoded);
    });

    await test("UI upgrades a prepared candidate when recovery becomes required before commit", async () => {
        const prepared = {
            status: PhotoFolderChangeStatus.PREPARED,
            transactionId: 42,
            folderName: "new",
            recoveryDecisionRequired: false
        };
        const staged = {
            busy: true,
            prepared,
            clearRecovery: true,
            error: null
        };
        const upgraded = upgradePhotoFolderChangeForRecovery(staged, {
            status: PhotoFolderChangeStatus.RECOVERY_DECISION_REQUIRED,
            recoveryClassification: "interrupted"
        });
        assert.notStrictEqual(upgraded, staged);
        assert.strictEqual(upgraded.prepared.transactionId, 42);
        assert.strictEqual(upgraded.prepared.folderName, "new");
        assert.strictEqual(upgraded.prepared.recoveryDecisionRequired, true);
        assert.strictEqual(upgraded.clearRecovery, false);
        assert.strictEqual(upgraded.busy, false);
        assert.strictEqual(canConfirmPhotoFolderChange(upgraded), false);
        assert.deepStrictEqual(photoFolderChangeCommitOptions(upgraded), {
            clearRecovery: false
        });
        const acknowledged = { ...upgraded, clearRecovery: true };
        assert.strictEqual(canConfirmPhotoFolderChange(acknowledged), true);
        assert.deepStrictEqual(photoFolderChangeCommitOptions(acknowledged), {
            clearRecovery: true
        });
        assert.strictEqual(
            shouldResetPhotoPreview({
                status: PhotoFolderChangeStatus.RECOVERY_DECISION_REQUIRED
            }),
            false
        );
        const repeated = upgradePhotoFolderChangeForRecovery(acknowledged, {
            status: PhotoFolderChangeStatus.RECOVERY_DECISION_REQUIRED
        });
        assert.strictEqual(repeated.prepared.transactionId, 42);
        assert.strictEqual(repeated.clearRecovery, false);
        assert.strictEqual(
            shouldResetPhotoPreview({ status: PhotoFolderChangeStatus.SUCCESS }),
            true
        );
    });

    await test("successful replacement clears recovery metadata and the panel reads NONE immediately", async () => {
        const completedRecovery = {
            batchId: "completed-batch",
            lifecycle: "COMPLETED",
            templateOutcomes: [{ templateId: "one", status: "SUCCESS" }]
        };
        const state = harness({ initialBatchRecovery: completedRecovery });
        const prepared = await state.service.preparePhotoFolderChange(folder("new"));
        const result = await state.service.commitPreparedPhotoFolderChange(
            prepared,
            {
                projectValues: {
                    templateRegistry: [{ id: "template-1" }],
                    batchRecovery: null
                }
            }
        );
        assert.strictEqual(result.status, PhotoFolderChangeStatus.SUCCESS);
        assert.strictEqual(state.project.metadata.batchRecovery, null);

        let authoritativeState = {
            available: false,
            classification: "COMPLETED",
            snapshot: completedRecovery
        };
        let memoizedRecoveryState = null;
        let memoizedRecoveryKey = null;
        let visibleRecoveryTransitions = 0;
        const renderRecoveryState = () => {
            const current = readCurrentRecoveryState(() => authoritativeState);
            const key = recoveryPanelStateKey(current);
            const changed = !memoizedRecoveryKey || key.some(
                (value, index) => !Object.is(value, memoizedRecoveryKey[index])
            );
            if (changed) {
                memoizedRecoveryState = current;
                memoizedRecoveryKey = key;
                visibleRecoveryTransitions += 1;
            }
            return memoizedRecoveryState;
        };
        const firstRender = renderRecoveryState();
        assert.strictEqual(firstRender.snapshot.batchId, "completed-batch");
        assert.strictEqual(visibleRecoveryTransitions, 1);
        assert.strictEqual(
            renderRecoveryState(),
            firstRender,
            "fresh controller wrappers must retain stable panel identity"
        );
        assert.strictEqual(visibleRecoveryTransitions, 1);
        authoritativeState = null;
        const reloadedState = renderRecoveryState();
        assert.deepStrictEqual(
            reloadedState,
            {
                available: false,
                classification: "NONE",
                snapshot: null
            }
        );
        assert.strictEqual(visibleRecoveryTransitions, 2);
        assert.strictEqual(
            renderRecoveryState(),
            reloadedState,
            "cleared recovery must settle without another visible transition"
        );
        assert.strictEqual(visibleRecoveryTransitions, 2);

        const failing = harness({
            initialBatchRecovery: completedRecovery,
            saveFailure: new Error("disk full")
        });
        const failedPrepared =
            await failing.service.preparePhotoFolderChange(folder("failed"));
        const failedResult =
            await failing.service.commitPreparedPhotoFolderChange(
                failedPrepared,
                {
                    projectValues: {
                        templateRegistry: [{ id: "template-1" }],
                        batchRecovery: null
                    }
                }
            );
        assert.strictEqual(
            failedResult.status,
            PhotoFolderChangeStatus.SAVE_FAILURE
        );
        assert.strictEqual(
            failing.project.metadata.batchRecovery,
            completedRecovery
        );
        assert.strictEqual(
            readCurrentRecoveryState(() => ({
                available: false,
                classification: "COMPLETED",
                snapshot: failing.project.metadata.batchRecovery
            })).snapshot.batchId,
            "completed-batch"
        );
    });

    await test("prepare stages a valid folder without active mutation", async () => {
        const candidate = folder("new");
        const state = harness();
        const beforePhotos = state.library.getPhotos();
        const result =
            await state.service.preparePhotoFolderChange(candidate);
        assert.strictEqual(
            result.status,
            PhotoFolderChangeStatus.PREPARED
        );
        assert.strictEqual(state.service.sourceFolder.name, "old");
        assert.strictEqual(state.library.getPhotos(), beforePhotos);
        assert.strictEqual(state.selection.clearCalls, 0);
        assert.strictEqual(state.lifecycle.clears.length, 0);
        assert.strictEqual(state.saves.length, 0);
        assert.strictEqual(state.tokenCalls(), 0);
    });

    await test("classifies prepare failures and confirmed token failure", async () => {
        const cancelled = harness();
        assert.strictEqual(
            (await cancelled.service.preparePhotoFolderChange()).status,
            PhotoFolderChangeStatus.CANCELLED
        );

        const empty = harness({
            importFolder: async candidate => staged(candidate, {
                totalFiles: 0,
                recognizedImages: 0,
                browserRenderableImages: 0,
                images: []
            })
        });
        assert.strictEqual(
            (await empty.service.preparePhotoFolderChange(folder("empty"))).status,
            PhotoFolderChangeStatus.EMPTY_FOLDER
        );

        const unsupported = harness({
            importFolder: async candidate => staged(candidate, {
                totalFiles: 2,
                recognizedImages: 1,
                browserRenderableImages: 0,
                images: [{ id: "png", name: "one.png" }]
            })
        });
        assert.strictEqual(
            (await unsupported.service.preparePhotoFolderChange(folder("png"))).status,
            PhotoFolderChangeStatus.UNSUPPORTED_ONLY
        );

        const inaccessible = harness({
            importFolder: async () => {
                throw new Error("denied");
            }
        });
        assert.strictEqual(
            (await inaccessible.service.preparePhotoFolderChange(folder("denied"))).status,
            PhotoFolderChangeStatus.INACCESSIBLE
        );

        const tokenFailure = harness({
            token: new Error("token denied")
        });
        const tokenPrepared =
            await tokenFailure.service
                .preparePhotoFolderChange(folder("token"));
        assert.strictEqual(
            (
                await tokenFailure.service
                    .commitPreparedPhotoFolderChange(
                        tokenPrepared,
                        {
                            projectValues: {
                                templateRegistry: [],
                                batchRecovery: null
                            }
                        }
                    )
            ).status,
            PhotoFolderChangeStatus.TOKEN_FAILURE
        );
        assert.strictEqual(tokenFailure.saves.length, 0);
        assert.strictEqual(tokenFailure.lifecycle.clears.length, 0);
    });

    await test("save failure restores metadata and leaves runtime untouched", async () => {
        const state = harness({
            saveFailure: new Error("disk full")
        });
        const beforePhotos = state.library.getPhotos();
        const prepared =
            await state.service.preparePhotoFolderChange(folder("new"));
        const result =
            await state.service.commitPreparedPhotoFolderChange(
                prepared,
                {
                    projectValues: {
                        templateRegistry: [{ id: "template-1" }],
                        batchRecovery: null
                    }
                }
            );
        assert.strictEqual(
            result.status,
            PhotoFolderChangeStatus.SAVE_FAILURE
        );
        assert.strictEqual(state.service.sourceFolder.name, "old");
        assert.strictEqual(state.library.getPhotos(), beforePhotos);
        assert.strictEqual(state.selection.clearCalls, 0);
        assert.strictEqual(state.lifecycle.clears.length, 0);
        assert.strictEqual(state.project.metadata.photoSource.token, "old-token");
        assert.strictEqual(state.project.metadata.updatedAt, "before");
    });

    await test("successful commit persists before one runtime replacement", async () => {
        const nextPhotos = [
            { id: "new-1", name: "one.jpg" },
            { id: "new-2", name: "two.jpg" }
        ];
        const state = harness({
            importFolder: async candidate => staged(candidate, {
                totalFiles: 2,
                recognizedImages: 2,
                browserRenderableImages: 2,
                images: nextPhotos
            })
        });
        const prepared =
            await state.service.preparePhotoFolderChange(folder("new"));
        const result =
            await state.service.commitPreparedPhotoFolderChange(
                prepared,
                {
                    projectValues: {
                        templateRegistry: [{ id: "template-1" }],
                        batchRecovery: null
                    }
                }
            );
        assert.strictEqual(
            result.status,
            PhotoFolderChangeStatus.SUCCESS
        );
        assert.strictEqual(state.saves.length, 1, "folder transaction save count");
        assert.strictEqual(state.tokenCalls(), 1);
        assert.strictEqual(state.service.sourceFolder.name, "new");
        assert.strictEqual(state.library.getPhotos(), nextPhotos);
        assert.strictEqual(state.library.loadCalls, 1);
        assert.strictEqual(state.selection.clearCalls, 1);
        assert.strictEqual(state.lifecycle.clears.length, 1);
        assert.strictEqual(state.refresh.calls, 1, "one folder publication before background metadata");
        assert.strictEqual(state.metadataStarts.length, 1);
        assert.strictEqual(state.metadataStarts[0].photos, nextPhotos);
        assert.strictEqual(state.metadataStarts[0].generation, state.service.lifecycleGeneration);
        assert.strictEqual(state.project.metadata.photoSource.token, "persistent-token");
        assert.deepStrictEqual(
            state.project.metadata.templateRegistry,
            [{ id: "template-1" }]
        );
    });

    await test("lifecycle failure rolls project metadata back and keeps old workspace", async () => {
        const state = harness({
            clearFailure: new Error("scheduler clear failed")
        });
        const oldPhotos = state.library.getPhotos();
        const prepared =
            await state.service.preparePhotoFolderChange(folder("new"));
        const result =
            await state.service.commitPreparedPhotoFolderChange(
                prepared,
                {
                    projectValues: {
                        templateRegistry: [{ id: "template-1" }],
                        batchRecovery: null
                    }
                }
            );
        assert.strictEqual(
            result.status,
            PhotoFolderChangeStatus.COMMIT_FAILURE
        );
        assert.strictEqual(state.saves.length, 2);
        assert.strictEqual(state.service.sourceFolder.name, "old");
        assert.strictEqual(state.library.getPhotos(), oldPhotos);
        assert.strictEqual(state.project.metadata.photoSource.token, "old-token");
    });

    await test("same-folder refresh reuses runtime path without replacing token", async () => {
        const current = folder("old");
        const state = harness({ sourceFolder: current });
        const prepared =
            await state.service.preparePhotoFolderChange(current);
        assert.strictEqual(
            prepared.status,
            PhotoFolderChangeStatus.SAME_FOLDER
        );
        const result =
            await state.service.commitPreparedPhotoFolderChange(prepared);
        assert.strictEqual(
            result.status,
            PhotoFolderChangeStatus.SAME_FOLDER
        );
        assert.strictEqual(state.tokenCalls(), 0);
        assert.strictEqual(state.saves.length, 0);
        assert.strictEqual(
            state.lifecycle.clears[0].preserveCache,
            true
        );
        assert.strictEqual(
            state.project.metadata.photoSource.token,
            "old-token"
        );
    });

    await test("a newer preparation supersedes an unfinished scan", async () => {
        let resolveFirst;
        const firstScan = new Promise(resolve => {
            resolveFirst = resolve;
        });
        const first = folder("first");
        const second = folder("second");
        const state = harness({
            importFolder: candidate => (
                candidate === first
                    ? firstScan
                    : Promise.resolve(staged(candidate))
            )
        });
        const olderPromise =
            state.service.preparePhotoFolderChange(first);
        const newer =
            await state.service.preparePhotoFolderChange(second);
        resolveFirst(staged(first));
        const older = await olderPromise;
        assert.strictEqual(
            newer.status,
            PhotoFolderChangeStatus.PREPARED
        );
        assert.strictEqual(
            older.status,
            PhotoFolderChangeStatus.SUPERSEDED
        );
        assert.strictEqual(state.service.sourceFolder.name, "old");
    });

    await test("folder import maps UXP metadata onto photo models", async () => {
        const created = new Date("2026-01-02T03:04:05.000Z");
        const modified = new Date("2026-06-07T08:09:10.000Z");
        let metadataCalls = 0;
        const file = {
            isFile: true,
            name: "metadata.jpg",
            nativePath: "/photos/metadata.jpg",
            async getMetadata() {
                metadataCalls += 1;
                return {
                    size: 987654,
                    dateCreated: created,
                    dateModified: modified
                };
            }
        };

        const result = await importPhotoFolder({
            name: "photos",
            nativePath: "/photos",
            async getEntries() {
                return [file];
            }
        });

        assert.strictEqual(metadataCalls, 1);
        assert.strictEqual(result.images.length, 1);
        assert.strictEqual(result.images[0].fileSize, 987654);
        assert.strictEqual(result.images[0].created, created);
        assert.strictEqual(result.images[0].modified, modified);
    });

    await test("Add Folder retains old photos, assignments and decisions across refresh and reopen", async () => {
        const oldFolder = folder("original"), extra = folder("extra");
        const original = { id: "/original/one.jpg", name: "one.jpg", modified: 1 };
        const addition = { id: "/extra/one.jpg", name: "one.jpg", modified: 1 };
        oldFolder.getEntries = async () => [original];
        extra.getEntries = async () => [addition];
        const h = harness({ sourceFolder: oldFolder, initialPhotos: [original],
            importFolder: async candidate => staged(candidate, { images: await candidate.getEntries() }) });
        const album = { sheets: [{ id: "spread", assignments: [{ photoId: original.id, cropFocus: "top" }] }] };
        h.project.metadata.album = album;
        const tokens = new Map();
        h.service.localFileSystem.createPersistentToken = async candidate => {
            tokens.set(candidate.nativePath, candidate);
            return candidate.nativePath;
        };
        h.service.localFileSystem.getEntryForPersistentToken = async token => tokens.get(token);
        await h.service.updatePhotoDecision(original, { culling: "REJECT", rating: 4 });
        await h.service.addPhotoFolder(extra);
        assert.deepStrictEqual(h.library.getPhotos().map(photo => photo.id), [original.id, addition.id]);
        assert.strictEqual(h.library.getPhotos()[0], original);
        assert.strictEqual(h.selection.clearCalls, 0);
        assert.strictEqual(h.project.metadata.album, album);
        assert.strictEqual(h.project.metadata.photoSource.sources.length, 2);
        assert.strictEqual(h.service.getPhotoDecisions().items[0].culling, "REJECT");
        const decisions = JSON.stringify(h.service.getPhotoDecisions());
        await h.service.addPhotoFolder(extra);
        assert.strictEqual(h.library.getPhotos().length, 2, "same folder is not duplicated");
        assert.strictEqual(h.project.metadata.photoSource.sources.length, 2);
        await h.service.refreshPhotos();
        await h.service.persistencePromise;
        assert.strictEqual(h.library.getPhotos().length, 2);
        h.service.sourceFolder = null;
        const reopened = await h.service.resolveSourceFolder();
        h.library.load([]);
        await h.service.importPhotos(reopened, { persistFolderReference: false });
        await h.service.persistencePromise;
        assert.deepStrictEqual(h.library.getPhotos().map(photo => photo.id), [original.id, addition.id]);
        assert.strictEqual(JSON.stringify(h.service.getPhotoDecisions()), decisions);
        assert.strictEqual(h.project.metadata.album, album);
        tokens.delete(extra.nativePath);
        assert.strictEqual(await h.service.resolveSourceFolder(), null, "partial source hydration is refused");
    });

    await test("Add Folder cancellation, token and save failures leave the original library intact", async () => {
        for (const options of [{}, { token: new Error("token failed") }, { saveFailure: new Error("save failed") }]) {
            const h = harness(options);
            const photos = h.library.getPhotos();
            const before = JSON.stringify(h.project.metadata);
            if (!Object.keys(options).length) {
                assert.strictEqual(await h.service.addPhotoFolder(), null);
            } else {
                await assert.rejects(h.service.addPhotoFolder(folder("extra")), /Existing photos were kept/);
            }
            assert.strictEqual(h.library.getPhotos(), photos);
            for (const [key, value] of Object.entries(JSON.parse(before))) {
                assert.deepStrictEqual(h.project.metadata[key], value);
            }
            assert.ok(!h.project.metadata.photoStoryOrder?.items?.includes("extra-1"));
            assert.strictEqual(h.selection.clearCalls, 0);
        }
    });

    console.log(`ALB-043 service tests passed: ${count}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
