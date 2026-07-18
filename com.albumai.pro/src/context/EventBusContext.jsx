import React, {
    createContext,
    useContext
} from "react";

import AlbumAIPro from "../index";

const EventBusContext = createContext(null);

export function EventBusProvider({ children }) {

    const eventBus = AlbumAIPro.core.events;

    return (

        <EventBusContext.Provider value={eventBus}>

            {children}

        </EventBusContext.Provider>

    );

}

export function useEventBus() {

    const eventBus = useContext(EventBusContext);

    if (!eventBus) {

        throw new Error(

            "useEventBus must be used inside EventBusProvider."

        );

    }

    return eventBus;

}

export function useEvent(eventName, handler) {

    const eventBus = useEventBus();

    React.useEffect(() => {

        if (!eventName || !handler)
            return;

        eventBus.on(

            eventName,

            handler

        );

        return () => {

            eventBus.off(

                eventName,

                handler

            );

        };

    }, [

        eventBus,

        eventName,

        handler

    ]);

}

export default EventBusContext;