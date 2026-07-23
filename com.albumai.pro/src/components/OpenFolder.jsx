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
    const [executionDetails, setExecutionDetails] = useState(null);
    const [photoViewMode, setPhotoViewMode] = useState("icons");
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

    function onPhotoClick() {

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

    async function closeProject() {

        try {
            await App.closeProject();
        } catch (error) {
            setProjectError(error.message);
            return;
        }
        setFolderName("");
        setProjectError(null);
        forceRefresh(value => value + 1);

    }

    const loadTemplates = () => App.getProjectTemplates();
    const getRegisteredProjectTemplates = () => App.getRegisteredProjectTemplates();

    const addCurrentPsdToProject = file => App.addCurrentPsdToProject(file);

    const removeRegisteredProjectTemplate = id =>
        App.removeRegisteredProjectTemplate(id);

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

    const executeReplacementBatch = onProgress =>
        App.executeReplacementBatch(onProgress);

    const getCurrentExecutionSummary = () =>
        App.getCurrentExecutionSummary();

    const getCurrentBatchProgress = () =>
        App.getCurrentBatchProgress();

    const getCurrentExecutionLifecycle = () =>
        App.getCurrentExecutionLifecycle();

    const executeProject = onUpdate =>
        App.executeProject(onUpdate);
    const resumeProjectBatch = onUpdate =>
        App.resumeProjectBatch(onUpdate);
    const retryFailedTemplates = onUpdate =>
        App.retryFailedTemplates(onUpdate);
    const clearRecoveryState = async () => {
        const result = await App.clearRecoveryState();
        return result;
    };
    const getBatchRecoveryState = () =>
        App.getBatchRecoveryState();

    const getCurrentProjectExecutionSummary = () =>
        App.getCurrentProjectExecutionSummary();

    const getPhotos = () =>
        App.getPhotos();

    const getCurrentTemplate = () =>
        App.getCurrentTemplate();

    const setAutoSaveEnabled = enabled =>
        App.setAutoSaveEnabled(enabled);

    const getAutoSaveEnabled = () =>
        App.getAutoSaveEnabled();

    const setAutoSaveMode = mode =>
        App.setAutoSaveMode(mode);

    const getAutoSaveMode = () =>
        App.getAutoSaveMode();

    const getCurrentAutoSaveResult = () =>
        App.getCurrentAutoSaveResult();

    const setExportEnabled = enabled =>
        App.setExportEnabled(enabled);

    const getExportEnabled = () =>
        App.getExportEnabled();

    const setExportFormat = format =>
        App.setExportFormat(format);

    const getExportFormat = () =>
        App.getExportFormat();

    const getCurrentExportResult = () =>
        App.getCurrentExportResult();

    return (

        <div
            style={{
                display: "flex",
                height: "100%",
                width: "100%",
                boxSizing: "border-box",
                minHeight: 0,
                overflow: "hidden",
                color: "#ffffff",
                background: "#1e1e1e"
            }}
        >

            <div
                className="left-pane"
                style={{
                    flex: 2,
                    display: "flex",
                    flexDirection: "column",
                    padding: 15,
                    minHeight: 0,
                    minWidth: 0,
                    overflow: "hidden"
                }}
            >

                <div className="fixed-controls" style={{ flex: "0 0 auto" }}>
                <section
                    style={{
                        marginBottom: 15,
                        padding: 12,
                        background: "#2f2f2f",
                        borderRadius: 6
                    }}
                >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, marginBottom: 10 }}>
                        <span>Project: {hasProject ? project.metadata.name : "MISSING"}</span>
                        <span>Photos: {App.getPhotos().length}</span>
                        <span>Selected: {App.selection.getSelected().length}</span>
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

                <TemplateDocumentPanel
                    loadTemplates={loadTemplates}
                    getRegisteredProjectTemplates={getRegisteredProjectTemplates}
                    addCurrentPsdToProject={addCurrentPsdToProject}
                    removeRegisteredProjectTemplate={removeRegisteredProjectTemplate}
                    openTemplate={openTemplate}
                    planPhotoPlacement={planPhotoPlacement}
                    getCurrentPlacementPlan={getCurrentPlacementPlan}
                    buildPlacementExecutionPlan={buildPlacementExecutionPlan}
                    getCurrentPlacementExecutionPlan={getCurrentPlacementExecutionPlan}
                    getCurrentReplacementRequest={getCurrentReplacementRequest}
                    executeReplacementStep={executeReplacementStep}
                    executeReplacementBatch={executeReplacementBatch}
                    getCurrentExecutionSummary={getCurrentExecutionSummary}
                    getCurrentBatchProgress={getCurrentBatchProgress}
                    getCurrentExecutionLifecycle={getCurrentExecutionLifecycle}
                    executeProject={executeProject}
                    resumeProjectBatch={resumeProjectBatch}
                    retryFailedTemplates={retryFailedTemplates}
                    clearRecoveryState={clearRecoveryState}
                    getBatchRecoveryState={getBatchRecoveryState}
                    getCurrentProjectExecutionSummary={getCurrentProjectExecutionSummary}
                    getPhotos={getPhotos}
                    getCurrentTemplate={getCurrentTemplate}
                    setAutoSaveEnabled={setAutoSaveEnabled}
                    getAutoSaveEnabled={getAutoSaveEnabled}
                    setAutoSaveMode={setAutoSaveMode}
                    getAutoSaveMode={getAutoSaveMode}
                    getCurrentAutoSaveResult={getCurrentAutoSaveResult}
                    setExportEnabled={setExportEnabled}
                    getExportEnabled={getExportEnabled}
                    setExportFormat={setExportFormat}
                    getExportFormat={getExportFormat}
                    getCurrentExportResult={getCurrentExportResult}
                    onExecutionDetailsChange={setExecutionDetails}
                    projectId={project?.metadata?.id || null}
                    projectName={project?.metadata?.name || ""}
                    hasProject={hasProject}
                />
                </div>
                <div
                    className="fixed-view-toolbar"
                    style={{
                        flex: "0 0 auto",
                        display: "flex",
                        gap: 6,
                        marginBottom: 8
                    }}
                >
                    {[
                        ["icons", "Icons"],
                        ["list", "List"]
                    ].map(([mode, label]) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setPhotoViewMode(mode)}
                            aria-pressed={photoViewMode === mode}
                            style={{
                                fontWeight: photoViewMode === mode ? 700 : 400,
                                color: "#fff",
                                background: photoViewMode === mode ? "#17355d" : "transparent",
                                backgroundColor: photoViewMode === mode ? "#17355d" : "transparent",
                                border: photoViewMode === mode
                                    ? "2px solid #3B82F6"
                                    : "2px solid #b5b5b5",
                                borderRadius: 16,
                                padding: "4px 14px",
                                outline: "none"
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <ThumbnailGrid
                    photos={App.getPhotos()}
                    onPhotoClick={onPhotoClick}
                    viewMode={photoViewMode}
                />

            </div>

            <PreviewPanel
                photos={App.getPhotos()}
                selectedPhotoId={App.selection.getSelected()[0]?.id || null}
                executionDetails={executionDetails}
            />

        </div>

    );

}
