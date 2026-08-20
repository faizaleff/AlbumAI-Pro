import React, { useEffect, useMemo, useRef, useState } from "react";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import BatchProgressPanel from "./BatchProgressPanel";
import UxpDropdown from "./UxpDropdown";
import {
    readCurrentRecoveryState,
    recoveryPanelStateKey
} from "./recoveryPanelState";
import {
    canProcessProject,
    canRevalidateTemplates,
    executionGateFeedback,
    emptyTemplateRegistryUiSession,
    isCurrentTemplateRegistryRequest,
    recoveryCompatibilityLabel,
    revalidationFeedback,
    shouldResetTemplatePreflightUi,
    templateRegistryIsBlocked,
    templateRegistryUiSummary,
    templateValidationLabel
} from "./templatePreflightUi";

const AUTO_SAVE_MODE_OPTIONS = Object.freeze([
    Object.freeze({ value: "SAVE_COPY", label: "Save Copy" }),
    Object.freeze({
        value: "OVERWRITE_ORIGINAL",
        label: "Overwrite Original (non-reversible)"
    })
]);

const EXPORT_FORMAT_OPTIONS = Object.freeze([
    Object.freeze({ value: "JPEG", label: "JPEG" }),
    Object.freeze({ value: "PSD", label: "PSD" })
]);

export { ExecutionDetails, summaryText, debugText } from "./ExecutionDetailsPanel";

export default function TemplateDocumentPanel({
    loadTemplates,
    getRegisteredProjectTemplates,
    revalidateProjectTemplates,
    getTemplateRegistryPreflightState,
    getTemplateRegistryRecoveryCompatibility,
    addCurrentPsdToProject,
    getActivePhotoshopDocument,
    onRegistryChange = null,
    removeRegisteredProjectTemplate,
    moveRegisteredProjectTemplate,
    requestBatchCancellation,
    openTemplate,
    planPhotoPlacement,
    getCurrentPlacementPlan,
    buildPlacementExecutionPlan,
    getCurrentPlacementExecutionPlan,
    getCurrentReplacementRequest,
    executeReplacementStep,
    executeReplacementBatch,
    getCurrentExecutionSummary,
    getCurrentBatchProgress,
    getCurrentExecutionLifecycle,
    executeProject,
    albumSheetForRender = null,
    createAlbumSheetRenderRequest,
    executeAlbumSheetRenderRequest,
    resumeProjectBatch,
    retryFailedTemplates,
    clearRecoveryState,
    getBatchRecoveryState,
    getCurrentProjectExecutionSummary,
    getPhotos,
    getCurrentTemplate,
    setAutoSaveEnabled,
    getAutoSaveEnabled,
    setAutoSaveMode,
    getAutoSaveMode,
    getCurrentAutoSaveResult,
    setExportEnabled,
    getExportEnabled,
    setExportFormat,
    getExportFormat,
    getCurrentExportResult,
    projectId = null,
    projectName = "",
    hasProject = false
}) {

    const [templates, setTemplates] = useState([]);
    const [selectedName, setSelectedName] = useState("");
    const [registeredTemplates, setRegisteredTemplates] = useState([]);
    const [selectedRegisteredId, setSelectedRegisteredId] = useState("");
    const [draggedTemplateId, setDraggedTemplateId] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [registryMutating, setRegistryMutating] = useState(false);
    const draggedTemplateIdRef = useRef(null);
    const registeredTemplatesRef = useRef([]);
    const dragStateRef = useRef(null);
    const templateRowRefs = useRef(new Map());
    const templateListRef = useRef(null);
    const mountedRef = useRef(true);
    const renderedDragHandlesRef = useRef(new Set());
    const [registryError, setRegistryError] = useState(null);
    const [registryPreflightState, setRegistryPreflightState] = useState(() =>
        getTemplateRegistryPreflightState?.() || null
    );
    const [revalidateBusy, setRevalidateBusy] = useState(false);
    const [revalidationMessage, setRevalidationMessage] = useState("");
    const [templatesWorkspaceAvailable, setTemplatesWorkspaceAvailable] = useState(false);
    const revalidationRequestRef = useRef(0);
    const revalidationProjectIdRef = useRef(projectId);
    const [document, setDocument] = useState(null);
    const [, setPlacementVersion] = useState(0);
    const [placementError, setPlacementError] = useState(null);
    const [replacementResult, setReplacementResult] = useState(null);
    const [executionSummary, setExecutionSummary] = useState(null);
    const [batchProgress, setBatchProgress] = useState(() =>
        getCurrentBatchProgress?.() || null
    );
    const [executionLifecycle, setExecutionLifecycle] = useState(() =>
        getCurrentExecutionLifecycle?.() || null
    );
    const [projectExecutionSummary, setProjectExecutionSummary] = useState(null);
    const [recoveryVersion, setRecoveryVersion] = useState(0);
    const currentRecoveryState = readCurrentRecoveryState(
        getBatchRecoveryState
    );
    const [
        recoveryAvailable,
        recoveryClassification,
        recoverySnapshot
    ] = recoveryPanelStateKey(currentRecoveryState);
    // The controller returns a fresh wrapper object for each read. Keep the
    // panel state identity stable for effects, but replace it immediately when
    // a folder change clears the authoritative snapshot.
    const recoveryState = useMemo(
        () => currentRecoveryState,
        [
            recoveryVersion,
            projectId,
            hasProject,
            recoveryAvailable,
            recoveryClassification,
            recoverySnapshot
        ]
    );
    const [autoSaveResult, setAutoSaveResult] = useState(() =>
        getCurrentAutoSaveResult?.() || null
    );
    const [exportResult, setExportResult] = useState(() =>
        getCurrentExportResult?.() || null
    );

    const placementPlan = getCurrentPlacementPlan?.() || null;
    const executionPlan = getCurrentPlacementExecutionPlan?.() || null;
    const replacementRequest = getCurrentReplacementRequest?.() || null;
    const healthPhotos = getPhotos?.() || [];
    const healthTemplate = getCurrentTemplate?.() || null;
    const autoSaveEnabled = getAutoSaveEnabled?.() || false;
    const autoSaveMode = getAutoSaveMode?.() || "SAVE_COPY";
    const exportEnabled = getExportEnabled?.() || false;
    const exportFormat = getExportFormat?.() || "JPEG";
    const activeBatchLifecycle = ["RUNNING", "CANCEL_REQUESTED", "CANCELLING"].includes(
        projectExecutionSummary?.batchProgress?.lifecycle
    );
    const isExecuting = executionLifecycle?.status === "RUNNING" || activeBatchLifecycle;
    const registryLocked = isExecuting || registryMutating || revalidateBusy;
    const registrySummary = templateRegistryUiSummary(
        registeredTemplates,
        registryPreflightState
    );
    const registryBlocked = templateRegistryIsBlocked(
        registeredTemplates,
        registryPreflightState
    );
    const activePhotoshopDocument = getActivePhotoshopDocument?.() || null;
    const activePsdTarget = activePhotoshopDocument ||
        (selectedName ? templates.find(item => item.name === selectedName) : null) ||
        null;
    const recoveryCompatibility = recoverySnapshot
        ? getTemplateRegistryRecoveryCompatibility?.() || ""
        : "";

    useEffect(() => {
        registeredTemplatesRef.current = registeredTemplates;
    }, [registeredTemplates]);

    useEffect(() => {
        console.info("ALB-032.3-mouse-drag-v1");
        console.info("ALB-036-recovery-ui-hardening-v1");
        console.info("ALB-037.4-restored-template-status-refresh-v1");
    }, []);

    useEffect(() => {
        if (shouldResetTemplatePreflightUi({
            hasProject,
            projectId,
            previousProjectId: revalidationProjectIdRef.current
        })) {
            revalidationProjectIdRef.current = projectId;
            clearTemplateRegistrySessionUi();
            return;
        }
        refreshRegistryPreflightState();
    }, [hasProject, projectId]);

    function clearTemplateRegistrySessionUi() {
        const empty = emptyTemplateRegistryUiSession();
        revalidationRequestRef.current += 1;
        setTemplates([]);
        setSelectedName("");
        registeredTemplatesRef.current = empty.registeredTemplates;
        setRegisteredTemplates(empty.registeredTemplates);
        setSelectedRegisteredId(empty.selectedRegisteredId);
        setRegistryError(null);
        setRegistryPreflightState(empty.preflight);
        setRevalidationMessage(empty.message);
        setRevalidateBusy(empty.busy);
        setTemplatesWorkspaceAvailable(empty.workspaceAvailable);
        draggedTemplateIdRef.current = null;
        dragStateRef.current = null;
        templateRowRefs.current.clear();
        setDraggedTemplateId(null);
        setDropTarget(null);
        onRegistryChange?.(empty.registeredTemplates);
    }

    function refreshRegisteredTemplates() {
        const entries = getRegisteredProjectTemplates?.() || [];
        setRegisteredTemplates(entries);
        setSelectedRegisteredId(current => entries.some(entry => entry.id === current)
            ? current
            : (entries[0]?.id || ""));
        onRegistryChange?.(entries);
    }

    function refreshRegistryPreflightState() {
        const next = getTemplateRegistryPreflightState?.() || null;
        setRegistryPreflightState(current => current === next ? current : next);
    }

    function refreshRecoveryState() {
        setRecoveryVersion(value => value + 1);
    }



    useEffect(() => {

        let active = true;
        PhotoBrowserPerformance.recordRenderUpdate(
            "TemplateDocumentPanel",
            "loadEffectEntry",
            { hasProject, projectId }
        );

        async function load() {

            if (!hasProject) {
                setTemplatesWorkspaceAvailable(false);
                setTemplates(current =>
                    current.length ? [] : current
                );
                setSelectedName(current =>
                    current ? "" : current
                );
                return;
            }

            try {

                const files = await loadTemplates();

                if (!active) return;

                PhotoBrowserPerformance.recordRenderUpdate(
                    "TemplateDocumentPanel",
                    "loadEffectStateUpdate",
                    { templates: files.length }
                );
                setTemplates(files);
                setTemplatesWorkspaceAvailable(true);
                setSelectedName(files[0]?.name || "");
                refreshRegisteredTemplates();
                refreshRegistryPreflightState();
                refreshRecoveryState();

            }

            catch (_) {

                if (!active) return;

                setTemplates([]);
                setSelectedName("");
                clearTemplateRegistrySessionUi();

            }

        }

        load();

        return () => {
            PhotoBrowserPerformance.recordRenderUpdate(
                "TemplateDocumentPanel",
                "loadEffectCleanup",
                { projectId }
            );
            active = false;
        };

    }, [loadTemplates, hasProject, projectId]);

    async function revalidateTemplatesRequest() {
        if (!canRevalidateTemplates({
            hasProject,
            isExecuting,
            registryMutating,
            revalidateBusy,
            workspaceAvailable: templatesWorkspaceAvailable
        })) return;

        const requestId = ++revalidationRequestRef.current;
        const requestProjectId = projectId;
        setRevalidateBusy(true);
        setRevalidationMessage("");

        try {
            const result = await revalidateProjectTemplates?.({
                reason: "USER_REVALIDATE"
            });
            if (!isCurrentTemplateRegistryRequest({
                mounted: mountedRef.current,
                requestId,
                currentRequestId: revalidationRequestRef.current,
                projectId: requestProjectId,
                currentProjectId: revalidationProjectIdRef.current
            })) return;
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            setRevalidationMessage(revalidationFeedback(result));
        } catch (_) {
            if (!isCurrentTemplateRegistryRequest({
                mounted: mountedRef.current,
                requestId,
                currentRequestId: revalidationRequestRef.current,
                projectId: requestProjectId,
                currentProjectId: revalidationProjectIdRef.current
            })) return;
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            setRevalidationMessage(
                "Template validation could not be completed. Check project access and try again."
            );
        } finally {
            if (isCurrentTemplateRegistryRequest({
                mounted: mountedRef.current,
                requestId,
                currentRequestId: revalidationRequestRef.current,
                projectId: requestProjectId,
                currentProjectId: revalidationProjectIdRef.current
            })) {
                setRevalidateBusy(false);
            }
        }
    }

    async function addCurrentPsd() {
        const file = getActivePhotoshopDocument?.() ||
            (selectedName ? templates.find(item => item.name === selectedName) : null) ||
            null;
        if (!file) return;
        try {
            await addCurrentPsdToProject?.(file);
            const updatedTemplates = await loadTemplates?.() || [];
            setTemplates(updatedTemplates);
            if (updatedTemplates.length && !selectedName) {
                setSelectedName(file.name || updatedTemplates[0]?.name || "");
            }
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            refreshRecoveryState();
            setRevalidationMessage("");
            setRegistryError(null);
        } catch (error) {
            setRegistryError(error.message);
        }
    }

    async function removeSelectedRegisteredTemplate(id = selectedRegisteredId) {
        if (!id || registryLocked) return;
        try {
            setRegistryMutating(true);
            await removeRegisteredProjectTemplate?.(id);
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            refreshRecoveryState();
            setRevalidationMessage("");
            setRegistryError(null);
        } catch (error) {
            setRegistryError(error.message);
        } finally {
            setRegistryMutating(false);
        }
    }

    async function moveRegisteredTemplate(id, targetIndex, method) {
        if (registryLocked) return;
        try {
            setRegistryMutating(true);
            const moved = await moveRegisteredProjectTemplate?.(id, targetIndex, method);
            if (!moved) return;
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            refreshRecoveryState();
            setRevalidationMessage("");
            setRegistryError(null);
        } catch (error) {
            setRegistryError(error.message);
        } finally {
            setRegistryMutating(false);
        }
    }

    function reorderDiagnostic(event, details) {
        console.info(event, JSON.stringify({
            method: "drag",
            batchRunning: isExecuting,
            mutationRunning: registryMutating,
            ...details
        }));
    }

    function detachMouseDragListeners(drag) {
        const target = drag?.listNode;
        const listeners = drag?.listeners;
        if (!target || !listeners || typeof target.removeEventListener !== "function") return;
        target.removeEventListener("mousemove", listeners.move);
        target.removeEventListener("mouseup", listeners.up);
        target.removeEventListener("mouseleave", listeners.leave);
    }

    function clearTemplateDrag({ cancelled = false, reason = null, updateState = mountedRef.current } = {}) {
        const drag = dragStateRef.current;
        if (cancelled && drag) {
            const entries = registeredTemplatesRef.current;
            const entry = entries[drag.sourceIndex];
            reorderDiagnostic("TEMPLATE_REORDER_CANCELLED", {
                templateId: drag.templateId,
                templateName: entry?.name || "",
                sourceIndex: drag.sourceIndex,
                targetIndex: drag.targetIndex,
                reason
            });
        }
        detachMouseDragListeners(drag);
        dragStateRef.current = null;
        draggedTemplateIdRef.current = null;
        if (updateState) {
            setDraggedTemplateId(null);
            setDropTarget(null);
        }
    }

    function cancelTemplateDrag(templateId, reason = "cancelled") {
        if (dragStateRef.current?.templateId === templateId) {
            clearTemplateDrag({ cancelled: true, reason });
        } else if (templateId) {
            console.info("TEMPLATE_REORDER_CANCELLED", JSON.stringify({
                templateId,
                templateName: registeredTemplates.find(entry => entry.id === templateId)?.name || "",
                sourceIndex: registeredTemplates.findIndex(entry => entry.id === templateId),
                targetIndex: null,
                method: "drag",
                batchRunning: isExecuting,
                mutationRunning: registryMutating,
                reason
            }));
        }
    }

    function targetFromMouse(clientY) {
        const drag = dragStateRef.current;
        const entries = registeredTemplatesRef.current;
        if (!drag || !entries.length) return null;
        let insertIndex = entries.length;
        let position = "after";
        let targetId = entries[entries.length - 1]?.id || null;
        for (let index = 0; index < entries.length; index += 1) {
            const entry = entries[index];
            const row = drag.rowNodes.get(entry.id);
            if (!row) continue;
            const bounds = row.getBoundingClientRect();
            if (clientY < bounds.top + bounds.height / 2) {
                insertIndex = index;
                position = "before";
                targetId = entry.id;
                break;
            }
        }
        let targetIndex = insertIndex;
        if (drag.sourceIndex < targetIndex) targetIndex -= 1;
        targetIndex = Math.max(0, Math.min(entries.length - 1, targetIndex));
        return { id: targetId, position, targetIndex };
    }

    function updateMouseDragTarget(clientY) {
        const drag = dragStateRef.current;
        const target = targetFromMouse(clientY);
        if (!drag || !target) return;
        if (drag.targetIndex !== target.targetIndex) {
            drag.targetIndex = target.targetIndex;
            reorderDiagnostic("TEMPLATE_REORDER_DRAG_TARGET", {
                templateId: drag.templateId,
                templateName: registeredTemplatesRef.current[drag.sourceIndex]?.name || "",
                sourceIndex: drag.sourceIndex,
                targetIndex: target.targetIndex
            });
        }
        setDropTarget(target);
    }

    function finishMouseDrag(event) {
        const drag = dragStateRef.current;
        if (!drag) return;
        const bounds = drag.listNode?.getBoundingClientRect?.();
        const releasedOutsideList = bounds && (
            event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom
        );
        if (releasedOutsideList) {
            clearTemplateDrag({ cancelled: true, reason: "pointer-released-outside-list" });
            return;
        }
        const { templateId, sourceIndex, targetIndex } = drag;
        clearTemplateDrag();
        if (targetIndex !== sourceIndex) {
            moveRegisteredTemplate(templateId, targetIndex, "drag");
        }
    }

    function moveMouseDrag(event) {
        const drag = dragStateRef.current;
        if (!drag) return;
        const distance = Math.max(
            Math.abs(event.clientX - drag.startClientX),
            Math.abs(event.clientY - drag.startClientY)
        );
        if (!drag.thresholdPassed) {
            if (distance < 4) return;
            drag.thresholdPassed = true;
            reorderDiagnostic("TEMPLATE_DRAG_THRESHOLD_PASSED", {
                templateId: drag.templateId,
                sourceIndex: drag.sourceIndex,
                targetIndex: drag.targetIndex,
                clientX: event.clientX,
                clientY: event.clientY,
                thresholdPassed: true
            });
            reorderDiagnostic("TEMPLATE_REORDER_DRAG_START", {
                templateId: drag.templateId,
                templateName: drag.templateName,
                sourceIndex: drag.sourceIndex,
                targetIndex: drag.targetIndex
            });
            setDraggedTemplateId(drag.templateId);
        }
        updateMouseDragTarget(event.clientY);
    }

    function beginTemplateMouseDrag(event, entry, sourceIndex) {
        reorderDiagnostic("TEMPLATE_DRAG_HANDLE_MOUSEDOWN", {
            templateId: entry.id,
            sourceIndex,
            button: event.button,
            hasListNode: Boolean(templateListRef.current),
            rowCount: templateRowRefs.current.size,
            clientX: event.clientX,
            clientY: event.clientY,
            thresholdPassed: false,
            targetIndex: sourceIndex
        });
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (registryLocked) {
            reorderDiagnostic("TEMPLATE_REORDER_REJECTED", {
                templateId: entry.id,
                templateName: entry.name,
                sourceIndex,
                targetIndex: sourceIndex,
                reason: isExecuting ? "batch-running" : "registry-mutation-running"
            });
            return;
        }
        const listNode = templateListRef.current;
        if (!listNode || typeof listNode.addEventListener !== "function") {
            reorderDiagnostic("TEMPLATE_REORDER_REJECTED", {
                templateId: entry.id,
                sourceIndex,
                targetIndex: sourceIndex,
                reason: "template-list-unavailable"
            });
            return;
        }
        dragStateRef.current = {
            templateId: entry.id,
            templateName: entry.name,
            sourceIndex,
            targetIndex: sourceIndex,
            listNode,
            rowNodes: new Map(templateRowRefs.current),
            startClientX: event.clientX,
            startClientY: event.clientY,
            thresholdPassed: false,
            listeners: null
        };
        draggedTemplateIdRef.current = entry.id;
        const listeners = {
            move: moveMouseDrag,
            up: finishMouseDrag,
            leave: () => clearTemplateDrag({ cancelled: true, reason: "mouse-left-list" })
        };
        dragStateRef.current.listeners = listeners;
        listNode.addEventListener("mousemove", listeners.move);
        listNode.addEventListener("mouseup", listeners.up);
        listNode.addEventListener("mouseleave", listeners.leave);
        reorderDiagnostic("TEMPLATE_DRAG_LISTENER_ATTACHED", {
            templateId: entry.id,
            sourceIndex,
            button: event.button,
            hasListNode: true,
            rowCount: dragStateRef.current.rowNodes.size,
            clientX: event.clientX,
            clientY: event.clientY,
            thresholdPassed: false,
            targetIndex: sourceIndex
        });
    }

    useEffect(() => () => {
        mountedRef.current = false;
        revalidationRequestRef.current += 1;
        if (dragStateRef.current) {
            clearTemplateDrag({ cancelled: true, reason: "component-unmount", updateState: false });
        }
    }, []);

    useEffect(() => {
        if (registryLocked && dragStateRef.current) {
            clearTemplateDrag({ cancelled: true, reason: isExecuting ? "batch-running" : "registry-mutation-running" });
        }
    }, [registryLocked, isExecuting]);

    useEffect(() => {

        if (!hasProject) {
            setDocument(null);
            setRegistryError(null);
            setPlacementError(null);
            setReplacementResult(null);
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
            setProjectExecutionSummary(null);
            setAutoSaveResult(null);
            setExportResult(null);
        }

        else if (!replacementRequest) {
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
        }

    }, [hasProject, replacementRequest]);

    async function open() {

        const file = templates.find(
            item => item.name === selectedName
        );

        if (!file) {
            return;
        }

        const result = await openTemplate(file);

        setDocument(result);
        setPlacementError(null);
        setReplacementResult(null);
        setExecutionSummary(null);
        setBatchProgress(getCurrentBatchProgress?.() || null);
        setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
        setProjectExecutionSummary(null);
        setAutoSaveResult(null);
        setExportResult(null);
        setPlacementVersion(value => value + 1);

    }

    function planPlacement() {

        if (isExecuting) return;

        try {

            planPhotoPlacement?.();
            setPlacementError(null);
            setProjectExecutionSummary(null);
            setAutoSaveResult(null);
            setExportResult(null);
            setPlacementVersion(value => value + 1);

        }

        catch (error) {

            setPlacementError(error.message);

        }

    }

    function buildExecutionPlan() {

        if (isExecuting) return;

        try {

            buildPlacementExecutionPlan?.();
            setPlacementError(null);
            setReplacementResult(null);
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
            setProjectExecutionSummary(null);
            setAutoSaveResult(null);
            setExportResult(null);
            setPlacementVersion(value => value + 1);

        }

        catch (error) {

            setPlacementError(error.message);
            setReplacementResult({
                status: "FAILED",
                errors: [`Replacement request: ${error.message}`]
            });

        }

    }

    async function executeFirstReplacementStep() {

        const step = replacementRequest?.steps?.[0];

        if (!step) {
            setReplacementResult({
                status: "FAILED",
                errors: ["A replacement request with at least one step is required."]
            });
            return;
        }

        try {

            const result = await executeReplacementStep(step);

            setReplacementResult(result);
            setPlacementVersion(value => value + 1);

        }

        catch (error) {

            setReplacementResult({
                status: "FAILED",
                errors: [error.message]
            });

        }

    }

    async function executeReplacementBatchRequest() {

        try {

            setReplacementResult(null);
            setExecutionLifecycle({ status: "RUNNING" });
            const summary = await executeReplacementBatch(progress => {
                setBatchProgress(progress);
                setExecutionLifecycle(getCurrentExecutionLifecycle?.() || { status: "RUNNING" });
            });

            setExecutionSummary(summary || getCurrentExecutionSummary?.() || null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
            setPlacementVersion(value => value + 1);

        }

        catch (error) {

            setExecutionSummary(getCurrentExecutionSummary?.() || null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
            setReplacementResult({ status: "FAILED", errors: [error.message] });

        }

    }

    async function executeProjectRequest() {

        try {

            setRegistryError(null);

            const summary = await executeProject(nextSummary => {
                setProjectExecutionSummary(nextSummary);
                refreshRecoveryState();
            });

            const gateFeedback = executionGateFeedback(summary);
            if (gateFeedback) {
                setRegistryError(gateFeedback);
                refreshRegisteredTemplates();
                refreshRegistryPreflightState();
                setProjectExecutionSummary(
                    getCurrentProjectExecutionSummary?.() || null
                );
                return;
            }

            setProjectExecutionSummary(
                summary || getCurrentProjectExecutionSummary?.() || null
            );
            setRegistryError(null);
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);
            refreshRecoveryState();

        }

        catch (error) {

            if (error?.code === "NO_SELECTED_PHOTOS") {
                setRegistryError("Select at least one photo before processing.");
            }

            setProjectExecutionSummary(
                getCurrentProjectExecutionSummary?.() || null
            );
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);

        }

    }

    async function executeAlbumSheetRender() {

        if (!albumSheetForRender?.id ||
            typeof createAlbumSheetRenderRequest !== "function" ||
            typeof executeAlbumSheetRenderRequest !== "function") return;

        try {

            setRegistryError(null);
            const created = createAlbumSheetRenderRequest(albumSheetForRender.id);

            if (!created?.accepted) {
                setRegistryError(
                    created?.reasonCodes?.join(", ") ||
                    "The selected Album Sheet is not ready to render."
                );
                return;
            }

            const summary = await executeAlbumSheetRenderRequest(
                created.request,
                nextSummary => {
                    setProjectExecutionSummary(nextSummary);
                    refreshRecoveryState();
                }
            );

            const gateFeedback = executionGateFeedback(summary);
            if (gateFeedback) {
                setRegistryError(gateFeedback);
                refreshRegisteredTemplates();
                refreshRegistryPreflightState();
                setProjectExecutionSummary(
                    getCurrentProjectExecutionSummary?.() || null
                );
                return;
            }

            setProjectExecutionSummary(
                summary || getCurrentProjectExecutionSummary?.() || null
            );
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);
            refreshRecoveryState();

        } catch (error) {

            const reasonCodes = Array.isArray(error?.reasonCodes)
                ? error.reasonCodes.join(", ")
                : null;
            setRegistryError(
                reasonCodes || error?.message || "The selected Album Sheet could not be rendered."
            );
            setProjectExecutionSummary(
                getCurrentProjectExecutionSummary?.() || null
            );
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);
            refreshRecoveryState();

        }

    }

    async function executeRecoveryAction(action) {
        if (typeof action !== "function" || isExecuting) return;
        try {
            const summary = await action(nextSummary => {
                setProjectExecutionSummary(nextSummary);
                refreshRecoveryState();
            });
            const finalSummary = summary || getCurrentProjectExecutionSummary?.() || null;
            setProjectExecutionSummary(finalSummary);
            // Resolution updates the authoritative registry during execution;
            // refresh the copied row data only after a successful retry ends.
            if (action === retryFailedTemplates &&
                finalSummary?.failedTemplates === 0 &&
                finalSummary?.batchProgress?.lifecycle === "COMPLETED") {
                refreshRegisteredTemplates();
            }
        } finally {
            refreshRecoveryState();
        }
    }

    async function clearRecovery() {
        if (isExecuting) {
            const error = new Error("A project batch is already running.");
            throw error;
        }
        if (typeof clearRecoveryState !== "function") {
            const error = new Error("Clear Recovery State is unavailable.");
            throw error;
        }

        try {
            const result = await clearRecoveryState();
            if (result?.status === "FAILED") {
                throw new Error(result.error || "Recovery state could not be cleared.");
            }
            if (!result?.status) {
                throw new Error("Clear Recovery State returned no result.");
            }
            refreshRecoveryState();
            return result;
        } catch (error) {
            refreshRecoveryState();
            throw error;
        }
    }

    return (

        <section
            className="template-workspace-section"
            style={{
                marginBottom: 15,
                padding: 12,
                background: "#2f2f2f",
                borderRadius: 6
            }}
        >

            <div className="template-workspace-content">
                <div className="template-setup-row">
                    <div className="template-action-group">

                <UxpDropdown
                    value={selectedName}
                    options={templates.map(file => ({
                        value: file.name,
                        label: file.name
                    }))}
                    onValueChange={setSelectedName}
                    className="template-selector-dropdown"
                    ariaLabel="Select template"
                    title="Select template"
                    disabled={!templates.length}
                />

                <button
                    onClick={open}
                    disabled={isExecuting || !hasProject || !selectedName}
                >
                    Open PSD
                </button>
                    </div>
                    <div className="template-action-group">
                <button
                    onClick={planPlacement}
                    disabled={isExecuting || !hasProject || !document}
                >
                    Plan Placement
                </button>
                    </div>
                    <div className="template-action-group">
                <button
                    onClick={addCurrentPsd}
                    disabled={registryLocked || !hasProject || !activePsdTarget}
                    title={
                        !hasProject
                            ? "Open a project to register templates"
                            : registryLocked
                                ? "Template registry is busy"
                                : !activePsdTarget
                                    ? "Open a PSD in Photoshop or select a template to add"
                                    : `Register "${activePsdTarget.name}" as project template`
                    }
                >
                    Add Current PSD
                </button>
                <span style={{ fontSize: 12, color: "#b8b8b8" }}>
                    Registered: {registeredTemplates.length}
                </span>
                <button
                    onClick={revalidateTemplatesRequest}
                    disabled={!canRevalidateTemplates({
                        hasProject,
                        isExecuting,
                        registryMutating,
                        revalidateBusy,
                        workspaceAvailable: templatesWorkspaceAvailable
                    })}
                >
                    {revalidateBusy ? "Revalidating…" : "Revalidate Templates"}
                </button>
                    </div>
                </div>

                <div style={{ fontSize: 12, color: registryBlocked ? "#ffcc88" : "#9ee6a5" }}>
                    Ready: {registrySummary.ready} · Blocking: {registrySummary.blocking}
                    {registryBlocked && " — Template registry needs attention before processing."}
                </div>
                {revalidationMessage && (
                    <div style={{ fontSize: 12, color: revalidationMessage.includes("could not") ? "#ff9999" : "#b8dca0" }}>
                        {revalidationMessage}
                    </div>
                )}
                {recoverySnapshot && recoveryCompatibility && (
                    <div style={{ fontSize: 12, color: recoveryCompatibility === "COMPATIBLE" ? "#9ee6a5" : "#ffcc88" }}>
                        Recovery compatibility: {recoveryCompatibilityLabel(recoveryCompatibility)}
                    </div>
                )}

                <div
                    ref={templateListRef}
                    className="template-registry-scroll"
                    aria-label="Registered project templates in batch execution order"
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                    {registeredTemplates.map((entry, index) => {
                        const isSelected = entry.id === selectedRegisteredId;
                        const isDropBefore = dropTarget?.id === entry.id && dropTarget?.position === "before";
                        const isDropAfter = dropTarget?.id === entry.id && dropTarget?.position === "after";
                        const status = templateValidationLabel(entry.validationState);
                        const statusBlocked = entry.validationState !== "READY";
                        return (
                            <div key={entry.id}>
                                {isDropBefore && <div className="drop-before" style={{ height: 2, background: "#4da3ff", marginBottom: 3 }} />}
                                <div
                                    ref={node => {
                                        if (node) templateRowRefs.current.set(entry.id, node);
                                        else templateRowRefs.current.delete(entry.id);
                                    }}
                                    role="button"
                                    className={`template-row${draggedTemplateId === entry.id ? " dragging" : ""}${isDropBefore ? " drop-before" : ""}${isDropAfter ? " drop-after" : ""}`}
                                    tabIndex={0}
                                    title={`Select ${entry.name}`}
                                    aria-label={`Template ${index + 1}: ${entry.name}, ${status}`}
                                    onClick={() => {
                                        if (!draggedTemplateId) setSelectedRegisteredId(entry.id);
                                    }}
                                    onKeyDown={event => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setSelectedRegisteredId(entry.id);
                                        }
                                    }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                                        borderRadius: 4, cursor: registryLocked ? "default" : "pointer",
                                        background: isSelected ? "#3c5a78" : "#252525",
                                        border: draggedTemplateId === entry.id ? "1px dashed #61aef7" : (isSelected ? "1px solid #61aef7" : "1px solid #444"),
                                        opacity: draggedTemplateId === entry.id ? 0.65 : 1
                                    }}
                                >
                                    <div
                                        className="template-drag-handle"
                                        ref={node => {
                                            if (node && !renderedDragHandlesRef.current.has(entry.id)) {
                                                renderedDragHandlesRef.current.add(entry.id);
                                                console.info("TEMPLATE_DRAG_HANDLE_RENDERED", JSON.stringify({
                                                    templateId: entry.id,
                                                    sourceIndex: index,
                                                    disabled: registryLocked
                                                }));
                                            }
                                        }}
                                        role="button"
                                        tabIndex={registryLocked ? -1 : 0}
                                        aria-disabled={registryLocked}
                                        title={`Drag to reorder ${entry.name}`}
                                        aria-label={`Drag handle for ${entry.name}`}
                                        onClick={event => event.stopPropagation()}
                                        onMouseDown={event => beginTemplateMouseDrag(event, entry, index)}
                                        onKeyDown={event => {
                                            if (event.key === "Escape" && dragStateRef.current) {
                                                clearTemplateDrag({ cancelled: true, reason: "escape" });
                                            }
                                        }}
                                        style={{ cursor: registryLocked ? "not-allowed" : "grab", touchAction: "none", pointerEvents: "auto", userSelect: "none" }}
                                    >☰</div>
                                    <span aria-label={`Order ${index + 1}`}>{index + 1}</span>
                                    <span style={{ flex: 1 }}>{entry.name}</span>
                                    <span title={`Validation status: ${status}`} aria-label={`Status ${status}`} style={{ fontSize: 11, color: statusBlocked ? "#ff9999" : "#9ee6a5" }}>{status}</span>
                                    <button title={`Move ${entry.name} up`} aria-label={`Move ${entry.name} up`} disabled={registryLocked || index === 0} onClick={event => { event.stopPropagation(); moveRegisteredTemplate(entry.id, index - 1, "keyboard"); }}>↑</button>
                                    <button title={`Move ${entry.name} down`} aria-label={`Move ${entry.name} down`} disabled={registryLocked || index === registeredTemplates.length - 1} onClick={event => { event.stopPropagation(); moveRegisteredTemplate(entry.id, index + 1, "keyboard"); }}>↓</button>
                                    <button title={`Remove ${entry.name}`} aria-label={`Remove ${entry.name}`} disabled={registryLocked} onClick={event => { event.stopPropagation(); removeSelectedRegisteredTemplate(entry.id); }}>×</button>
                                </div>
                                {isDropAfter && <div className="drop-after" style={{ height: 2, background: "#4da3ff", marginTop: 3 }} />}
                            </div>
                        );
                    })}
                </div>

                <div className="template-execution-row">
                    <div className="template-action-group">
                <button
                    onClick={buildExecutionPlan}
                    disabled={isExecuting || !hasProject || !placementPlan}
                >
                    Build Execution Dry Run
                </button>

                <button
                    onClick={executeFirstReplacementStep}
                    disabled={
                        !hasProject ||
                        isExecuting ||
                        executionPlan?.status !== "READY" ||
                        !replacementRequest?.steps?.length
                    }
                >
                    Execute Replacement
                </button>

                <button
                    onClick={executeReplacementBatchRequest}
                    disabled={isExecuting || !hasProject}
                >
                    {isExecuting ? "Replacing…" : "Replace All"}
                </button>
                    </div>
                    <div className="template-action-group template-action-group--primary">
                <button
                    onClick={executeProjectRequest}
                    disabled={!canProcessProject({
                        hasProject,
                        isExecuting,
                        entries: registeredTemplates,
                        preflight: registryPreflightState
                    })}
                >
                    {isExecuting ? "Processing…" : "Process Project"}
                </button>
                {albumSheetForRender?.id && (
                    <button
                        className="template-render-sheet-button"
                        onClick={executeAlbumSheetRender}
                        disabled={isExecuting || !hasProject}
                        title="Render only this Album Sheet using the current selected photos."
                    >
                        {isExecuting
                            ? "Rendering…"
                            : `Render Sheet: ${albumSheetForRender.label || albumSheetForRender.id}`}
                    </button>
                )}
                    </div>
                </div>

                <BatchProgressPanel
                    summary={projectExecutionSummary}
                    onRequestCancel={requestBatchCancellation}
                    recoveryOutput={recoveryState?.outputRecovery || null}
                />

                <div className="template-output-row">
                    <div className="template-action-group">
                <label style={{ fontSize: 12 }}>
                    <input
                        type="checkbox"
                        checked={autoSaveEnabled}
                        onChange={event => {
                            setAutoSaveEnabled?.(event.target.checked);
                            setAutoSaveResult(null);
                            setPlacementVersion(value => value + 1);
                        }}
                    />
                    Auto Save
                </label>

                <UxpDropdown
                    value={autoSaveMode}
                    options={AUTO_SAVE_MODE_OPTIONS}
                    onValueChange={mode => {
                        setAutoSaveMode?.(mode);
                        setAutoSaveResult(null);
                        setPlacementVersion(value => value + 1);
                    }}
                    className="template-output-dropdown"
                    ariaLabel="Auto Save mode"
                    title="Auto Save mode"
                />
                {autoSaveEnabled && autoSaveMode === "OVERWRITE_ORIGINAL" && (
                    <span role="alert" style={{ fontSize: 12, color: "#ffcc88" }}>
                        Overwrite Original is non-reversible. Cancellation cannot restore the prior PSD after the host save commits.
                    </span>
                )}
                    </div>
                    <div className="template-action-group">
                <label style={{ fontSize: 12 }}>
                    <input
                        type="checkbox"
                        checked={exportEnabled}
                        onChange={event => {
                            setExportEnabled?.(event.target.checked);
                            setExportResult(null);
                            setPlacementVersion(value => value + 1);
                        }}
                    />
                    Export
                </label>

                <UxpDropdown
                    value={exportFormat}
                    options={EXPORT_FORMAT_OPTIONS}
                    onValueChange={format => {
                        setExportFormat?.(format);
                        setExportResult(null);
                        setPlacementVersion(value => value + 1);
                    }}
                    className="template-output-dropdown"
                    ariaLabel="Export format"
                    title="Export format"
                />
                    </div>
                </div>
            </div>

            {false && <>
            <div style={{ marginTop: 10, fontSize: 12 }}>
                <div>Project Health</div>
                <div>Project: {hasProject ? "READY" : "MISSING"}</div>
                <div>Photos: {healthPhotos.length}</div>
                <div>Template: {healthTemplate ? "READY" : "MISSING"}</div>
                <div>Smart Objects: {healthTemplate?.smartObjects?.length || 0}</div>
                <div>Placement: {placementPlan ? "READY" : "NOT READY"}</div>
                <div>Execution Plan: {executionPlan?.status === "READY" ? "READY" : "NOT READY"}</div>
                <div>Replacement Request: {replacementRequest ? "READY" : "NOT READY"}</div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12 }}>
                <div>Auto Save: {autoSaveEnabled ? "ON" : "OFF"}</div>
                <div>Mode: {autoSaveMode === "SAVE_COPY" ? "Save Copy" : "Overwrite Original"}</div>
                {autoSaveMode === "OVERWRITE_ORIGINAL" && (
                    <div style={{ color: "#ffcc99" }}>
                        Warning: Overwrite Original is destructive.
                    </div>
                )}
                {autoSaveResult && (
                    <>
                        <div>Auto Save: {autoSaveResult.status}</div>
                        {!!autoSaveResult.outputPath && (
                            <div>Output: {autoSaveResult.outputPath}</div>
                        )}
                        {!!autoSaveResult.warnings?.length && (
                            <div>Warning: {autoSaveResult.warnings.join(" ")}</div>
                        )}
                        {autoSaveResult.error && (
                            <div>Warning: {autoSaveResult.error}</div>
                        )}
                    </>
                )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12 }}>
                <div>Export: {exportEnabled ? "ON" : "OFF"}</div>
                <div>Format: {exportFormat}</div>
                {exportResult && (
                    <>
                        <div>Last Export: {exportResult.status}</div>
                        {!!exportResult.outputPath && (
                            <div>Output: {exportResult.outputPath}</div>
                        )}
                        {!!exportResult.warnings?.length && (
                            <div>Warning: {exportResult.warnings.join(" ")}</div>
                        )}
                        {exportResult.error && (
                            <div>Warning: {exportResult.error}</div>
                        )}
                    </>
                )}
            </div>

            {document && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Template Name: {document.name}</div>
                    <div>Width × Height: {document.document.width} × {document.document.height}</div>
                    <div>Resolution: {document.document.resolution}</div>
                    <div>Layer Count: {document.statistics.totalLayers}</div>
                    <div>
                        Smart Objects: {document.statistics.totalSmartObjects}
                    </div>
                    {!!document.smartObjects?.length && (
                        <div>
                            Smart Object Names: {document.smartObjects
                                .map(layer => layer.layerName)
                                .join(", ")}
                        </div>
                    )}
                    <div>
                        Text Layers: {document.statistics.totalTextLayers}
                    </div>
                    {!!document.textLayers?.length && (
                        <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                            {document.textLayers.map(layer => (
                                <li key={layer.layerId}>
                                    {layer.layerName}: {textPreview(layer.textContent)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

            )}

            {document?.layerTree && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <LayerTree layers={document.layerTree} />
                </div>

            )}

            {placementPlan && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Assigned Slots: {placementPlan.statistics.assignedSlots}</div>
                    <div>Empty Slots: {placementPlan.statistics.emptySlots}</div>
                    <div>Unassigned Photos: {placementPlan.statistics.unassignedPhotos}</div>
                    <div>Warnings: {placementPlan.warnings.length}</div>
                </div>

            )}

            {placementError && (

                <div style={{ marginTop: 10, fontSize: 12, color: "#ff9999" }}>
                    Placement Plan: {placementError}
                </div>

            )}

            {executionPlan && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Ready Steps: {executionPlan.statistics.readySteps}</div>
                    <div>Warnings: {executionPlan.statistics.warningCount}</div>
                    <div>Status: {executionPlan.status}</div>
                </div>

            )}

            {replacementResult && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Replacement: {replacementResult.status}</div>
                    {!!replacementResult.errors?.length && (
                        <div>{replacementResult.errors.join(" ")}</div>
                    )}
                </div>

            )}

            {executionSummary && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Completed</div>
                    <div>Success: {executionSummary.completedSteps}</div>
                    <div>Failed: {executionSummary.failedSteps}</div>
                </div>

            )}

            {batchProgress && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Batch Progress</div>
                    <div>Status: {batchProgress.status}</div>
                    <div>Current Photo: {batchProgress.currentPhotoName || "—"}</div>
                    <div>Current Slot: {batchProgress.currentSlotName || "—"}</div>
                    <div>Completed: {batchProgress.completedSteps} / {batchProgress.totalSteps}</div>
                    <div>Success: {batchProgress.successCount}</div>
                    <div>Failed: {batchProgress.failedCount}</div>
                </div>

            )}

            {projectExecutionSummary && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Project Execution</div>
                    <div>Templates</div>
                    <div>Completed : {projectExecutionSummary.completedTemplates}</div>
                    <div>Failed : {projectExecutionSummary.failedTemplates}</div>
                    <div>Status : {projectExecutionSummary.status}</div>
                </div>

            )}
            </>}

        </section>

    );

}
