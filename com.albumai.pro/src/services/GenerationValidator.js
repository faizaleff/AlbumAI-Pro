// src/services/GenerationValidator.js

class GenerationValidator {

    constructor({
        templateRegistry,
        fileSystem
    } = {}) {

        this.templateRegistry = templateRegistry;
        this.fileSystem = fileSystem;

    }

    /**
     * Create generation context.
     */
    async createContext(job) {

        const { default: GenerationContext } = await import("./GenerationContext.js");

        return new GenerationContext(job);

    }

    /**
     * Validate the complete generation job.
     */
    async validate(context) {

        this.validateJob(context);

        await this.validatePaths(context);

        await this.validateTemplate(context);

        await this.validateWeddingFolder(context);

        await this.validateOutput(context);

        this.validateExportOptions(context);

        return true;

    }

    validateJob(context) {

        if (!context)
            throw new Error("Generation context is missing.");

    }

    async validatePaths(context) {

        const required = [

            {
                value: context.templatePath,
                name: "Template Path"
            },

            {
                value: context.weddingFolder,
                name: "Wedding Folder"
            },

            {
                value: context.outputFolder,
                name: "Output Folder"
            }

        ];

        for (const item of required) {

            if (!item.value) {

                throw new Error(`${item.name} is required.`);

            }

            if (
                this.fileSystem &&
                this.fileSystem.exists
            ) {

                const exists =
                    await this.fileSystem.exists(
                        item.value
                    );

                if (!exists) {

                    throw new Error(
                        `${item.name} not found.`
                    );

                }

            }

        }

    }

    async validateTemplate(context) {

        if (!this.templateRegistry)
            return;

        const template =
            await this.templateRegistry.get(
                context.templatePath
            );

        if (!template) {

            throw new Error(
                "Album template not registered."
            );

        }

    }

    async validateWeddingFolder(context) {

        if (
            !this.fileSystem ||
            !this.fileSystem.listFiles
        ) {

            return;

        }

        const files =
            await this.fileSystem.listFiles(
                context.weddingFolder
            );

        const supported = files.filter(file => {

            const ext =
                file.name
                    .split(".")
                    .pop()
                    .toLowerCase();

            return [

                "jpg",
                "jpeg",
                "png",
                "tif",
                "tiff",
                "psd"

            ].includes(ext);

        });

        if (supported.length === 0) {

            throw new Error(
                "Wedding folder contains no supported photos."
            );

        }

    }

    async validateOutput(context) {

        if (
            this.fileSystem &&
            this.fileSystem.ensureDirectory
        ) {

            await this.fileSystem.ensureDirectory(

                context.outputFolder

            );

        }

    }

    validateExportOptions(context) {

        const options =
            context.exportOptions || {};

        const enabled =

            options.psd ||
            options.jpg ||
            options.pdf;

        if (!enabled) {

            throw new Error(

                "Select at least one export format."

            );

        }

    }

}

export default GenerationValidator;