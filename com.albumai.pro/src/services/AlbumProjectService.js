import Logger from "../core/photoshop/Logger";

export default class AlbumProjectService {

    constructor({

        configurationService,

        albumSessionService,

        albumTemplateService,

        recentFilesService,

        validationService

    }) {

        this.configurationService =
            configurationService;

        this.albumSessionService =
            albumSessionService;

        this.albumTemplateService =
            albumTemplateService;

        this.recentFilesService =
            recentFilesService;

        this.validationService =
            validationService;

        this.project = null;

    }

    async open(project) {

        this.validationService.validateTemplate(

            project.template

        );

        this.project = {

            ...project,

            openedAt: new Date()

        };

        await this.albumTemplateService.load(

            project.template

        );

        this.recentFilesService.add(

            project.template

        );

        Logger.info(

            `Project Opened : ${project.name}`

        );

        return this.project;

    }

    startSession() {

        return this.albumSessionService.start({

            project:

                this.project

        });

    }

    finishSession() {

        return this.albumSessionService.finish();

    }

    async close() {

        if (!this.project)
            return;

        const id =

            this.project.template.id ??

            this.project.template.name;

        await this.albumTemplateService.unload(

            id,

            false

        );

        Logger.info(

            `Project Closed : ${this.project.name}`

        );

        this.project = null;

    }

    getProject() {

        return this.project;

    }

    hasProject() {

        return this.project !== null;

    }

}