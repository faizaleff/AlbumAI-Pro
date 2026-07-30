import assert from "assert";

import PhotoWorkspaceService, {
    PhotoFolderChangeStatus
} from "../src/services/PhotoWorkspaceService";
import {
    isBrowserRenderableImage
} from "../src/services/FolderService";

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
