class AlbumStateManager {

    constructor() {

        this.state = {

            project: null,

            album: null,

            pages: [],

            selectedPhotos: [],

            currentPage: 0,

            currentPhoto: null,

            template: null,

            zoom: 1,

            modified: false,

            saved: false

        };

    }

    getState() {

        return this.clone(this.state);

    }

    setState(state) {

        this.state = {

            ...this.state,

            ...this.clone(state)

        };

    }

    get(key) {

        return this.state[key];

    }

    set(key, value) {

        this.state[key] = value;

        this.state.modified = true;

    }

    update(values = {}) {

        Object.assign(this.state, values);

        this.state.modified = true;

    }

    reset() {

        this.state = {

            project: null,

            album: null,

            pages: [],

            selectedPhotos: [],

            currentPage: 0,

            currentPhoto: null,

            template: null,

            zoom: 1,

            modified: false,

            saved: false

        };

    }

    markSaved() {

        this.state.saved = true;

        this.state.modified = false;

    }

    markModified() {

        this.state.modified = true;

        this.state.saved = false;

    }

    isModified() {

        return this.state.modified;

    }

    isSaved() {

        return this.state.saved;

    }

    hasProject() {

        return this.state.project !== null;

    }

    hasAlbum() {

        return this.state.album !== null;

    }

    clone(data) {

        return structuredClone(data);

    }

}

export default new AlbumStateManager();