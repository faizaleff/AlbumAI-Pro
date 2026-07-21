import AlbumEventBus from "../album/AlbumEventBus";
import Logger from "../photoshop/Logger";

export default class DragDropManager {

    constructor({

        eventBus = new AlbumEventBus(),

        validators = {}

    } = {}) {

        this.eventBus = eventBus;

        this.validators = validators;

        this.dragData = null;

        this.dropTargets = new Map();

    }

    startDrag(type, data = {}) {

        this.dragData = {

            type,

            data,

            startedAt: Date.now()

        };

        this.eventBus.emit(

            "drag:start",

            this.dragData

        );

    }

    updateDrag(data = {}) {

        if (!this.dragData) {

            return;

        }

        Object.assign(

            this.dragData.data,

            data

        );

        this.eventBus.emit(

            "drag:update",

            this.dragData

        );

    }

    endDrag() {

        if (!this.dragData) {

            return;

        }

        this.eventBus.emit(

            "drag:end",

            this.dragData

        );

        this.dragData = null;

    }

    registerTarget(id, options = {}) {

        this.dropTargets.set(

            id,

            options

        );

    }

    unregisterTarget(id) {

        this.dropTargets.delete(id);

    }

    canDrop(targetId) {

        if (!this.dragData) {

            return false;

        }

        const target =

            this.dropTargets.get(targetId);

        if (!target) {

            return false;

        }

        if (

            typeof target.accept === "function"

        ) {

            return target.accept(

                this.dragData

            );

        }

        return true;

    }

    async drop(targetId) {

        if (

            !this.canDrop(targetId)

        ) {

            Logger.warn(

                "Drop rejected."

            );

            return false;

        }

        const target =

            this.dropTargets.get(targetId);

        if (

            typeof target.onDrop ===

            "function"

        ) {

            await target.onDrop(

                this.dragData

            );

        }

        this.eventBus.emit(

            "drag:dropped",

            {

                targetId,

                dragData:

                    this.dragData

            }

        );

        this.endDrag();

        return true;

    }

    validateFiles(files = []) {

        if (

            typeof this.validators.files !==

            "function"

        ) {

            return true;

        }

        return this.validators.files(

            files

        );

    }

    validatePhotos(files = []) {

        if (

            typeof this.validators.photos !==

            "function"

        ) {

            return true;

        }

        return this.validators.photos(

            files

        );

    }

    validateTemplates(files = []) {

        if (

            typeof this.validators.templates !==

            "function"

        ) {

            return true;

        }

        return this.validators.templates(

            files

        );

    }

    async importFiles(

        files = [],

        callback

    ) {

        if (

            !this.validateFiles(files)

        ) {

            throw new Error(

                "Invalid files."

            );

        }

        if (

            typeof callback ===

            "function"

        ) {

            await callback(files);

        }

        this.eventBus.emit(

            "files:imported",

            files

        );

    }

    async reorder(items = []) {

        this.eventBus.emit(

            "drag:reorder",

            items

        );

    }

    getCurrentDrag() {

        return this.dragData;

    }

    clear() {

        this.dragData = null;

        this.dropTargets.clear();

    }

}