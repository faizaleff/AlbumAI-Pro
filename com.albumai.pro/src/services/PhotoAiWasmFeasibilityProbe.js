export const ALB070_WASM_PROBE_SCHEMA = 1;
export const ALB070_WASM_SERIES_SCHEMA = 1;

export const PhotoAiWasmProbeStatus = Object.freeze({
    PASS: "PASS",
    LIMITATION: "LIMITATION",
    FAIL: "FAIL"
});

export const PhotoAiWasmProbeReason = Object.freeze({
    CANCELLED: "CANCELLED",
    RUNTIME_UNSUPPORTED: "RUNTIME_UNSUPPORTED",
    INVALID_FIXTURE: "INVALID_FIXTURE",
    MODULE_INVALID: "MODULE_INVALID",
    INSTANTIATION_FAILED: "INSTANTIATION_FAILED",
    INVALID_EXPORTS: "INVALID_EXPORTS",
    INFERENCE_FAILED: "INFERENCE_FAILED"
});

export const ALB070_SYNTHETIC_MODEL = Object.freeze({
    modelId: "alb070-synthetic-rgb-mean",
    modelVersion: "1.0.0",
    purpose: "UXP_WASM_FEASIBILITY_ONLY",
    productionModel: false,
    width: 16,
    height: 16,
    components: 4,
    wasmBytes: 68,
    memoryMaximumPages: 1
});

const MAX_PIXELS = 4096;
const MAX_WARM_RUNS = 25;
const MAX_SERIES_RUNS = 20;

// Synthetic module: one fixed 64 KiB page and infer(r, g, b) => RGB mean.
// It contains no learned weights and makes no photo-quality claim.
const SYNTHETIC_WASM_BYTES = Object.freeze([
    0, 97, 115, 109, 1, 0, 0, 0,
    1, 8, 1, 96, 3, 125, 125, 125, 1, 125,
    3, 2, 1, 0,
    5, 4, 1, 1, 1, 1,
    7, 18, 2, 6, 109, 101, 109, 111, 114, 121, 2, 0,
    5, 105, 110, 102, 101, 114, 0, 0,
    10, 18, 1, 16, 0, 32, 0, 32, 1, 146, 32, 2, 146,
    67, 0, 0, 64, 64, 149, 11
]);

function safeNow(now) {
    const value = Number(now());
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

function duration(start, end) {
    return Math.max(0, Math.round((end - start) * 1000) / 1000);
}

function warmRunCount(value) {
    if (!Number.isSafeInteger(value) || value < 1) return 5;
    return Math.min(value, MAX_WARM_RUNS);
}

function seriesRunCount(value) {
    if (!Number.isSafeInteger(value) || value < 1) return MAX_SERIES_RUNS;
    return Math.min(value, MAX_SERIES_RUNS);
}

function rounded(value) {
    return Math.round(value * 1000) / 1000;
}

function timingAggregate(values) {
    const samples = values.filter(Number.isFinite);
    if (!samples.length) {
        return Object.freeze({ samples: 0, min: null, max: null, average: null });
    }
    return Object.freeze({
        samples: samples.length,
        min: Math.min(...samples),
        max: Math.max(...samples),
        average: rounded(samples.reduce((total, value) => total + value, 0) / samples.length)
    });
}

function firstMeasurements(report) {
    const measurements = report?.measurements || {};
    return Object.freeze({
        validationMs: measurements.validationMs ?? null,
        preprocessingMs: measurements.preprocessingMs ?? null,
        coldInstantiationMs: measurements.coldInstantiationMs ?? null,
        firstInferenceMs: measurements.firstInferenceMs ?? null,
        warmInferenceMs: measurements.warmInferenceMs ?? null,
        warmRuns: measurements.warmRuns || 0,
        wasmMemoryBytes: measurements.wasmMemoryBytes ?? null
    });
}

function seriesReport({ requestedRuns, warmRuns, reports, cancelled }) {
    const successfulRuns = reports.filter(
        report => report.status === PhotoAiWasmProbeStatus.PASS
    ).length;
    const limitedRuns = reports.filter(
        report => report.status === PhotoAiWasmProbeStatus.LIMITATION
    ).length;
    const failedRuns = reports.filter(
        report => report.status === PhotoAiWasmProbeStatus.FAIL
    ).length;
    const reasonCodes = [...new Set([
        ...reports.flatMap(report => report.reasonCodes || []),
        ...(cancelled ? [PhotoAiWasmProbeReason.CANCELLED] : [])
    ])];
    const measurementValues = field => reports
        .map(report => report.measurements?.[field])
        .filter(Number.isFinite);
    const memoryValues = measurementValues("wasmMemoryBytes");
    return Object.freeze({
        schemaVersion: ALB070_WASM_SERIES_SCHEMA,
        probeSchemaVersion: ALB070_WASM_PROBE_SCHEMA,
        status: failedRuns
            ? PhotoAiWasmProbeStatus.FAIL
            : (limitedRuns || cancelled
                ? PhotoAiWasmProbeStatus.LIMITATION
                : PhotoAiWasmProbeStatus.PASS),
        reasonCodes: Object.freeze(reasonCodes),
        requestedRuns,
        completedRuns: reports.length,
        successfulRuns,
        limitedRuns,
        failedRuns,
        warmRunsPerProbe: warmRuns,
        firstRunMeasurements: firstMeasurements(reports[0]),
        timing: Object.freeze({
            validationMs: timingAggregate(measurementValues("validationMs")),
            preprocessingMs: timingAggregate(measurementValues("preprocessingMs")),
            coldInstantiationMs: timingAggregate(measurementValues("coldInstantiationMs")),
            firstInferenceMs: timingAggregate(measurementValues("firstInferenceMs")),
            warmInferenceMs: timingAggregate(measurementValues("warmInferenceMs"))
        }),
        maximumWasmMemoryBytes: memoryValues.length
            ? Math.max(...memoryValues)
            : null,
        result: Object.freeze({ publishable: false }),
        cancellationObserved: cancelled || reports.some(
            report => report.cancellationObserved === true
        ),
        retainedWasmReferences: false,
        photoshopDocumentsOpenedByProbe: 0,
        hostMemoryReclamation: "RUNTIME_VERIFICATION_REQUIRED"
    });
}

function frozenReport(data = {}) {
    return Object.freeze({
        schemaVersion: ALB070_WASM_PROBE_SCHEMA,
        status: data.status || PhotoAiWasmProbeStatus.FAIL,
        reasonCodes: Object.freeze([...(data.reasonCodes || [])]),
        runtime: Object.freeze({
            webAssemblyAvailable: data.webAssemblyAvailable === true,
            moduleValidated: data.moduleValidated === true,
            instantiated: data.instantiated === true
        }),
        fixture: Object.freeze({
            kind: "SYNTHETIC_RGBA",
            width: ALB070_SYNTHETIC_MODEL.width,
            height: ALB070_SYNTHETIC_MODEL.height,
            components: ALB070_SYNTHETIC_MODEL.components,
            sourceBytes: data.sourceBytes || 0,
            tensorValues: data.tensorValues || 0
        }),
        model: ALB070_SYNTHETIC_MODEL,
        measurements: Object.freeze({
            validationMs: data.validationMs ?? null,
            preprocessingMs: data.preprocessingMs ?? null,
            coldInstantiationMs: data.coldInstantiationMs ?? null,
            firstInferenceMs: data.firstInferenceMs ?? null,
            warmInferenceMs: data.warmInferenceMs ?? null,
            warmRuns: data.warmRuns || 0,
            wasmMemoryBytes: data.wasmMemoryBytes ?? null
        }),
        result: Object.freeze({
            syntheticScore: data.syntheticScore ?? null,
            publishable: false
        }),
        cancellationObserved: data.cancellationObserved === true,
        retainedWasmReferences: false,
        photoshopDocumentsOpenedByProbe: 0,
        hostMemoryReclamation: "RUNTIME_VERIFICATION_REQUIRED"
    });
}

export function createAlb070SyntheticRgbaFixture() {
    const { width, height, components } = ALB070_SYNTHETIC_MODEL;
    const pixels = new Uint8Array(width * height * components);
    for (let index = 0; index < pixels.length; index += components) {
        const pixel = index / components;
        pixels[index] = pixel % 256;
        pixels[index + 1] = (pixel * 3) % 256;
        pixels[index + 2] = (255 - pixel) % 256;
        pixels[index + 3] = 255;
    }
    return pixels;
}

export function preprocessAlb070SyntheticRgba({
    pixels,
    width = ALB070_SYNTHETIC_MODEL.width,
    height = ALB070_SYNTHETIC_MODEL.height,
    components = ALB070_SYNTHETIC_MODEL.components
} = {}) {
    const pixelCount = width * height;
    if (
        !(pixels instanceof Uint8Array) ||
        !Number.isSafeInteger(width) || width < 1 ||
        !Number.isSafeInteger(height) || height < 1 ||
        components !== 4 || pixelCount > MAX_PIXELS ||
        pixels.length !== pixelCount * components
    ) {
        return null;
    }
    const tensor = new Float32Array(3);
    for (let index = 0; index < pixels.length; index += components) {
        tensor[0] += pixels[index] / 255;
        tensor[1] += pixels[index + 1] / 255;
        tensor[2] += pixels[index + 2] / 255;
    }
    tensor[0] /= pixelCount;
    tensor[1] /= pixelCount;
    tensor[2] /= pixelCount;
    return tensor;
}

export async function runPhotoAiWasmFeasibilityProbe({
    webAssembly = globalThis.WebAssembly,
    now = () => globalThis.performance?.now?.() ?? Date.now(),
    isCancelled = () => false,
    warmRuns: requestedWarmRuns = 5,
    fixture = createAlb070SyntheticRgbaFixture()
} = {}) {
    const warmRuns = warmRunCount(requestedWarmRuns);
    const base = {
        webAssemblyAvailable: Boolean(webAssembly),
        sourceBytes: fixture instanceof Uint8Array ? fixture.length : 0
    };
    if (!webAssembly || typeof webAssembly.validate !== "function" ||
        typeof webAssembly.Module !== "function" ||
        typeof webAssembly.Instance !== "function") {
        return frozenReport({
            ...base,
            status: PhotoAiWasmProbeStatus.FAIL,
            reasonCodes: [PhotoAiWasmProbeReason.RUNTIME_UNSUPPORTED]
        });
    }
    if (isCancelled()) {
        return frozenReport({
            ...base,
            status: PhotoAiWasmProbeStatus.LIMITATION,
            reasonCodes: [PhotoAiWasmProbeReason.CANCELLED],
            cancellationObserved: true
        });
    }

    const wasmBytes = Uint8Array.from(SYNTHETIC_WASM_BYTES);
    const validationStart = safeNow(now);
    let moduleValidated = false;
    try {
        moduleValidated = webAssembly.validate(wasmBytes);
    } catch (_) {
        moduleValidated = false;
    }
    const validationMs = duration(validationStart, safeNow(now));
    if (!moduleValidated) {
        return frozenReport({
            ...base,
            validationMs,
            status: PhotoAiWasmProbeStatus.FAIL,
            reasonCodes: [PhotoAiWasmProbeReason.MODULE_INVALID]
        });
    }

    const preprocessingStart = safeNow(now);
    const tensor = preprocessAlb070SyntheticRgba({ pixels: fixture });
    const preprocessingMs = duration(preprocessingStart, safeNow(now));
    if (!tensor) {
        return frozenReport({
            ...base,
            moduleValidated,
            validationMs,
            preprocessingMs,
            status: PhotoAiWasmProbeStatus.FAIL,
            reasonCodes: [PhotoAiWasmProbeReason.INVALID_FIXTURE]
        });
    }
    if (isCancelled()) {
        return frozenReport({
            ...base,
            moduleValidated,
            validationMs,
            preprocessingMs,
            tensorValues: tensor.length,
            status: PhotoAiWasmProbeStatus.LIMITATION,
            reasonCodes: [PhotoAiWasmProbeReason.CANCELLED],
            cancellationObserved: true
        });
    }

    let module = null;
    let instance = null;
    let failureReason = PhotoAiWasmProbeReason.INSTANTIATION_FAILED;
    try {
        const coldStart = safeNow(now);
        module = new webAssembly.Module(wasmBytes);
        instance = new webAssembly.Instance(module, {});
        const coldInstantiationMs = duration(coldStart, safeNow(now));
        module = null;
        failureReason = PhotoAiWasmProbeReason.INFERENCE_FAILED;
        const infer = instance?.exports?.infer;
        const memory = instance?.exports?.memory;
        if (typeof infer !== "function" || !(memory?.buffer instanceof ArrayBuffer)) {
            instance = null;
            return frozenReport({
                ...base,
                moduleValidated,
                instantiated: true,
                validationMs,
                preprocessingMs,
                coldInstantiationMs,
                tensorValues: tensor.length,
                status: PhotoAiWasmProbeStatus.FAIL,
                reasonCodes: [PhotoAiWasmProbeReason.INVALID_EXPORTS]
            });
        }
        if (isCancelled()) {
            instance = null;
            return frozenReport({
                ...base,
                moduleValidated,
                instantiated: true,
                validationMs,
                preprocessingMs,
                coldInstantiationMs,
                tensorValues: tensor.length,
                wasmMemoryBytes: memory.buffer.byteLength,
                status: PhotoAiWasmProbeStatus.LIMITATION,
                reasonCodes: [PhotoAiWasmProbeReason.CANCELLED],
                cancellationObserved: true
            });
        }

        const firstStart = safeNow(now);
        let score = infer(tensor[0], tensor[1], tensor[2]);
        const firstInferenceMs = duration(firstStart, safeNow(now));
        const warmStart = safeNow(now);
        for (let run = 0; run < warmRuns; run += 1) {
            if (isCancelled()) {
                instance = null;
                return frozenReport({
                    ...base,
                    moduleValidated,
                    instantiated: true,
                    validationMs,
                    preprocessingMs,
                    coldInstantiationMs,
                    firstInferenceMs,
                    tensorValues: tensor.length,
                    wasmMemoryBytes: memory.buffer.byteLength,
                    status: PhotoAiWasmProbeStatus.LIMITATION,
                    reasonCodes: [PhotoAiWasmProbeReason.CANCELLED],
                    cancellationObserved: true
                });
            }
            score = infer(tensor[0], tensor[1], tensor[2]);
        }
        const warmInferenceMs = duration(warmStart, safeNow(now));
        if (!Number.isFinite(score) || score < 0 || score > 1) {
            throw new Error("INVALID_SYNTHETIC_RESULT");
        }
        const report = frozenReport({
            ...base,
            moduleValidated,
            instantiated: true,
            validationMs,
            preprocessingMs,
            coldInstantiationMs,
            firstInferenceMs,
            warmInferenceMs,
            warmRuns,
            tensorValues: tensor.length,
            wasmMemoryBytes: memory.buffer.byteLength,
            syntheticScore: Math.round(score * 1000000) / 1000000,
            status: PhotoAiWasmProbeStatus.PASS,
            reasonCodes: []
        });
        instance = null;
        return report;
    } catch (_) {
        module = null;
        instance = null;
        return frozenReport({
            ...base,
            moduleValidated,
            validationMs,
            preprocessingMs,
            tensorValues: tensor.length,
            status: PhotoAiWasmProbeStatus.FAIL,
            reasonCodes: [failureReason]
        });
    }
}

export async function runPhotoAiWasmFeasibilitySeries({
    runs: requestedSeriesRuns = MAX_SERIES_RUNS,
    warmRuns: requestedWarmRuns = 10,
    webAssembly = globalThis.WebAssembly,
    now = () => globalThis.performance?.now?.() ?? Date.now(),
    isCancelled = () => false
} = {}) {
    const runs = seriesRunCount(requestedSeriesRuns);
    const warmRuns = warmRunCount(requestedWarmRuns);
    const reports = [];
    let cancelled = false;
    for (let index = 0; index < runs; index += 1) {
        if (isCancelled()) {
            cancelled = true;
            break;
        }
        const report = await runPhotoAiWasmFeasibilityProbe({
            webAssembly,
            now,
            isCancelled,
            warmRuns
        });
        reports.push(report);
        if (report.status !== PhotoAiWasmProbeStatus.PASS) {
            cancelled = report.cancellationObserved === true;
            break;
        }
    }
    return seriesReport({ requestedRuns: runs, warmRuns, reports, cancelled });
}
