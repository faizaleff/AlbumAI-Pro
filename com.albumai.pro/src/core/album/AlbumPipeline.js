import Logger from "../photoshop/Logger";

export default class AlbumPipeline {

    constructor() {

        this.steps = [];

    }

    use(name, handler) {

        this.steps.push({

            name,

            handler

        });

        Logger.info(

            `Pipeline step registered: ${name}`

        );

        return this;

    }

    async execute(context = {}) {

        let current = context;

        for (const step of this.steps) {

            Logger.info(

                `Running pipeline step: ${step.name}`

            );

            try {

                const result = await step.handler(current);

                if (result !== undefined) {

                    current = result;

                }

            }
            catch (error) {

                Logger.error(error);

                throw error;

            }

        }

        return current;

    }

    remove(name) {

        this.steps = this.steps.filter(

            step => step.name !== name

        );

    }

    clear() {

        this.steps = [];

    }

    count() {

        return this.steps.length;

    }

    has(name) {

        return this.steps.some(

            step => step.name === name

        );

    }

    names() {

        return this.steps.map(

            step => step.name

        );

    }

    get(name) {

        return this.steps.find(

            step => step.name === name

        );

    }

}