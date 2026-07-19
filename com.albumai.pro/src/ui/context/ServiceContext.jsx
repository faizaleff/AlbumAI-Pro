import { createContext, useContext } from "react";

const ServiceContext = createContext(null);

export function ServiceProvider({

    services,

    children

}) {

    return (

        <ServiceContext.Provider value={services}>

            {children}

        </ServiceContext.Provider>

    );

}

export function useServices() {

    const services =

        useContext(ServiceContext);

    if (!services) {

        throw new Error(

            "ServiceProvider not found."

        );

    }

    return services;

}