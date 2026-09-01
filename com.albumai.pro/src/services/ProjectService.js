import { storage } from "uxp";
import AtomicJsonFileWriter from "./AtomicJsonFileWriter";
import {
    applyAlbumSheetHistoryMutation,
    createAlbumSheetHistory,
    createEmptyAlbum,
    inspectAlbum
} from "../project/AlbumSheetSchema";

const PROJECT_FILE = "project.json";
const PROJECT_TEMP_FILE = "project.json.tmp";
const PROJECT_BACKUP_FILE = "project.json.bak";
const PROJECT_BACKUP_TEMP_FILE = "project.json.bak.tmp";
export const PROJECT_SCHEMA_VERSION = 2;
const WORKSPACE_FOLDERS = [
    "Templates",
    "Photos",
    "Cache",
    "Output"
];

export default class ProjectService {

    constructor({
        projectEngine,
        recentProjects,
        localFileSystem = storage.localFileSystem
    } = {}) {

        if (!projectEngine) {
            throw new Error("ProjectEngine is required.");
        }

        if (!recentProjects) {
            throw new Error("Recent projects service is required.");
        }

        this.projectEngine = projectEngine;
        this.recentProjects = recentProjects;
        this.localFileSystem = localFileSystem;

    }

    async createProject({
        name,
        parentFolder = null,
        metadata = {}
    } = {}) {

        const projectName = this.validateName(name);
        const parent = parentFolder ||
            await this.localFileSystem.getFolder();

        if (!parent) {
            return null;
        }

        const folder = await parent.createFolder(projectName);
        const workspace = await this.ensureWorkspace(folder);
        const projectMetadata = this.validateMetadata(
            this.createMetadata(projectName, metadata),
            "new project metadata"
        );

        workspace.projectFile = await this.writeMetadata(
            workspace.projectFile,
            projectMetadata,
            folder,
            "CREATE_PROJECT"
        );

        return this.activate(
            folder,
            projectMetadata,
            workspace
        );

    }

    async openProject(folder = null) {

        const projectFolder = folder ||
            await this.localFileSystem.getFolder();

        if (!projectFolder) {
            return null;
        }

        let workspace = await this.ensureWorkspace(
            projectFolder,
            false
        );

        if (!workspace.projectFile) {
            throw new Error(
                `No ${PROJECT_FILE} found in ${projectFolder.name}.`
            );
        }

        const metadata = await this.readMetadata(
            workspace.projectFile,
            projectFolder
        );

        workspace = await this.ensureWorkspace(
            projectFolder,
            true
        );

        return this.activate(
            projectFolder,
            metadata,
            workspace
        );

    }

    async saveProject(
        values = {},
        { reason = "SAVE_PROJECT" } = {}
    ) {

        const project = this.projectEngine.getProject();

        if (!project) {
            throw new Error("No project is open.");
        }

        const metadata = this.migrateMetadata({
            ...project.metadata,
            ...values,
            updatedAt: new Date().toISOString()
        }, "project metadata").metadata;

        const projectFile = project.workspace.projectFile ||
            await this.getProjectFile(project.folder, true);

        await this.writeMetadata(
            projectFile,
            metadata,
            project.folder,
            reason
        );

        // Do not publish a proposed metadata change until the atomic writer
        // has verified it. This keeps the in-memory project aligned with disk
        // when a UXP filesystem operation rejects.
        this.projectEngine.updateMetadata(metadata);

        return this.projectEngine.getProject();

    }

    /**
     * Persist one detached Album Sheet mutation. The supplied cursor is
     * returned unchanged when its command is rejected or saving fails, so a
     * caller cannot expose partial Album state to a future UI slice.
     */
    async saveAlbumSheetMutation(history, mutation, options = {}) {

        const project = this.projectEngine.getProject();

        if (!project) {
            throw new Error("No project is open.");
        }

        const currentHistory = createAlbumSheetHistory(project.metadata.album);

        if (!currentHistory || !sameAlbum(currentHistory.present, history?.present)) {
            return Object.freeze({
                accepted: false,
                changed: false,
                reasonCodes: Object.freeze(["ALBUM_HISTORY_STALE"]),
                history
            });
        }

        const result = applyAlbumSheetHistoryMutation(history, mutation, options);

        if (!result.accepted || !result.changed) {
            return result;
        }

        try {
            await this.saveProject(
                { album: result.history.present },
                { reason: "ALB080_ALBUM_SHEET_MUTATION" }
            );
        } catch (_) {
            return Object.freeze({
                accepted: false,
                changed: false,
                reasonCodes: Object.freeze(["ALBUM_SAVE_FAILED"]),
                history
            });
        }

        return result;

    }

    async saveAlbumSheetHistory(previousHistory, nextHistory) {

        const project = this.projectEngine.getProject();
        const next = createAlbumSheetHistory(nextHistory?.present);

        if (!project || !next) {
            return Object.freeze({
                accepted: false,
                reasonCodes: Object.freeze(["ALBUM_HISTORY_INVALID"]),
                history: previousHistory
            });
        }

        if (!sameAlbum(project.metadata.album, previousHistory?.present)) {
            return Object.freeze({
                accepted: false,
                reasonCodes: Object.freeze(["ALBUM_HISTORY_STALE"]),
                history: previousHistory
            });
        }

        try {
            await this.saveProject(
                { album: next.present },
                { reason: "ALB080_ALBUM_SHEET_HISTORY" }
            );
        } catch (_) {
            return Object.freeze({
                accepted: false,
                reasonCodes: Object.freeze(["ALBUM_SAVE_FAILED"]),
                history: previousHistory
            });
        }

        return Object.freeze({
            accepted: true,
            reasonCodes: Object.freeze([]),
            history: nextHistory
        });

    }

    closeProject() {

        this.projectEngine.close();

    }

    getRecentProjects() {

        return this.recentProjects.getAll();

    }

    async ensureWorkspace(folder, createMissing = true) {

        const entries = await folder.getEntries();
        const byName = new Map(
            entries.map(entry => [entry.name, entry])
        );
        const workspace = {
            root: folder,
            projectFile: byName.get(PROJECT_FILE) || null
        };

        for (const name of WORKSPACE_FOLDERS) {

            let child = byName.get(name);

            if (!child && createMissing) {
                child = await folder.createFolder(name);
            }

            if (child && !child.isFolder) {
                throw new Error(
                    `${name} must be a project folder.`
                );
            }

            workspace[name.toLowerCase()] = child || null;

        }

        workspace.cache = await this.ensureCacheFolders(
            workspace.cache,
            createMissing
        );

        return workspace;

    }

    async ensureCacheFolders(cacheFolder, createMissing) {

        if (!cacheFolder) {
            return {
                root: null,
                thumbnails: null,
                metadata: null
            };
        }

        const entries = await cacheFolder.getEntries();
        const byName = new Map(
            entries.map(entry => [entry.name, entry])
        );
        const cache = { root: cacheFolder };

        for (const name of ["thumbnails", "metadata"]) {

            let folder = byName.get(name);

            if (!folder && createMissing) {
                folder = await cacheFolder.createFolder(name);
            }

            if (folder && !folder.isFolder) {
                throw new Error(
                    `${name} must be a cache folder.`
                );
            }

            cache[name] = folder || null;

        }

        return cache;

    }

    async getProjectFile(folder, createIfMissing = false) {

        const entries = await folder.getEntries();
        const projectFile = entries.find(
            entry => entry.name === PROJECT_FILE
        );

        return projectFile || null;

    }

    createMetadata(name, metadata = {}) {

        const timestamp = new Date().toISOString();

        return {
            id: typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
            name,
            schemaVersion: PROJECT_SCHEMA_VERSION,
            createdAt: timestamp,
            updatedAt: timestamp,
            ...metadata,
            schemaVersion: PROJECT_SCHEMA_VERSION,
            name,
            album: createEmptyAlbum()
        };

    }

    async readMetadata(file, folder) {
        let primaryError;
        let primary;
        try {
            const content = await file.read();
            primary = this.migrateMetadata(
                JSON.parse(content),
                PROJECT_FILE
            );
        }

        catch (error) {
            primaryError = error;
        }

        if (primary) {
            if (primary.migrated) {
                await this.writeMetadata(
                    file,
                    primary.metadata,
                    folder,
                    "MIGRATE_PROJECT_SCHEMA_V1_TO_V2"
                );
            }

            return primary.metadata;
        }

        // Never replace a project written by a newer application with an
        // older backup. That could silently discard fields this version does
        // not understand.
        if (primaryError?.code === "PROJECT_SCHEMA_INCOMPATIBLE") {
            throw primaryError;
        }

        const recovered = await this.readRecoveryMetadata(folder);

        if (!recovered) {
            throw this.metadataError(
                "PROJECT_METADATA_INVALID",
                `Project data is invalid and no valid recovery copy was found. ${primaryError?.message || "Restore project.json from a known-good backup."}`,
                { source: PROJECT_FILE, recoveryAttempted: true }
            );
        }

        await this.writeMetadata(
            file,
            recovered.metadata,
            folder,
            "RECOVER_INVALID_PROJECT_JSON",
            { preferredBackupContent: recovered.content }
        );

        console.warn(
            `${PROJECT_FILE} was restored from the last valid backup.`
        );

        return recovered.metadata;

    }

    writeMetadata(
        file,
        metadata,
        folder,
        reason = "PROJECT_SERVICE",
        { preferredBackupContent = null } = {}
    ) {

        // Serialization must finish before any file is created or opened
        // for writing. This prevents serialization failures from truncating
        // the current project.
        const validated = this.migrateMetadata(
            metadata,
            "project metadata"
        ).metadata;
        const serialized = JSON.stringify(validated, null, 2);
        JSON.parse(serialized);

        return AtomicJsonFileWriter.write({
            folder,
            fileName: PROJECT_FILE,
            serialized,
            currentFile: file,
            preferredBackupContent,
            reason
        }).then(committed => {
            const project = this.projectEngine.getProject();

            if (
                project?.folder === folder &&
                project.workspace
            ) {
                project.workspace.projectFile = committed;
            }

            return committed;
        });

    }

    async readRecoveryMetadata(folder) {

        if (!folder) return null;

        for (const name of [
            PROJECT_BACKUP_FILE,
            PROJECT_BACKUP_TEMP_FILE,
            PROJECT_TEMP_FILE
        ]) {
            const recovered =
                await this.readJsonEntry(folder, name);

            if (recovered) return recovered;
        }

        return null;

    }

    async readJsonEntry(folder, name) {

        let entry;

        try {
            entry = typeof folder.getEntry === "function"
                ? await folder.getEntry(name)
                : (await folder.getEntries()).find(
                    candidate => candidate.name === name
                );
        } catch (_) {
            return null;
        }

        if (!entry || entry.isFolder) return null;

        try {
            const content = await entry.read();
            return {
                metadata: this.migrateMetadata(JSON.parse(content), name).metadata,
                content
            };
        } catch (_) {
            return null;
        }

    }

    activate(folder, metadata, workspace) {

        const project = this.projectEngine.open(
            folder,
            metadata,
            workspace
        );

        this.recentProjects.add(folder);

        return project;

    }

    validateName(name) {

        const value = String(name || "").trim();

        if (!value) {
            throw new Error("Project name is required.");
        }

        if (/[\\/:*?"<>|]/.test(value)) {
            throw new Error("Project name contains unsupported characters.");
        }

        return value;

    }

    migrateMetadata(metadata, source = PROJECT_FILE) {

        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
            this.validateMetadata(metadata, source);
        }

        const schemaVersion = metadata.schemaVersion;

        if (Number.isInteger(schemaVersion) && schemaVersion > PROJECT_SCHEMA_VERSION) {
            this.validateMetadata(metadata, source);
        }

        if (schemaVersion === 1) {
            this.validateMetadata(metadata, source, { allowLegacy: true });

            const migrated = {
                ...metadata,
                schemaVersion: PROJECT_SCHEMA_VERSION,
                album: createEmptyAlbum()
            };

            return Object.freeze({
                metadata: this.validateMetadata(migrated, source),
                migrated: true
            });
        }

        return Object.freeze({
            metadata: this.validateMetadata(metadata, source),
            migrated: false
        });

    }

    validateMetadata(
        metadata,
        source = PROJECT_FILE,
        { allowLegacy = true } = {}
    ) {

        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
            throw this.metadataError(
                "PROJECT_METADATA_INVALID",
                `${source} must contain one project object.`,
                { source }
            );
        }

        const schemaVersion = metadata.schemaVersion;
        if (Number.isInteger(schemaVersion) && schemaVersion > PROJECT_SCHEMA_VERSION) {
            throw this.metadataError(
                "PROJECT_SCHEMA_INCOMPATIBLE",
                `This project uses schema version ${schemaVersion}; this AlbumAI build supports version ${PROJECT_SCHEMA_VERSION}. Update AlbumAI to open it safely.`,
                { source, schemaVersion, supportedSchemaVersion: PROJECT_SCHEMA_VERSION }
            );
        }

        const supportedSchema = schemaVersion === PROJECT_SCHEMA_VERSION ||
            (allowLegacy && schemaVersion === 1);

        if (!supportedSchema) {
            throw this.metadataError(
                "PROJECT_METADATA_INVALID",
                `${source} has a missing or unsupported project schema version.`,
                { source, schemaVersion: schemaVersion ?? null }
            );
        }

        if (typeof metadata.id !== "string" || !metadata.id.trim()) {
            throw this.metadataError(
                "PROJECT_METADATA_INVALID",
                `${source} is missing a valid project id.`,
                { source, field: "id" }
            );
        }

        if (typeof metadata.name !== "string" || !metadata.name.trim()) {
            throw this.metadataError(
                "PROJECT_METADATA_INVALID",
                `${source} is missing a valid project name.`,
                { source, field: "name" }
            );
        }

        for (const field of ["createdAt", "updatedAt"]) {
            if (metadata[field] != null && typeof metadata[field] !== "string") {
                throw this.metadataError(
                    "PROJECT_METADATA_INVALID",
                    `${source} has an invalid ${field} value.`,
                    { source, field }
                );
            }
        }

        if (metadata.templateRegistry != null && !Array.isArray(metadata.templateRegistry)) {
            throw this.metadataError(
                "PROJECT_METADATA_INVALID",
                `${source} has an invalid template registry.`,
                { source, field: "templateRegistry" }
            );
        }

        for (const field of [
            "batchRecovery",
            "photoSource",
            "photoDecisions",
            "photoBrowserPreferences",
            "photoStoryOrder",
            "cameraClockOffsets",
            "photoDuplicateEvidence"
        ]) {
            const value = metadata[field];
            if (value != null && (typeof value !== "object" || Array.isArray(value))) {
                throw this.metadataError(
                    "PROJECT_METADATA_INVALID",
                    `${source} has an invalid ${field} value.`,
                    { source, field }
                );
            }
        }

        if (schemaVersion === PROJECT_SCHEMA_VERSION) {
            const album = inspectAlbum(metadata.album);

            if (!album.valid) {
                throw this.metadataError(
                    "PROJECT_METADATA_INVALID",
                    `${source} has an invalid album definition.`,
                    {
                        source,
                        field: "album",
                        reasonCodes: album.reasonCodes
                    }
                );
            }

            return {
                ...metadata,
                album: album.album
            };
        }

        return metadata;

    }

    metadataError(code, message, diagnostic = {}) {

        const error = new Error(message);
        error.code = code;
        error.diagnostic = Object.freeze({ code, ...diagnostic });
        return error;

    }

}

function sameAlbum(left, right) {

    const inspectedLeft = inspectAlbum(left);
    const inspectedRight = inspectAlbum(right);

    if (!inspectedLeft.valid || !inspectedRight.valid) {
        return false;
    }

    return JSON.stringify(inspectedLeft.album) === JSON.stringify(inspectedRight.album);

}
