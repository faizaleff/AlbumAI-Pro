import AlbumController from "./AlbumController";
import AlbumEngine from "./AlbumEngine";
import AlbumKernel from "./AlbumKernel";

import AlbumProject from "./AlbumProject";
import AlbumSession from "./AlbumSession";

import TemplateManager from "./TemplateManager";
import AlbumConfiguration from "./AlbumConfiguration";
import AlbumPreferences from "./AlbumPreferences";

export default class AlbumFactory {

    static createController() {

        return new AlbumController();

    }

    static createEngine() {

        return new AlbumEngine();

    }

    static createKernel() {

        return new AlbumKernel();

    }

    static createProject(data = {}) {

        const project = new AlbumProject();

        if (Object.keys(data).length) {

            project.create(data);

        }

        return project;

    }

    static createSession(data = {}) {

        const session = new AlbumSession();

        if (Object.keys(data).length) {

            session.start(data);

        }

        return session;

    }

    static createTemplateManager() {

        return new TemplateManager();

    }

    static createConfiguration(defaults = {}) {

        return new AlbumConfiguration(defaults);

    }

    static createPreferences(defaults = {}) {

        return new AlbumPreferences(defaults);

    }

    static create() {

        return {

            controller: this.createController(),

            engine: this.createEngine(),

            kernel: this.createKernel(),

            templates: this.createTemplateManager(),

            configuration: this.createConfiguration(),

            preferences: this.createPreferences()

        };

    }

}