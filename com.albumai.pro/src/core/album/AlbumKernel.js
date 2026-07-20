import Logger from "../photoshop/Logger";
import AlbumBootstrap from "./AlbumBootstrap";

export default class AlbumKernel {

    constructor() {

        this.bootstrap =
            new AlbumBootstrap();

        this.services = null;

    }

    boot() {

        if (this.services) {

            return this.services;

        }

        this.services =
            this.bootstrap.initialize();

        Logger.info(
            "Album kernel booted."
        );

        return this.services;

    }

    shutdown() {

        if (!this.services) {

            return;

        }

        this.bootstrap.shutdown();

        this.services = null;

        Logger.info(
            "Album kernel shutdown."
        );

    }

    reboot() {

        this.shutdown();

        return this.boot();

    }

    service(name) {

        if (!this.services) {

            this.boot();

        }

        return this.bootstrap.get(name);

    }

    has(name) {

        if (!this.services) {

            this.boot();

        }

        return this.bootstrap.has(name);

    }

    all() {

        if (!this.services) {

            this.boot();

        }

        return this.bootstrap.all();

    }

    configuration() {

        return this.service(
            "configuration"
        );

    }

    preferences() {

        return this.service(
            "preferences"
        );

    }

    metadata() {

        return this.service(
            "metadata"
        );

    }

    context() {

        return this.service(
            "context"
        );

    }

    project() {

        return this.service(
            "project"
        );

    }

    templates() {

        return this.service(
            "templates"
        );

    }

    validation() {

        return this.service(
            "validation"
        );

    }

    lifecycle() {

        return this.service(
            "lifecycle"
        );

    }

}