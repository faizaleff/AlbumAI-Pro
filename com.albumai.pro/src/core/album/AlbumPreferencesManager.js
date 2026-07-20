import Logger from "../photoshop/Logger";
import AlbumPreferences from "./AlbumPreferences";

export default class AlbumPreferencesManager {

    constructor(defaultPreferences = {}) {

        this.preferences =
            new AlbumPreferences(defaultPreferences);

    }

    get(key, defaultValue = null) {

        return this.preferences.get(

            key,

            defaultValue

        );

    }

    set(key, value) {

        const result = this.preferences.set(

            key,

            value

        );

        Logger.info(

            `Preference updated: ${key}`

        );

        return result;

    }

    has(key) {

        return this.preferences.has(key);

    }

    update(values = {}) {

        return this.preferences.update(values);

    }

    reset() {

        return this.preferences.reset();

    }

    addRecentProject(project) {

        this.preferences.addRecentProject(project);

        Logger.info(

            "Recent project added."

        );

    }

    removeRecentProject(project) {

        this.preferences.removeRecentProject(project);

    }

    clearRecentProjects() {

        this.preferences.clearRecentProjects();

        Logger.info(

            "Recent projects cleared."

        );

    }

    recentProjects() {

        return this.get(

            "recentProjects",

            []

        );

    }

    export() {

        return this.preferences.export();

    }

    import(data = {}) {

        return this.preferences.import(data);

    }

    enableNotifications() {

        this.set(

            "showNotifications",

            true

        );

    }

    disableNotifications() {

        this.set(

            "showNotifications",

            false

        );

    }

    notificationsEnabled() {

        return this.get(

            "showNotifications",

            true

        );

    }

}