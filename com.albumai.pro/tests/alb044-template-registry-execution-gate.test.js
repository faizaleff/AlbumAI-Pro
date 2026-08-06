import { AppController } from "../src/app/AppController";
import ProjectExecutionSummary, {
    ProjectExecutionStatus
} from "../src/project/ProjectExecutionSummary";
import ProjectTemplateRegistry from "../src/project/ProjectTemplateRegistry";
import {
    TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION,
    TemplateRegistryValidationReason as Reason,
    TemplateRegistryValidationState as State
} from "../src/project/TemplateRegistryValidationState";
import {
    TemplateRegistryRecoveryCompatibility as Compatibility
} from "../src/project/TemplateRegistryRecoveryCompatibility";

let count = 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
    assert(actual === expected, `${message}: expected ${expected}, received ${actual}`);
}

function descriptor(id, name, state = State.READY, registrationOrder = 0) {
    const reasons = {
        [State.READY]: Reason.UNIQUE_MATCH,
        [State.MISSING]: Reason.NO_MATCH,
        [State.AMBIGUOUS]: Reason.MULTIPLE_MATCHES,
        [State.ACCESS_ERROR]: Reason.STORAGE_INSPECTION_FAILED,
        [State.UNKNOWN]: Reason.NOT_VALIDATED
    };
    return {
        id,
        name,
        fileReference: name,
        fileName: name,
        registrationOrder,
        validationState: state,
        validationReason: reasons[state],
        validationObservedAt: "2026-01-01T00:00:00.000Z",
        validationSchemaVersion: TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION
    };
}

function entry(name, extras = {}) {
    return { name, isFile: true, ...extras };
}

function fixture({ descriptors, entries, failSave = false } = {}) {
    const controller = new AppController();
    const templates = {
        entries: entries || [],
        async getEntries() { return this.entries; }
    };
    const folder = { name: "Project" };
    const metadata = {
        id: "project-1",
        name: "Project",
        templateRegistry: descriptors || [],
        batchRecovery: null
    };
    let shouldFailSave = failSave;
    let checkpointCalls = 0;
    let executorCalls = 0;
    let documentCalls = 0;
    const saves = [];

    controller.projectService.openProject = async () =>
        controller.project.open(folder, metadata, { root: folder, templates });
    controller.projectService.saveProject = async values => {
        controller.project.updateMetadata(values);
        if (shouldFailSave) throw new Error("controlled persistence failure");
        saves.push(JSON.parse(JSON.stringify(values)));
        return controller.project.getProject();
    };
    controller.photoWorkspace.getPhotos = () => [{
        id: "photo-1",
        name: "Photo.jpg",
        selected: true
    }];
    controller.beginRecoverySnapshot = async () => { checkpointCalls++; };
    controller.projectExecutor.execute = async () => {
        executorCalls++;
        return new ProjectExecutionSummary({
            projectId: "project-1",
            totalTemplates: controller.projectTemplateRegistry.count(),
            completedTemplates: controller.projectTemplateRegistry.count(),
            successfulTemplates: controller.projectTemplateRegistry.count(),
            status: ProjectExecutionStatus.COMPLETED,
            batchExecution: {
                status: "COMPLETED",
                templateResults: []
            }
        });
    };
    controller.templateDocumentReader.resolveRegisteredTemplate = async () => {
        documentCalls++;
        throw new Error("document resolver must not run");
    };
    controller.updateRecoveryBatch = () => {};
    controller.flushRecoveryWrites = async () => {};

    return {
        controller,
        templates,
        saves,
        calls: {
            checkpoint: () => checkpointCalls,
            executor: () => executorCalls,
            document: () => documentCalls
        },
        setSaveFailure(value) { shouldFailSave = value; }
    };
}

async function test(name, callback) {
    await callback();
    count++;
    console.log(`PASS ${name}`);
}

function assertBlockedBeforeExecution(setup, result, expectedStateCount, field) {
    equal(result.status, "TEMPLATE_REGISTRY_BLOCKED", "status");
    equal(result.counts[field], expectedStateCount, `${field} count`);
    equal(result.counts.blocking, expectedStateCount, "blocking count");
    equal(result.checkpointCreated, false, "checkpoint flag");
    equal(result.recoveryMutated, false, "recovery flag");
    equal(result.documentsOpened, 0, "document count");
    equal(setup.calls.checkpoint(), 0, "checkpoint calls");
    equal(setup.calls.executor(), 0, "executor calls");
    equal(setup.calls.document(), 0, "document calls");
}

async function run() {
    await test("READY registry allows the existing execution path", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd")],
            entries: [entry("Cover.psd")]
        });
        await setup.controller.openProject();
        const result = await setup.controller.executeProject();
        equal(result.status, ProjectExecutionStatus.COMPLETED, "execution status");
        equal(setup.calls.checkpoint(), 1, "checkpoint calls");
        equal(setup.calls.executor(), 1, "executor calls");
        equal(
            setup.controller.getLastTemplateRegistryExecutionGateResult().status,
            "READY",
            "gate status"
        );
    });

    await test("UNKNOWN blocks before checkpoint", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd")],
            entries: [entry("Cover.psd")]
        });
        await setup.controller.openProject();
        setup.controller.templateRegistryPreflightService.validate = () => Object.freeze({
            results: Object.freeze([Object.freeze({
                templateId: "template-1",
                state: State.UNKNOWN,
                reasonCode: Reason.NOT_VALIDATED,
                blocking: true
            })]),
            blockingTemplateIds: Object.freeze(["template-1"])
        });
        const result = await setup.controller.executeProject();
        assertBlockedBeforeExecution(setup, result, 1, "blocking");
        equal(result.blockingReasonCodes[0], Reason.NOT_VALIDATED, "reason");
    });

    await test("MISSING blocks before checkpoint", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Missing.psd", State.MISSING)],
            entries: []
        });
        await setup.controller.openProject();
        const result = await setup.controller.executeProject();
        assertBlockedBeforeExecution(setup, result, 1, "missing");
        equal(result.blockingReasonCodes[0], Reason.NO_MATCH, "reason");
    });

    await test("AMBIGUOUS blocks before checkpoint", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Duplicate.psd", State.AMBIGUOUS)],
            entries: [entry("Duplicate.psd"), entry("Duplicate.psd")]
        });
        await setup.controller.openProject();
        const result = await setup.controller.executeProject();
        assertBlockedBeforeExecution(setup, result, 1, "ambiguous");
        equal(result.blockingReasonCodes[0], Reason.MULTIPLE_MATCHES, "reason");
    });

    await test("ACCESS_ERROR blocks before checkpoint", async () => {
        const inaccessible = { name: "Blocked.psd" };
        Object.defineProperty(inaccessible, "isFile", {
            get() { throw new Error("denied"); }
        });
        const setup = fixture({
            descriptors: [descriptor("template-1", "Blocked.psd", State.ACCESS_ERROR)],
            entries: [inaccessible]
        });
        await setup.controller.openProject();
        const result = await setup.controller.executeProject();
        assertBlockedBeforeExecution(setup, result, 1, "accessError");
        equal(result.blockingReasonCodes[0], Reason.STORAGE_INSPECTION_FAILED, "reason");
    });

    await test("mixed READY and blocking registry blocks deterministically", async () => {
        const setup = fixture({
            descriptors: [
                descriptor("template-1", "Ready.psd", State.READY, 0),
                descriptor("template-2", "Missing.psd", State.MISSING, 1),
                descriptor("template-3", "Duplicate.psd", State.AMBIGUOUS, 2)
            ],
            entries: [entry("Ready.psd"), entry("Duplicate.psd"), entry("Duplicate.psd")]
        });
        await setup.controller.openProject();
        const result = await setup.controller.executeProject();
        equal(result.status, "TEMPLATE_REGISTRY_BLOCKED", "status");
        equal(result.counts.total, 3, "total");
        equal(result.counts.ready, 1, "ready");
        equal(result.counts.missing, 1, "missing");
        equal(result.counts.ambiguous, 1, "ambiguous");
        equal(result.counts.blocking, 2, "blocking");
        equal(result.blockingReasonCodes.join(","), "NO_MATCH,MULTIPLE_MATCHES", "reasons");
        equal(setup.calls.executor(), 0, "executor calls");
        const serialized = JSON.stringify(result);
        assert(!serialized.includes("Ready.psd"), "result exposed filename");
        assert(!serialized.includes("nativePath"), "result exposed native path");
        assert(!serialized.includes("token"), "result exposed token");
    });

    await test("blocked gate preserves recovery snapshot and classification", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Missing.psd", State.MISSING)],
            entries: []
        });
        await setup.controller.openProject();
        const recovery = Object.freeze({
            registryVersion: "template-1:Missing.psd",
            registrySnapshot: Object.freeze([Object.freeze({
                id: "template-1",
                fileReference: "Missing.psd",
                registrationOrder: 0
            })])
        });
        setup.controller.batchRecoverySnapshot = recovery;
        setup.controller.batchRecoveryClassification = "INTERRUPTED";
        const result = await setup.controller.executeProject();
        assert(setup.controller.batchRecoverySnapshot === recovery, "recovery identity changed");
        equal(setup.controller.batchRecoveryClassification, "INTERRUPTED", "classification");
        equal(result.recoveryCompatibility, Compatibility.BLOCKED_TEMPLATE_REGISTRY, "compatibility");
    });

    await test("stale recovery registry identity is classified STALE_REGISTRY", async () => {
        const setup = fixture({ descriptors: [], entries: [] });
        setup.controller.projectTemplateRegistry = new ProjectTemplateRegistry([
            descriptor("template-current", "Cover.psd")
        ]);
        setup.controller.batchRecoverySnapshot = {
            registrySnapshot: [{
                id: "template-old",
                fileReference: "Cover.psd",
                registrationOrder: 0
            }]
        };
        equal(
            setup.controller.getTemplateRegistryRecoveryCompatibility(),
            Compatibility.STALE_REGISTRY,
            "compatibility"
        );
    });

    await test("stale recovery registry order is classified STALE_REGISTRY", async () => {
        const setup = fixture({ descriptors: [], entries: [] });
        setup.controller.projectTemplateRegistry = new ProjectTemplateRegistry([
            descriptor("template-1", "One.psd", State.READY, 0),
            descriptor("template-2", "Two.psd", State.READY, 1)
        ]);
        setup.controller.batchRecoverySnapshot = {
            registrySnapshot: [
                { id: "template-2", fileReference: "Two.psd", registrationOrder: 1 },
                { id: "template-1", fileReference: "One.psd", registrationOrder: 0 }
            ]
        };
        equal(
            setup.controller.getTemplateRegistryRecoveryCompatibility(),
            Compatibility.STALE_REGISTRY,
            "compatibility"
        );
    });

    await test("unchanged READY registry is COMPATIBLE", async () => {
        const setup = fixture({ descriptors: [], entries: [] });
        setup.controller.projectTemplateRegistry = new ProjectTemplateRegistry([
            descriptor("template-1", "Cover.psd")
        ]);
        setup.controller.batchRecoverySnapshot = {
            registrySnapshot: [{
                id: "template-1",
                fileReference: "Cover.psd",
                registrationOrder: 0
            }]
        };
        equal(
            setup.controller.getTemplateRegistryRecoveryCompatibility(),
            Compatibility.COMPATIBLE,
            "compatibility"
        );
    });

    await test("validation-blocked recovery overrides identity compatibility", async () => {
        const setup = fixture({ descriptors: [], entries: [] });
        setup.controller.projectTemplateRegistry = new ProjectTemplateRegistry([
            descriptor("template-1", "Missing.psd", State.MISSING)
        ]);
        setup.controller.batchRecoverySnapshot = {
            registrySnapshot: [{
                id: "template-1",
                fileReference: "Missing.psd",
                registrationOrder: 0
            }]
        };
        equal(
            setup.controller.getTemplateRegistryRecoveryCompatibility(),
            Compatibility.BLOCKED_TEMPLATE_REGISTRY,
            "compatibility"
        );
    });

    await test("preflight persistence failure blocks execution safely", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd")],
            entries: [entry("Cover.psd")]
        });
        await setup.controller.openProject();
        const recovery = Object.freeze({ registryVersion: "template-1:Cover.psd" });
        setup.controller.batchRecoverySnapshot = recovery;
        setup.templates.entries = [];
        setup.setSaveFailure(true);
        const result = await setup.controller.executeProject();
        equal(result.status, "TEMPLATE_REGISTRY_PREFLIGHT_PERSISTENCE_FAILED", "status");
        equal(result.counts.missing, 1, "missing count");
        equal(result.checkpointCreated, false, "checkpoint flag");
        equal(setup.calls.checkpoint(), 0, "checkpoint calls");
        equal(setup.calls.executor(), 0, "executor calls");
        assert(setup.controller.batchRecoverySnapshot === recovery, "recovery changed");
        assert(setup.controller.project.isOpen(), "project closed");
    });

    console.log(`ALB-044 execution gate tests passed: ${count}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
