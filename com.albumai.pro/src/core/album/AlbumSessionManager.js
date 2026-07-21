import Logger from "../photoshop/Logger";

export default class AlbumSessionManager {

    constructor() {

        this.reset();

    }

    reset() {

        this.session = {

            id: crypto.randomUUID(),

            startedAt: new Date().toISOString(),

            activeProject: null,

            activeDocument: null,

            currentAlbum: null,

            currentSheet: null,

            progress: {

                stage: "idle",

                current: 0,

                total: 0,

                percent: 0

            },

            cancelled: false,

            paused: false,

            completed: false,

            metadata: {}

        };

    }

    start(project) {

        this.reset();

        this.session.activeProject = project;

        Logger.info("Album session started.");

        return this.session;

    }

    getSession() {

        return this.session;

    }

    setDocument(document) {

        this.session.activeDocument = document;

    }

    getDocument() {

        return this.session.activeDocument;

    }

    setCurrentAlbum(album) {

        this.session.currentAlbum = album;

    }

    setCurrentSheet(sheet) {

        this.session.currentSheet = sheet;

    }

    updateProgress({

        stage,

        current,

        total

    }) {

        this.session.progress = {

            stage,

            current,

            total,

            percent:

                total > 0

                    ? Math.round(

                          (current / total) * 100

                      )

                    : 0

        };

    }

    cancel() {

        this.session.cancelled = true;
    }

    pause() {

        this.session.paused = true;
    }

    resume() {

        this.session.paused = false;
    }

    complete() {

        this.session.completed = true;

        this.session.finishedAt =
            new Date().toISOString();

        Logger.info("Album session completed.");
    }

    isCancelled() {

        return this.session.cancelled;
    }

    isPaused() {

        return this.session.paused;
    }

    isCompleted() {

        return this.session.completed;
    }

    addMetadata(key, value) {

        this.session.metadata[key] = value;
    }

    getMetadata(key) {

        return this.session.metadata[key];
    }

}