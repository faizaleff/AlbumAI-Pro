export default class ProjectEngine {

    constructor() {

        this.folder = null;
        this.projectName = "";
        this.metadata = null;
        this.workspace = null;

    }

    open(folder, metadata = {}, workspace = {}) {

        this.folder = folder;
        this.projectName = metadata.name || folder.name;
        this.metadata = {
            ...metadata,
            name: this.projectName
        };
        this.workspace = {
            root: folder,
            ...workspace
        };

        return this.getProject();

    }

    updateMetadata(values = {}) {

        if (!this.metadata) {
            throw new Error("No project is open.");
        }

        this.metadata = {
            ...this.metadata,
            ...values
        };

        this.projectName = this.metadata.name;

        return this.getProject();

    }

    getProject() {

        if (!this.folder || !this.metadata) {
            return null;
        }

        return {
            folder: this.folder,
            workspace: this.workspace,
            metadata: {
                ...this.metadata
            }
        };

    }

    isOpen() {

        return !!this.folder;

    }

    close() {

        this.folder = null;
        this.projectName = "";
        this.metadata = null;
        this.workspace = null;

    }

}
