import React, { useEffect, useState } from "react";

import { openWeddingFolder } from "../services/FolderService";

import ThumbnailGrid from "./ThumbnailGrid";
import PreviewPanel from "./PreviewPanel";
import Toolbar from "./Toolbar";

import App from "../app/AppController";
import ThumbnailWorker from "../queue/ThumbnailWorker";
import RefreshService from "../services/RefreshService";

export default function OpenFolder() {

    const [folderName, setFolderName] = useState("");
    const [, forceRefresh] = useState(0);

    useEffect(() => {

        const unsubscribe = RefreshService.subscribe(() => {

            forceRefresh(value => value + 1);

        });

        return unsubscribe;

    }, []);

    async function openFolder() {

        try {

            const result = await openWeddingFolder();

            if (!result) return;

            App.library.load(result.images);

            ThumbnailWorker.clear();

            for (const photo of result.images) {

                ThumbnailWorker.add(photo);

            }

            if (result.images.length > 0) {

                App.selection.select(result.images[0]);

            }

            setFolderName(result.folder.name);

            forceRefresh(value => value + 1);

        }
        catch (error) {

            console.error("OpenFolder:", error);

        }

    }

    function refreshFolder() {

        forceRefresh(value => value + 1);

    }

    function selectAll() {

        App.selection.selectAll();

        forceRefresh(value => value + 1);

    }

    function clearSelection() {

        App.selection.clear();

        forceRefresh(value => value + 1);

    }

    function onPhotoClick(photo) {

        App.selection.select(photo);

        forceRefresh(value => value + 1);

    }

    return (

        <div
            style={{
                display: "flex",
                height: "100vh",
                color: "#ffffff",
                background: "#1e1e1e"
            }}
        >

            <div
                style={{
                    flex: 2,
                    display: "flex",
                    flexDirection: "column",
                    padding: 15,
                    overflow: "hidden"
                }}
            >

                <Toolbar
                    onOpen={openFolder}
                    onRefresh={refreshFolder}
                    onSelectAll={selectAll}
                    onClearSelection={clearSelection}
                    photoCount={App.library.getPhotos().length}
                    selectedCount={App.selection.getSelected().length}
                />

                <div
                    style={{
                        marginBottom: 15
                    }}
                >
                    <h3
                        style={{
                            margin: 0
                        }}
                    >
                        {folderName || "No Folder Open"}
                    </h3>

                    <div
                        style={{
                            marginTop: 6,
                            color: "#aaaaaa",
                            fontSize: 13
                        }}
                    >
                        Photos : {App.library.getPhotos().length}
                        {"  |  "}
                        Selected : {App.selection.getSelected().length}
                    </div>
                </div>

                <div
                    style={{
                        flex: 1,
                        overflow: "hidden"
                    }}
                >
                    <ThumbnailGrid
                        photos={App.library.getPhotos()}
                        onPhotoClick={onPhotoClick}
                    />
                </div>

            </div>

            <PreviewPanel
                photo={App.selection.getSelected()[0]}
            />

        </div>

    );

}