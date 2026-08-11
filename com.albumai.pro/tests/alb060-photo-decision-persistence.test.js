import assert from "assert";

import PhotoWorkspaceService from "../src/services/PhotoWorkspaceService";
import {
    createPhotoDecisionLookup,
    normalizePhotoDecisions
} from "../src/services/PhotoBrowserModel";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-060 Slice 2: ${name}`);
}

function fixture() {
    let metadata = {
        id: "project-one",
        name: "Project One",
        schemaVersion: 1,
        photoDecisions: normalizePhotoDecisions()
    };
    let failSave = false;
    const saved = [];
    const photos = [
        {
            id: "/photos/one.jpg",
            name: "one.jpg",
            file: { nativePath: "/photos/one.jpg" }
        },
        {
            id: "/photos/two.jpg",
            name: "two.jpg",
            file: { nativePath: "/photos/two.jpg" }
        }
    ];
    const projectEngine = {
        isOpen: () => true,
        getProject: () => ({ metadata }),
        updateMetadata: values => {
            metadata = { ...metadata, ...values };
        }
    };
    const projectService = {
        saveProject: async (values, options) => {
            if (failSave) {
                metadata = { ...metadata, ...values };
                throw new Error("Injected decision save failure.");
            }
            saved.push({ values, options });
            metadata = { ...metadata, ...values };
        }
    };
    const service = new PhotoWorkspaceService({
        library: {
            getPhotos: () => photos,
            load: () => {}
        },
        selection: {},
        projectEngine,
        projectService,
        localFileSystem: {},
        importFolder: async () => null,
        thumbnailService: {},
        thumbnailQueue: {},
        refreshService: {},
        performance: {}
    });
    return {
        service,
        photos,
        saved,
        metadata: () => metadata,
        setMetadata: value => { metadata = value; },
        fail: value => { failSave = value; }
    };
}

async function run() {
    await test("persists a normalized decision through the Photo owner", async () => {
        const state = fixture();
        const persisted = await state.service.updatePhotoDecision(
            state.photos[0],
            { rating: 4, favorite: true }
        );
        assert.deepStrictEqual(
            createPhotoDecisionLookup(persisted)(state.photos[0]),
            { rating: 4, favorite: true }
        );
        assert.strictEqual(state.saved.length, 1);
        assert.strictEqual(
            state.saved[0].options.reason,
            "PHOTO_DECISION_UPDATE"
        );
        assert.deepStrictEqual(state.metadata().photoDecisions, persisted);
    });

    await test("serializes rapid updates without losing fields", async () => {
        const state = fixture();
        const rating = state.service.updatePhotoDecision(
            state.photos[0],
            { rating: 5 }
        );
        const favourite = state.service.updatePhotoDecision(
            state.photos[0],
            { favorite: true }
        );
        await Promise.all([rating, favourite]);
        assert.strictEqual(state.saved.length, 2);
        assert.deepStrictEqual(
            createPhotoDecisionLookup(state.service.getPhotoDecisions())(
                state.photos[0]
            ),
            { rating: 5, favorite: true }
        );
    });

    await test("rolls the in-memory decision back after persistence failure", async () => {
        const state = fixture();
        await state.service.updatePhotoDecision(state.photos[0], { rating: 2 });
        const before = state.service.getPhotoDecisions();
        state.fail(true);
        await assert.rejects(
            state.service.updatePhotoDecision(state.photos[0], { rating: 5 }),
            /Injected decision save failure/
        );
        assert.deepStrictEqual(state.service.getPhotoDecisions(), before);
        assert.deepStrictEqual(state.metadata().photoDecisions, before);
    });

    await test("rejects a queued write after project identity changes", async () => {
        const state = fixture();
        const pending = state.service.updatePhotoDecision(
            state.photos[0],
            { favorite: true }
        );
        state.setMetadata({
            ...state.metadata(),
            id: "project-two",
            photoDecisions: normalizePhotoDecisions()
        });
        await assert.rejects(pending, error =>
            error?.code === "PHOTO_DECISION_PROJECT_CHANGED"
        );
        assert.strictEqual(state.saved.length, 0);
        assert.strictEqual(state.metadata().id, "project-two");
        assert.strictEqual(state.metadata().photoDecisions.items.length, 0);
    });

    console.info(
        `ALB-060 photo decision persistence tests complete: ${assertions} assertions.`
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
