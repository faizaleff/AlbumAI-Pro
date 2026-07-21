import AlbumEventBus from "../album/AlbumEventBus";

export default class DialogManager {

    constructor({

        eventBus = new AlbumEventBus()

    } = {}) {

        this.eventBus = eventBus;

        this.dialogs = new Map();

        this.stack = [];

    }

    open(id, options = {}) {

        const dialog = {

            id,

            visible: true,

            ...options

        };

        this.dialogs.set(id, dialog);

        this.stack.push(id);

        this.eventBus.emit(

            "dialog:opened",

            dialog

        );

        return dialog;

    }

    close(id, result = null) {

        if (!this.dialogs.has(id)) {

            return;

        }

        const dialog = this.dialogs.get(id);

        dialog.visible = false;

        dialog.result = result;

        this.stack = this.stack.filter(

            item => item !== id

        );

        this.eventBus.emit(

            "dialog:closed",

            dialog

        );

        this.dialogs.delete(id);

    }

    async confirm({

        title = "Confirm",

        message = "",

        confirmText = "OK",

        cancelText = "Cancel"

    }) {

        return new Promise(resolve => {

            this.open("confirm", {

                type: "confirm",

                title,

                message,

                confirmText,

                cancelText,

                resolve

            });

        });

    }

    async alert({

        title = "Message",

        message = "",

        buttonText = "OK"

    }) {

        return new Promise(resolve => {

            this.open("alert", {

                type: "alert",

                title,

                message,

                buttonText,

                resolve

            });

        });

    }

    async progress({

        title = "Processing",

        message = "",

        percent = 0

    }) {

        this.open("progress", {

            type: "progress",

            title,

            message,

            percent

        });

    }

    updateProgress(percent, message = null) {

        const dialog = this.dialogs.get(

            "progress"

        );

        if (!dialog) {

            return;

        }

        dialog.percent = percent;

        if (message !== null) {

            dialog.message = message;

        }

        this.eventBus.emit(

            "dialog:updated",

            dialog

        );

    }

    closeProgress() {

        this.close("progress");

    }

    get(id) {

        return this.dialogs.get(id);

    }

    isOpen(id) {

        return this.dialogs.has(id);

    }

    closeAll() {

        for (const id of this.stack) {

            this.close(id);

        }

        this.stack = [];

    }

    getOpenDialogs() {

        return Array.from(

            this.dialogs.values()

        );

    }

}