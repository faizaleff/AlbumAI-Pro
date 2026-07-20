import Logger from "../photoshop/Logger";
import AlbumSession from "./AlbumSession";

export default class AlbumSessionManager {

    constructor() {

        this.session =
            new AlbumSession();

    }

    start(data = {}) {

        return this.session.start(data);

    }

    update(values = {}) {

        return this.session.update(values);

    }

    incrementProcessed(count = 1) {

        this.session.incrementProcessed(count);

    }

    setTotalPhotos(total = 0) {

        this.session.update({

            totalPhotos: total

        });

    }

    finish() {

        const session =
            this.session.finish();

        Logger.info(
            "Album session finished."
        );

        return session;

    }

    fail(error) {

        this.session.fail(error);

        Logger.error(error);

    }

    cancel() {

        this.session.cancel();

    }

    current() {

        return this.session.get();

    }

    isRunning() {

        const current =
            this.session.get();

        return current?.status === "running";

    }

    progress() {

        const current =
            this.session.get();

        if (!current) {

            return 0;

        }

        if (!current.totalPhotos) {

            return 0;

        }

        return (

            current.processedPhotos /

            current.totalPhotos

        ) * 100;

    }

    reset() {

        this.session.reset();

    }

}