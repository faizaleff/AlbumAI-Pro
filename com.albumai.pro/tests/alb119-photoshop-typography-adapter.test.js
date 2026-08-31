import assert from "assert";

import PhotoshopTypographyAdapter, {
    normalizePhotoshopText,
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

function setup({ layers = [layer(7)], fonts = [], writeFailureAt = null,
    verificationText = null, activeDocumentId = 41, history = true,
    rollbackFailure = false } = {}) {
    const document = { id: 41, layers: [] };
    const state = {
        activeDocumentId,
        activated: 0,
        scanned: 0,
        modalCalls: 0,
        writes: [],
        suspended: [],
        resumed: []
    };
    const runtimeLayers = layers.map(item => {
        if (item.photoshopLayer) return item;

        let contents = `Original ${item.id}`;
        const textItem = {
            characterStyle: {},
            paragraphStyle: {}
        };
        Object.defineProperty(textItem, "contents", {
            get() {
                return verificationText ?? contents;
            },
            set(value) {
                state.writes.push({ layerId: item.id, value });
                if (item.id === writeFailureAt) {
                    throw new Error("Photoshop rejected text contents");
                }
                contents = value;
            }
        });

        return {
            ...item,
            photoshopLayer: { textItem }
        };
    });
    state.runtimeLayers = runtimeLayers;
    const byId = new Map(runtimeLayers.map(item => [item.id, item]));
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
    const hostControl = history ? {
        async suspendHistory(options) {
            state.suspended.push(options);
            return "history-1";
        },
        async resumeHistory(id, commit) {
            state.resumed.push({ id, commit });
            if (!commit && rollbackFailure) throw new Error("Rollback rejected");
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
            executeModal,
            fontCatalog,
            photoshopApp: {
                SolidColor: class SolidColor {
                    constructor() {
                        this.rgb = {};
                    }
                }
            },
            photoshopConstants: {
                Justification: {
                    LEFT: "left",
                    CENTER: "center",
                    RIGHT: "right",
                    FULLYJUSTIFIED: "justifyAll"
                }
            }
        })
    };
}

async function run() {
    await test("normalizes multiline text to Photoshop paragraph breaks", async () => {
        assert.strictEqual(normalizePhotoshopText("First\nSecond"), "First\rSecond");
        assert.strictEqual(normalizePhotoshopText("First\r\nSecond"), "First\rSecond");

        const { adapter, state } = setup();
        const result = await adapter.execute({
            plan: plan([{ layerId: 7, role: "CAPTION", text: "First\nSecond", preset: null }]),
            expectedDocumentId: 41
        });

        assert.strictEqual(result.status, TypographyExecutionStatus.SUCCESS);
        assert.deepStrictEqual(state.writes, [{ layerId: 7, value: "First\rSecond" }]);
    });

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
        assert.deepStrictEqual(state.writes, []);
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

        assert.deepStrictEqual(state.writes, [
            { layerId: 7, value: "Album Title" },
            { layerId: 8, value: "Caption" }
        ]);
        const title = layersById(state, 7);
        assert.strictEqual(title.textItem.characterStyle.font, "AvailablePS");
        assert.strictEqual(title.textItem.characterStyle.size, 36);
        assert.deepStrictEqual(title.textItem.characterStyle.color.rgb, {
            red: 10,
            green: 20,
            blue: 30
        });
        assert.strictEqual(title.textItem.paragraphStyle.justification, "center");
    });

    await test("rolls back the whole history group at the first failed layer", async () => {
        const { adapter, state } = setup({
            layers: [layer(7), layer(8)],
            writeFailureAt: 8
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
        assert.deepStrictEqual(state.writes, []);
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

    await test("preserves the original Photoshop rejection when rollback also fails", async () => {
        const { adapter } = setup({ writeFailureAt: 7, rollbackFailure: true });
        const result = await adapter.execute({
            plan: plan([{ layerId: 7, role: "TITLE", text: "Title", preset: null }]),
            expectedDocumentId: 41
        });

        assert.strictEqual(result.reasonCode, TypographyExecutionReason.PHOTOSHOP_REJECTED);
        assert.strictEqual(result.failedLayerId, 7);
    });

    console.info(`ALB-119 Photoshop Typography Adapter: PASS (${assertions} tests)`);
}

function layersById(state, id) {
    const write = state.writes.find(item => item.layerId === id);
    assert(write);
    return state.runtimeLayers.find(item => item.id === id).photoshopLayer;
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
