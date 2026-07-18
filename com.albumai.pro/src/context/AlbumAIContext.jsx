import React, {
    createContext,
    useContext,
    useMemo
} from "react";

import useAlbumAI from "../hooks/useAlbumAI";

const AlbumAIContext = createContext(null);

export function AlbumAIProvider({ children }) {

    const albumAI = useAlbumAI();

    const value = useMemo(() => albumAI, [albumAI]);

    return (

        <AlbumAIContext.Provider value={value}>

            {children}

        </AlbumAIContext.Provider>

    );

}

export function useAlbumAIContext() {

    const context = useContext(AlbumAIContext);

    if (!context) {

        throw new Error(
            "useAlbumAIContext must be used inside AlbumAIProvider."
        );

    }

    return context;

}

export default AlbumAIContext;