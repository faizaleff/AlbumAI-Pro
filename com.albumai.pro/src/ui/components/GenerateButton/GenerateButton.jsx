// src/ui/components/GenerateButton/GenerateButton.jsx

import React, { useState } from "react";

export default function GenerateButton({

    project,

    albumService,

    onStarted,

    onCompleted,

    onError

}) {

    const [running, setRunning] = useState(false);

    function validate() {

        if (!project.weddingFolder)
            return "Please select a wedding folder.";

        if (!project.template)
            return "Please select a template.";

        if (!project.outputFolder)
            return "Please select an output folder.";

        const options = project.exportOptions;

        if (
            !options.psd &&
            !options.jpg &&
            !options.pdf
        ) {

            return "Select at least one export format.";

        }

        return null;

    }

    async function generate() {

        const error = validate();

        if (error) {

            onError?.(error);

            return;

        }

        try {

            setRunning(true);

            onStarted?.();

            const report =

                await albumService.generate({

                    templatePath:
                        project.template.path,

                    weddingFolder:
                        project.weddingFolder,

                    outputFolder:
                        project.outputFolder,

                    exportOptions:
                        project.exportOptions

                });

            onCompleted?.(report);

        }

        catch (error) {

            onError?.(

                error.message

            );

        }

        finally {

            setRunning(false);

        }

    }

    return (

        <button

            className="generate-button"

            disabled={running}

            onClick={generate}

        >

            {

                running

                    ? "Generating Album..."

                    : "Generate Album"

            }

        </button>

    );

}