// src/ui/routes/Dashboard.jsx

import React, { useState, useEffect } from "react";

import Header from "../components/Header/Header";
import FolderPicker from "../components/FolderPicker/FolderPicker";
import TemplatePicker from "../components/TemplatePicker/TemplatePicker";
import OutputFolderPicker from "../components/OutputFolderPicker/OutputFolderPicker";
import ExportOptions from "../components/ExportOptions/ExportOptions";
import GenerateButton from "../components/GenerateButton/GenerateButton";
import ProgressCard from "../components/ProgressCard/ProgressCard";
import StatusCard from "../components/StatusCard/StatusCard";

export default function Dashboard({ services }) {

    const [project, setProject] = useState({

        weddingFolder: null,

        outputFolder: null,

        template: null,

        exportOptions: {

            psd: true,

            jpg: true,

            pdf: false

        }

    });

    const [progress, setProgress] = useState({

        stage: "",

        percentage: 0,

        message: ""

    });

    useEffect(() => {

        const unsubscribe =

            services.progressReporter.subscribe(

                setProgress

            );

        return unsubscribe;

    }, [services]);

    async function generateAlbum() {

        await services.albumService.generate({

            templatePath:

                project.template,

            weddingFolder:

                project.weddingFolder,

            outputFolder:

                project.outputFolder,

            exportOptions:

                project.exportOptions

        });

    }

    return (

        <div className="dashboard">

            <Header />

            <FolderPicker

                value={project.weddingFolder}

                onChange={folder =>

                    setProject({

                        ...project,

                        weddingFolder: folder

                    })

                }

            />

            <TemplatePicker

                value={project.template}

                onChange={template =>

                    setProject({

                        ...project,

                        template

                    })

                }

            />

            <OutputFolderPicker

                value={project.outputFolder}

                onChange={folder =>

                    setProject({

                        ...project,

                        outputFolder: folder

                    })

                }

            />

            <ExportOptions

                value={project.exportOptions}

                onChange={options =>

                    setProject({

                        ...project,

                        exportOptions: options

                    })

                }

            />

            <GenerateButton

                onClick={generateAlbum}

            />

            <ProgressCard

                progress={progress}

            />

            <StatusCard />

        </div>

    );

}