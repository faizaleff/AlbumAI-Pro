import { useEffect, useState, useCallback } from "react";

import AppController from "../controllers/AppController";
import AlbumAIPro from "../index";

export default function useAlbumAI() {

    const [initialized, setInitialized] = useState(false);
    const [project, setProject] = useState(null);
    const [album, setAlbum] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {

        const initialize = async () => {

            setLoading(true);

            await AppController.initialize();

            setInitialized(true);

            setLoading(false);

        };

        initialize();

        const events = AlbumAIPro.core.events;

        const onPhotos = data => setPhotos(data || []);

        const onTemplate = data => setTemplate(data);

        const onProject = data => setProject(data);

        const onAlbum = data => setAlbum(data);

        events.on("photos:loaded", onPhotos);
        events.on("template:selected", onTemplate);
        events.on("project:created", onProject);
        events.on("album:generated", onAlbum);
        events.on("album:created", onAlbum);

        return () => {

            events.off("photos:loaded", onPhotos);
            events.off("template:selected", onTemplate);
            events.off("project:created", onProject);
            events.off("album:generated", onAlbum);
            events.off("album:created", onAlbum);

        };

    }, []);

    const openFolder = useCallback(folder => {

        return AppController.openFolder(folder);

    }, []);

    const createProject = useCallback(data => {

        return AppController.createProject(data);

    }, []);

    const generateAlbum = useCallback(options => {

        return AppController.generateAlbum(options);

    }, []);

    const exportAlbum = useCallback((format, options) => {

        return AppController.exportAlbum(format, options);

    }, []);

    const reset = useCallback(() => {

        AppController.reset();

        setProject(null);
        setAlbum(null);
        setPhotos([]);
        setTemplate(null);

    }, []);

    return {

        initialized,
        loading,

        project,
        album,
        photos,
        template,

        openFolder,
        createProject,
        generateAlbum,
        exportAlbum,
        reset,

        controllers: AppController.getControllers()

    };

}