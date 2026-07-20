import Logger from "../core/photoshop/Logger";

export default class UpdateService {

    constructor() {

        this.currentVersion = "1.0.0";

        this.latestVersion = null;

        this.lastChecked = null;

    }

    async check(checker) {

        this.lastChecked = new Date();

        if (typeof checker !== "function") {

            return {

                updateAvailable: false,

                version: this.currentVersion

            };

        }

        const latest = await checker();

        this.latestVersion = latest;

        const updateAvailable =

            latest !== this.currentVersion;

        Logger.info(

            updateAvailable

                ? `Update Available (${latest})`

                : "Plugin Up To Date."

        );

        return {

            updateAvailable,

            currentVersion:

                this.currentVersion,

            latestVersion:

                latest,

            checkedAt:

                this.lastChecked

        };

    }

    getCurrentVersion() {

        return this.currentVersion;

    }

    getLatestVersion() {

        return this.latestVersion;

    }

    setCurrentVersion(version) {

        this.currentVersion = version;

    }

    setLatestVersion(version) {

        this.latestVersion = version;

    }

}