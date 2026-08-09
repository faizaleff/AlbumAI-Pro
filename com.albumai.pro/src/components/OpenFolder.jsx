import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import PhotoBrowserSection from "./PhotoBrowserSection";
import PreviewPanel from "./PreviewPanel";
import TemplateDocumentPanel from "./TemplateDocumentPanel";
import SelectionCount from "./SelectionCount";

import App from "../app/AppController";
import RefreshService from "../services/RefreshService";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import {
    canConfirmPhotoFolderChange,
    createIdlePhotoFolderChangeState,
    photoFolderChangeMessage,
    photoFolderChangeCommitOptions,
    photoFolderChangePreparationFailureState,
    shouldResetPhotoPreview,
    upgradePhotoFolderChangeForRecovery
} from "./photoFolderChangeMessages";

export default function OpenFolder() {

    const [folderName, setFolderName] = useState("");
    const [projectName, setProjectName] = useState("");
    const [projectError, setProjectError] = useState(null);
    const [projectAction, setProjectAction] = useState(null);
    const [executionDetails, setExecutionDetails] = useState(null);
    const [focusedPhotoId, setFocusedPhotoId] = useState(null);
    const [isImportingPhotos, setIsImportingPhotos] = useState(false);
    const [importedPhotoCount, setImportedPhotoCount] = useState(0);
    const [photoFolderAvailable, setPhotoFolderAvailable] = useState(false);
    const [photoFolderMessage, setPhotoFolderMessage] = useState(null);
    const [photoFolderChange, setPhotoFolderChange] = useState(
        createIdlePhotoFolderChangeState
    );
    const unavailableDiagnosticRef = useRef(null);
    const mountedRef = useRef(true);
    const photoFolderChangeAttemptRef = useRef(0);
    const photoFolderChangeBusyRef = useRef(false);
    const projectActionBusyRef = useRef(false);
    const photoFolderChangeProjectIdRef = useRef(null);
    const [, forceRefresh] = useState(0);

    PhotoBrowserPerformance.recordRender("OpenFolder");
    const project = App.project.getProject();
    const hasProject = !!project;
    const projectId = project?.metadata?.id || null;

    const clearPhotoFolderChangeState = useCallback(() => {
        photoFolderChangeAttemptRef.current += 1;
        photoFolderChangeBusyRef.current = false;
        if (mountedRef.current) {
            setPhotoFolderChange(createIdlePhotoFolderChangeState());
        }
    }, []);

    useEffect(() => {
        const projectChanged =
            photoFolderChangeProjectIdRef.current !== projectId;
        photoFolderChangeProjectIdRef.current = projectId;
        if (projectChanged || !projectId || !photoFolderAvailable) {
            clearPhotoFolderChangeState();
        }
    }, [
        clearPhotoFolderChangeState,
        photoFolderAvailable,
        projectId
    ]);

    useEffect(() => {
        PhotoBrowserPerformance.markPublished();
    });

    const markFolderUnavailable = useCallback((
        reason,
        hadFolderReference
    ) => {
        App.markPhotoFolderUnavailable();
        setPhotoFolderAvailable(false);
        setPhotoFolderMessage(
            hadFolderReference
                ? "Photo folder is unavailable. Open the folder again."
                : null
        );

        const diagnosticKey =
            `${project?.metadata?.id || "no-project"}:${reason}`;
        if (unavailableDiagnosticRef.current !== diagnosticKey) {
            unavailableDiagnosticRef.current = diagnosticKey;
            PhotoBrowserPerformance.trace(
                "PHOTO_FOLDER_UNAVAILABLE",
                {
                    reason,
                    hadFolderReference,
                    photoCount: App.getPhotos().length,
                    recoverable: true
                }
            );
        }
    }, [project?.metadata?.id]);

    useEffect(() => {
        let active = true;
        unavailableDiagnosticRef.current = null;

        if (!hasProject) {
            setPhotoFolderAvailable(false);
            setPhotoFolderMessage(null);
            return () => {
                active = false;
            };
        }

        App.getPhotoFolderStatus()
            .then(status => {
                if (!active) return;
                if (status.available) {
                    setPhotoFolderAvailable(true);
                    setPhotoFolderMessage(null);
                    return;
                }
                markFolderUnavailable(
                    status.hadFolderReference
                        ? "folder-reference-unavailable"
                        : "folder-reference-missing",
                    status.hadFolderReference
                );
            })
            .catch(error => {
                if (!active) return;
                markFolderUnavailable(
                    error?.message || "folder-validation-failed",
                    !!project?.metadata?.photoSource
                );
            });

        return () => {
            active = false;
        };
    }, [
        hasProject,
        markFolderUnavailable,
        project?.metadata?.id,
        project?.metadata?.photoSource
    ]);

    useEffect(() => {

        const unsubscribe = RefreshService.subscribe(scope => {

            if (scope === "thumbnails") return;
            PhotoBrowserPerformance.recordRenderUpdate(
                "OpenFolder",
                "forceRefresh",
                { scope }
            );
            PhotoBrowserPerformance.refresh();
            forceRefresh(value => value + 1);

        });

        return () => {
            PhotoBrowserPerformance.trace(
                "PHOTO_BROWSER_COMPONENT_UNMOUNT",
                {
                    photos: App.getPhotos().length
                }
            );
            unsubscribe();
        };

    }, []);

    useEffect(() => () => {
        mountedRef.current = false;
        photoFolderChangeAttemptRef.current += 1;
    }, []);

    const setCurrentPhotoFolderChange = useCallback((attempt, update) => {
        if (!mountedRef.current || attempt !== photoFolderChangeAttemptRef.current) {
            return;
        }
        setPhotoFolderChange(update);
    }, []);

    const changePhotoFolder = useCallback(async () => {
        if (!hasProject || photoFolderChangeBusyRef.current) return;

        const attempt = ++photoFolderChangeAttemptRef.current;
        photoFolderChangeBusyRef.current = true;
        setCurrentPhotoFolderChange(attempt, {
            busy: true, prepared: null, clearRecovery: false, message: null, error: null
        });
        try {
            const prepared = await App.preparePhotoFolderChange();
            if (!mountedRef.current || attempt !== photoFolderChangeAttemptRef.current) return;
            if (prepared.status === "CANCELLED") {
                setCurrentPhotoFolderChange(attempt, {
                    busy: false, prepared: null, clearRecovery: false, message: null, error: null
                });
                return;
            }
            if (prepared.status === "SAME_FOLDER") {
                const result = await App.commitPhotoFolderChange(prepared);
                if (!mountedRef.current || attempt !== photoFolderChangeAttemptRef.current) return;
                setCurrentPhotoFolderChange(attempt, {
                    busy: false, prepared: null, clearRecovery: false,
                    message: result.status === "SAME_FOLDER" ? photoFolderChangeMessage(result) : null,
                    error: result.status === "SAME_FOLDER" ? null : photoFolderChangeMessage(result)
                });
                if (result.status === "SAME_FOLDER") forceRefresh(value => value + 1);
                return;
            }
            if (prepared.status !== "PREPARED") {
                setCurrentPhotoFolderChange(
                    attempt,
                    photoFolderChangePreparationFailureState(prepared)
                );
                return;
            }
            setCurrentPhotoFolderChange(attempt, {
                busy: false, prepared, clearRecovery: false, message: null, error: null
            });
        } catch (error) {
            setCurrentPhotoFolderChange(attempt, {
                busy: false, prepared: null, clearRecovery: false, message: null,
                error: photoFolderChangeMessage()
            });
        } finally {
            if (attempt === photoFolderChangeAttemptRef.current) {
                photoFolderChangeBusyRef.current = false;
            }
        }
    }, [hasProject, setCurrentPhotoFolderChange]);

    const cancelPhotoFolderChange = useCallback(() => {
        const attempt = ++photoFolderChangeAttemptRef.current;
        photoFolderChangeBusyRef.current = false;
        setCurrentPhotoFolderChange(attempt, {
            busy: false, prepared: null, clearRecovery: false, message: null, error: null
        });
    }, [setCurrentPhotoFolderChange]);

    const confirmPhotoFolderChange = useCallback(async () => {
        const prepared = photoFolderChange.prepared;
        if (
            !prepared ||
            photoFolderChangeBusyRef.current ||
            !canConfirmPhotoFolderChange(photoFolderChange)
        ) return;

        const attempt = photoFolderChangeAttemptRef.current;
        photoFolderChangeBusyRef.current = true;
        setCurrentPhotoFolderChange(attempt, previous => ({ ...previous, busy: true, error: null }));
        try {
            const result = await App.commitPhotoFolderChange(
                prepared,
                photoFolderChangeCommitOptions(photoFolderChange)
            );
            if (!mountedRef.current || attempt !== photoFolderChangeAttemptRef.current) return;
            if (shouldResetPhotoPreview(result)) {
                setFocusedPhotoId(null);
                setFolderName(App.project.getProject()?.metadata?.photoSource?.name || "");
                setPhotoFolderAvailable(true);
                setPhotoFolderMessage(null);
                setCurrentPhotoFolderChange(attempt, {
                    busy: false, prepared: null, clearRecovery: false,
                    message: "Photo folder changed successfully.", error: null
                });
                forceRefresh(value => value + 1);
                return;
            }
            if (result.status === "RECOVERY_DECISION_REQUIRED") {
                setCurrentPhotoFolderChange(attempt, previous =>
                    upgradePhotoFolderChangeForRecovery(previous, result)
                );
                return;
            }
            setCurrentPhotoFolderChange(attempt, previous => ({
                ...previous, busy: false, error: photoFolderChangeMessage(result)
            }));
        } catch (error) {
            setCurrentPhotoFolderChange(attempt, previous => ({
                ...previous, busy: false, error: photoFolderChangeMessage()
            }));
        } finally {
            if (attempt === photoFolderChangeAttemptRef.current) {
                photoFolderChangeBusyRef.current = false;
            }
        }
    }, [photoFolderChange, setCurrentPhotoFolderChange]);

    async function openFolder() {

        if (!hasProject) {
            setProjectError("Create or open a project to continue.");
            return;
        }

        let progressTimer = null;
        try {
            setImportedPhotoCount(App.getPhotos().length);
            setIsImportingPhotos(true);
            progressTimer = setInterval(() => {
                setImportedPhotoCount(App.getPhotos().length);
            }, 150);

            const photos = await App.importPhotos();

            if (!photos) return;

            setPhotoFolderAvailable(true);
            setPhotoFolderMessage(null);
            unavailableDiagnosticRef.current = null;

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

            setPhotoFolderMessage("Unable to open the photo folder. Try again.");
            PhotoBrowserPerformance.trace("PHOTO_FOLDER_OPEN_FAILED", {
                recoverable: true
            });

        }
        finally {
            if (progressTimer != null) clearInterval(progressTimer);
            setImportedPhotoCount(App.getPhotos().length);
            setIsImportingPhotos(false);
        }

    }

    async function refreshFolder() {

        if (!hasProject || !photoFolderAvailable) {
            return;
        }

        try {

            await App.refreshPhotos();

            setPhotoFolderAvailable(true);
            setPhotoFolderMessage(null);
            forceRefresh(value => value + 1);

        }

        catch (error) {

            const reason = String(
                error?.message || error || "folder-refresh-failed"
            );
            const isUnavailable = [
                "no such file or directory",
                "invalid token",
                "unavailable volume",
                "folder before refreshing",
                "not found",
                "disconnected"
            ].some(value => reason.toLowerCase().includes(value));

            if (isUnavailable) {
                markFolderUnavailable(
                    reason,
                    !!project?.metadata?.photoSource
                );
                return;
            }

            console.error("Refresh photos:", error);

        }

    }

    const onPhotoClick = useCallback(photo => {

        setFocusedPhotoId(photo?.id || null);
        App.prioritizePhotoThumbnail(photo);

    }, []);

    async function runProjectAction(action, callback) {
        if (projectActionBusyRef.current) return null;
        projectActionBusyRef.current = true;
        setProjectAction(action);
        try {
            return await callback();
        } finally {
            projectActionBusyRef.current = false;
            if (mountedRef.current) setProjectAction(null);
        }
    }

    async function createProject() {

        if (projectActionBusyRef.current) return;

        const name = projectName.trim();

        if (!name) {
            setProjectError("Enter a project name.");
            return;
        }

        try {

            const created = await runProjectAction(
                "CREATING",
                () => App.createProject({ name })
            );

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

        if (projectActionBusyRef.current) return;

        try {

            const opened = await runProjectAction(
                "OPENING",
                () => App.openProject()
            );

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

        if (projectActionBusyRef.current) return;

        try {

            await runProjectAction(
                "SAVING",
                () => App.saveProject(
                    undefined,
                    { reason: "MANUAL_SAVE_PROJECT" }
                )
            );
            setProjectError(null);
            forceRefresh(value => value + 1);

        }

        catch (error) {

            setProjectError(error.message);

        }

    }

    async function closeProject() {

        if (projectActionBusyRef.current) return;

        try {
            await runProjectAction(
                "CLOSING",
                () => App.closeProject()
            );
        } catch (error) {
            setProjectError(error.message);
            return;
        }
        setFolderName("");
        setPhotoFolderAvailable(false);
        setPhotoFolderMessage(null);
        clearPhotoFolderChangeState();
        setProjectError(null);
        forceRefresh(value => value + 1);

    }

    const loadTemplates = useCallback(
        () => App.getProjectTemplates(),
        []
    );
    const getRegisteredProjectTemplates = () => App.getRegisteredProjectTemplates();
    const revalidateProjectTemplates = options => App.revalidateProjectTemplates(options);
    const getTemplateRegistryPreflightState = () => App.getTemplateRegistryPreflightState();
    const getTemplateRegistryRecoveryCompatibility = () =>
        App.getTemplateRegistryRecoveryCompatibility();

    const addCurrentPsdToProject = file => App.addCurrentPsdToProject(file);

    const removeRegisteredProjectTemplate = id =>
        App.removeRegisteredProjectTemplate(id);
    const moveRegisteredProjectTemplate = (id, targetIndex, method) =>
        App.moveRegisteredProjectTemplate(id, targetIndex, method);
    const requestBatchCancellation = () => App.requestBatchCancellation();

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
                        <span>Selected: <SelectionCount selection={App.selection} /></span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input
                            value={projectName}
                            onChange={event => setProjectName(event.target.value)}
                            placeholder="Project name"
                            disabled={hasProject || Boolean(projectAction)}
                        />
                        <button onClick={createProject} disabled={hasProject || Boolean(projectAction)}>
                            {projectAction === "CREATING" ? "Creating…" : "Create Project"}
                        </button>
                        <button onClick={openProject} disabled={hasProject || Boolean(projectAction)}>
                            {projectAction === "OPENING" ? "Opening…" : "Open Project"}
                        </button>
                        <button onClick={saveProject} disabled={!hasProject || Boolean(projectAction)}>
                            {projectAction === "SAVING" ? "Saving…" : "Save Project"}
                        </button>
                        <button onClick={closeProject} disabled={!hasProject || Boolean(projectAction)}>
                            {projectAction === "CLOSING" ? "Closing…" : "Close Project"}
                        </button>
                    </div>

                    {projectError && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#ff9999" }}>
                            Project: {projectError}
                        </div>
                    )}
                </section>

                <TemplateDocumentPanel
                    loadTemplates={loadTemplates}
                    getRegisteredProjectTemplates={getRegisteredProjectTemplates}
                    revalidateProjectTemplates={revalidateProjectTemplates}
                    getTemplateRegistryPreflightState={getTemplateRegistryPreflightState}
                    getTemplateRegistryRecoveryCompatibility={getTemplateRegistryRecoveryCompatibility}
                    addCurrentPsdToProject={addCurrentPsdToProject}
                    removeRegisteredProjectTemplate={removeRegisteredProjectTemplate}
                    moveRegisteredProjectTemplate={moveRegisteredProjectTemplate}
                    requestBatchCancellation={requestBatchCancellation}
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
                <PhotoBrowserSection
                    photos={App.getPhotos()}
                    onPhotoClick={onPhotoClick}
                    focusedPhotoId={focusedPhotoId}
                    onFocusPhoto={setFocusedPhotoId}
                    projectId={project?.metadata?.id || null}
                    folderLoaded={photoFolderAvailable}
                    folderMessage={photoFolderMessage}
                    onOpenFolder={openFolder}
                    onRefresh={refreshFolder}
                    onChangePhotoFolder={changePhotoFolder}
                    isLoading={isImportingPhotos}
                    loadingPhotoCount={importedPhotoCount}
                    photoFolderChange={{
                        ...photoFolderChange,
                        onCancel: cancelPhotoFolderChange,
                        onConfirm: confirmPhotoFolderChange,
                        onRecoveryAcceptance: accepted => setPhotoFolderChange(
                            previous => ({ ...previous, clearRecovery: accepted })
                        )
                    }}
                />

            </div>

            <PreviewPanel
                photos={App.getPhotos()}
                selection={App.selection}
                focusedPhotoId={focusedPhotoId}
                executionDetails={executionDetails}
            />

        </div>

    );

}
