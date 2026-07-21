import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

import "./styles/index.css";

import {

    start,

    stop

} from "./main";

async function initialize() {

    try {

        await start();

    }

    catch (error) {

        console.error(

            "AlbumAI initialization failed.",

            error

        );

    }

}

initialize();

const container =

    document.getElementById("root");

if (!container) {

    throw new Error(

        'Root element "#root" not found.'

    );

}

const root =

    createRoot(container);

root.render(

    <React.StrictMode>

        <App />

    </React.StrictMode>

);

if (

    typeof window !== "undefined"

) {

    window.addEventListener(

        "beforeunload",

        async () => {

            try {

                await stop();

            }

            catch (error) {

                console.error(

                    "AlbumAI shutdown failed.",

                    error

                );

            }

        }

    );

}

if (

    import.meta?.hot

) {

    import.meta.hot.accept();

    import.meta.hot.dispose(

        async () => {

            await stop();

        }

    );

}