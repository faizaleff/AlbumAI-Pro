class AlbumSession {

    constructor() {

        this.id = crypto.randomUUID();

        this.project = null;

        this.album = null;

        this.user = null;

        this.started = new Date();

        this.lastActivity = new Date();

        this.status = "idle";

        this.progress = 0;

        this.data = {};

    }

    setProject(project) {

        this.project = project;

        this.touch();

    }

    setAlbum(album) {

        this.album = album;

        this.touch();

    }

    setUser(user) {

        this.user = user;

        this.touch();

    }

    setStatus(status) {

        this.status = status;

        this.touch();

    }

    setProgress(progress) {

        this.progress = Math.max(
            0,
            Math.min(100, progress)
        );

        this.touch();

    }

    set(key, value) {

        this.data[key] = value;

        this.touch();

    }

    get(key) {

        return this.data[key];

    }

    has(key) {

        return Object.prototype.hasOwnProperty.call(
            this.data,
            key
        );

    }

    remove(key) {

        delete this.data[key];

        this.touch();

    }

    clear() {

        this.project = null;

        this.album = null;

        this.user = null;

        this.progress = 0;

        this.status = "idle";

        this.data = {};

        this.touch();

    }

    touch() {

        this.lastActivity = new Date();

    }

    isRunning() {

        return this.status === "running";

    }

    isCompleted() {

        return this.status === "completed";

    }

    isCancelled() {

        return this.status === "cancelled";

    }

    duration() {

        return Date.now() - this.started.getTime();

    }

    summary() {

        return {

            id: this.id,

            status: this.status,

            progress: this.progress,

            started: this.started,

            lastActivity: this.lastActivity,

            duration: this.duration(),

            hasProject: !!this.project,

            hasAlbum: !!this.album

        };

    }

}

export default AlbumSession;