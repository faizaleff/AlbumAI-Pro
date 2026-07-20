const defaultConfig = Object.freeze({

    application: {

        name: "AlbumAI Pro",

        version: "1.0.0"

    },

    generation: {

        maxConcurrentJobs: 1,

        autoSave: true,

        saveInterval: 10,

        retryCount: 3,

        retryDelay: 1000

    },

    photoshop: {

        historyStates: 50,

        suspendHistory: true,

        smartObjects: true

    },

    cache: {

        enabled: true,

        maxItems: 100,

        clearOnExit: true

    },

    performance: {

        monitor: true,

        logExecutionTime: true,

        memoryLimitMB: 2048

    },

    export: {

        format: "PSD",

        jpegQuality: 12,

        overwrite: false

    },

    logging: {

        enabled: true,

        level: "info"

    }

});

export default defaultConfig;