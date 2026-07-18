import React from "react";

import { AlbumAIProvider } from "../context/AlbumAIContext";
import { AppStateProvider } from "../context/AppStateContext";
import { EventBusProvider } from "../context/EventBusContext";

export default function AppProvider({ children }) {

    return (

        <EventBusProvider>

            <AppStateProvider>

                <AlbumAIProvider>

                    {children}

                </AlbumAIProvider>

            </AppStateProvider>

        </EventBusProvider>

    );

}