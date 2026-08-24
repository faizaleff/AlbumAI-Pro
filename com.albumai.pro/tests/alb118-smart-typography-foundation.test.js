import assert from "assert";

import Template from "../src/templates/Template";
import {
    TYPOGRAPHY_SCHEMA_VERSION,
    TypographyReason,
    TypographyRole,
    TypographyState,
    createTypographyInventory,
    createTypographyPlan
} from "../src/typography/TypographyPlan";

let assertions = 0;

function test(name, callback) {
    callback();
    assertions += 1;
    console.info(`PASS ALB-118: ${name}`);
}

function textLayer(overrides = {}) {
    return {
        documentId: 41,
        layerId: 7,
        parentGroupId: 3,
        parentGroupName: "Copy",
        layerName: "Headline",
        layerType: "textLayer",
        textContent: "Original",
        fontFamily: "CervoNeue-SemiBoldNeue",
        fontSize: 42,
        color: { red: 12, green: 34, blue: 56 },
        alignment: "center",
        visible: true,
        locked: false,
        bounds: { left: 10, top: 20, right: 300, bottom: 80 },
        ...overrides
    };
}

function run() {
    test("creates a detached immutable inventory without inferring a role", () => {
        const source = textLayer();
        const inventory = createTypographyInventory([source]);

        assert.strictEqual(inventory.schemaVersion, TYPOGRAPHY_SCHEMA_VERSION);
        assert.strictEqual(inventory.state, TypographyState.READY);
        assert.deepStrictEqual(inventory.reasonCodes, []);
        assert.deepStrictEqual(inventory.slots[0], {
            layerId: 7,
            layerName: "Headline",
            editable: true,
            currentText: "Original",
            style: {
                fontFamily: "CervoNeue-SemiBoldNeue",
                fontSize: 42,
                color: { red: 12, green: 34, blue: 56 },
                alignment: "center"
            },
            bounds: { left: 10, top: 20, right: 300, bottom: 80 }
        });
        assert.strictEqual(Object.hasOwn(inventory.slots[0], "role"), false);
        assert(Object.isFrozen(inventory));
        assert(Object.isFrozen(inventory.slots));
        assert(Object.isFrozen(inventory.slots[0].style.color));

        source.textContent = "Changed outside";
        source.color.red = 255;
        assert.strictEqual(inventory.slots[0].currentText, "Original");
        assert.strictEqual(inventory.slots[0].style.color.red, 12);
    });

    test("fails closed for duplicate identities and host-object fields", () => {
        const duplicate = createTypographyInventory([
            textLayer({ layerId: 4 }),
            textLayer({ layerId: 4, layerName: "Other" })
        ]);
        assert.strictEqual(duplicate.state, TypographyState.BLOCKED);
        assert.deepStrictEqual(duplicate.reasonCodes, [
            TypographyReason.DUPLICATE_LAYER_ID
        ]);
        assert.deepStrictEqual(duplicate.slots, []);

        const hostReference = createTypographyInventory([{
            ...textLayer(),
            photoshopLayer: { id: 7 }
        }]);
        assert.deepStrictEqual(hostReference.reasonCodes, [
            TypographyReason.UNSUPPORTED_TEXT_LAYER_FIELD
        ]);
    });

    test("builds deterministic explicit typography steps", () => {
        const inventory = createTypographyInventory([
            textLayer({ layerId: 9, layerName: "Quote" }),
            textLayer({ layerId: 12, layerName: "Caption" })
        ]);
        const plan = createTypographyPlan({
            templateId: "template-01",
            inventory,
            assignments: [
                {
                    layerId: 12,
                    role: TypographyRole.CAPTION,
                    text: "Keep exact spacing",
                    preset: {
                        fontFamily: "CervoNeue-SemiBoldNeue",
                        fontSize: 24,
                        color: { red: 240, green: 241, blue: 242 },
                        alignment: "left"
                    }
                },
                {
                    layerId: 9,
                    role: TypographyRole.QUOTE,
                    text: "A deliberate quote"
                }
            ]
        });

        assert.strictEqual(plan.state, TypographyState.READY);
        assert.deepStrictEqual(plan.steps.map(step => step.layerId), [12, 9]);
        assert.deepStrictEqual(plan.steps.map(step => step.role), [
            TypographyRole.CAPTION,
            TypographyRole.QUOTE
        ]);
        assert.strictEqual(plan.steps[0].text, "Keep exact spacing");
        assert.strictEqual(plan.steps[0].preset.fontSize, 24);
        assert.strictEqual(plan.steps[1].preset, null);
        assert(Object.isFrozen(plan.steps[0].preset.color));
    });

    test("blocks missing, non-editable, duplicate, and unsupported targets", () => {
        const inventory = createTypographyInventory([
            textLayer({ layerId: 1 }),
            textLayer({ layerId: 2, locked: true })
        ]);

        const cases = [
            [{ layerId: 99, role: TypographyRole.TITLE, text: "Title" }, TypographyReason.TARGET_NOT_FOUND],
            [{ layerId: 2, role: TypographyRole.TITLE, text: "Title" }, TypographyReason.TARGET_NOT_EDITABLE],
            [{ layerId: 1, role: "BODY", text: "Body" }, TypographyReason.UNSUPPORTED_ROLE],
            [{ layerId: 1, role: TypographyRole.TITLE, text: "   " }, TypographyReason.INVALID_TEXT],
            [{ layerId: 1, role: TypographyRole.TITLE, text: "Title", preset: { fontSize: -1 } }, TypographyReason.INVALID_PRESET]
        ];

        cases.forEach(([assignment, reason]) => {
            const plan = createTypographyPlan({
                templateId: "template-01",
                inventory,
                assignments: [assignment]
            });
            assert.strictEqual(plan.state, TypographyState.BLOCKED);
            assert.deepStrictEqual(plan.reasonCodes, [reason]);
            assert.deepStrictEqual(plan.steps, []);
        });

        const duplicate = createTypographyPlan({
            templateId: "template-01",
            inventory,
            assignments: [
                { layerId: 1, role: TypographyRole.TITLE, text: "One" },
                { layerId: 1, role: TypographyRole.CAPTION, text: "Two" }
            ]
        });
        assert.deepStrictEqual(duplicate.reasonCodes, [
            TypographyReason.DUPLICATE_TARGET
        ]);
    });

    test("exposes typography inventory on Template without changing raw descriptors", () => {
        const rawTextLayers = [textLayer({ layerId: 21 })];
        const template = new Template({
            documentId: 100,
            name: "01.psd",
            textLayers: rawTextLayers
        });

        assert.strictEqual(template.textLayers, rawTextLayers);
        assert.strictEqual(template.typography.state, TypographyState.READY);
        assert.strictEqual(template.typography.slots[0].layerId, 21);
        assert.strictEqual(template.statistics.totalTextLayers, 1);
        assert(Object.isFrozen(template.typography));
        assert(Object.isFrozen(template));
    });

    console.info(`ALB-118 Smart Typography Foundation: PASS (${assertions} tests)`);
}

run();
