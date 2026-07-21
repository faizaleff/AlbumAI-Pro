import Logger from "../photoshop/Logger";

export default class AlbumPreferencesManager {

    constructor() {

        this.defaults = {

            recentProjects: [],

            recentTemplates: [],

            recentPhotoFolders: [],

            recentOutputFolders: [],

            favoriteTemplates: [],

            lastProject: null,

            lastTemplate: null,

            lastPhotoFolder: null,

            lastOutputFolder: null,

            window: {

                width: 1400,

                height: 900,

                maximized: false

            },

            ui: {

                sidebarWidth: 280,

                previewZoom: 100,

                selectedTab: "dashboard"

            }

        };

        this.preferences = structuredClone(

            this.defaults

        );

    }

    getAll() {

        return structuredClone(

            this.preferences

        );

    }

    get(key) {

        return this.preferences[key];

    }

    set(key, value) {

        this.preferences[key] = value;

        Logger.info(

            `Preference updated: ${key}`

        );

    }

    reset() {

        this.preferences = structuredClone(

            this.defaults

        );

    }

    addRecentProject(project) {

        this.addRecent(

            "recentProjects",

            project

        );

        this.preferences.lastProject = project;

    }

    addRecentTemplate(template) {

        this.addRecent(

            "recentTemplates",

            template

        );

        this.preferences.lastTemplate = template;

    }

    addRecentPhotoFolder(folder) {

        this.addRecent(

            "recentPhotoFolders",

            folder

        );

        this.preferences.lastPhotoFolder = folder;

    }

    addRecentOutputFolder(folder) {

        this.addRecent(

            "recentOutputFolders",

            folder

        );

        this.preferences.lastOutputFolder = folder;

    }

    addFavoriteTemplate(template) {

        if (

            !this.preferences.favoriteTemplates.includes(

                template

            )

        ) {

            this.preferences.favoriteTemplates.push(

                template

            );

        }

    }

    removeFavoriteTemplate(template) {

        this.preferences.favoriteTemplates =

            this.preferences.favoriteTemplates.filter(

                item => item !== template

            );

    }

    addRecent(list, value) {

        const items =

            this.preferences[list];

        const filtered = items.filter(

            item => item !== value

        );

        filtered.unshift(value);

        this.preferences[list] = filtered.slice(

            0,

            10

        );

    }

    export() {

        return JSON.stringify(

            this.preferences,

            null,

            2

        );

    }

    import(json) {

        this.preferences = {

            ...this.defaults,

            ...JSON.parse(json)

        };

    }

}