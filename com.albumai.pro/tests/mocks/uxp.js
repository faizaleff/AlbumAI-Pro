let lastSetup = null;

module.exports = {
    entrypoints: {
        setup(configuration) {
            lastSetup = configuration;
        },
        get lastSetup() {
            return lastSetup;
        },
        reset() {
            lastSetup = null;
        }
    },
    storage: {
        formats: { binary: "binary" },
        localFileSystem: {}
    }
};
