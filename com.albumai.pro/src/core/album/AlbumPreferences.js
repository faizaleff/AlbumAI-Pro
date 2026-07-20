import Logger from "../photoshop/Logger";

export default class AlbumPreferences {

    constructor(defaultPreferences = {}) {

        this.defaults = {

            theme: "dark",

            language: "en",

            recentProjects: [],

            autoOpenOutput: false,

            showNotifications: true,

            saveHistory: true,

            rememberLastTemplate: true,

            rememberOutputFolder: true,

            ...defaultPreferences

        };

        this.preferences = {

            ...this.defaults

        };

    }

    get(key, defaultValue = null) {

        return Object.prototype.hasOwnProperty.call(

            this.preferences,

            key

        )
            ? this.preferences[key]
            : defaultValue;

    }

    set(key, value) {

        this.preferences[key] = value;

        return value;

    }

    has(key) {

        return Object.prototype.hasOwnProperty.call(

            this.preferences,

            key

        );

    }

    update(values = {}) {

        Object.assign(

            this.preferences,

            values

        );

        Logger.info(

            "Album preferences updated."

        );

        return this.preferences;

    }

    addRecentProject(project) {

        if (!project) {

            return;

        }

        this.preferences.recentProjects = [

            project,

            ...this.preferences.recentProjects.filter(

                item => item !== project

            )

        ].slice(0, 20);

    }

    removeRecentProject(project) {

        this.preferences.recentProjects =

            this.preferences.recentProjects.filter(

                item => item !== project

            );

    }

    clearRecentProjects() {

        this.preferences.recentProjects = [];

    }

    reset() {

        this.preferences = {

            ...this.defaults

        };

        Logger.info(

            "Album preferences reset."

        );

        return this.preferences;

    }

    export() {

        return {

            ...this.preferences

        };

    }

    import(data = {}) {

        this.preferences = {

            ...this.defaults,

            ...data

        };

        Logger.info(

            "Album preferences imported."

        );

        return this.preferences;

    }

}