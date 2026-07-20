import config from "./index";
import FEATURES from "./features";

class Environment {

    constructor() {

        this.mode = "production";

    }

    get modeName() {

        return this.mode;

    }

    setMode(mode = "production") {

        this.mode = mode;

    }

    isDevelopment() {

        return this.mode === "development";

    }

    isProduction() {

        return this.mode === "production";

    }

    isTest() {

        return this.mode === "test";

    }

    feature(name) {

        return Boolean(

            FEATURES[name]

        );

    }

    config(path) {

        return config.get(path);

    }

    version() {

        return config.get(

            "application.version"

        );

    }

    applicationName() {

        return config.get(

            "application.name"

        );

    }

    information() {

        return {

            name: this.applicationName(),

            version: this.version(),

            mode: this.mode,

            features: FEATURES,

            configuration: config.all()

        };

    }

}

export default new Environment();