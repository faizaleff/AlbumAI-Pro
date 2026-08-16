import assert from "assert";

import {
    ALB070_SYNTHETIC_MODEL,
    createAlb070SyntheticRgbaFixture,
    PhotoAiWasmProbeReason,
    PhotoAiWasmProbeStatus,
    preprocessAlb070SyntheticRgba,
    runPhotoAiWasmFeasibilityProbe,
    runPhotoAiWasmFeasibilitySeries
} from "../src/services/PhotoAiWasmFeasibilityProbe";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-070 WASM: ${name}`);
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
                Module: class {},
                Instance: class {
                    constructor() { instantiated = true; }
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
                Module: class {
                    constructor() { instantiated = true; }
                },
                Instance: class {
                    constructor() { instantiated = true; }
                }
            }
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.LIMITATION);
        assert.deepStrictEqual(report.reasonCodes, [PhotoAiWasmProbeReason.CANCELLED]);
        assert.strictEqual(report.cancellationObserved, true);
        assert.strictEqual(report.result.publishable, false);
        assert.strictEqual(instantiated, false);
    });

    await test("rejects an async-only runtime instead of awaiting a hanging promise", async () => {
        let asyncInstantiateCalled = false;
        const report = await runPhotoAiWasmFeasibilityProbe({
            webAssembly: {
                validate: () => true,
                instantiate: async () => {
                    asyncInstantiateCalled = true;
                    return new Promise(() => {});
                }
            }
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.FAIL);
        assert.deepStrictEqual(report.reasonCodes, [
            PhotoAiWasmProbeReason.RUNTIME_UNSUPPORTED
        ]);
        assert.strictEqual(asyncInstantiateCalled, false);
    });

    await test("fails closed when required WASM exports are absent", async () => {
        const report = await runPhotoAiWasmFeasibilityProbe({
            webAssembly: {
                validate: () => true,
                Module: class {},
                Instance: class { constructor() { this.exports = {}; } }
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
                Module: class {},
                Instance: class {
                    constructor() {
                        this.exports = {
                            infer: () => { throw new Error("unsafe host detail"); },
                            memory: { buffer: new ArrayBuffer(65536) }
                        };
                    }
                }
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

    await test("aggregates bounded quantitative timing evidence", async () => {
        const report = await runPhotoAiWasmFeasibilitySeries({
            runs: 3,
            warmRuns: 2,
            now: steppedClock()
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.PASS);
        assert.strictEqual(report.requestedRuns, 3);
        assert.strictEqual(report.completedRuns, 3);
        assert.strictEqual(report.successfulRuns, 3);
        assert.strictEqual(report.warmRunsPerProbe, 2);
        assert.strictEqual(report.firstRunMeasurements.preprocessingMs, 0.25);
        assert.deepStrictEqual(report.timing.coldInstantiationMs, {
            samples: 3,
            min: 0.25,
            max: 0.25,
            average: 0.25
        });
        assert.strictEqual(report.maximumWasmMemoryBytes, 65536);
        assert(Object.isFrozen(report));
        assert(Object.isFrozen(report.timing));
    });

    await test("bounds a quantitative series to twenty probes", async () => {
        const report = await runPhotoAiWasmFeasibilitySeries({
            runs: 1000,
            warmRuns: 1
        });
        assert.strictEqual(report.requestedRuns, 20);
        assert.strictEqual(report.completedRuns, 20);
        assert.strictEqual(report.successfulRuns, 20);
    });

    await test("stops a quantitative series safely on cancellation", async () => {
        const report = await runPhotoAiWasmFeasibilitySeries({
            isCancelled: () => true
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.LIMITATION);
        assert.strictEqual(report.completedRuns, 0);
        assert.strictEqual(report.cancellationObserved, true);
        assert.deepStrictEqual(report.reasonCodes, [PhotoAiWasmProbeReason.CANCELLED]);
        assert.strictEqual(report.result.publishable, false);
    });

    await test("fails a quantitative series closed after one invalid host run", async () => {
        const report = await runPhotoAiWasmFeasibilitySeries({
            webAssembly: null
        });
        assert.strictEqual(report.status, PhotoAiWasmProbeStatus.FAIL);
        assert.strictEqual(report.completedRuns, 1);
        assert.strictEqual(report.failedRuns, 1);
        assert.deepStrictEqual(report.reasonCodes, [
            PhotoAiWasmProbeReason.RUNTIME_UNSUPPORTED
        ]);
    });

    await test("keeps quantitative evidence public-safe and developer-only", async () => {
        const report = await runPhotoAiWasmFeasibilitySeries({ runs: 2 });
        const serialized = JSON.stringify(report);
        assert(!serialized.includes("pixels"));
        assert(!serialized.includes("path"));
        assert(!serialized.includes("Uint8Array"));
        assert.strictEqual(report.retainedWasmReferences, false);
        assert.strictEqual(report.photoshopDocumentsOpenedByProbe, 0);
        const indexSource = require("fs").readFileSync(
            require("path").join(process.cwd(), "src/index.jsx"),
            "utf8"
        );
        assert(indexSource.includes("__ALBUMAI_ALB070_RUN_WASM_SERIES__"));
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
