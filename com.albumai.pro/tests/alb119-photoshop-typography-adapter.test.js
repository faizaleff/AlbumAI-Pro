import assert from "assert";

import PhotoshopTypographyAdapter, {
    TypographyExecutionReason,
    TypographyExecutionStatus
} from "../src/typography/PhotoshopTypographyAdapter";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-119: ${name}`);
}

function plan(steps = []) {
    return {
        schemaVersion: 1,
        templateId: "template-01",
        state: "READY",
        reasonCodes: [],
        steps
    };
}

function layer(id, overrides = {}) {
    return {
        id,
        kind: "textLayer",
        visible: true,
        locked: false,
        ...overrides
    };
}

function setup({ layers = [layer(7)], fonts = [], batchFailureAt = null,
    verificationText = null, activeDocumentId = 41, history = true } = {}) {
    const document = { id: 41, layers: [] };
    const state = {
        activeDocumentId,
        activated: 0,
        scanned: 0,
        modalCalls: 0,
        commands: [],
        suspended: [],
        resumed: []
    };
    const byId = new Map(layers.map(item => [item.id, item]));
    const documentManager = {
        byId(id) { return id === 41 ? document : null; },
        get activeId() { return state.activeDocumentId; },
        async activate(item) {
            state.activated += 1;
            state.activeDocumentId = item.id;
        }
    };
    const layerManager = {
        scan(item) {
            assert.strictEqual(item, document);
            state.scanned += 1;
        },
        byId(id) { return byId.get(id) || null; }
    };
    const batchPlay = {
        async execute(commands) {
            const descriptor = commands[0];
            state.commands.push(descriptor);
            if (descriptor?._target?.[0]?._id === batchFailureAt) {
                throw new Error("Photoshop rejected command");
            }
            return [{}];
        },
        async command(descriptor) {
            state.commands.push(descriptor);
            const id = descriptor._target[1]._id;
            const set = [...state.commands].reverse().find(command =>
                command._obj === "set" && command._target[0]._id === id
            );
            return { textKey: verificationText ?? set?.to?.textKey };
        }
    };
    const hostControl = history ? {
        async suspendHistory(options) {
            state.suspended.push(options);
            return "history-1";
        },
        async resumeHistory(id, commit) {
            state.resumed.push({ id, commit });
        }
    } : {};
    const executeModal = {
        async run(callback, options) {
            state.modalCalls += 1;
            state.modalOptions = options;
            return callback({ hostControl });
        }
    };
    const fontCatalog = {
        async hasExact(name) { return fonts.includes(name); }
    };

    return {
        state,
        adapter: new PhotoshopTypographyAdapter({
            documentManager,
            layerManager,
            batchPlay,
            executeModal,
            fontCatalog
        })
    };
}

async function run() {
    await test("rejects a non-ready plan before touching Photoshop", async () => {
        const { adapter, state } = setup();
        const result = await adapter.execute({
            plan: { state: "BLOCKED", steps: [] },
            expectedDocumentId: 41
        });

        assert.strictEqual(result.status, TypographyExecutionStatus.FAILED);
        assert.strictEqual(result.reasonCode, TypographyExecutionReason.PLAN_NOT_READY);
        assert.strictEqual(state.scanned, 0);
        assert.strictEqual(state.modalCalls, 0);
        assert(Object.isFrozen(result));
    });

    await test("preflights the entire exact target set before mutation", async () => {
        const { adapter, state } = setup({ layers: [layer(7)] });
        const result = await adapter.execute({
            plan: plan([
                { layerId: 7, role: "TITLE", text: "Title", preset: null },
                { layerId: 8, role: "CAPTION", text: "Caption", preset: null }
            ]),
            expectedDocumentId: 41
        });

        assert.strictEqual(result.reasonCode, TypographyExecutionReason.TARGET_NOT_FOUND);
        assert.strictEqual(state.modalCalls, 0);
        assert.deepStrictEqual(state.commands, []);
    });

    await test("activates the expected document and fails closed for unavailable fonts", async () => {
        const { adapter, state } = setup({ activeDocumentId: 99 });
        const result = await adapter.execute({
            plan: plan([{
                layerId: 7,
                role: "TITLE",
                text: "Title",
                preset: { fontFamily: "MissingPS", fontSize: null, color: null, alignment: null }
            }]),
            expectedDocumentId: 41
        });

        assert.strictEqual(state.activated, 1);
        assert.strictEqual(result.reasonCode, TypographyExecutionReason.FONT_UNAVAILABLE);
        assert.strictEqual(state.modalCalls, 0);
    });

    await test("applies two exact layers in one committed undo transaction", async () => {
        const { adapter, state } = setup({
            layers: [layer(7), layer(8)],
            fonts: ["AvailablePS"]
        });
        const result = await adapter.execute({
            plan: plan([
                {
                    layerId: 7,
                    role: "TITLE",
                    text: "Album Title",
                    preset: {
                        fontFamily: "AvailablePS",
                        fontSize: 36,
                        color: { red: 10, green: 20, blue: 30 },
                        alignment: "center"
                    }
                },
                { layerId: 8, role: "CAPTION", text: "Caption", preset: null }
            ]),
            expectedDocumentId: 41
        });

        assert.strictEqual(result.status, TypographyExecutionStatus.SUCCESS);
        assert.deepStrictEqual(result.completedLayerIds, [7, 8]);
        assert.strictEqual(state.modalCalls, 1);
        assert.deepStrictEqual(state.suspended, [{
            documentID: 41,
            name: "Apply Album Typography"
        }]);
        assert.deepStrictEqual(state.resumed, [{ id: "history-1", commit: true }]);

        const sets = state.commands.filter(command => command._obj === "set");
        assert.deepStrictEqual(sets.map(command => command._target[0]), [
            { _ref: "textLayer", _id: 7 },
            { _ref: "textLayer", _id: 8 }
        ]);
        assert.strictEqual(sets[0].to.textKey, "Album Title");
        assert.strictEqual(
            sets[0].to.textStyleRange[0].textStyle.fontPostScriptName,
            "AvailablePS"
        );
        assert.strictEqual(
            sets[0].to.paragraphStyleRange[0].paragraphStyle.align._value,
            "center"
        );
    });

    await test("rolls back the whole history group at the first failed layer", async () => {
        const { adapter, state } = setup({
            layers: [layer(7), layer(8)],
            batchFailureAt: 8
        });
        const result = await adapter.execute({
            plan: plan([
                { layerId: 7, role: "TITLE", text: "Title", preset: null },
                { layerId: 8, role: "CAPTION", text: "Caption", preset: null }
            ]),
            expectedDocumentId: 41
        });

        assert.strictEqual(result.status, TypographyExecutionStatus.FAILED);
        assert.strictEqual(result.reasonCode, TypographyExecutionReason.PHOTOSHOP_REJECTED);
        assert.strictEqual(result.failedLayerId, 8);
        assert.deepStrictEqual(result.completedLayerIds, []);
        assert.deepStrictEqual(state.resumed, [{ id: "history-1", commit: false }]);
    });

    await test("refuses mutation when Photoshop cannot provide grouped undo", async () => {
        const { adapter, state } = setup({ history: false });
        const result = await adapter.execute({
            plan: plan([{ layerId: 7, role: "TITLE", text: "Title", preset: null }]),
            expectedDocumentId: 41
        });

        assert.strictEqual(result.reasonCode, TypographyExecutionReason.HISTORY_UNAVAILABLE);
        assert.deepStrictEqual(state.commands, []);
    });

    await test("rolls back when post-write text verification disagrees", async () => {
        const { adapter, state } = setup({ verificationText: "Different" });
        const result = await adapter.execute({
            plan: plan([{ layerId: 7, role: "TITLE", text: "Title", preset: null }]),
            expectedDocumentId: 41
        });

        assert.strictEqual(result.reasonCode, TypographyExecutionReason.VERIFICATION_FAILED);
        assert.strictEqual(result.failedLayerId, 7);
        assert.deepStrictEqual(state.resumed, [{ id: "history-1", commit: false }]);
    });

    console.info(`ALB-119 Photoshop Typography Adapter: PASS (${assertions} tests)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
