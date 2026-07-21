import { action } from "photoshop";
import Logger from "./Logger";

export default class BatchPlayService {

    constructor() {

        this.options = {

            synchronousExecution: true,

            modalBehavior: "execute"

        };

    }

    async execute(commands = [], options = {}) {

        if (!Array.isArray(commands)) {

            throw new Error(
                "BatchPlay commands must be an array."
            );

        }

        if (commands.length === 0) {

            return [];

        }

        try {

            const result = await action.batchPlay(

                commands,

                {

                    ...this.options,

                    ...options

                }

            );

            return result;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async executeSingle(command, options = {}) {

        const result = await this.execute(

            [command],

            options

        );

        return result[0];

    }

    async get(target) {

        return this.executeSingle({

            _obj: "get",

            _target: target

        });

    }

    async set(target, to) {

        return this.executeSingle({

            _obj: "set",

            _target: target,

            to

        });

    }

    async delete(target) {

        return this.executeSingle({

            _obj: "delete",

            _target: target

        });

    }

    async duplicate(target, name = null) {

        const command = {

            _obj: "duplicate",

            _target: target

        };

        if (name) {

            command.name = name;

        }

        return this.executeSingle(command);

    }

    async select(target) {

        return this.executeSingle({

            _obj: "select",

            _target: target

        });

    }

    async hide(target) {

        return this.executeSingle({

            _obj: "hide",

            _target: target

        });

    }

    async show(target) {

        return this.executeSingle({

            _obj: "show",

            _target: target

        });

    }

    async rename(target, name) {

        return this.executeSingle({

            _obj: "set",

            _target: target,

            to: {

                _obj: "layer",

                name

            }

        });

    }

}