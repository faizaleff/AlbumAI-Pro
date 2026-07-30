import assert from "assert";

import PhotoWorkspaceService, {
    PhotoFolderChangeStatus
} from "../src/services/PhotoWorkspaceService";
import {
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
    clearFailure = null
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
            batchRecovery: null,
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
    service.sourceFolder = sourceFolder;
    return {
        service,
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

    await test("Change Photo Folder is available only for an initialized photo workspace", async () => {
        const idle = { busy: false, prepared: null };
        assert.strictEqual(canStartPhotoFolderChange({
            projectId: "project-a",
            folderLoaded: false,
            isLoading: false,
            photoFolderChange: idle
        }), false);
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
        assert.strictEqual(state.saves.length, 1);
        assert.strictEqual(state.tokenCalls(), 1);
        assert.strictEqual(state.service.sourceFolder.name, "new");
        assert.strictEqual(state.library.getPhotos(), nextPhotos);
        assert.strictEqual(state.library.loadCalls, 1);
        assert.strictEqual(state.selection.clearCalls, 1);
        assert.strictEqual(state.lifecycle.clears.length, 1);
        assert.strictEqual(state.refresh.calls, 1);
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

    console.log(`ALB-043 service tests passed: ${count}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
