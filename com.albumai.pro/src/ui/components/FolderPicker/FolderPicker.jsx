// src/ui/components/FolderPicker/FolderPicker.jsx

import React, { useState } from "react";

import { storage } from "uxp";

const fs = storage.localFileSystem;

export default function FolderPicker({

    value,

    services,

    onChange

}) {

    const [loading, setLoading] = useState(false);

    const [photoCount, setPhotoCount] = useState(0);

    const [folderName, setFolderName] = useState("");

    async function browse() {

        try {

            setLoading(true);

            const folder =
                await fs.getFolder();

            if (!folder)
                return;

            await services.photoManager.import(
                folder
            );

            const photos =
                services.photoManager.getPhotos();

            setPhotoCount(photos.length);

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

        <div className="folder-picker">

            <h3>

                Wedding Folder

            </h3>

            <button

                onClick={browse}

                disabled={loading}

            >

                {

                    loading

                        ? "Loading..."

                        : "Browse Folder"

                }

            </button>

            {

                value && (

                    <div className="folder-info">

                        <p>

                            Folder

                        </p>

                        <strong>

                            {folderName}

                        </strong>

                        <p>

                            {photoCount} Photos

                        </p>

                    </div>

                )

            }

        </div>

    );

}