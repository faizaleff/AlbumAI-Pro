import React, {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

import AlbumAIPro from "../index";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {

    const [state, setState] = useState({});

    useEffect(() => {

        const updateState = () => {

            setState({

                ...AlbumAIPro.core.state.getAll()

            });

        };

        updateState();

        const events = AlbumAIPro.core.events;

        const subscriptions = [

            "app:initialized",
            "project:created",
            "folder:opened",
            "photos:loaded",
            "photo:added",
            "photo:removed",
            "photo:selected",
            "selection:cleared",
            "template:selected",
            "templates:loaded",
            "album:created",
            "album:generated",
            "album:loaded",
            "album:closed",
            "export:status",
            "app:reset"

        ];

        subscriptions.forEach(event =>

            events.on(event, updateState)

        );

        return () => {

            subscriptions.forEach(event =>

                events.off(event, updateState)

            );

        };

    }, []);

    return (

        <AppStateContext.Provider value={state}>

            {children}

        </AppStateContext.Provider>

    );

}

export function useAppState() {

    const context = useContext(AppStateContext);

    if (!context) {

        throw new Error(

            "useAppState must be used inside AppStateProvider."

        );

    }

    return context;

}

export default AppStateContext;