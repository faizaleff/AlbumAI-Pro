import Logger from "../photoshop/Logger";

import AlbumWorkflow from "./AlbumWorkflow";

export default class AlbumWorkflowManager {

    constructor() {

        this.workflows = new Map();

    }

    create(name) {

        const workflow = new AlbumWorkflow(name);

        this.workflows.set(

            name,

            workflow

        );

        Logger.info(

            `Workflow created: ${name}`

        );

        return workflow;

    }

    register(workflow) {

        if (!(workflow instanceof AlbumWorkflow)) {

            throw new Error(

                "Invalid workflow."

            );

        }

        this.workflows.set(

            workflow.name,

            workflow

        );

        Logger.info(

            `Workflow registered: ${workflow.name}`

        );

        return workflow;

    }

    get(name) {

        return this.workflows.get(name);

    }

    has(name) {

        return this.workflows.has(name);

    }

    async run(name, context = {}) {

        const workflow =

            this.get(name);

        if (!workflow) {

            throw new Error(

                `Workflow not found: ${name}`

            );

        }

        return workflow.run(context);

    }

    remove(name) {

        const removed =

            this.workflows.delete(name);

        if (removed) {

            Logger.info(

                `Workflow removed: ${name}`

            );

        }

        return removed;

    }

    clear() {

        this.workflows.clear();

        Logger.info(

            "All workflows cleared."

        );

    }

    names() {

        return [

            ...this.workflows.keys()

        ];

    }

    values() {

        return [

            ...this.workflows.values()

        ];

    }

    count() {

        return this.workflows.size;

    }

}