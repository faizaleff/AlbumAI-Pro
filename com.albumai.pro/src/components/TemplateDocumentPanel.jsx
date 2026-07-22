import React, { useEffect, useState } from "react";

function LayerTree({ layers = [], depth = 0 }) {

    return (

        <ul
            style={{
                margin: 0,
                paddingLeft: depth ? 16 : 0,
                listStyle: "none"
            }}
        >

            {layers.map(layer => (
                <li key={layer.id} style={{ marginTop: 4 }}>
                    <span>
                        {layer.children.length ? "Group" : "Layer"}: {layer.name}
                    </span>
                    {layer.children.length > 0 && (
                        <LayerTree
                            layers={layer.children}
                            depth={depth + 1}
                        />
                    )}
                </li>
            ))}

        </ul>

    );

}

function textPreview(text) {

    if (typeof text !== "string") {
        return "—";
    }

    return text.length > 80
        ? `${text.slice(0, 80)}…`
        : text;

}

export default function TemplateDocumentPanel({
    loadTemplates,
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
    executeProject,
    getCurrentProjectExecutionSummary,
    getPhotos,
    getCurrentTemplate,
    hasProject = false
}) {

    const [templates, setTemplates] = useState([]);
    const [selectedName, setSelectedName] = useState("");
    const [document, setDocument] = useState(null);
    const [, setPlacementVersion] = useState(0);
    const [placementError, setPlacementError] = useState(null);
    const [replacementResult, setReplacementResult] = useState(null);
    const [executionSummary, setExecutionSummary] = useState(null);
    const [batchProgress, setBatchProgress] = useState(() =>
        getCurrentBatchProgress?.() || null
    );
    const [projectExecutionSummary, setProjectExecutionSummary] = useState(null);

    const placementPlan = getCurrentPlacementPlan?.() || null;
    const executionPlan = getCurrentPlacementExecutionPlan?.() || null;
    const replacementRequest = getCurrentReplacementRequest?.() || null;
    const healthPhotos = getPhotos?.() || [];
    const healthTemplate = getCurrentTemplate?.() || null;

    useEffect(() => {

        async function load() {

            if (!hasProject) {
                setTemplates([]);
                setSelectedName("");
                return;
            }

            try {

                const files = await loadTemplates();

                setTemplates(files);
                setSelectedName(files[0]?.name || "");

            }

            catch (_) {

                setTemplates([]);
                setSelectedName("");

            }

        }

        load();

    }, [loadTemplates, hasProject]);

    useEffect(() => {

        if (!hasProject) {
            setDocument(null);
            setPlacementError(null);
            setReplacementResult(null);
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setProjectExecutionSummary(null);
        }

        else if (!replacementRequest) {
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
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
        setProjectExecutionSummary(null);
        setPlacementVersion(value => value + 1);

    }

    function planPlacement() {

        try {

            planPhotoPlacement?.();
            setPlacementError(null);
            setProjectExecutionSummary(null);
            setPlacementVersion(value => value + 1);

        }

        catch (error) {

            setPlacementError(error.message);

        }

    }

    function buildExecutionPlan() {

        try {

            buildPlacementExecutionPlan?.();
            setPlacementError(null);
            setReplacementResult(null);
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setProjectExecutionSummary(null);
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
            const summary = await executeReplacementBatch(progress => {
                setBatchProgress(progress);
            });

            setExecutionSummary(summary || getCurrentExecutionSummary?.() || null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setPlacementVersion(value => value + 1);

        }

        catch (_) {

            setExecutionSummary(getCurrentExecutionSummary?.() || null);
            setBatchProgress(getCurrentBatchProgress?.() || null);

        }

    }

    async function executeProjectRequest() {

        try {

            const summary = await executeProject(nextSummary => {
                setProjectExecutionSummary(nextSummary);
            });

            setProjectExecutionSummary(
                summary || getCurrentProjectExecutionSummary?.() || null
            );

        }

        catch (_) {

            setProjectExecutionSummary(
                getCurrentProjectExecutionSummary?.() || null
            );

        }

    }

    return (

        <section
            style={{
                marginBottom: 15,
                padding: 12,
                background: "#2f2f2f",
                borderRadius: 6
            }}
        >

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center"
                }}
            >

                <select
                    value={selectedName}
                    onChange={event =>
                        setSelectedName(event.target.value)
                    }
                    disabled={!templates.length}
                >

                    {templates.map(file => (
                        <option key={file.name} value={file.name}>
                            {file.name}
                        </option>
                    ))}

                </select>

                <button
                    onClick={open}
                    disabled={!hasProject || !selectedName}
                >
                    Open PSD
                </button>

                <button
                    onClick={planPlacement}
                    disabled={!hasProject || !document}
                >
                    Plan Placement
                </button>

                <button
                    onClick={buildExecutionPlan}
                    disabled={!hasProject || !placementPlan}
                >
                    Build Execution Dry Run
                </button>

                <button
                    onClick={executeFirstReplacementStep}
                    disabled={
                        !hasProject ||
                        executionPlan?.status !== "READY" ||
                        !replacementRequest?.steps?.length
                    }
                >
                    Execute Replacement
                </button>

                <button
                    onClick={executeReplacementBatchRequest}
                    disabled={!hasProject}
                >
                    Replace All
                </button>

                <button
                    onClick={executeProjectRequest}
                    disabled={!hasProject}
                >
                    Process Project
                </button>

            </div>

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

        </section>

    );

}
