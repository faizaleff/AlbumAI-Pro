import UxpDropdown from "./UxpDropdown";
import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import PhotoBrowserSection from "./PhotoBrowserSection";
import LibraryLoadGate from "./LibraryLoadGate";
import { prepareTemplatePreviews } from "../services/prepareTemplatePreviews";
// These legacy panels remain bundle-reachable for backward-compatible
// diagnostics and coverage, but the production Library no longer renders
// them as a second workspace shell.
import PreviewPanel from "./PreviewPanel";
import TemplateDocumentPanel from "./TemplateDocumentPanel";
import SelectionCount from "./SelectionCount";
import SpreadCanvas, { DesignWorkspace } from "./SpreadCanvas";
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
import { PsdPreviews } from "../services/TemplateDocumentReader";
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
    // Retained for legacy workflow compatibility outside the new Library UI.
    WIZARD_STEPS,
    computeCompletedSteps,
    canNavigateToStep,
    resolveWizardNavigation,
    workspaceModeForWizardStep
} from "../services/PhotoGroupingEngine";
import { ALBUMAI_VERSION } from "../config/buildIdentity";

const PRODUCT_WORKFLOW_STEPS = Object.freeze([
    Object.freeze({ key: "PHOTOS", number: 1, label: "Photos" }),
    Object.freeze({ key: "ENHANCE", number: 2, label: "Enhance", future: true }),
    Object.freeze({ key: "DESIGNER", number: 3, label: "Design" }),
    Object.freeze({ key: "EXPORT", number: 4, label: "Export" })
]);

export default function OpenFolder() {

    const workspaceRoot = useRef(null);

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
    const [templatePreviewLoadingId, setTemplatePreviewLoadingId] = useState(null);
    const [isAutoFlowModalOpen, setIsAutoFlowModalOpen] = useState(false);
    const [isPrintProofModalOpen, setIsPrintProofModalOpen] = useState(false);
    const [libraryHistoryControls, setLibraryHistoryControls] = useState(null);
    const unavailableDiagnosticRef = useRef(null);
    const mountedRef = useRef(true);
    const photoFolderChangeAttemptRef = useRef(0);
    const photoFolderChangeBusyRef = useRef(false);
    const projectActionBusyRef = useRef(false);
    const photoFolderChangeProjectIdRef = useRef(null);
    const [, forceRefresh] = useState(0);
    const [wizardStep, setWizardStep] = useState(1);
    const [designDrafts, setDesignDrafts] = useState({});
    const draftHistory = useRef({past:[],future:[]});
    const editDrafts = change => setDesignDrafts(previous => {
        const next = change(previous);
        draftHistory.current.past.push(previous);
        if (draftHistory.current.past.length > 50) draftHistory.current.past.shift();
        draftHistory.current.future = [];
        return next;
    });
    const undoDesign = redo => {
        const history = draftHistory.current, from = redo ? history.future : history.past;
        if (from.length) setDesignDrafts(previous => {
            (redo ? history.past : history.future).push(previous);
            return from.pop();
        });
        else if (!hasDesignDrafts) restoreAlbumHistory(redo ? redoAlbumSheetHistory : undoAlbumSheetHistory);
    };
    const hasDesignDrafts = Object.keys(designDrafts).length > 0;
    const [applyingDrafts, setApplyingDrafts] = useState(false);
    const activeWorkspaceMode = workspaceModeForWizardStep(wizardStep);

    PhotoBrowserPerformance.recordRender("OpenFolder");
    const project = App.project.getProject();
    const hasProject = !!project;
    const projectId = project?.metadata?.id || null;
    useEffect(() => { setDesignDrafts({}); draftHistory.current = {past:[],future:[]}; }, [projectId]);
    const requireAppliedDrafts = () => {
        if (!hasDesignDrafts) return true;
        setWizardStep(4); setAlbumMutationError("Apply or discard your preview changes before leaving Design."); return false;
    };
    const album = albumHistory?.present || project?.metadata?.album || null;
    const albumMutationLocked = App.isAlbumSheetMutationLocked();
    const workspacePhotos = App.getPhotos();
    const designPhotos = App.getDesignPhotos();
    const [designPhotoId, setDesignPhotoId] = useState("");
    const [designTypographyTarget, setDesignTypographyTarget] = useState(null);
    const [selectedPhoto, setSelectedPhoto] = useState(() => App.selection.getSelected()[0] || null);
    const templateList = registeredTemplates.length > 0
        ? registeredTemplates
        : (App.getRegisteredProjectTemplates?.() || []);
    const activeSheet = album?.sheets?.find(sheet => sheet.id === selectedAlbumSheetId) || album?.sheets?.[0] || null;
    const activeTemplate = templateList.find(t => t.id === activeSheet?.templateId || t.name === activeSheet?.templateId || t.fileName === activeSheet?.templateId) || null;
    const activeSelectedPhoto = selectedPhoto || App.selection.getSelected()[0] || null;
    const [previewPreparation, setPreviewPreparation] = useState(null);
    const previewPriority = useRef(null);
    previewPriority.current = activeTemplate?.id || albumTemplateId;
    useEffect(() => {
        if (!projectId || projectAction === "OPENING") return;
        let cancelled = false;
        prepareTemplatePreviews({
            getTemplates: () => App.getRegisteredProjectTemplates(),
            priority: () => previewPriority.current,
            ready: item => PsdPreviews.get(PsdPreviews.key(projectId, null, item))?.status === "ready",
            load: item => App.previewTemplate(item.id),
            locked: () => App.isAlbumSheetMutationLocked(),
            cancelled: () => cancelled || !mountedRef.current || App.project.getProject()?.metadata?.id !== projectId,
            progress: status => { if (!cancelled && mountedRef.current) setPreviewPreparation(status); }
        });
        return () => { cancelled = true; };
    }, [projectId, projectAction]);

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

    const keptPhotoCount = designPhotos.length;
    const placedPhotoCount = (album?.sheets || []).reduce((count, sheet) =>
        count + (sheet.slots || []).filter(slot => slot.photoId).length, 0);
    const wizardCompletedSteps = computeCompletedSteps({
        photoCount: workspacePhotos.length,
        analysisComplete: workspacePhotos.length > 0,
        groupsReviewed: workspacePhotos.length > 0,
        keptPhotoCount,
        placedPhotoCount,
        exportComplete: false
    });
    const handleWizardStepClick = (stepId, { directDesignerEntry = false } = {}) => {
        if (stepId !== 4 && !requireAppliedDrafts()) return;
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
        setDesignPhotoId("");
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
        if (!requireAppliedDrafts()) return;

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
        if (!requireAppliedDrafts()) return;

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

    async function addAlbumSheet(requestedTemplateId) {

        const templates = registeredTemplates.length > 0
            ? registeredTemplates
            : (App.getRegisteredProjectTemplates?.() || []);

        if (!templates.length) {
            setAlbumMutationError("Register at least one PSD template before adding spreads.");
            return;
        }

        const chosenTemplateId = typeof requestedTemplateId === "string" ? requestedTemplateId : albumTemplateId;
        const templateId = (chosenTemplateId && templates.some(t => t.id === chosenTemplateId))
            ? chosenTemplateId
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
        if (removed) draftHistory.current = {past:[],future:[]};
        if (removed) setDesignDrafts(previous => {const next = {...previous}; delete next[sheetId]; return next;});
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
        return mutateAlbum({
            intent: AlbumSheetMutationIntent.SWAP_SLOTS,
            sheetId,
            slotIdA,
            slotIdB
        });
    }

    async function applyDesignDraft(sheetId, draft) {
        const current = album?.sheets?.find(item => item.id === sheetId);
        if (JSON.stringify(current) !== JSON.stringify(draft.base) ||
            draft.slots.some(slot => !designPhotos.some(photo => String(photo.id) === String(slot.photoId)))) {
            setAlbumMutationError("This spread changed. Discard the draft and update its preview before editing again.");
            return;
        }
        const changed = await mutateAlbum({intent: AlbumSheetMutationIntent.SET_SHEETS,
            sheets: album.sheets.map(item => item.id === sheetId ? {...item, slots: draft.slots} : item)});
        if (!changed) return;
        draftHistory.current = {past:[],future:[]};
        setDesignDrafts(previous => { const next = {...previous}; delete next[sheetId]; return next; });
        if (draft.slots.length) await renderAlbumSheet(sheetId);
    }

    async function applyAllDesignDrafts() {
        const entries = Object.entries(designDrafts);
        if (!entries.length || albumSheetRenderBusy) return;
        if (entries.some(([id, draft]) => JSON.stringify(album.sheets.find(item => item.id === id)) !== JSON.stringify(draft.base) ||
            draft.slots.some(slot => !designPhotos.some(photo => String(photo.id) === String(slot.photoId))))) {
            setAlbumMutationError("A spread changed. Review its draft before applying all changes."); return;
        }
        setApplyingDrafts(true);
        try {
            const changed = await mutateAlbum({intent: AlbumSheetMutationIntent.SET_SHEETS,
                sheets: album.sheets.map(item => designDrafts[item.id] ? {...item, slots: designDrafts[item.id].slots} : item)});
            if (!changed) return;
            draftHistory.current = {past:[],future:[]};
            setDesignDrafts({});
            for (const [id, draft] of entries) {
                if (draft.slots.length && !(await renderAlbumSheet(id))) break;
            }
        } finally { setApplyingDrafts(false); }
    }

    async function setAlbumSheetSlotCrop(sheetId, slotId, cropFocus, position) {
        const changed = await mutateAlbum({
            intent: AlbumSheetMutationIntent.SET_SLOT_CROP,
            sheetId,
            slotId,
            cropFocus, position
        });
        if (changed) await renderAlbumSheet(sheetId);
    }

    async function setAlbumSheetTypography(assignments, document) {
        if (!activeSheet?.id || !activeTemplate) return;
        const documentName = document?.name || "";
        const templateName = activeTemplate.fileName || activeTemplate.name || "";
        if (documentName !== templateName) {
            setAlbumMutationError("Open the selected sheet's PSD before assigning typography.");
            return;
        }
        const updatedLayerIds = assignments.map(item => String(item.layerId));
        await mutateAlbum({
            intent: AlbumSheetMutationIntent.SET_TYPOGRAPHY,
            sheetId: activeSheet.id,
            assignments: [
                ...(activeSheet.typographyAssignments || []).filter(
                    item => !updatedLayerIds.includes(String(item.layerId))
                ),
                ...assignments
            ]
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
            const result = await App.executeAlbumSheetRenderRequest(request.request, undefined,
                {autoSaveEnabled: false, exportEnabled: false});
            if (result?.status !== "COMPLETED") {
                throw new Error("Spread rendering did not complete. Check the batch details before retrying.");
            }
            return true;
        } catch (error) {
            setAlbumMutationError(error?.message || "Failed to render sheet.");
        } finally {
            setAlbumSheetRenderBusy(false);
        }
    }

    async function handleApplyAutoFlow(generatedSheets, append = false) {
        if (!Array.isArray(generatedSheets) || generatedSheets.length === 0) return;
        draftHistory.current = {past:[],future:[]};
        const previews = new Map();
        setAlbumSheetRenderBusy(true);
        try {
            for (const id of [...new Set(generatedSheets.map(item => item.templateId))]) {
                const template = templateList.find(item => item.id === id);
                const key = PsdPreviews.key(project?.metadata?.id, null, template);
                if (PsdPreviews.get(key)?.status !== "ready") {
                    setTemplatePreviewLoadingId(id);
                    await App.previewTemplate(id);
                }
                const preview = PsdPreviews.get(key);
                if (preview?.status !== "ready") throw new Error("Template preview could not load. Update the template preview and retry.");
                previews.set(id, preview);
            }
            // Store empty spreads; photo placement remains an interactive draft until Apply.
            const emptySheets = generatedSheets.map(item => ({...item, slots: []}));
            const nextSheets = append ? [...(album?.sheets || []), ...emptySheets] : emptySheets;
            const result = await mutateAlbum({intent: AlbumSheetMutationIntent.SET_SHEETS, sheets: nextSheets});
            if (!result) throw new Error("The spreads could not be prepared. Try again.");
            const savedSheets = App.project.getProject()?.metadata?.album?.sheets || nextSheets;
            setDesignDrafts(previous => {
                const next = append ? {...previous} : {};
                for (const item of generatedSheets) next[item.id] = {
                    base: savedSheets.find(base => base.id === item.id),
                    slots: item.slots, preview: previews.get(item.templateId)
                };
                return next;
            });
            setSelectedAlbumSheetId(generatedSheets[0].id);
            setAlbumSheetLabel(generatedSheets[0].label || generatedSheets[0].id);
        } finally {
            setTemplatePreviewLoadingId(null);
            setAlbumSheetRenderBusy(false);
        }
    }

    async function handleExportPrint(exportPayload, onUpdate) {
        if (exportPayload?.type === "LAB_PRINT") {
            setAlbumSheetRenderBusy(true);
            try {
                const summary = await App.executeAlbumBatchRender({
                    album,
                    exportOptions: exportPayload
                }, onUpdate);
                if (summary?.cancelled) return summary;
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
        throw new Error("This export format is not available.");
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
        return { ...result, document: App.refreshCurrentTemplateDocument() };
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
        App.executeProject(onUpdate, { selectedPhotoIds: App.getDesignPhotos().map(photo => photo.id) });
    const createAlbumSheetRenderRequest = sheetId =>
        App.createAlbumSheetRenderRequest(sheetId);
    const executeAlbumSheetRenderRequest = (request, onUpdate) =>
        App.executeAlbumSheetRenderRequest(request, onUpdate);
    const runRecovery = async (action, onUpdate) => {
        const result = await action(summary => {
            onUpdate?.(summary);
            forceRefresh(value => value + 1);
        });
        forceRefresh(value => value + 1);
        return result;
    };
    const resumeProjectBatch = onUpdate =>
        runRecovery(update => App.resumeProjectBatch(update), onUpdate);
    const retryFailedTemplates = onUpdate =>
        runRecovery(update => App.retryFailedTemplates(update), onUpdate);
    const clearRecoveryState = async () => {
        const result = await App.clearRecoveryState();
        forceRefresh(value => value + 1);
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

    const applyManualTypography = request =>
        App.applyManualTypography(request);

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
            ref={workspaceRoot}
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
            <LibraryLoadGate rootRef={workspaceRoot}
                opening={isImportingPhotos || projectAction === "OPENING"}
                status={previewPreparation?.phase === "preparing" ? previewPreparation : App.photoWorkspace.metadataStatus}
                onRetry={() => App.photoWorkspace.startMetadataExtraction(App.getPhotos(), App.photoWorkspace.lifecycleGeneration)} />
            {/* Top Workspace Navigation Bar */}
            <header
                className={`workspace-top-bar${hasProject && activeWorkspaceMode === "LIBRARY"
                    ? " workspace-top-bar--library"
                    : hasProject && (activeWorkspaceMode === "DESIGNER" || activeWorkspaceMode === "EXPORT")
                        ? " workspace-top-bar--design" : ""}`}
                style={{ minHeight: 42 }}
            >
                <div className="workspace-brand-group">
                    {hasProject && activeWorkspaceMode === "LIBRARY" ? (
                        <>
                            <span className="workspace-brand-mark" aria-hidden="true">✦</span>
                            <span className="workspace-brand-copy">
                                <strong>AlbumAI Pro</strong>
                                <small>{project.metadata.name}</small>
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="workspace-brand-title">
                                <span>✨ AlbumAI Pro</span>
                            </span>
                            <span className={`workspace-project-badge ${hasProject ? "active" : ""}`}>
                                {hasProject ? `📁 ${project.metadata.name}` : `v${ALBUMAI_VERSION}`}
                            </span>
                        </>
                    )}
                </div>

                {hasProject && (
                    <>
                        <nav className="wizard-step-bar product-workflow-bar" role="navigation" aria-label="Product workflow">
                            {PRODUCT_WORKFLOW_STEPS.map((step, idx) => {
                                const isActive = activeWorkspaceMode === step.key ||
                                    (step.key === "PHOTOS" && activeWorkspaceMode === "LIBRARY");
                                const canOpenDesigner = hasProject && workspacePhotos.length > 0;
                                const canOpenExport = wizardCompletedSteps?.has(4);
                                const isLocked = step.future ||
                                    (step.key === "DESIGNER" && !canOpenDesigner) ||
                                    (step.key === "EXPORT" && !canOpenExport);
                                const isCompleted = step.key === "PHOTOS"
                                    ? workspacePhotos.length > 0
                                    : step.key === "DESIGNER"
                                        ? Boolean(wizardCompletedSteps?.has(4))
                                        : step.key === "EXPORT"
                                            ? Boolean(wizardCompletedSteps?.has(5))
                                            : false;

                                let cls = "wizard-step";
                                if (isActive) cls += " wizard-step--active";
                                if (isCompleted) cls += " wizard-step--completed";
                                if (isLocked) cls += " wizard-step--locked";

                                return (
                                    <React.Fragment key={step.key}>
                                        {idx > 0 && (
                                            <div
                                                className={`wizard-step-connector${isActive ? " filled" : ""}`}
                                                aria-hidden="true"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            className={cls}
                                            onClick={() => {
                                                if (step.key === "PHOTOS" && requireAppliedDrafts()) setWizardStep(1);
                                                if (step.key === "DESIGNER") {
                                                    handleWizardStepClick(4, { directDesignerEntry: true });
                                                }
                                                if (step.key === "EXPORT") handleWizardStepClick(5);
                                            }}
                                            disabled={isLocked}
                                            title={step.future
                                                ? `${step.label} is provisioned for a future release`
                                                : isLocked
                                                    ? `${step.label} is not ready yet`
                                                    : `${step.number}. ${step.label}`}
                                            aria-current={isActive ? "step" : undefined}
                                        >
                                            <span className="wizard-step-icon">
                                                {isLocked ? "⌾" : ""}
                                            </span>
                                            <span className="wizard-step-label">{step.number} · {step.label}</span>
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </nav>

                        <div className="workspace-quick-actions">
                            {activeWorkspaceMode === "LIBRARY" && (
                                <div className="workspace-library-history" role="group" aria-label="Library history">
                                    <button
                                        type="button"
                                        className="workspace-quick-btn"
                                        onClick={libraryHistoryControls?.undo}
                                        disabled={!libraryHistoryControls?.canUndo}
                                        title="Undo Library change"
                                    >
                                        ↶ Undo
                                    </button>
                                    <button
                                        type="button"
                                        className="workspace-quick-btn"
                                        onClick={libraryHistoryControls?.redo}
                                        disabled={!libraryHistoryControls?.canRedo}
                                        title="Redo Library change"
                                    >
                                        ↷ Redo
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                className="workspace-quick-btn"
                                onClick={saveProject}
                                disabled={!hasProject || Boolean(projectAction)}
                                title="Save Project Metadata"
                            >
                                {projectAction === "SAVING" ? "Saving…" : "💾 Save"}
                            </button>
                            {activeWorkspaceMode !== "LIBRARY" && (
                                <>
                                    <button
                                        type="button"
                                        className="workspace-quick-btn"
                                        onClick={() => restoreAlbumHistory(undoAlbumSheetHistory)}
                                        disabled={hasDesignDrafts || albumMutationLocked || albumMutationBusy || !albumHistory?.past?.length}
                                        title="Undo Sheet Change"
                                    >
                                        ⟲ Undo
                                    </button>
                                    <button
                                        type="button"
                                        className="workspace-quick-btn"
                                        onClick={() => restoreAlbumHistory(redoAlbumSheetHistory)}
                                        disabled={hasDesignDrafts || albumMutationLocked || albumMutationBusy || !albumHistory?.future?.length}
                                        title="Redo Sheet Change"
                                    >
                                        ⟳ Redo
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                className="workspace-quick-btn workspace-close-project-btn"
                                onClick={closeProject}
                                disabled={!hasProject || Boolean(projectAction)}
                                title="Close project"
                                aria-label="Close project"
                            >
                                ×
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
                                v{ALBUMAI_VERSION}
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
                    <div className="library-workspace-container library-workspace-container--production">
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
                            onHistoryControlsChange={setLibraryHistoryControls}
                        />
                    </div>
                )}

                {activeWorkspaceMode === "DESIGNER" && (
                    hasProject ? <DesignWorkspace key={project?.metadata?.id}
                        drafts={designDrafts} onDesignUndo={() => undoDesign(false)} onDesignRedo={() => undoDesign(true)}
                        canDesignUndo={!!draftHistory.current.past.length || (!hasDesignDrafts && !!albumHistory?.past?.length)}
                        canDesignRedo={!!draftHistory.current.future.length || (!hasDesignDrafts && !!albumHistory?.future?.length)}
                        onDraftBatchChange={changes => editDrafts(previous => ({...previous, ...changes}))} onDraftChange={(id, draft) => editDrafts(previous => {
                            const next = {...previous}; if (draft) next[id] = draft; else delete next[id]; return next;
                        })} onApplyDraft={applyDesignDraft} onApplyAllDrafts={applyAllDesignDrafts}
                        projectId={project?.metadata?.id}
                        templatePreviewLoadingId={templatePreviewLoadingId}
                        onCancelPreview={App.projectBatchRunning ? () => App.requestBatchCancellation() : null}
                        onPreviewTemplate={async id => {
                            if (albumSheetRenderBusy) return;
                            setAlbumSheetRenderBusy(true); setTemplatePreviewLoadingId(id); setAlbumMutationError(null);
                            try { await App.previewTemplate(id); }
                            catch (error) { setAlbumMutationError(error.message); }
                            finally { setTemplatePreviewLoadingId(null); setAlbumSheetRenderBusy(false); }
                        }}
                        sheets={album?.sheets || []} sheet={activeSheet} template={activeTemplate}
                        templates={templateList} photos={designPhotos} allPhotos={workspacePhotos}
                        selectedPhotoId={designPhotoId} onSelectPhoto={setDesignPhotoId}
                        templateId={albumTemplateId} onSelectTemplate={setAlbumTemplateId}
                        typographyTargetRef={setDesignTypographyTarget}
                        onSelectSheet={selectAlbumSheet} onAddSheet={addAlbumSheet}
                        onMoveSheet={moveAlbumSheet} onDuplicateSheet={duplicateAlbumSheet} onRemoveSheet={removeAlbumSheet}
                        onRenameSheet={(sheetId, label) => mutateAlbum({intent: AlbumSheetMutationIntent.RENAME, sheetId, label})}
                        onArrange={() => setIsAutoFlowModalOpen(true)} onExport={() => setIsPrintProofModalOpen(true)}
                        onAssignSlot={assignAlbumSheetSlot} onUnassignSlot={unassignAlbumSheetSlot}
                        onSwapSlots={swapAlbumSheetSlots}
                        onPreviewSwap={async (sheetId, a, b) => {
                            if (await swapAlbumSheetSlots(sheetId, a, b)) await renderAlbumSheet(sheetId);
                        }} onSetSlotCrop={setAlbumSheetSlotCrop}
                        onRenderSheet={renderAlbumSheet} renderBusy={albumSheetRenderBusy}
                        disabled={applyingDrafts || albumMutationLocked || albumMutationBusy || albumSheetRenderBusy} error={albumMutationError}
                        templateTools={
                        <TemplateDocumentPanel
                            simpleDesign={true}
                            typographyPortalTarget={designTypographyTarget}
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
                            albumSheetForRender={activeSheet}
                            createAlbumSheetRenderRequest={createAlbumSheetRenderRequest}
                            executeAlbumSheetRenderRequest={executeAlbumSheetRenderRequest}
                            resumeProjectBatch={resumeProjectBatch}
                            retryFailedTemplates={retryFailedTemplates}
                            clearRecoveryState={clearRecoveryState}
                            getBatchRecoveryState={getBatchRecoveryState}
                            getCurrentProjectExecutionSummary={getCurrentProjectExecutionSummary}
                            getPhotos={getPhotos}
                            getCurrentTemplate={getCurrentTemplate}
                            applyManualTypography={applyManualTypography}
                            onTypographyAssignmentsApplied={({ assignments, document }) =>
                                setAlbumSheetTypography(assignments, document)
                            }
                            customTextPresets={project?.metadata?.typographyTextPresets || null}
                            saveCustomTextPresets={async catalog => {
                                const saved = await App.saveProject(
                                    { typographyTextPresets: catalog },
                                    { reason: "ALB126_CUSTOM_TEXT_PRESETS" }
                                );
                                forceRefresh(value => value + 1);
                                return saved?.metadata?.typographyTextPresets || catalog;
                            }}
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
                        }
                    /> : <div className="workspace-empty-state"><h3>No Project Open</h3>
                        <button onClick={() => handleWizardStepClick(1)}>Go to Library & Projects</button></div>
                )}

                {activeWorkspaceMode === "EXPORT" && (
                    <div className="workspace-mode-pane">
                        <div className="workspace-empty-state" style={{ background: "#1c1f26", border: "1px solid #2d333f" }}>
                            <div className="workspace-empty-icon">🖨</div>
                            <div className="workspace-empty-title">Export album</div>
                            <div className="workspace-empty-subtitle">
                                Save editable spreads and export JPEGs in storyboard order. Output uses each PSD template’s dimensions and resolution.
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                                <button
                                    type="button"
                                    className="workspace-empty-action-btn"
                                    style={{ background: "#8957e5", borderColor: "#a371f7" }}
                                    onClick={() => setIsPrintProofModalOpen(true)}
                                    disabled={albumMutationLocked || albumMutationBusy || !album?.sheets?.length}
                                >
                                    Export spreads
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
                photos={designPhotos}
                templates={registeredTemplates}
                existingSheetCount={album?.sheets?.length || 0}
                onApplyAutoFlow={handleApplyAutoFlow}
                disabled={albumMutationLocked || albumMutationBusy}
            />

            <PrintProofModal
                isOpen={isPrintProofModalOpen}
                onClose={() => setIsPrintProofModalOpen(false)}
                album={album}
                photos={designPhotos}
                templates={registeredTemplates}
                onExportPrint={handleExportPrint}
                onCancel={() => App.requestBatchCancellation()}
                disabled={applyingDrafts || albumMutationLocked || albumMutationBusy || albumSheetRenderBusy}
            />
        </div>
    );

}
