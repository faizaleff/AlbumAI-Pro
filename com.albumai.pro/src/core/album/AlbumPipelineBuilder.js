import Logger from "../photoshop/Logger";

import AlbumPipeline from "./AlbumPipeline";

export default class AlbumPipelineBuilder {

    constructor() {

        this.pipeline = new AlbumPipeline();

    }

    add(name, handler) {

        this.pipeline.use(

            name,

            handler

        );

        return this;

    }

    remove(name) {

        this.pipeline.remove(name);

        return this;

    }

    clear() {

        this.pipeline.clear();

        return this;

    }

    build() {

        Logger.info(

            "Album pipeline built."

        );

        return this.pipeline;

    }

    async execute(context = {}) {

        return this.pipeline.execute(

            context

        );

    }

    has(name) {

        return this.pipeline.has(

            name

        );

    }

    count() {

        return this.pipeline.count();

    }

    names() {

        return this.pipeline.names();

    }

    get(name) {

        return this.pipeline.get(

            name

        );

    }

}