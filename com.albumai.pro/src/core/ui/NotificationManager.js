import AlbumEventBus from "../album/AlbumEventBus";

export default class NotificationManager {

    constructor({

        eventBus = new AlbumEventBus(),

        maxNotifications = 50

    } = {}) {

        this.eventBus = eventBus;

        this.maxNotifications = maxNotifications;

        this.notifications = [];

    }

    success(message, options = {}) {

        return this.add({

            type: "success",

            message,

            ...options

        });

    }

    info(message, options = {}) {

        return this.add({

            type: "info",

            message,

            ...options

        });

    }

    warning(message, options = {}) {

        return this.add({

            type: "warning",

            message,

            ...options

        });

    }

    error(message, options = {}) {

        return this.add({

            type: "error",

            message,

            ...options

        });

    }

    progress(message, percent = 0, options = {}) {

        return this.add({

            type: "progress",

            message,

            percent,

            ...options

        });

    }

    add(notification) {

        const item = {

            id: crypto.randomUUID(),

            timestamp: Date.now(),

            read: false,

            ...notification

        };

        this.notifications.unshift(item);

        if (

            this.notifications.length >

            this.maxNotifications

        ) {

            this.notifications.length =

                this.maxNotifications;

        }

        this.eventBus.emit(

            "notification:added",

            item

        );

        return item;

    }

    remove(id) {

        this.notifications =

            this.notifications.filter(

                item => item.id !== id

            );

        this.eventBus.emit(

            "notification:removed",

            { id }

        );

    }

    clear() {

        this.notifications = [];

        this.eventBus.emit(

            "notification:cleared"

        );

    }

    markRead(id) {

        const item =

            this.notifications.find(

                n => n.id === id

            );

        if (!item) {

            return;

        }

        item.read = true;

        this.eventBus.emit(

            "notification:updated",

            item

        );

    }

    markAllRead() {

        this.notifications.forEach(

            item => {

                item.read = true;

            }

        );

        this.eventBus.emit(

            "notification:allRead"

        );

    }

    getAll() {

        return [...this.notifications];

    }

    getUnread() {

        return this.notifications.filter(

            item => !item.read

        );

    }

    count() {

        return this.notifications.length;

    }

    unreadCount() {

        return this.getUnread().length;

    }

}