// src/core/photoshop/ErrorHandler.js

import Logger from "./Logger.js";

class PhotoshopError extends Error {
    constructor(message, options = {}) {
        super(message);

        this.name = "PhotoshopError";
        this.code = options.code || "UNKNOWN";
        this.recoverable = options.recoverable ?? false;
        this.originalError = options.originalError || null;
        this.context = options.context || {};
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace?.(this, PhotoshopError);
    }
}

class ErrorHandler {

    /**
     * Wrap any async Photoshop operation.
     */
    async execute(task, context = {}) {
        try {
            return await task();
        } catch (error) {
            throw this.process(error, context);
        }
    }

    /**
     * Convert any error into PhotoshopError.
     */
    process(error, context = {}) {

        if (error instanceof PhotoshopError) {
            Logger.error(error.message, error);
            return error;
        }

        const photoshopError = new PhotoshopError(
            error?.message || "Unknown Photoshop error",
            {
                code: this.detectCode(error),
                recoverable: this.isRecoverable(error),
                originalError: error,
                context
            }
        );

        Logger.group("Photoshop Error");
        Logger.error(photoshopError.message);
        Logger.error("Code:", photoshopError.code);
        Logger.error("Recoverable:", photoshopError.recoverable);
        Logger.error("Context:", context);

        if (error?.stack) {
            Logger.error(error.stack);
        }

        Logger.groupEnd();

        return photoshopError;
    }

    detectCode(error) {

        const message = error?.message?.toLowerCase() || "";

        if (message.includes("modal"))
            return "MODAL_EXECUTION_ERROR";

        if (message.includes("batchplay"))
            return "BATCHPLAY_ERROR";

        if (message.includes("document"))
            return "DOCUMENT_ERROR";

        if (message.includes("layer"))
            return "LAYER_ERROR";

        if (message.includes("permission"))
            return "PERMISSION_ERROR";

        if (message.includes("cancel"))
            return "USER_CANCELLED";

        return "UNKNOWN";
    }

    isRecoverable(error) {

        const message = error?.message?.toLowerCase() || "";

        if (message.includes("cancel"))
            return true;

        if (message.includes("busy"))
            return true;

        if (message.includes("timeout"))
            return true;

        return false;
    }

    /**
     * Retry helper.
     */
    async retry(task, retries = 3) {

        let lastError;

        for (let i = 0; i < retries; i++) {

            try {
                return await task();

            } catch (error) {

                lastError = error;

                Logger.warn(
                    `Retry ${i + 1}/${retries} after error: ${error.message}`
                );
            }
        }

        throw this.process(lastError);
    }

    userMessage(error) {

        switch (error.code) {

            case "MODAL_EXECUTION_ERROR":
                return "Photoshop is busy. Please try again.";

            case "DOCUMENT_ERROR":
                return "Unable to access the active document.";

            case "LAYER_ERROR":
                return "Required layer could not be found.";

            case "PERMISSION_ERROR":
                return "Photoshop denied access to the requested operation.";

            case "USER_CANCELLED":
                return "Operation cancelled.";

            default:
                return "An unexpected Photoshop error occurred.";
        }
    }
}

export {
    PhotoshopError
};

export default new ErrorHandler();