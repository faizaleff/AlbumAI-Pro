import { storage } from "uxp";
import AtomicJsonFileWriter from "./AtomicJsonFileWriter";

const PROJECT_FILE = "project.json";
const PROJECT_TEMP_FILE = "project.json.tmp";
const PROJECT_BACKUP_FILE = "project.json.bak";
const PROJECT_BACKUP_TEMP_FILE = "project.json.bak.tmp";
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
        const projectMetadata = this.createMetadata(
            projectName,
            metadata
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

        const metadata = this.projectEngine.updateMetadata({
            ...values,
            updatedAt: new Date().toISOString()
        }).metadata;

        const projectFile = project.workspace.projectFile ||
            await this.getProjectFile(project.folder, true);

        await this.writeMetadata(
            projectFile,
            metadata,
            project.folder,
            reason
        );

        return this.projectEngine.getProject();

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
            schemaVersion: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            ...metadata,
            name
        };

    }

    async readMetadata(file, folder) {

        const content = await file.read();

        try {
            return JSON.parse(content);
        }

        catch (error) {
            const recovered =
                await this.readRecoveryMetadata(folder);

            if (!recovered) {
                throw new Error(
                    `Invalid ${PROJECT_FILE}: ${error.message}`
                );
            }

            await this.writeMetadata(
                file,
                recovered.metadata,
                folder,
                "RECOVER_INVALID_PROJECT_JSON"
            );

            console.warn(
                `${PROJECT_FILE} was restored from the last valid backup.`
            );

            return recovered.metadata;
        }

    }

    writeMetadata(
        file,
        metadata,
        folder,
        reason = "PROJECT_SERVICE"
    ) {

        // Serialization must finish before any file is created or opened
        // for writing. This prevents serialization failures from truncating
        // the current project.
        const serialized = JSON.stringify(metadata, null, 2);
        JSON.parse(serialized);

        return AtomicJsonFileWriter.write({
            folder,
            fileName: PROJECT_FILE,
            serialized,
            currentFile: file,
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
                metadata: JSON.parse(content),
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

}
