import AlbumEventBus from "../album/AlbumEventBus";

export default class PanelStateManager {

    constructor({

        eventBus = new AlbumEventBus()

    } = {}) {

        this.eventBus = eventBus;

        this.reset();

    }

    reset() {

        this.state = {

            activePanel: "dashboard",

            selectedProject: null,

            selectedAlbum: null,

            selectedTemplate: null,

            selectedPhotos: [],

            sidebarOpen: true,

            loading: false,

            progressVisible: false,

            notification: null,

            busy: false

        };

    }

    getState() {

        return {

            ...this.state

        };

    }

    get(key) {

        return this.state[key];

    }

    set(key, value) {

        this.state[key] = value;

        this.emit();

    }

    update(values = {}) {

        Object.assign(

            this.state,

            values

        );

        this.emit();

    }

    setActivePanel(panel) {

        this.update({

            activePanel: panel

        });

    }

    setProject(project) {

        this.update({

            selectedProject: project

        });

    }

    setAlbum(album) {

        this.update({

            selectedAlbum: album

        });

    }

    setTemplate(template) {

        this.update({

            selectedTemplate: template

        });

    }

    setPhotos(photos = []) {

        this.update({

            selectedPhotos: photos

        });

    }

    showLoading(message = "") {

        this.update({

            loading: true,

            notification: message

        });

    }

    hideLoading() {

        this.update({

            loading: false

        });

    }

    showProgress() {

        this.update({

            progressVisible: true

        });

    }

    hideProgress() {

        this.update({

            progressVisible: false

        });

    }

    notify(message, type = "info") {

        this.update({

            notification: {

                type,

                message,

                time: Date.now()

            }

        });

    }

    clearNotification() {

        this.update({

            notification: null

        });

    }

    emit() {

        this.eventBus.emit(

            "panel:stateChanged",

            this.getState()

        );

    }

}