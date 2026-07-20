import Logger from "../photoshop/Logger";

import AlbumWorkflowRegistry from "./AlbumWorkflowRegistry";

export default class AlbumWorkflowExecutor {

    constructor(registry = new AlbumWorkflowRegistry()) {

        this.registry = registry;

    }

    setRegistry(registry) {

        this.registry = registry;

        return this;

    }

    async execute(name, context = {}) {

        const workflow = this.registry.get(name);

        if (!workflow) {

            throw new Error(

                `Workflow "${name}" not found.`

            );

        }

        Logger.info(

            `Executing workflow: ${name}`

        );

        return await workflow.run(context);

    }

    async executeAll(context = {}) {

        const results = [];

        for (const [name, workflow] of this.registry.entries()) {

            Logger.info(

                `Executing workflow: ${name}`

            );

            const result = await workflow.run(context);

            results.push({

                name,

                result

            });

        }

        return results;

    }

    async executeSequential(names = [], context = {}) {

        const results = [];

        let currentContext = context;

        for (const name of names) {

            const workflow = this.registry.get(name);

            if (!workflow) {

                continue;

            }

            currentContext = await workflow.run(

                currentContext

            );

            results.push({

                name,

                result: currentContext

            });

        }

        return results;

    }

    async executeParallel(names = [], context = {}) {

        return Promise.all(

            names.map(async name => {

                const workflow =

                    this.registry.get(name);

                if (!workflow) {

                    return {

                        name,

                        result: null

                    };

                }

                return {

                    name,

                    result: await workflow.run(context)

                };

            })

        );

    }

}