import React, { useEffect, useState } from "react";

import ThumbnailGrid from "./ThumbnailGrid";
import PreviewPanel from "./PreviewPanel";
import Toolbar from "./Toolbar";

import App from "../app/AppController";
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

            const photos = await App.importPhotos();

            if (!photos) return;

            if (photos.length > 0) {

                App.selection.select(photos[0]);

            }

            setFolderName(
                App.project.getProject()?.metadata?.photoSource?.name ||
                ""
            );

            forceRefresh(value => value + 1);

        }
        catch (error) {

            console.error("OpenFolder:", error);

        }

    }

    async function refreshFolder() {

        try {

            await App.refreshPhotos();

            forceRefresh(value => value + 1);

        }

        catch (error) {

            console.error("Refresh photos:", error);

        }

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
                    photoCount={App.getPhotos().length}
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
                        Photos : {App.getPhotos().length}
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
                        photos={App.getPhotos()}
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
