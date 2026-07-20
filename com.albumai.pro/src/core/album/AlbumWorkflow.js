import Logger from "../photoshop/Logger";

import AlbumPipeline from "./AlbumPipeline";

export default class AlbumWorkflow {

    constructor(name = "Album Workflow") {

        this.name = name;

        this.pipeline = new AlbumPipeline();

        this.enabled = true;

    }

    step(name, handler) {

        this.pipeline.use(

            name,

            handler

        );

        return this;

    }

    async run(context = {}) {

        if (!this.enabled) {

            Logger.warn(

                `Workflow "${this.name}" is disabled.`

            );

            return context;

        }

        Logger.info(

            `Workflow started: ${this.name}`

        );

        const result =

            await this.pipeline.execute(

                context

            );

        Logger.info(

            `Workflow completed: ${this.name}`

        );

        return result;

    }

    enable() {

        this.enabled = true;

        return this;

    }

    disable() {

        this.enabled = false;

        return this;

    }

    isEnabled() {

        return this.enabled;

    }

    clear() {

        this.pipeline.clear();

        return this;

    }

    count() {

        return this.pipeline.count();

    }

    has(step) {

        return this.pipeline.has(step);

    }

    names() {

        return this.pipeline.names();

    }

    get(step) {

        return this.pipeline.get(step);

    }

}