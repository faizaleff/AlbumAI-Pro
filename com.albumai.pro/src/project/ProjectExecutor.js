import ReplacementRequest from "../placement/ReplacementRequest";
import ProjectExecutionSummary, {
    ProjectExecutionStatus
} from "./ProjectExecutionSummary";

/** Coordinates deterministic template execution through the batch executor. */
export default class ProjectExecutor {

    constructor({
        templateRegistry,
        photoPlacementEngine,
        placementExecutionPlanBuilder,
        replacementBatchExecutor
    } = {}) {

        if (!templateRegistry) throw new Error("A template registry is required.");
        if (!photoPlacementEngine) throw new Error("A photo placement engine is required.");
        if (!placementExecutionPlanBuilder) throw new Error("A placement execution plan builder is required.");
        if (!replacementBatchExecutor) throw new Error("A replacement batch executor is required.");

        this.templateRegistry = templateRegistry;
        this.photoPlacementEngine = photoPlacementEngine;
        this.placementExecutionPlanBuilder = placementExecutionPlanBuilder;
        this.replacementBatchExecutor = replacementBatchExecutor;

    }

    async execute({ project, photos = [] } = {}) {

        const startedAt = new Date().toISOString();
        const startedMilliseconds = Date.now();
        const templates = this.templates();
        const templateResults = [];
        let completedTemplates = 0;
        let failedTemplates = 0;

        for (const template of templates) {

            try {
                this.templateRegistry.register(template);

                const placementResult = this.photoPlacementEngine.plan({
                    project,
                    photos,
                    template
                });
                const executionPlan = this.placementExecutionPlanBuilder.build({
                    placementResult,
                    project,
                    template,
                    photos
                });
                const request = new ReplacementRequest({ executionPlan });
                const executionSummary = await this.replacementBatchExecutor.execute(
                    request,
                    { photos, templateName: template.name }
                );
                const succeeded = executionSummary.status === "COMPLETED";

                templateResults.push({
                    templateId: template.id,
                    templateName: template.name,
                    status: executionSummary.status,
                    executionSummary
                });

                if (succeeded) {
                    completedTemplates += 1;
                }
                else {
                    failedTemplates += 1;
                }

            }
            catch (error) {

                failedTemplates += 1;
                templateResults.push({
                    templateId: template?.id ?? null,
                    templateName: template?.name || "",
                    status: "FAILED",
                    executionSummary: null,
                    error: error.message
                });

            }
        }

        return new ProjectExecutionSummary({
            projectId: this.projectId(project),
            totalTemplates: templates.length,
            completedTemplates,
            failedTemplates,
            templateResults,
            startedAt,
            finishedAt: new Date().toISOString(),
            elapsedMilliseconds: Date.now() - startedMilliseconds,
            status: failedTemplates
                ? ProjectExecutionStatus.FAILED
                : ProjectExecutionStatus.COMPLETED
        });

    }

    templates() {

        return this.templateRegistry.getAll()
            .map((template, registryOrder) => ({ template, registryOrder }))
            .sort((left, right) => {
                if (left.registryOrder !== right.registryOrder) {
                    return left.registryOrder - right.registryOrder;
                }

                const timestampDifference = this.registrationTimestamp(left.template) -
                    this.registrationTimestamp(right.template);

                if (timestampDifference) return timestampDifference;

                return String(left.template?.id).localeCompare(
                    String(right.template?.id),
                    undefined,
                    { numeric: true, sensitivity: "base" }
                );
            })
            .map(item => item.template);

    }

    registrationTimestamp(template) {

        const timestamp = Date.parse(template?.registeredAt || "");

        return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;

    }

    projectId(project) {

        return project?.metadata?.id ?? project?.metadata?.name ?? null;

    }

}
