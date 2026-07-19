// src/core/photoshop/index.js

import PHOTOSHOP from "./Constants.js";
import Logger from "./Logger.js";
import ErrorHandler, { PhotoshopError } from "./ErrorHandler.js";
import ExecuteModal from "./ExecuteModal.js";
import BatchPlayHelper from "./BatchPlayHelper.js";
import HistoryManager from "./HistoryManager.js";

const Photoshop = {

    // Constants
    constants: PHOTOSHOP,

    // Logging
    logger: Logger,

    // Error handling
    errors: ErrorHandler,

    // Modal execution
    modal: ExecuteModal,

    // BatchPlay
    batchPlay: BatchPlayHelper,

    // History
    history: HistoryManager,

    /**
     * Execute a Photoshop modal operation.
     */
    async execute(task, options = {}) {

        return ExecuteModal.run(task, options);

    },

    /**
     * Execute BatchPlay descriptors.
     */
    async play(descriptors, options = {}) {

        return BatchPlayHelper.execute(
            descriptors,
            options
        );

    },

    /**
     * Execute inside one Photoshop history state.
     */
    async transaction(name, callback) {

        return HistoryManager.suspend(
            name,
            callback
        );

    }

};

export {
    PHOTOSHOP,
    Logger,
    ErrorHandler,
    PhotoshopError,
    ExecuteModal,
    BatchPlayHelper,
    HistoryManager
};

export default Photoshop;