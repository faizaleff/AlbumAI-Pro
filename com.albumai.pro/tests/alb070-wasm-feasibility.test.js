import assert from "assert";

import {
    ALB070_SYNTHETIC_MODEL,
    createAlb070SyntheticRgbaFixture,
    PhotoAiWasmProbeReason,
    PhotoAiWasmProbeStatus,
    preprocessAlb070SyntheticRgba,
    runPhotoAiWasmFeasibilityProbe
} from "../src/services/PhotoAiWasmFeasibilityProbe";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-070 Slice 2: ${name}`);
}

function steppedClock(step = 0.25) {
    let value = 0;
    return () => {
        value += step;
        return value;
    };
}

(async () => {
    await test("creates one deterministic bounded disposable RGBA fixture", () => {
        const first = createAlb070SyntheticRgbaFixture();
        const second = createAlb070SyntheticRgbaFixture();
        assert(first instanceof Uint8Array);
        assert.strictEqual(first.length, 16 * 16 * 4);
        assert.deepStrictEqual([...first], [...second]);
        assert.strictEqual(ALB070_SYNTHETIC_MODEL.productionModel, false);
    });

    await test("preprocesses RGBA bytes into a bounded normalized RGB tensor", () => {
        const tensor = preprocessAlb070SyntheticRgba({
            pixels: new Uint8Array([255, 0, 127, 255, 0, 255, 127, 255]),
            width: 2,
            height: 1,
            components: 4
        });
        assert(tensor instanceof Float32Array);
        assert.strictEqual(tensor.length, 3);
        assert(Math.abs(tensor[0] - 0.5) < 0.000001);
        assert(Math.abs(tensor[1] - 0.5) < 0.000001);
        assert(Math.abs(tensor[2] - (127 / 255)) < 0.000001);
        assert.strictEqual(preprocessAlb070SyntheticRgba({
            pixels: new Uint8Array(3), width: 1, height: 1, components: 3
        }), null);
    });

    await test("loads and executes the synthetic module with cold and warm measurements", async () => {
        const report = await runPhotoAiWasmFeasibilityProbe({
            now: steppedClock(),
            warmRuns: 3
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.PASS);
        assert.deepStrictEqual(report.reasonCodes, []);
        assert.strictEqual(report.runtime.moduleValidated, true);
        assert.strictEqual(report.runtime.instantiated, true);
        assert.strictEqual(report.measurements.warmRuns, 3);
        assert.strictEqual(report.measurements.wasmMemoryBytes, 65536);
        assert(report.result.syntheticScore >= 0 && report.result.syntheticScore <= 1);
    });

    await test("never marks feasibility output publishable or retains WASM references", async () => {
        const report = await runPhotoAiWasmFeasibilityProbe();
        assert.strictEqual(report.result.publishable, false);
        assert.strictEqual(report.retainedWasmReferences, false);
        assert.strictEqual(report.photoshopDocumentsOpenedByProbe, 0);
        assert.strictEqual(report.hostMemoryReclamation, "RUNTIME_VERIFICATION_REQUIRED");
        const serialized = JSON.stringify(report);
        assert(!serialized.includes("Uint8Array"));
        assert(!serialized.includes("pixels"));
        assert(!serialized.includes("path"));
    });

    await test("fails closed when WebAssembly is unavailable", async () => {
        const report = await runPhotoAiWasmFeasibilityProbe({ webAssembly: null });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.FAIL);
        assert.deepStrictEqual(report.reasonCodes, [
            PhotoAiWasmProbeReason.RUNTIME_UNSUPPORTED
        ]);
        assert.strictEqual(report.result.syntheticScore, null);
    });

    await test("rejects an invalid disposable fixture before instantiation", async () => {
        let instantiated = false;
        const report = await runPhotoAiWasmFeasibilityProbe({
            fixture: new Uint8Array(3),
            webAssembly: {
                validate: () => true,
                instantiate: async () => {
                    instantiated = true;
                    return {};
                }
            }
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.FAIL);
        assert.deepStrictEqual(report.reasonCodes, [
            PhotoAiWasmProbeReason.INVALID_FIXTURE
        ]);
        assert.strictEqual(instantiated, false);
    });

    await test("observes cancellation between preprocessing and module loading", async () => {
        let checks = 0;
        let instantiated = false;
        const report = await runPhotoAiWasmFeasibilityProbe({
            isCancelled: () => ++checks === 2,
            webAssembly: {
                validate: () => true,
                instantiate: async () => {
                    instantiated = true;
                    return {};
                }
            }
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.LIMITATION);
        assert.deepStrictEqual(report.reasonCodes, [PhotoAiWasmProbeReason.CANCELLED]);
        assert.strictEqual(report.cancellationObserved, true);
        assert.strictEqual(report.result.publishable, false);
        assert.strictEqual(instantiated, false);
    });

    await test("fails closed when required WASM exports are absent", async () => {
        const report = await runPhotoAiWasmFeasibilityProbe({
            webAssembly: {
                validate: () => true,
                instantiate: async () => ({
                    instance: { exports: {} }
                })
            }
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.FAIL);
        assert.deepStrictEqual(report.reasonCodes, [
            PhotoAiWasmProbeReason.INVALID_EXPORTS
        ]);
    });

    await test("classifies a synthetic inference exception without exposing it", async () => {
        const report = await runPhotoAiWasmFeasibilityProbe({
            webAssembly: {
                validate: () => true,
                instantiate: async () => ({
                    instance: {
                        exports: {
                            infer: () => { throw new Error("unsafe host detail"); },
                            memory: { buffer: new ArrayBuffer(65536) }
                        }
                    }
                })
            }
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.FAIL);
        assert.deepStrictEqual(report.reasonCodes, [
            PhotoAiWasmProbeReason.INFERENCE_FAILED
        ]);
        assert(!JSON.stringify(report).includes("unsafe host detail"));
    });

    await test("bounds warm inference work to twenty-five runs", async () => {
        const report = await runPhotoAiWasmFeasibilityProbe({ warmRuns: 1000 });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.PASS);
        assert.strictEqual(report.measurements.warmRuns, 25);
    });

    await test("does not import UXP or Photoshop document APIs", () => {
        const source = require("fs").readFileSync(
            require("path").join(
                process.cwd(),
                "src/services/PhotoAiWasmFeasibilityProbe.js"
            ),
            "utf8"
        );
        assert(!/from\s+["'](?:uxp|photoshop)["']/.test(source));
        assert(!/require\(["'](?:uxp|photoshop)["']\)/.test(source));
        assert(!/open\s*\(/.test(source));
    });

    console.info(`ALB-070 WASM feasibility tests: PASS (${assertions} assertions)`);
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
