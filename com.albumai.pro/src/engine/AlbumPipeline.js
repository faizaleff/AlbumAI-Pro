class AlbumPipeline {

    constructor() {

        this.steps = [];

        this.context = {};

    }

    use(name, handler) {

        if (typeof handler !== "function")
            throw new Error(`${name} is not a function.`);

        this.steps.push({

            name,

            handler

        });

        return this;

    }

    async execute(context = {}) {

        this.context = context;

        for (const step of this.steps) {

            this.context =

                await step.handler(this.context);

        }

        return this.context;

    }

    async executeStep(name, context = this.context) {

        const step = this.steps.find(

            s => s.name === name

        );

        if (!step)
            throw new Error(`Pipeline step "${name}" not found.`);

        return step.handler(context);

    }

    remove(name) {

        this.steps = this.steps.filter(

            step => step.name !== name

        );

    }

    clear() {

        this.steps = [];

        this.context = {};

    }

    list() {

        return this.steps.map(

            step => step.name

        );

    }

    count() {

        return this.steps.length;

    }

    has(name) {

        return this.steps.some(

            step => step.name === name

        );

    }

    insert(index, name, handler) {

        this.steps.splice(

            index,

            0,

            {

                name,

                handler

            }

        );

    }

    replace(name, handler) {

        const index = this.steps.findIndex(

            step => step.name === name

        );

        if (index === -1)
            return false;

        this.steps[index].handler = handler;

        return true;

    }

}

export default new AlbumPipeline();