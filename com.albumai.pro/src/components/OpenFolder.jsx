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
import SpreadCanvas from "./SpreadCanvas";
import SheetStoryboardStrip from "./SheetStoryboardStrip";
import AutoFlowModal from "./AutoFlowModal";
import PrintProofModal from "./PrintProofModal";
import {
    AlbumSheetMutationIntent,
    createAlbumSheetHistory,
    redoAlbumSheetHistory,
    undoAlbumSheetHistory
} from "../project/AlbumSheetSchema";

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
import {
    WIZARD_STEPS,
    computeCompletedSteps,
    canNavigateToStep,
    resolveWizardNavigation,
    workspaceModeForWizardStep
} from "../services/PhotoGroupingEngine";

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
    const [albumHistory, setAlbumHistory] = useState(() => createAlbumSheetHistory(App.project?.getProject?.()?.metadata?.album));
    const [albumSheetId, setAlbumSheetId] = useState("");
    const [registeredTemplates, setRegisteredTemplates] = useState(() => App.getRegisteredProjectTemplates?.() || []);
    const [albumTemplateId, setAlbumTemplateId] = useState(() => App.getRegisteredProjectTemplates?.()?.[0]?.id || "");
    const [selectedAlbumSheetId, setSelectedAlbumSheetId] = useState("");
    const [albumSheetLabel, setAlbumSheetLabel] = useState("");
    const [albumDuplicateId, setAlbumDuplicateId] = useState("");
    const [albumMutationBusy, setAlbumMutationBusy] = useState(false);
    const [albumMutationError, setAlbumMutationError] = useState(null);
    const [albumSheetRenderBusy, setAlbumSheetRenderBusy] = useState(false);
    const [isAutoFlowModalOpen, setIsAutoFlowModalOpen] = useState(false);
    const [isPrintProofModalOpen, setIsPrintProofModalOpen] = useState(false);
    const unavailableDiagnosticRef = useRef(null);
    const mountedRef = useRef(true);
    const photoFolderChangeAttemptRef = useRef(0);
    const photoFolderChangeBusyRef = useRef(false);
    const projectActionBusyRef = useRef(false);
    const photoFolderChangeProjectIdRef = useRef(null);
    const [, forceRefresh] = useState(0);
    const [wizardStep, setWizardStep] = useState(1);
    const activeWorkspaceMode = workspaceModeForWizardStep(wizardStep);

    PhotoBrowserPerformance.recordRender("OpenFolder");
    const project = App.project.getProject();
    const hasProject = !!project;
    const projectId = project?.metadata?.id || null;
    const album = albumHistory?.present || project?.metadata?.album || null;
    const albumMutationLocked = App.isAlbumSheetMutationLocked();
    const workspacePhotos = App.getPhotos();
    const [selectedPhoto, setSelectedPhoto] = useState(() => App.selection.getSelected()[0] || null);
    const templateList = registeredTemplates.length > 0
        ? registeredTemplates
        : (App.getRegisteredProjectTemplates?.() || []);
    const activeSheet = album?.sheets?.find(sheet => sheet.id === selectedAlbumSheetId) || album?.sheets?.[0] || null;
    const activeTemplate = templateList.find(t => t.id === activeSheet?.templateId || t.name === activeSheet?.templateId || t.fileName === activeSheet?.templateId) || templateList[0] || null;
    const activeSelectedPhoto = selectedPhoto || App.selection.getSelected()[0] || null;

    useEffect(() => {
        return App.selection.subscribe(() => {
            setSelectedPhoto(App.selection.getSelected()[0] || null);
        });
    }, []);

    const refreshRegisteredTemplates = useCallback(() => {
        const entries = App.getRegisteredProjectTemplates?.() || [];
        setRegisteredTemplates(entries);
        return entries;
    }, []);

    const keptPhotoCount = workspacePhotos.filter(p => {
        const decision = App.culling?.getDecision?.(p.id);
        return decision === "keep" || decision === "KEEP";
    }).length;
    const placedPhotoCount = activeSheet?.slots?.filter(s => s.photoId)?.length || 0;
    const wizardCompletedSteps = computeCompletedSteps({
        photoCount: workspacePhotos.length,
        analysisComplete: workspacePhotos.length > 0,
        groupsReviewed: workspacePhotos.length > 0,
        keptPhotoCount,
        placedPhotoCount,
        exportComplete: false
    });
    const handleWizardStepClick = (stepId, { directDesignerEntry = false } = {}) => {
        const isAllowed = resolveWizardNavigation({
            currentStep: wizardStep,
            targetStep: stepId,
            completedSteps: wizardCompletedSteps,
            hasProject,
            photoCount: workspacePhotos.length,
            directDesignerEntry
        });
        if (!isAllowed) return;
        setWizardStep(stepId);
    };

    useEffect(() => {
        setAlbumHistory(createAlbumSheetHistory(project?.metadata?.album));
        setAlbumSheetId("");
        setSelectedAlbumSheetId("");
        setAlbumSheetLabel("");
        setAlbumDuplicateId("");
        setAlbumMutationError(null);
        refreshRegisteredTemplates();
    }, [projectId, refreshRegisteredTemplates]);

    useEffect(() => {
        if (registeredTemplates.length > 0) {
            setAlbumTemplateId(current =>
                registeredTemplates.some(t => t.id === current)
                    ? current
                    : (registeredTemplates[0]?.id || "")
            );
        } else {
            setAlbumTemplateId("");
        }
    }, [registeredTemplates]);

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
            .then(async status => {
                if (!active) return;
                if (status.available) {
                    if (App.getPhotos().length === 0 && project?.metadata?.photoSource) {
                        try {
                            await App.refreshPhotos();
                        } catch (_) {}
                    }
                    if (!active) return;
                    setPhotoFolderAvailable(true);
                    setFolderName(project?.metadata?.photoSource?.name || "");
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

    const onPhotoClick = useCallback((photo, event) => {

        setFocusedPhotoId(photo?.id || null);
        App.selection.handleClick(photo, event);
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
            setWizardStep(1);
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

            const currentPhotos = App.getPhotos();
            if (currentPhotos.length > 0) {
                setPhotoFolderAvailable(true);
                setFolderName(opened?.metadata?.photoSource?.name || "");
                setPhotoFolderMessage(null);
            }

            setWizardStep(1);
            setProjectError(null);
            refreshRegisteredTemplates();
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
        setWizardStep(1);
        setFolderName("");
        setPhotoFolderAvailable(false);
        setPhotoFolderMessage(null);
        clearPhotoFolderChangeState();
        setProjectError(null);
        forceRefresh(value => value + 1);

    }

    async function mutateAlbum(mutation) {

        const currentHistory = albumHistory || createAlbumSheetHistory(project?.metadata?.album);
        if (!currentHistory) {
            setAlbumMutationError("No active album project available.");
            return false;
        }

        if (albumMutationBusy) return false;

        setAlbumMutationBusy(true);
        setAlbumMutationError(null);

        try {
            const result = await App.saveAlbumSheetMutation(currentHistory, mutation);

            if (!result.accepted) {
                const message = (Array.isArray(result.reasonCodes) && result.reasonCodes.length > 0)
                    ? result.reasonCodes.join(", ")
                    : "Sheet change was not saved.";
                setAlbumMutationError(message);
                return false;
            }

            if (result.changed) {
                setAlbumHistory(result.history);
            }
            return result.changed;
        } catch (error) {
            setAlbumMutationError(error?.message || "Sheet change was not saved.");
            return false;
        } finally {
            setAlbumMutationBusy(false);
        }

    }

    async function addAlbumSheet() {

        const templates = registeredTemplates.length > 0
            ? registeredTemplates
            : (App.getRegisteredProjectTemplates?.() || []);

        if (!templates.length) {
            setAlbumMutationError("Register at least one PSD template before adding spreads.");
            return;
        }

        const templateId = (albumTemplateId && templates.some(t => t.id === albumTemplateId))
            ? albumTemplateId
            : templates[0].id;

        const existingIds = new Set((album?.sheets || []).map(sheet => sheet.id));
        let nextNum = 1;
        let defaultId;
        do {
            defaultId = `Spread_${String(nextNum).padStart(2, "0")}`;
            nextNum += 1;
        } while (existingIds.has(defaultId));
        const id = albumSheetId.trim() || defaultId;

        const added = await mutateAlbum({
            intent: AlbumSheetMutationIntent.ADD,
            sheet: { id, templateId, label: id }
        });
        if (added) {
            setAlbumSheetId("");
            setSelectedAlbumSheetId(id);
        }

    }

    async function removeAlbumSheet(sheetId) {

        const removed = await mutateAlbum({
            intent: AlbumSheetMutationIntent.REMOVE,
            sheetId
        });
        if (removed && selectedAlbumSheetId === sheetId) {
            setSelectedAlbumSheetId("");
            setAlbumSheetLabel("");
            setAlbumDuplicateId("");
        }

    }

    function selectAlbumSheet(sheet) {

        setSelectedAlbumSheetId(sheet.id);
        setAlbumSheetLabel(sheet.label || sheet.id);
        setAlbumDuplicateId(`${sheet.id}-copy`);
        setAlbumMutationError(null);

    }

    async function renameSelectedAlbumSheet() {

        if (!selectedAlbumSheetId) return;

        await mutateAlbum({
            intent: AlbumSheetMutationIntent.RENAME,
            sheetId: selectedAlbumSheetId,
            label: albumSheetLabel
        });

    }

    async function duplicateSelectedAlbumSheet() {

        const newSheetId = albumDuplicateId.trim();

        if (!selectedAlbumSheetId || !newSheetId) {
            setAlbumMutationError("Enter a new Sheet ID before duplicating.");
            return;
        }

        const duplicated = await mutateAlbum({
            intent: AlbumSheetMutationIntent.DUPLICATE,
            sheetId: selectedAlbumSheetId,
            newSheetId
        });
        if (duplicated) {
            const source = album?.sheets?.find(sheet => sheet.id === selectedAlbumSheetId);
            setSelectedAlbumSheetId(newSheetId);
            setAlbumSheetLabel(source?.label || newSheetId);
            setAlbumDuplicateId(`${newSheetId}-copy`);
        }

    }

    async function moveAlbumSheet(sheetId, targetIndex) {

        await mutateAlbum({
            intent: AlbumSheetMutationIntent.MOVE,
            sheetId,
            targetIndex
        });

    }

    async function duplicateAlbumSheet(sheetId) {
        const source = album?.sheets?.find(s => s.id === sheetId);
        if (!source) return;
        const newSheetId = `${sheetId}-copy-${Date.now().toString(36).slice(-4)}`;
        await mutateAlbum({
            intent: AlbumSheetMutationIntent.DUPLICATE,
            sheetId,
            newSheetId
        });
    }

    async function assignAlbumSheetSlot(sheetId, slotId, photoId, cropFocus = "center") {
        await mutateAlbum({
            intent: AlbumSheetMutationIntent.ASSIGN_SLOT,
            sheetId,
            slotId,
            photoId,
            cropFocus
        });
    }

    async function unassignAlbumSheetSlot(sheetId, slotId) {
        await mutateAlbum({
            intent: AlbumSheetMutationIntent.UNASSIGN_SLOT,
            sheetId,
            slotId
        });
    }

    async function swapAlbumSheetSlots(sheetId, slotIdA, slotIdB) {
        await mutateAlbum({
            intent: AlbumSheetMutationIntent.SWAP_SLOTS,
            sheetId,
            slotIdA,
            slotIdB
        });
    }

    async function setAlbumSheetSlotCrop(sheetId, slotId, cropFocus) {
        await mutateAlbum({
            intent: AlbumSheetMutationIntent.SET_SLOT_CROP,
            sheetId,
            slotId,
            cropFocus
        });
    }

    async function renderAlbumSheet(sheetId) {
        if (!sheetId || albumSheetRenderBusy) return;
        setAlbumSheetRenderBusy(true);
        setAlbumMutationError(null);
        try {
            const request = App.createAlbumSheetRenderRequest(sheetId);
            if (!request.accepted) {
                setAlbumMutationError(request.reasonCodes?.join(", ") || "Cannot render sheet.");
                return;
            }
            await App.executeAlbumSheetRenderRequest(request.request);
        } catch (error) {
            setAlbumMutationError(error?.message || "Failed to render sheet.");
        } finally {
            setAlbumSheetRenderBusy(false);
        }
    }

    async function handleApplyAutoFlow(generatedSheets, append = false) {
        if (!Array.isArray(generatedSheets) || generatedSheets.length === 0) return;
        const currentSheets = album?.sheets || [];
        const nextSheets = append ? [...currentSheets, ...generatedSheets] : generatedSheets;
        const result = await mutateAlbum({
            intent: AlbumSheetMutationIntent.SET_SHEETS,
            sheets: nextSheets
        });
        if (result && nextSheets.length > 0) {
            setSelectedAlbumSheetId(nextSheets[0].id);
            setAlbumSheetLabel(nextSheets[0].label || nextSheets[0].id);
        }
    }

    async function handleExportPrint(exportPayload) {
        if (exportPayload?.type === "LAB_PRINT") {
            setAlbumSheetRenderBusy(true);
            try {
                const summary = await App.executeAlbumBatchRender({
                    album,
                    exportOptions: exportPayload
                });
                if (!summary?.success) {
                    const failedSheets = Number(summary?.failedSheets) || 0;
                    const error = new Error(
                        `Lab Print Batch completed with ${failedSheets} failed spread(s).`
                    );
                    error.code = "ALBUM_BATCH_RENDER_FAILED";
                    error.summary = summary;
                    throw error;
                }
                return summary;
            } finally {
                setAlbumSheetRenderBusy(false);
            }
        }
        return null;
    }

    async function restoreAlbumHistory(operation) {

        if (!albumHistory || albumMutationBusy) return;

        const transition = operation(albumHistory);
        if (!transition.changed) return;

        setAlbumMutationBusy(true);
        setAlbumMutationError(null);
        try {
            const result = await App.saveAlbumSheetHistory(
                albumHistory,
                transition.history
            );
            if (!result.accepted) {
                setAlbumMutationError(result.reasonCodes?.join(", ") || "Sheet history was not saved.");
                return;
            }
            setAlbumHistory(result.history);
        } catch (error) {
            setAlbumMutationError(error?.message || "Sheet history was not saved.");
        } finally {
            setAlbumMutationBusy(false);
        }

    }

    const loadTemplates = useCallback(
        () => App.getProjectTemplates(),
        []
    );
    const getRegisteredProjectTemplates = () => App.getRegisteredProjectTemplates();
    const revalidateProjectTemplates = async options => {
        const result = await App.revalidateProjectTemplates(options);
        refreshRegisteredTemplates();
        return result;
    };
    const getTemplateRegistryPreflightState = () => App.getTemplateRegistryPreflightState();
    const getTemplateRegistryRecoveryCompatibility = () =>
        App.getTemplateRegistryRecoveryCompatibility();

    const addCurrentPsdToProject = async file => {
        const result = await App.addCurrentPsdToProject(file);
        refreshRegisteredTemplates();
        return result;
    };
    const getActivePhotoshopDocument = () => App.getActivePhotoshopDocument();

    const removeRegisteredProjectTemplate = async id => {
        const result = await App.removeRegisteredProjectTemplate(id);
        refreshRegisteredTemplates();
        return result;
    };
    const moveRegisteredProjectTemplate = async (id, targetIndex, method) => {
        const result = await App.moveRegisteredProjectTemplate(id, targetIndex, method);
        refreshRegisteredTemplates();
        return result;
    };
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
    const createAlbumSheetRenderRequest = sheetId =>
        App.createAlbumSheetRenderRequest(sheetId);
    const executeAlbumSheetRenderRequest = (request, onUpdate) =>
        App.executeAlbumSheetRenderRequest(request, onUpdate);
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
            className="albumai-workspace-layout"
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
                boxSizing: "border-box",
                minHeight: 0,
                overflow: "hidden",
                color: "#ffffff",
                background: "#121418"
            }}
        >
            {/* Top Workspace Navigation Bar */}
            <header className="workspace-top-bar" style={{ minHeight: 42 }}>
                <div className="workspace-brand-group">
                    <span className="workspace-brand-title">
                        <span>✨ AlbumAI Pro</span>
                    </span>
                    <span className={`workspace-project-badge ${hasProject ? "active" : ""}`}>
                        {hasProject ? `📁 ${project.metadata.name}` : "v1.0.1"}
                    </span>
                </div>

                {hasProject && (
                    <>
                        <nav className="wizard-step-bar" role="navigation" aria-label="Workflow Steps">
                            {WIZARD_STEPS.map((step, idx) => {
                                const isActive = step.id === wizardStep;
                                const isCompleted = wizardCompletedSteps?.has(step.id);
                                const isClickable = canNavigateToStep(wizardStep, step.id, wizardCompletedSteps);
                                const isLocked = !isClickable && !isActive && !isCompleted;

                                let cls = "wizard-step";
                                if (isActive) cls += " wizard-step--active";
                                if (isCompleted) cls += " wizard-step--completed";
                                if (isLocked) cls += " wizard-step--locked";

                                return (
                                    <React.Fragment key={step.id}>
                                        {idx > 0 && (
                                            <div
                                                className={`wizard-step-connector${isCompleted || wizardCompletedSteps?.has(step.id - 1) ? " filled" : ""}`}
                                                aria-hidden="true"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            className={cls}
                                            onClick={() => handleWizardStepClick(step.id)}
                                            disabled={isLocked}
                                            title={isLocked ? `Complete Step ${step.id - 1} first` : `${step.id}. ${step.label} (${step.description})`}
                                            aria-current={isActive ? "step" : undefined}
                                        >
                                            <span className="wizard-step-icon">
                                                {isCompleted ? "✓" : step.icon}
                                            </span>
                                            <span className="wizard-step-label">{step.id}. {step.label}</span>
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </nav>

                        <div className="workspace-quick-actions">
                            <button
                                type="button"
                                className="workspace-quick-btn"
                                onClick={saveProject}
                                disabled={!hasProject || Boolean(projectAction)}
                                title="Save Project Metadata"
                            >
                                {projectAction === "SAVING" ? "Saving…" : "💾 Save"}
                            </button>
                            <button
                                type="button"
                                className="workspace-quick-btn"
                                onClick={() => restoreAlbumHistory(undoAlbumSheetHistory)}
                                disabled={albumMutationLocked || albumMutationBusy || !albumHistory?.past?.length}
                                title="Undo Sheet Change"
                            >
                                ⟲ Undo
                            </button>
                            <button
                                type="button"
                                className="workspace-quick-btn"
                                onClick={() => restoreAlbumHistory(redoAlbumSheetHistory)}
                                disabled={albumMutationLocked || albumMutationBusy || !albumHistory?.future?.length}
                                title="Redo Sheet Change"
                            >
                                ⟳ Redo
                            </button>
                        </div>
                    </>
                )}
            </header>

            {/* Mode-specific Workspace View */}
            <div className="workspace-view-container">
                {!hasProject ? (
                    <div
                        className="welcome-landing-screen"
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: "1 1 auto",
                            width: "100%",
                            padding: "40px 20px",
                            boxSizing: "border-box",
                            textAlign: "center"
                        }}
                    >
                        <div style={{ fontSize: 40, marginBottom: 8 }}>✨</div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0", color: "#f0f6fc", letterSpacing: "0.02em" }}>
                            AlbumAI Pro
                        </h1>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                            <span style={{ fontSize: 11, background: "#1f6feb22", color: "#58a6ff", border: "1px solid #388bfd44", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                                v1.0.1
                            </span>
                            <span style={{ fontSize: 12, color: "#8b949e" }}>
                                Smart Wedding & Event Album Designer
                            </span>
                        </div>

                        <div
                            style={{
                                background: "#161b22",
                                border: "1px solid #30363d",
                                borderRadius: 10,
                                padding: "24px 28px",
                                width: "100%",
                                maxWidth: 360,
                                boxSizing: "border-box",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
                            }}
                        >
                            <div style={{ marginBottom: 14, textAlign: "left" }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#c9d1d9", display: "block", marginBottom: 6 }}>
                                    Project Name
                                </label>
                                <input
                                    value={projectName}
                                    onChange={event => setProjectName(event.target.value)}
                                    placeholder="e.g. Rahul_Ananya_Wedding"
                                    disabled={hasProject || Boolean(projectAction)}
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px",
                                        background: "#0d1117",
                                        border: "1px solid #30363d",
                                        borderRadius: 6,
                                        color: "#fff",
                                        fontSize: 13,
                                        boxSizing: "border-box"
                                    }}
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={createProject}
                                    disabled={hasProject || Boolean(projectAction) || !projectName.trim()}
                                    style={{
                                        padding: "10px 16px",
                                        background: projectName.trim() ? "#238636" : "#21262d",
                                        borderColor: projectName.trim() ? "#2ea043" : "#30363d",
                                        color: projectName.trim() ? "#fff" : "#6e7681",
                                        borderRadius: 6,
                                        fontWeight: 600,
                                        fontSize: 13,
                                        cursor: projectName.trim() ? "pointer" : "not-allowed",
                                        border: "1px solid",
                                        transition: "all 0.15s ease"
                                    }}
                                >
                                    {projectAction === "CREATING" ? "Creating Project…" : "+ Create Project"}
                                </button>

                                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
                                    <div style={{ flex: 1, height: 1, background: "#30363d" }} />
                                    <span style={{ fontSize: 11, color: "#6e7681" }}>or</span>
                                    <div style={{ flex: 1, height: 1, background: "#30363d" }} />
                                </div>

                                <button
                                    type="button"
                                    onClick={openProject}
                                    disabled={hasProject || Boolean(projectAction)}
                                    style={{
                                        padding: "10px 16px",
                                        background: "#21262d",
                                        borderColor: "#30363d",
                                        color: "#c9d1d9",
                                        borderRadius: 6,
                                        fontWeight: 600,
                                        fontSize: 13,
                                        cursor: "pointer",
                                        border: "1px solid #30363d",
                                        transition: "all 0.15s ease"
                                    }}
                                >
                                    {projectAction === "OPENING" ? "Opening Project…" : "📁 Open Existing Project"}
                                </button>
                            </div>

                            {projectError && (
                                <div style={{ marginTop: 12, fontSize: 11, color: "#f85149", background: "#f8514911", border: "1px solid #f8514933", padding: "6px 10px", borderRadius: 4 }}>
                                    ⚠️ {projectError}
                                </div>
                            )}
                        </div>
                    </div>
                ) : activeWorkspaceMode === "LIBRARY" && (
                    <div className="library-workspace-container">
                        <div className="left-pane album-workspace-scroll-pane">
                            <section
                                className="album-workspace-section album-workspace-project-section"
                                style={{
                                    marginBottom: 12,
                                    padding: 12,
                                    background: "#1c1f26",
                                    borderRadius: 6,
                                    border: "1px solid #2d333f"
                                }}
                            >
                                <div className="album-workspace-summary" style={{ fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#8b949e", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
                                    <div className="album-workspace-meta-stats" style={{ display: "flex", gap: "6px 12px", flexWrap: "wrap", minWidth: 0 }}>
                                        <span>Project: <strong style={{ color: "#f0f3f6" }}>{project.metadata.name}</strong></span>
                                        <span>Photos: <strong style={{ color: "#f0f3f6" }}>{App.getPhotos().length}</strong></span>
                                        <span>Selected: <SelectionCount selection={App.selection} /></span>
                                    </div>
                                    <div className="album-workspace-action-group album-workspace-action-group--primary" style={{ display: "flex", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
                                        <button onClick={closeProject} disabled={!hasProject || Boolean(projectAction)} style={{ fontSize: 11, padding: "3px 8px" }}>
                                            {projectAction === "CLOSING" ? "Closing…" : "Close Project"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleWizardStepClick(4, { directDesignerEntry: true })}
                                            style={{ background: "#1f6feb", borderColor: "#388bfd", color: "#fff", fontWeight: 600, fontSize: 11, padding: "3px 10px" }}
                                        >
                                            🎨 Go to Designer →
                                        </button>
                                    </div>
                                </div>

                                {projectError && (
                                    <div style={{ marginTop: 8, fontSize: 12, color: "#ff9999" }}>
                                        Project: {projectError}
                                    </div>
                                )}
                            </section>

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
                            diagnostics={{
                                hasProject,
                                projectId: project?.metadata?.id || null,
                                projectName: project?.metadata?.name || "",
                                healthPhotos: getPhotos(),
                                healthTemplate: getCurrentTemplate(),
                                placementPlan: getCurrentPlacementPlan(),
                                placementError: null,
                                executionPlan: getCurrentPlacementExecutionPlan(),
                                replacementRequest: getCurrentReplacementRequest(),
                                document: null,
                                autoSaveEnabled: getAutoSaveEnabled(),
                                autoSaveMode: getAutoSaveMode(),
                                autoSaveResult: getCurrentAutoSaveResult(),
                                exportEnabled: getExportEnabled(),
                                exportFormat: getExportFormat(),
                                exportResult: getCurrentExportResult(),
                                replacementResult: null,
                                executionSummary: getCurrentExecutionSummary(),
                                batchProgress: getCurrentBatchProgress(),
                                executionLifecycle: getCurrentExecutionLifecycle(),
                                projectExecutionSummary: getCurrentProjectExecutionSummary(),
                                registeredTemplates: getRegisteredProjectTemplates(),
                                registryError: null,
                                recoveryState: getBatchRecoveryState(),
                                recoveryBusy: Boolean(projectAction),
                                onResumeBatch: resumeProjectBatch,
                                onRetryFailed: retryFailedTemplates,
                                onClearRecovery: clearRecoveryState
                            }}
                        />
                    </div>
                )}

                {activeWorkspaceMode === "DESIGNER" && (
                    <div className="workspace-mode-pane">
                        {!hasProject ? (
                            <div className="workspace-empty-state">
                                <div className="workspace-empty-icon">🎨</div>
                                <div className="workspace-empty-title">No Project Open</div>
                                <div className="workspace-empty-subtitle">
                                    Create or open a project in Library mode to start designing multi-sheet album spreads.
                                </div>
                                <button
                                    type="button"
                                    className="workspace-empty-action-btn"
                                    onClick={() => handleWizardStepClick(1)}
                                >
                                    📁 Go to Library & Projects
                                </button>
                            </div>
                        ) : (
                            <>
                                <section
                                    className="album-workspace-section album-sheets-section"
                                    style={{
                                        padding: 12,
                                        background: "#1c1f26",
                                        borderRadius: 6,
                                        border: "1px solid #2d333f"
                                    }}
                                >
                                    <div className="album-workspace-section-header" style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <strong style={{ fontSize: 13 }}>Album Spreads & Layouts</strong>
                                        <span style={{ fontSize: 11, color: "#8b949e", background: "#262b35", padding: "2px 8px", borderRadius: 10 }}>
                                            {album?.sheets?.length || 0} spreads defined
                                        </span>
                                    </div>

                                    <div className="album-workspace-action-row" style={{ marginBottom: 10 }}>
                                        <div className="album-workspace-action-group">
                                            <input
                                                value={albumSheetId}
                                                onChange={event => setAlbumSheetId(event.target.value)}
                                                placeholder="Spread ID (e.g. Spread_1)"
                                                disabled={albumMutationLocked || albumMutationBusy}
                                            />
                                            <select
                                                value={albumTemplateId || registeredTemplates[0]?.id || ""}
                                                onChange={event => setAlbumTemplateId(event.target.value)}
                                                disabled={albumMutationLocked || albumMutationBusy || !registeredTemplates.length}
                                            >
                                                {!registeredTemplates.length && <option value="">No templates registered</option>}
                                                {registeredTemplates.map(template => (
                                                    <option key={template.id} value={template.id}>
                                                        {template.name || template.fileName || template.id}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={addAlbumSheet}
                                                disabled={albumMutationLocked || albumMutationBusy || !registeredTemplates.length}
                                            >
                                                + Add Spread
                                            </button>
                                        </div>
                                        <div className="album-workspace-action-group">
                                            <button
                                                type="button"
                                                className="album-autoflow-btn"
                                                onClick={() => setIsAutoFlowModalOpen(true)}
                                                disabled={albumMutationLocked || albumMutationBusy || !registeredTemplates.length}
                                                title={
                                                    !registeredTemplates.length
                                                        ? "Register at least one PSD template to use Smart Auto-Flow"
                                                        : (albumMutationLocked || albumMutationBusy)
                                                            ? "Spread changes are locked while the batch is running"
                                                            : "Open Smart Auto-Flow Engine"
                                                }
                                            >
                                                ⚡ Smart Auto-Flow
                                            </button>
                                            <button
                                                type="button"
                                                className="album-printproof-btn"
                                                onClick={() => setIsPrintProofModalOpen(true)}
                                                disabled={albumMutationLocked || albumMutationBusy || !album?.sheets?.length}
                                                title={
                                                    !album?.sheets?.length
                                                        ? "Add at least one spread to use Print & Proof"
                                                        : (albumMutationLocked || albumMutationBusy)
                                                            ? "Spread changes are locked while the batch is running"
                                                            : "Open Print Export & PDF Proofing Suite"
                                                }
                                            >
                                                🖨 Print & Proof
                                            </button>
                                        </div>
                                    </div>

                                    {!registeredTemplates.length && (
                                        <div style={{ fontSize: 12, color: "#e3b341", padding: 6, background: "rgba(227, 179, 65, 0.1)", borderRadius: 4 }}>
                                            ⚠️ Register at least one PSD template in the panel below to add spreads.
                                        </div>
                                    )}
                                    {albumMutationLocked && (
                                        <div style={{ fontSize: 12, color: "#ffca7a", marginTop: 4 }}>
                                            Sheet changes are locked while the batch is running or stopping.
                                        </div>
                                    )}
                                    {albumMutationError && (
                                        <div style={{ fontSize: 12, color: "#ff9999", marginTop: 6 }}>
                                            Album: {albumMutationError}
                                        </div>
                                    )}

                                    {!!album?.sheets?.length && (
                                        <>
                                            <SpreadCanvas
                                                sheet={activeSheet}
                                                template={activeTemplate}
                                                photos={workspacePhotos}
                                                selectedPhoto={activeSelectedPhoto}
                                                onAssignSlot={assignAlbumSheetSlot}
                                                onUnassignSlot={unassignAlbumSheetSlot}
                                                onSwapSlots={swapAlbumSheetSlots}
                                                onSetSlotCrop={setAlbumSheetSlotCrop}
                                                onRenderSheet={renderAlbumSheet}
                                                renderBusy={albumSheetRenderBusy}
                                                disabled={albumMutationLocked || albumMutationBusy}
                                            />

                                            <SheetStoryboardStrip
                                                sheets={album?.sheets || []}
                                                selectedSheetId={activeSheet?.id}
                                                templates={registeredTemplates}
                                                onSelectSheet={selectAlbumSheet}
                                                onMoveSheet={moveAlbumSheet}
                                                onDuplicateSheet={duplicateAlbumSheet}
                                                onRemoveSheet={removeAlbumSheet}
                                                onAddSheet={() => {
                                                    if (registeredTemplates.length > 0) {
                                                        const nextIndex = (album?.sheets?.length || 0) + 1;
                                                        setAlbumSheetId(`Sheet_${nextIndex}`);
                                                        setAlbumTemplateId(registeredTemplates[0].id);
                                                    }
                                                }}
                                                disabled={albumMutationLocked || albumMutationBusy}
                                            />

                                            {!!selectedAlbumSheetId && (
                                                <div className="album-sheet-editor" style={{ marginTop: 10 }}>
                                                    <div className="album-workspace-action-group">
                                                        <input
                                                            value={albumSheetLabel}
                                                            onChange={event => setAlbumSheetLabel(event.target.value)}
                                                            placeholder="Spread label"
                                                            disabled={albumMutationLocked || albumMutationBusy}
                                                        />
                                                        <button
                                                            onClick={renameSelectedAlbumSheet}
                                                            disabled={albumMutationLocked || albumMutationBusy || !albumSheetLabel.trim()}
                                                        >
                                                            Rename
                                                        </button>
                                                    </div>
                                                    <div className="album-workspace-action-group">
                                                        <input
                                                            value={albumDuplicateId}
                                                            onChange={event => setAlbumDuplicateId(event.target.value)}
                                                            placeholder="New Spread ID"
                                                            disabled={albumMutationLocked || albumMutationBusy}
                                                        />
                                                        <button
                                                            onClick={duplicateSelectedAlbumSheet}
                                                            disabled={albumMutationLocked || albumMutationBusy || !albumDuplicateId.trim()}
                                                        >
                                                            Duplicate
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </section>
                            </>
                        )}
                    </div>
                )}

                {hasProject && activeWorkspaceMode === "DESIGNER" && (
                    <div>
                        <TemplateDocumentPanel
                            loadTemplates={loadTemplates}
                            getRegisteredProjectTemplates={getRegisteredProjectTemplates}
                            revalidateProjectTemplates={revalidateProjectTemplates}
                            getTemplateRegistryPreflightState={getTemplateRegistryPreflightState}
                            getTemplateRegistryRecoveryCompatibility={getTemplateRegistryRecoveryCompatibility}
                            addCurrentPsdToProject={addCurrentPsdToProject}
                            getActivePhotoshopDocument={getActivePhotoshopDocument}
                            onRegistryChange={refreshRegisteredTemplates}
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
                            albumSheetForRender={album?.sheets?.find(
                                sheet => sheet.id === selectedAlbumSheetId
                            ) || null}
                            createAlbumSheetRenderRequest={createAlbumSheetRenderRequest}
                            executeAlbumSheetRenderRequest={executeAlbumSheetRenderRequest}
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
                            projectId={project?.metadata?.id || null}
                            projectName={project?.metadata?.name || ""}
                            hasProject={hasProject}
                        />
                    </div>
                )}

                {activeWorkspaceMode === "EXPORT" && (
                    <div className="workspace-mode-pane">
                        <div className="workspace-empty-state" style={{ background: "#1c1f26", border: "1px solid #2d333f" }}>
                            <div className="workspace-empty-icon">🖨</div>
                            <div className="workspace-empty-title">High-Resolution Print Export & Multi-Page PDF Proofing</div>
                            <div className="workspace-empty-subtitle">
                                Preflight inspection, 300 DPI Lab Print profiles (12×12", 12×18", 10×10", 8.5×11"), bleed geometry calculations, studio watermarking, and direct Photoshop batch rendering.
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                                <button
                                    type="button"
                                    className="workspace-empty-action-btn"
                                    style={{ background: "#8957e5", borderColor: "#a371f7" }}
                                    onClick={() => setIsPrintProofModalOpen(true)}
                                    disabled={albumMutationLocked || albumMutationBusy || !album?.sheets?.length}
                                >
                                    ⚡ Open Print & Proof Suite
                                </button>
                                <button
                                    type="button"
                                    className="workspace-empty-action-btn"
                                    style={{ background: "#21262d", borderColor: "#363c4a", color: "#c9d1d9" }}
                                    onClick={() => handleWizardStepClick(4)}
                                >
                                    🎨 Back to Designer
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <AutoFlowModal
                isOpen={isAutoFlowModalOpen}
                onClose={() => setIsAutoFlowModalOpen(false)}
                photos={workspacePhotos}
                selectedPhotoIds={new Set(App.selection.getSelected().map(p => p.id))}
                templates={registeredTemplates}
                existingSheetCount={album?.sheets?.length || 0}
                onApplyAutoFlow={handleApplyAutoFlow}
                disabled={albumMutationLocked || albumMutationBusy}
            />

            <PrintProofModal
                isOpen={isPrintProofModalOpen}
                onClose={() => setIsPrintProofModalOpen(false)}
                album={album}
                photos={workspacePhotos}
                templates={registeredTemplates}
                onExportPrint={handleExportPrint}
                disabled={albumMutationLocked || albumMutationBusy || albumSheetRenderBusy}
            />
        </div>
    );

}
