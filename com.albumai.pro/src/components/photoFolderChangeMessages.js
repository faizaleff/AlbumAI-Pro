import { PhotoFolderChangeStatus } from "../services/PhotoWorkspaceService";

export function photoFolderChangeMessage(result) {

    switch (result?.status) {
    case PhotoFolderChangeStatus.EMPTY_FOLDER:
        return "The selected folder is empty. Choose a folder with supported photos.";
    case PhotoFolderChangeStatus.UNSUPPORTED_ONLY:
        return "The selected folder has no supported JPEG photos.";
    case PhotoFolderChangeStatus.INACCESSIBLE:
        return "The selected photo folder is unavailable or cannot be read.";
    case PhotoFolderChangeStatus.TOKEN_FAILURE:
        return "AlbumAI could not retain access to the selected photo folder.";
    case PhotoFolderChangeStatus.SAVE_FAILURE:
        return "AlbumAI could not save the new photo folder. Your current folder is unchanged.";
    case PhotoFolderChangeStatus.SUPERSEDED:
        return "This photo folder change was superseded by a newer request.";
    case PhotoFolderChangeStatus.BLOCKED_ACTIVE_BATCH:
        return "Finish or cancel the active batch before changing the photo folder.";
    case PhotoFolderChangeStatus.RECOVERY_DECISION_REQUIRED:
        return "Recovery state changed. Acknowledge clearing saved batch recovery before retrying.";
    case PhotoFolderChangeStatus.INVALID_TRANSACTION:
        return "This photo folder change is no longer valid. Choose the folder again.";
    case PhotoFolderChangeStatus.COMMIT_FAILURE:
        return "AlbumAI could not complete the folder change. Your current folder is unchanged.";
    case PhotoFolderChangeStatus.SAME_FOLDER:
        return "Photo folder refreshed; no folder change was needed.";
    default:
        return "Unable to change the photo folder. Your current folder is unchanged.";
    }

}

export function shouldResetPhotoPreview(result) {

    return result?.status === PhotoFolderChangeStatus.SUCCESS;

}

export function upgradePhotoFolderChangeForRecovery(previous, result) {

    if (
        result?.status !== PhotoFolderChangeStatus.RECOVERY_DECISION_REQUIRED ||
        !previous?.prepared
    ) {
        return previous;
    }
    return {
        ...previous,
        busy: false,
        prepared: {
            ...previous.prepared,
            recoveryDecisionRequired: true,
            recoveryClassification: result.recoveryClassification || null
        },
        clearRecovery: false,
        error: photoFolderChangeMessage(result)
    };

}

export function canConfirmPhotoFolderChange(state) {

    return Boolean(
        state?.prepared &&
        (!state.prepared.recoveryDecisionRequired || state.clearRecovery)
    );

}

export function photoFolderChangeCommitOptions(state) {

    return {
        clearRecovery: Boolean(
            state?.prepared?.recoveryDecisionRequired &&
            state.clearRecovery
        )
    };

}
