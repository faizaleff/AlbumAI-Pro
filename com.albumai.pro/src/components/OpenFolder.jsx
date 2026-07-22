import React, { useEffect, useState } from "react";

import ThumbnailGrid from "./ThumbnailGrid";
import PreviewPanel from "./PreviewPanel";
import TemplateDocumentPanel from "./TemplateDocumentPanel";
import Toolbar from "./Toolbar";

import App from "../app/AppController";
import RefreshService from "../services/RefreshService";

export default function OpenFolder() {

    const [folderName, setFolderName] = useState("");
    const [projectName, setProjectName] = useState("");
    const [projectError, setProjectError] = useState(null);
    const [, forceRefresh] = useState(0);

    const project = App.project.getProject();
    const hasProject = !!project;

    useEffect(() => {

        const unsubscribe = RefreshService.subscribe(() => {

            forceRefresh(value => value + 1);

        });

        return unsubscribe;

    }, []);

    async function openFolder() {

        if (!hasProject) {
            return;
        }

        try {

            const photos = await App.importPhotos();

            if (!photos) return;

            if (photos.length > 0) {

                App.selection.select(photos[0]);

            }

            setFolderName(
                App.project.getProject()?.metadata?.photoSource?.name ||
                ""
            );

            forceRefresh(value => value + 1);

        }
        catch (error) {

            console.error("OpenFolder:", error);

        }

    }

    async function refreshFolder() {

        if (!hasProject) {
            return;
        }

        try {

            await App.refreshPhotos();

            forceRefresh(value => value + 1);

        }

        catch (error) {

            console.error("Refresh photos:", error);

        }

    }

    function selectAll() {

        App.selection.selectAll();

        forceRefresh(value => value + 1);

    }

    function clearSelection() {

        App.selection.clear();

        forceRefresh(value => value + 1);

    }

    function onPhotoClick(photo) {

        App.selection.select(photo);

        forceRefresh(value => value + 1);

    }

    async function createProject() {

        const name = projectName.trim();

        if (!name) {
            setProjectError("Enter a project name.");
            return;
        }

        try {

            const created = await App.createProject({ name });

            if (!created) {
                return;
            }

            setProjectName("");
            setProjectError(null);
            forceRefresh(value => value + 1);

        }

        catch (error) {

            setProjectError(error.message);

        }

    }

    async function openProject() {

        try {

            const opened = await App.openProject();

            if (!opened) {
                return;
            }

            setProjectError(null);
            forceRefresh(value => value + 1);

        }

        catch (error) {

            setProjectError(error.message);

        }

    }

    async function saveProject() {

        try {

            await App.saveProject();
            setProjectError(null);
            forceRefresh(value => value + 1);

        }

        catch (error) {

            setProjectError(error.message);

        }

    }

    function closeProject() {

        App.closeProject();
        setFolderName("");
        setProjectError(null);
        forceRefresh(value => value + 1);

    }

    const loadTemplates = () => App.getProjectTemplates();

    const openTemplate = file =>
        App.openTemplateDocument(file);

    const planPhotoPlacement = options =>
        App.planPhotoPlacement(options);

    const getCurrentPlacementPlan = () =>
        App.getCurrentPlacementPlan();

    const buildPlacementExecutionPlan = () =>
        App.buildPlacementExecutionPlan();

    const getCurrentPlacementExecutionPlan = () =>
        App.getCurrentPlacementExecutionPlan();

    const getCurrentReplacementRequest = () =>
        App.getCurrentReplacementRequest();

    const executeReplacementStep = step =>
        App.executeReplacementStep(step);

    return (

        <div
            style={{
                display: "flex",
                height: "100vh",
                color: "#ffffff",
                background: "#1e1e1e"
            }}
        >

            <div
                style={{
                    flex: 2,
                    display: "flex",
                    flexDirection: "column",
                    padding: 15,
                    overflow: "hidden"
                }}
            >

                <section
                    style={{
                        marginBottom: 15,
                        padding: 12,
                        background: "#2f2f2f",
                        borderRadius: 6
                    }}
                >
                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                        {hasProject
                            ? `Project Active: ${project.metadata.name}`
                            : "Create or open a project to continue."}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input
                            value={projectName}
                            onChange={event => setProjectName(event.target.value)}
                            placeholder="Project name"
                            disabled={hasProject}
                        />
                        <button onClick={createProject} disabled={hasProject}>
                            Create Project
                        </button>
                        <button onClick={openProject} disabled={hasProject}>
                            Open Project
                        </button>
                        <button onClick={saveProject} disabled={!hasProject}>
                            Save Project
                        </button>
                        <button onClick={closeProject} disabled={!hasProject}>
                            Close Project
                        </button>
                    </div>

                    {projectError && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#ff9999" }}>
                            Project: {projectError}
                        </div>
                    )}
                </section>

                <Toolbar
                    onOpen={openFolder}
                    onRefresh={refreshFolder}
                    onSelectAll={selectAll}
                    onClearSelection={clearSelection}
                    projectActive={hasProject}
                    photoCount={App.getPhotos().length}
                    selectedCount={App.selection.getSelected().length}
                />

                <div
                    style={{
                        marginBottom: 15
                    }}
                >
                    <h3
                        style={{
                            margin: 0
                        }}
                    >
                        {folderName || "No Folder Open"}
                    </h3>

                    <div
                        style={{
                            marginTop: 6,
                            color: "#aaaaaa",
                            fontSize: 13
                        }}
                    >
                        Photos : {App.getPhotos().length}
                        {"  |  "}
                        Selected : {App.selection.getSelected().length}
                    </div>
                </div>

                <TemplateDocumentPanel
                    loadTemplates={loadTemplates}
                    openTemplate={openTemplate}
                    planPhotoPlacement={planPhotoPlacement}
                    getCurrentPlacementPlan={getCurrentPlacementPlan}
                    buildPlacementExecutionPlan={buildPlacementExecutionPlan}
                    getCurrentPlacementExecutionPlan={getCurrentPlacementExecutionPlan}
                    getCurrentReplacementRequest={getCurrentReplacementRequest}
                    executeReplacementStep={executeReplacementStep}
                    hasProject={hasProject}
                />

                <div
                    style={{
                        flex: 1,
                        overflow: "hidden"
                    }}
                >
                    <ThumbnailGrid
                        photos={App.getPhotos()}
                        onPhotoClick={onPhotoClick}
                    />
                </div>

            </div>

            <PreviewPanel
                photo={App.selection.getSelected()[0]}
            />

        </div>

    );

}
