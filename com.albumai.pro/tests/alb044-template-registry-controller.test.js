import { AppController } from "../src/app/AppController";
import ProjectTemplateRegistry from "../src/project/ProjectTemplateRegistry";
import {
    TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION,
    TemplateRegistryValidationReason as Reason,
    TemplateRegistryValidationState as State
} from "../src/project/TemplateRegistryValidationState";

let count = 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
    assert(actual === expected, `${message}: expected ${expected}, received ${actual}`);
}

function descriptor(
    id,
    name,
    validationState = State.UNKNOWN,
    validationObservedAt = validationState === State.UNKNOWN
        ? null
        : "2026-01-01T00:00:00.000Z"
) {
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
        registrationOrder: Number(id.replace(/\D/g, "")) || 0,
        validationState,
        validationReason: reasons[validationState],
        validationObservedAt,
        validationSchemaVersion: TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION
    };
}

function entry(name, extras = {}) {
    return { name, isFile: true, ...extras };
}

function fixture({ descriptors = [], entries = [], recovery = null, failSave = false } = {}) {
    const controller = new AppController();
    const templates = {
        entries,
        async getEntries() { return this.entries; }
    };
    const folder = { name: "Project" };
    const workspace = { root: folder, templates };
    const metadata = {
        id: "project-1",
        name: "Project",
        updatedAt: "2026-01-01T00:00:00.000Z",
        templateRegistry: descriptors,
        batchRecovery: recovery
    };
    const saves = [];
    let shouldFailSave = failSave;

    controller.projectService.openProject = async () =>
        controller.project.open(folder, metadata, workspace);
    controller.projectService.saveProject = async (values, options) => {
        controller.project.updateMetadata({
            ...values,
            updatedAt: "2099-01-01T00:00:00.000Z"
        });
        if (shouldFailSave) throw new Error("controlled save failure");
        saves.push({ values: JSON.parse(JSON.stringify(values)), options });
        return controller.project.getProject();
    };

    return {
        controller,
        templates,
        saves,
        setSaveFailure(value) { shouldFailSave = value; }
    };
}

async function test(name, callback) {
    await callback();
    count++;
    console.log(`PASS ${name}`);
}

async function run() {
    await test("legacy descriptors normalize persisted validation fields", async () => {
        const registry = new ProjectTemplateRegistry([{
            id: "template-1",
            name: "Cover.psd",
            fileReference: "Cover.psd",
            fileName: "Cover.psd",
            registrationOrder: 0
        }]);
        const item = registry.getAll()[0];
        equal(item.validationState, State.UNKNOWN, "state");
        equal(item.validationReason, Reason.NOT_VALIDATED, "reason");
        equal(item.validationObservedAt, null, "observed at");
        equal(item.validationSchemaVersion, 1, "schema");
        equal(registry.blockingEntries().length, 1, "blocking count");
    });

    await test("project open revalidates READY and persists observations", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd")],
            entries: [entry("Cover.psd")]
        });
        await setup.controller.openProject();
        const item = setup.controller.getRegisteredProjectTemplates()[0];
        equal(item.validationState, State.READY, "state");
        equal(item.validationReason, Reason.UNIQUE_MATCH, "reason");
        assert(typeof item.validationObservedAt === "string", "observation timestamp missing");
        equal(setup.saves.length, 1, "save count");
        equal(setup.saves[0].values.templateRegistry[0].validationState, State.READY, "persisted state");
        equal(setup.controller.getTemplateRegistryPreflightState().persisted, true, "session persisted");
    });

    await test("unchanged READY on project open refreshes session without saving", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd", State.READY)],
            entries: [entry("Cover.psd")]
        });
        const persistedBefore = setup.controller.currentTemplateRegistryPreflightState;
        await setup.controller.openProject();
        const state = setup.controller.getTemplateRegistryPreflightState();
        equal(setup.saves.length, 0, "save count");
        equal(state.ready, 1, "ready count");
        equal(state.persisted, false, "persisted flag");
        equal(state.reason, "PROJECT_OPEN", "session reason");
        assert(state !== persistedBefore, "current-session state did not refresh");
        equal(
            setup.controller.getRegisteredProjectTemplates()[0].validationObservedAt,
            "2026-01-01T00:00:00.000Z",
            "observed at"
        );
    });

    await test("unchanged MISSING on project open causes no save", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Missing.psd", State.MISSING)],
            entries: []
        });
        await setup.controller.openProject();
        equal(setup.saves.length, 0, "save count");
        equal(setup.controller.getTemplateRegistryPreflightState().missing, 1, "missing count");
        equal(
            setup.controller.getRegisteredProjectTemplates()[0].validationObservedAt,
            "2026-01-01T00:00:00.000Z",
            "observed at"
        );
    });

    await test("persisted READY becomes MISSING after external removal", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd", State.READY)],
            entries: []
        });
        await setup.controller.openProject();
        const item = setup.controller.getRegisteredProjectTemplates()[0];
        equal(item.validationState, State.MISSING, "refreshed state");
        equal(item.validationReason, Reason.NO_MATCH, "refreshed reason");
        equal(setup.saves[0].values.templateRegistry[0].validationState, State.MISSING, "persisted state");
        equal(setup.saves.length, 1, "save count");
    });

    await test("only changed descriptors receive a new observation timestamp", async () => {
        const readyObservedAt = "2025-01-01T00:00:00.000Z";
        const changedObservedAt = "2025-02-01T00:00:00.000Z";
        const setup = fixture({
            descriptors: [
                descriptor("template-1", "Ready.psd", State.READY, readyObservedAt),
                descriptor("template-2", "Removed.psd", State.READY, changedObservedAt)
            ],
            entries: [entry("Ready.psd")]
        });
        await setup.controller.openProject();
        const items = setup.controller.getRegisteredProjectTemplates();
        equal(setup.saves.length, 1, "save count");
        equal(items[0].validationObservedAt, readyObservedAt, "unchanged timestamp");
        assert(items[1].validationObservedAt !== changedObservedAt, "changed timestamp was retained");
        equal(items[1].validationState, State.MISSING, "changed state");
    });

    await test("validation and persistence preserve descriptor order", async () => {
        const setup = fixture({
            descriptors: [
                descriptor("template-3", "Third.psd"),
                descriptor("template-1", "First.psd"),
                descriptor("template-2", "Second.psd")
            ],
            entries: [entry("Second.psd"), entry("Third.psd"), entry("First.psd")]
        });
        await setup.controller.openProject();
        equal(
            setup.controller.getRegisteredProjectTemplates().map(item => item.id).join(","),
            "template-1,template-2,template-3",
            "normalized authoritative order"
        );
        equal(
            setup.saves[0].values.templateRegistry.map(item => item.id).join(","),
            "template-1,template-2,template-3",
            "persisted order"
        );
    });

    await test("save failure restores registry and controller preflight state", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd")],
            entries: [entry("Cover.psd")]
        });
        await setup.controller.openProject();
        const registryBefore = JSON.stringify(setup.controller.getRegisteredProjectTemplates());
        const stateBefore = setup.controller.getTemplateRegistryPreflightState();
        const metadataBefore = JSON.stringify(setup.controller.project.getProject().metadata);
        setup.templates.entries = [];
        setup.setSaveFailure(true);

        const result = await setup.controller.revalidateProjectTemplates({ reason: "EXPLICIT" });

        equal(result.persisted, false, "failure persisted flag");
        equal(result.missing, 1, "attempted missing count");
        equal(JSON.stringify(setup.controller.getRegisteredProjectTemplates()), registryBefore, "registry rollback");
        assert(setup.controller.getTemplateRegistryPreflightState() === stateBefore, "preflight snapshot not restored");
        equal(JSON.stringify(setup.controller.project.getProject().metadata), metadataBefore, "metadata rollback");
    });

    await test("explicit revalidate reports deterministic state counts", async () => {
        const inaccessible = { name: "Blocked.psd" };
        Object.defineProperty(inaccessible, "isFile", {
            get() { throw new Error("denied"); }
        });
        const setup = fixture({
            descriptors: [
                descriptor("template-1", "Ready.psd"),
                descriptor("template-2", "Missing.psd"),
                descriptor("template-3", "Duplicate.psd"),
                descriptor("template-4", "Blocked.psd")
            ],
            entries: [
                entry("Ready.psd"),
                entry("Duplicate.psd"),
                entry("Duplicate.psd"),
                inaccessible
            ]
        });
        await setup.controller.openProject();
        const result = await setup.controller.revalidateProjectTemplates({ reason: "EXPLICIT_REVALIDATE" });
        equal(result.total, 4, "total");
        equal(result.ready, 1, "ready");
        equal(result.missing, 1, "missing");
        equal(result.ambiguous, 1, "ambiguous");
        equal(result.accessError, 1, "access error");
        equal(result.blocking, 3, "blocking");
        equal(result.persisted, false, "persisted");
        equal(setup.saves.length, 1, "only project-open change saved");
        equal(result.reason, "EXPLICIT_REVALIDATE", "reason");
    });

    await test("registration and removal trigger revalidation", async () => {
        const setup = fixture({ descriptors: [], entries: [] });
        await setup.controller.openProject();
        setup.templates.entries = [entry("Added.psd")];
        const added = await setup.controller.addCurrentPsdToProject(entry("Added.psd"));
        equal(setup.saves.length, 1, "registration save count");
        equal(
            setup.controller.getRegisteredProjectTemplates()[0].validationState,
            State.READY,
            "registered state"
        );
        equal(setup.controller.getLastTemplateRegistryPreflightResult().reason, "TEMPLATE_REGISTRY_ADD", "add reason");
        const removed = await setup.controller.removeRegisteredProjectTemplate(added.id);
        equal(setup.saves.length, 2, "removal save count");
        equal(removed, true, "removed");
        equal(setup.controller.getRegisteredProjectTemplates().length, 0, "registry count");
        equal(setup.controller.getLastTemplateRegistryPreflightResult().reason, "TEMPLATE_REGISTRY_REMOVE", "remove reason");
    });

    await test("explicit unchanged revalidation is a no-op save", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd", State.READY)],
            entries: [entry("Cover.psd")]
        });
        await setup.controller.openProject();
        const result = await setup.controller.revalidateProjectTemplates({
            reason: "EXPLICIT_REVALIDATE"
        });
        equal(setup.saves.length, 0, "save count");
        equal(result.persisted, false, "persisted flag");
        equal(result.ready, 1, "ready count");
        equal(result.reason, "EXPLICIT_REVALIDATE", "reason");
    });

    await test("basic orchestration never opens a Photoshop document", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd")],
            entries: [entry("Cover.psd")]
        });
        setup.controller.templateDocumentReader.read = async () => {
            throw new Error("must not read PSD");
        };
        setup.controller.templateDocumentReader.resolveRegisteredTemplate = async () => {
            throw new Error("must not resolve PSD");
        };
        await setup.controller.openProject();
        await setup.controller.revalidateProjectTemplates({ reason: "NO_DOCUMENT_API" });
        equal(setup.controller.getTemplateRegistryPreflightState().ready, 1, "ready count");
    });

    await test("recovery snapshot and classification remain unchanged", async () => {
        const recovery = {
            schemaVersion: 2,
            projectId: "project-1",
            registryVersion: "template-1:Cover.psd",
            queueOrder: ["template-1"],
            lifecycle: "RUNNING",
            pendingTemplateIds: ["template-1"]
        };
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd")],
            entries: [],
            recovery
        });
        await setup.controller.openProject();
        const snapshotBefore = setup.controller.batchRecoverySnapshot;
        const serializedBefore = JSON.stringify(snapshotBefore);
        const classificationBefore = setup.controller.batchRecoveryClassification;
        await setup.controller.revalidateProjectTemplates({ reason: "RECOVERY_UNCHANGED" });
        assert(setup.controller.batchRecoverySnapshot === snapshotBefore, "recovery snapshot identity changed");
        equal(JSON.stringify(setup.controller.batchRecoverySnapshot), serializedBefore, "recovery data");
        equal(setup.controller.batchRecoveryClassification, classificationBefore, "recovery classification");
    });

    await test("project stays open when project-open observation save fails", async () => {
        const setup = fixture({
            descriptors: [descriptor("template-1", "Cover.psd", State.READY)],
            entries: [],
            failSave: true
        });
        const opened = await setup.controller.openProject();
        assert(opened && setup.controller.project.isOpen(), "project closed after observation failure");
        equal(setup.controller.getRegisteredProjectTemplates()[0].validationState, State.READY, "persisted observation rollback");
        equal(setup.controller.getTemplateRegistryPreflightState().ready, 1, "session rollback state");
        const failure = setup.controller.getLastTemplateRegistryPreflightResult();
        equal(failure.persisted, false, "failure persisted flag");
        equal(failure.missing, 1, "observed missing count");
        equal(failure.reason, "PROJECT_OPEN_PERSISTENCE_FAILED", "failure reason");
    });

    await test("addCurrentPsdToProject falls back to active Photoshop document", async () => {
        const setup = fixture({ descriptors: [], entries: [] });
        await setup.controller.openProject();
        setup.templates.entries = [entry("22.psd")];
        // Simulate active document in Photoshop
        setup.controller.replacementStepExecutor.documentManager.activeDocumentId = 22;
        Object.defineProperty(setup.controller.replacementStepExecutor.documentManager, "active", {
            get() { return { id: 22, title: "22.psd", name: "22.psd" }; },
            configurable: true
        });

        const activeDoc = setup.controller.getActivePhotoshopDocument();
        equal(activeDoc?.name, "22.psd", "active photoshop document name");

        // Calling without arguments should auto-detect the active PSD
        const added = await setup.controller.addCurrentPsdToProject();
        equal(added.name, "22.psd", "added template name");
        equal(setup.controller.getRegisteredProjectTemplates().length, 1, "registered count");
        equal(
            setup.controller.getRegisteredProjectTemplates()[0].validationState,
            State.READY,
            "registered state"
        );
    });

    console.log(`ALB-044 controller tests passed: ${count}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
