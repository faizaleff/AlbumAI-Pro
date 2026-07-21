import React, { useEffect, useMemo, useState } from "react";

import Dashboard from "./components/Dashboard";
import Projects from "./components/Projects";
import Templates from "./components/Templates";
import Photos from "./components/Photos";
import Albums from "./components/Albums";
import ExportCenter from "./components/ExportCenter";
import Settings from "./components/Settings";

import UIController from "./core/ui/UIController";

export default function App() {

    const controller = useMemo(

        () => new UIController(),

        []

    );

    const [route, setRoute] = useState(

        "dashboard"

    );

    const [state, setState] = useState(

        controller.getState()

    );

    useEffect(() => {

        controller.initialize();

        controller.router.register(

            "dashboard"

        );

        controller.router.register(

            "projects"

        );

        controller.router.register(

            "templates"

        );

        controller.router.register(

            "photos"

        );

        controller.router.register(

            "albums"

        );

        controller.router.register(

            "export"

        );

        controller.router.register(

            "settings"

        );

        controller.router.navigate(

            "dashboard"

        );

        const unsubscribe =

            controller.stateStore.subscribe(

                () => {

                    setState(

                        controller.getState()

                    );

                }

            );

        return () => {

            unsubscribe();

            controller.destroy();

        };

    }, [controller]);

    const navigate = async page => {

        await controller.navigate(page);

        setRoute(page);

    };

    const renderPage = () => {

        switch (route) {

            case "projects":

                return <Projects controller={controller} />;

            case "templates":

                return <Templates controller={controller} />;

            case "photos":

                return <Photos controller={controller} />;

            case "albums":

                return <Albums controller={controller} />;

            case "export":

                return <ExportCenter controller={controller} />;

            case "settings":

                return <Settings controller={controller} />;

            default:

                return <Dashboard controller={controller} />;

        }

    };

    return (

        <div className="albumai-app">

            <header className="albumai-header">

                <h2>

                    AlbumAI Pro

                </h2>

                <nav>

                    <button onClick={() => navigate("dashboard")}>
                        Dashboard
                    </button>

                    <button onClick={() => navigate("projects")}>
                        Projects
                    </button>

                    <button onClick={() => navigate("templates")}>
                        Templates
                    </button>

                    <button onClick={() => navigate("photos")}>
                        Photos
                    </button>

                    <button onClick={() => navigate("albums")}>
                        Albums
                    </button>

                    <button onClick={() => navigate("export")}>
                        Export
                    </button>

                    <button onClick={() => navigate("settings")}>
                        Settings
                    </button>

                </nav>

            </header>

            <main>

                {renderPage()}

            </main>

            <footer>

                <small>

                    AlbumAI Pro v1.0.0

                </small>

            </footer>

        </div>

    );

}