// src/services/AlbumGenerationService.js

import { GenerationStateMachine } from "./GenerationStateMachine";
import { GenerationStates } from "./GenerationStates";

class AlbumGenerationService {

    constructor({

        photoManager,
        albumManager,
        documentManager,
        layerManager,
        smartObjectManager,
        exporter,
        validator,
        progressReporter,
        resourceManager,
        reportBuilder

    }) {

        this.photoManager = photoManager;
        this.albumManager = albumManager;
        this.documentManager = documentManager;
        this.layerManager = layerManager;
        this.smartObjectManager = smartObjectManager;
        this.exporter = exporter;
        this.validator = validator;
        this.progress = progressReporter;
        this.resources = resourceManager;
        this.report = reportBuilder;

        this.stateMachine = new GenerationStateMachine();

    }

    getState() {

        return this.stateMachine.getState();

    }

    onStateChanged(listener) {

        return this.stateMachine.subscribe(listener);

    }

    async generate(job) {

        const started = Date.now();

        const context = await this.validator.createContext(job);

        try {

            this.stateMachine.transition(
                GenerationStates.VALIDATING
            );

            this.progress.stage("Validating Project");

            await this.validator.validate(context);

            this.stateMachine.transition(
                GenerationStates.SCANNING_PHOTOS
            );

            this.progress.stage("Importing Photos");

            await this.photoManager.import(
                context.weddingFolder
            );

            context.photos =
                this.photoManager.getPhotos();

            this.stateMachine.transition(
                GenerationStates.LOADING_TEMPLATE
            );

            this.progress.stage("Loading Template");

            context.template =
                await this.albumManager.loadTemplate(
                    context.templatePath
                );

            this.stateMachine.transition(
                GenerationStates.OPENING_DOCUMENT
            );

            this.progress.stage("Opening Document");

            context.document =
                await this.documentManager.open(
                    context.template.path
                );

            this.stateMachine.transition(
                GenerationStates.SCANNING_LAYERS
            );

            this.progress.stage("Scanning Layers");

            context.layers =
                await this.layerManager.scan(
                    context.document
                );

            this.stateMachine.transition(
                GenerationStates.RESOLVING_SMART_OBJECTS
            );

            this.progress.stage("Resolving Smart Objects");

            context.smartObjects =
                await this.smartObjectManager.scan(
                    context.document
                );

            this.stateMachine.transition(
                GenerationStates.MATCHING_PHOTOS
            );

            this.progress.stage("Matching Photos");

            context.assignments =
                await this.photoManager.createAssignments(
                    context.smartObjects
                );

            this.stateMachine.transition(
                GenerationStates.REPLACING_PHOTOS
            );

            this.progress.stage("Replacing Photos");

            await this.smartObjectManager.replaceMany(
                context.assignments
            );

            this.stateMachine.transition(
                GenerationStates.SAVING
            );

            this.progress.stage("Saving PSD");

            await this.documentManager.save(
                context.document,
                context.outputPSD
            );

            this.stateMachine.transition(
                GenerationStates.EXPORTING
            );

            this.progress.stage("Exporting");

            context.exports =
                await this.exporter.export(
                    context
                );

            this.stateMachine.transition(
                GenerationStates.COMPLETED
            );

            return this.report.success({

                started,

                context

            });

        }

        catch (error) {

            this.stateMachine.transition(
                GenerationStates.ERROR
            );

            return this.report.failure({

                started,

                error,

                context

            });

        }

        finally {

            this.stateMachine.transition(
                GenerationStates.CLEANUP
            );

            await this.resources.cleanup(
                context
            );

        }

    }

}

export default AlbumGenerationService;