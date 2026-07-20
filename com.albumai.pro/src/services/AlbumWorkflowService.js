import Logger from "../core/photoshop/Logger";

export default class AlbumWorkflowService {

    constructor({

        albumProjectService,

        albumWorkspaceService,

        generationPipeline,

        notificationService,

        eventBus

    }) {

        this.albumProjectService =
            albumProjectService;

        this.albumWorkspaceService =
            albumWorkspaceService;

        this.generationPipeline =
            generationPipeline;

        this.notificationService =
            notificationService;

        this.eventBus =
            eventBus;

    }

    async execute({

        project,

        template,

        photos,

        outputFolder,

        progress

    }) {

        try {

            this.eventBus.emit(
                "workflow:start"
            );

            await this.albumProjectService.open(
                project
            );

            this.albumProjectService.startSession();

            const document =
                this.albumWorkspaceService
                    .getDocument() ||

                await this.albumProjectService
                    .albumTemplateService
                    .load(template);

            await this.albumWorkspaceService
                .initialize(document);

            const result =
                await this.generationPipeline.run({

                    template,

                    photos,

                    outputFolder,

                    progress

                });

            this.albumProjectService
                .finishSession();

            this.notificationService
                .success(
                    "Album generated successfully."
                );

            this.eventBus.emit(
                "workflow:completed",
                result
            );

            return result;

        }

        catch (error) {

            Logger.error(error);

            this.notificationService
                .error(error.message);

            this.eventBus.emit(
                "workflow:failed",
                { error }
            );

            throw error;

        }

        finally {

            await this.albumWorkspaceService
                .dispose();

            await this.albumProjectService
                .close();

        }

    }

}