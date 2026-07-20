import Logger from "../core/photoshop/Logger";

export default class LicenseService {

    constructor() {

        this.license = null;

        this.valid = false;

    }

    load(data = {}) {

        this.license = {

            ...data

        };

        this.valid = this.validate();

        return this.valid;

    }

    validate() {

        if (!this.license)
            return false;

        if (!this.license.key)
            return false;

        if (

            this.license.expiry &&

            new Date(this.license.expiry) < new Date()

        ) {

            return false;

        }

        return true;

    }

    activate(key) {

        this.license = {

            key,

            activatedAt: new Date()

        };

        this.valid = true;

        Logger.info(
            "License Activated."
        );

        return true;

    }

    deactivate() {

        this.license = null;

        this.valid = false;

        Logger.info(
            "License Deactivated."
        );

    }

    isValid() {

        return this.valid;

    }

    getLicense() {

        return this.license;

    }

}