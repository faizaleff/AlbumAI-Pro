import { storage } from "uxp";

const PROJECT_FILE = "project.json";
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

        await this.writeMetadata(
            workspace.projectFile,
            projectMetadata
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
            workspace.projectFile
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

    async saveProject(values = {}) {

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

        await this.writeMetadata(projectFile, metadata);

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

        if (!workspace.projectFile && createMissing) {
            workspace.projectFile = await folder.createFile(
                PROJECT_FILE,
                { overwrite: true }
            );
        }

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

        if (projectFile || !createIfMissing) {
            return projectFile || null;
        }

        return folder.createFile(PROJECT_FILE, {
            overwrite: true
        });

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

    async readMetadata(file) {

        const content = await file.read();

        try {
            return JSON.parse(content);
        }

        catch (error) {
            throw new Error(
                `Invalid ${PROJECT_FILE}: ${error.message}`
            );
        }

    }

    async writeMetadata(file, metadata) {

        await file.write(
            JSON.stringify(metadata, null, 2)
        );

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
