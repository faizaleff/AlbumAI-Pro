// ============================================================================
// File: src/core/photoshop/BatchPlay.js
// AlbumAI Pro
// Photoshop UXP BatchPlay Helper
// ============================================================================

import { action } from "photoshop";
import Logger from "./Logger";
import ExecuteModal from "./ExecuteModal";

class BatchPlay {

    /**
     * Execute BatchPlay inside executeAsModal.
     *
     * @param {Array} commands
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async execute(commands = [], options = {}) {

        if (!Array.isArray(commands)) {
            throw new Error("BatchPlay.execute(): commands must be an array.");
        }

        const {
            commandName = "AlbumAI Operation",
            synchronousExecution = true,
            modalBehavior = "fail",
            alreadyInModal = false
        } = options;

        if (commands.length === 0) return [];

        const execute = async () => {

            const batchPlayOptions = {
                synchronousExecution
            };

            if (!alreadyInModal) {
                batchPlayOptions.modalBehavior = modalBehavior;
            }

            Logger.info(
                `Replacement trace: BatchPlay payload (${commandName})`,
                {
                    descriptors: commands,
                    options: batchPlayOptions
                }
            );
            Logger.info(`Replacement trace: BatchPlay before action.batchPlay (${commandName})`);
            Logger.debug(
                `BatchPlay -> ${commandName}`
            );

            const results = await action.batchPlay(
                commands,
                batchPlayOptions
            );
            Logger.info(`Replacement trace: BatchPlay after action.batchPlay (${commandName})`);

            const failed = results.find(result => result?._obj === "error");
            if (failed) {
                throw new Error(failed.message || failed._message || "Photoshop rejected a BatchPlay command.");
            }

            return results;

        };

        return alreadyInModal
            ? execute()
            : ExecuteModal.run(execute, { commandName });

    }

    /**
     * Execute one descriptor.
     *
     * @param {Object} descriptor
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async command(descriptor, options = {}) {

        const result = await this.execute(
            [descriptor],
            options
        );

        return result[0];

    }

    /**
     * Select layer.
     */
    async selectLayer(layerId) {

        return this.command({

            _obj: "select",

            _target: [

                {
                    _ref: "layer",
                    _id: layerId
                }

            ],

            makeVisible: false

        }, {

            commandName: "Select Layer"

        });

    }

    /**
     * Delete currently selected layer.
     */
    async deleteSelectedLayer() {

        return this.command({

            _obj: "delete",

            _target: [

                {
                    _ref: "layer",
                    _enum: "ordinal",
                    _value: "targetEnum"
                }

            ]

        }, {

            commandName: "Delete Layer"

        });

    }

    /**
     * Transform selected layer.
     *
     * scaleX / scaleY in percent.
     * offsetX / offsetY in pixels.
     */
    async transform({

        scaleX = 100,
        scaleY = 100,
        offsetX = 0,
        offsetY = 0,
        angle = 0

    } = {}) {

        return this.command({

            _obj: "transform",

            freeTransformCenterState: {

                _enum: "quadCenterState",
                _value: "QCSAverage"
            },

            offset: {

                _obj: "offset",

                horizontal: {

                    _unit: "pixelsUnit",
                    _value: offsetX

                },

                vertical: {

                    _unit: "pixelsUnit",
                    _value: offsetY

                }

            },

            width: {

                _unit: "percentUnit",
                _value: scaleX

            },

            height: {

                _unit: "percentUnit",
                _value: scaleY

            },

            angle: {

                _unit: "angleUnit",
                _value: angle

            },

            linked: true,

            interfaceIconFrameDimmed: {

                _enum: "interpolationType",
                _value: "bicubic"

            }

        }, {

            commandName: "Transform Layer"

        });

    }

    /**
     * Get current document ID.
     */
    async activeDocumentId() {

        const result = await this.command({

            _obj: "get",

            _target: [

                {
                    _property: "documentID"
                },

                {
                    _ref: "document",
                    _enum: "ordinal",
                    _value: "targetEnum"
                }

            ]

        }, {

            commandName: "Get Document ID"

        });

        return result.documentID;

    }

    /**
     * Suspend history.
     */
    async suspendHistory(name, callback) {

        return ExecuteModal.run(callback, { commandName: name });

    }

}

export default new BatchPlay();
