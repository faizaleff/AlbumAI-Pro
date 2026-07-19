// src/ui/components/OutputFolderPicker/OutputFolderPicker.jsx

import React, { useState } from "react";
import { storage } from "uxp";

const fs = storage.localFileSystem;

export default function OutputFolderPicker({

    value,

    onChange

}) {

    const [loading, setLoading] = useState(false);

    const [folderName, setFolderName] = useState("");

    async function browse() {

        try {

            setLoading(true);

            const folder = await fs.getFolder();

            if (!folder)
                return;

            setFolderName(folder.name);

            onChange(folder);

        }

        catch (error) {

            console.error(error);

        }

        finally {

            setLoading(false);

        }

    }

    return (

        <div className="output-folder-picker">

            <h3>

                Output Folder

            </h3>

            <button

                onClick={browse}

                disabled={loading}

            >

                {

                    loading

                        ? "Selecting..."

                        : "Browse Output Folder"

                }

            </button>

            {

                value && (

                    <div className="folder-summary">

                        <strong>

                            {folderName}

                        </strong>

                    </div>

                )

            }

        </div>

    );

}