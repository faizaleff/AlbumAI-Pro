export default class ProjectEngine {

    constructor() {

        this.folder = null;
        this.projectName = "";

    }

    open(folder) {

        this.folder = folder;
        this.projectName = folder.name;

    }

}