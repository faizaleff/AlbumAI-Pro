// src/ui/App.jsx

import React, { useEffect, useState } from "react";

import Dashboard from "./routes/Dashboard";

import Bootstrap from "../container";

export default function App() {

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState(null);

    const [services, setServices] = useState(null);

    useEffect(() => {

        async function initialize() {

            try {

                const bootstrap = new Bootstrap();

                await bootstrap.initialize();

                setServices({

                    bootstrap,

                    albumService:
                        bootstrap.application(),

                    progressReporter:
                        bootstrap.resolve(
                            "progressReporter"
                        )

                });

            }

            catch (err) {

                console.error(err);

                setError(err);

            }

            finally {

                setLoading(false);

            }

        }

        initialize();

    }, []);

    if (loading) {

        return (

            <div className="app-loading">

                Initializing AlbumAI Pro...

            </div>

        );

    }

    if (error) {

        return (

            <div className="app-error">

                <h3>Initialization Failed</h3>

                <pre>{error.message}</pre>

            </div>

        );

    }

    return (

        <Dashboard

            services={services}

        />

    );

}