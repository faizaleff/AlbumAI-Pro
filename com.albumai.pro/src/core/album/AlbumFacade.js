import AlbumController from "./AlbumController";

class AlbumFacade {

    constructor() {

        this.controller = new AlbumController();

    }

    async initialize() {

        return this.controller.initialize();

    }

    async generate(project) {

        return this.controller.generate(project);

    }

    async generateBatch(projects = []) {

        return this.controller.generateBatch(projects);

    }

    async validate(project) {

        return this.controller.validate(project);

    }

    async status() {

        return this.controller.status();

    }

    async shutdown() {

        return this.controller.shutdown();

    }

}

const album = new AlbumFacade();

export default album;

export {

    AlbumFacade

};