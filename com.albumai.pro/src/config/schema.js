const CONFIG_SCHEMA = Object.freeze({

    application: {

        name: "string",

        version: "string"

    },

    generation: {

        maxConcurrentJobs: "number",

        autoSave: "boolean",

        saveInterval: "number",

        retryCount: "number",

        retryDelay: "number"

    },

    photoshop: {

        historyStates: "number",

        suspendHistory: "boolean",

        smartObjects: "boolean"

    },

    cache: {

        enabled: "boolean",

        maxItems: "number",

        clearOnExit: "boolean"

    },

    performance: {

        monitor: "boolean",

        logExecutionTime: "boolean",

        memoryLimitMB: "number"

    },

    export: {

        format: "string",

        jpegQuality: "number",

        overwrite: "boolean"

    },

    logging: {

        enabled: "boolean",

        level: "string"

    }

});

export function validate(config = {}, schema = CONFIG_SCHEMA) {

    const errors = [];

    function walk(target, rules, path = "") {

        Object.entries(rules).forEach(([key, value]) => {

            const currentPath =

                path ? `${path}.${key}` : key;

            const current = target?.[key];

            if (

                value &&
                typeof value === "object" &&
                !Array.isArray(value)

            ) {

                walk(current || {}, value, currentPath);

                return;

            }

            if (typeof current !== value) {

                errors.push({

                    path: currentPath,

                    expected: value,

                    actual: typeof current

                });

            }

        });

    }

    walk(config, schema);

    return {

        valid: errors.length === 0,

        errors

    };

}

export default CONFIG_SCHEMA;