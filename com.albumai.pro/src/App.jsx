import React from "react";

import AppProvider from "./providers/AppProvider";

import Dashboard from "./components/Dashboard";
import PreviewPanel from "./components/PreviewPanel";
import ThumbnailGrid from "./components/ThumbnailGrid";

import { useAlbumAIContext } from "./context/AlbumAIContext";
import { useAppState } from "./context/AppStateContext";

function AlbumWorkspace() {

    const {

        initialized,
        loading,

        project,
        album,
        photos

    } = useAlbumAIContext();

    const state = useAppState();

    if (loading) {

        return (

            <div className="albumai-loading">

                <h2>Initializing AlbumAI Pro...</h2>

            </div>

        );

    }

    if (!initialized) {

        return (

            <div className="albumai-loading">

                <h2>Waiting...</h2>

            </div>

        );

    }

    return (

        <div className="albumai-app">

            <header className="albumai-header">

                <h1>

                    AlbumAI Pro

                </h1>

            </header>

            <main className="albumai-main">

                <aside className="albumai-sidebar">

                    <Dashboard />

                </aside>

                <section className="albumai-content">

                    <ThumbnailGrid
                        photos={photos}
                    />

                </section>

                <aside className="albumai-preview">

                    <PreviewPanel
                        album={album}
                    />

                </aside>

            </main>

            <footer className="albumai-footer">

                <span>

                    {project?.name || "No Project"}

                </span>

                <span>

                    Photos: {photos.length}

                </span>

                <span>

                    Pages: {album?.pages?.length || 0}

                </span>

                <span>

                    Status: {state.exporting ? "Exporting..." : "Ready"}

                </span>

            </footer>

        </div>

    );

}

export default function App() {

    return (

        <AppProvider>

            <AlbumWorkspace />

        </AppProvider>

    );

}