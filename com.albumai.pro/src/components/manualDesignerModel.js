import { photoDecisionKey } from "../services/PhotoBrowserModel";
import { ManualSheetDesignIntent } from "../project/ManualSheetDesign";

export const ManualDesignerStatus = Object.freeze({
    NO_SHEET: "NO_SHEET",
    TEMPLATE_MISSING: "TEMPLATE_MISSING",
    TEMPLATE_NOT_LOADED: "TEMPLATE_NOT_LOADED",
    NO_SLOTS: "NO_SLOTS",
    READY: "READY"
});

export const MAX_MANUAL_DESIGNER_PHOTOS = 120;

export const ManualDesignerDragKind = Object.freeze({
    PHOTO: "PHOTO",
    SLOT: "SLOT"
});

export function manualDesignerDropMutation(source, targetSlotLayerId) {
    if (!Number.isSafeInteger(targetSlotLayerId) || targetSlotLayerId <= 0 ||
        !source || typeof source !== "object") return null;
    if (source.kind === ManualDesignerDragKind.PHOTO &&
        /^p1-[0-9a-f]{16}$/.test(source.photoKey || "")) {
        return Object.freeze({
            intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
            slotLayerId: targetSlotLayerId,
            photoKey: source.photoKey
        });
    }
    if (source.kind === ManualDesignerDragKind.SLOT &&
        Number.isSafeInteger(source.slotLayerId) &&
        source.slotLayerId > 0 && source.slotLayerId !== targetSlotLayerId) {
        return Object.freeze({
            intent: ManualSheetDesignIntent.SWAP_SLOTS,
            slotLayerId: source.slotLayerId,
            targetSlotLayerId
        });
    }
    return null;
}

export function manualDesignerClearMutation(slotLayerId) {
    return Number.isSafeInteger(slotLayerId) && slotLayerId > 0
        ? Object.freeze({
            intent: ManualSheetDesignIntent.CLEAR_SLOT,
            slotLayerId
        })
        : null;
}

export function manualDesignerCropMutation(slotLayerId, cropFocus) {
    const x = Number(cropFocus?.x);
    const y = Number(cropFocus?.y);
    if (!Number.isSafeInteger(slotLayerId) || slotLayerId <= 0 ||
        !Number.isFinite(x) || !Number.isFinite(y) ||
        x < 0 || x > 1 || y < 0 || y > 1) return null;
    return Object.freeze({
        intent: ManualSheetDesignIntent.SET_CROP_FOCUS,
        slotLayerId,
        cropFocus: Object.freeze({
            x: Math.round(x * 1000000) / 1000000,
            y: Math.round(y * 1000000) / 1000000
        })
    });
}

function safeText(value, fallback = "") {
    return typeof value === "string" && value.trim()
        ? value.trim().slice(0, 160)
        : fallback;
}

function slotBounds(value) {
    if (!value || typeof value !== "object") return null;
    const values = [value.left, value.top, value.right, value.bottom]
        .map(Number);
    if (!values.every(Number.isFinite)) return null;
    return Object.freeze({
        left: values[0],
        top: values[1],
        right: values[2],
        bottom: values[3]
    });
}

function templateChoices(templates) {
    const seen = new Set();
    return Object.freeze((Array.isArray(templates) ? templates : [])
        .filter(template => {
            const id = safeText(template?.id);
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        })
        .map(template => Object.freeze({
            id: safeText(template.id),
            name: safeText(template.name, safeText(template.id)),
            ready: template.validationState === "READY"
        })));
}

function photoTray(photos, assignedByPhoto, availablePhotoKeys) {
    const source = Array.isArray(photos) ? photos : [];
    const items = [];
    const seen = new Set();
    for (const photo of source) {
        if (items.length >= MAX_MANUAL_DESIGNER_PHOTOS) break;
        const photoKey = photoDecisionKey(photo);
        if (!photoKey || seen.has(photoKey)) continue;
        availablePhotoKeys.add(photoKey);
        seen.add(photoKey);
        items.push(Object.freeze({
            photoKey,
            name: safeText(photo?.name, "Photo"),
            assignedSlotLayerId: assignedByPhoto.get(photoKey) ?? null
        }));
    }
    return Object.freeze({
        items: Object.freeze(items),
        total: source.length,
        hidden: Math.max(0, source.length - items.length)
    });
}

export function buildManualDesignerView({
    sheet = null,
    templates = [],
    activeTemplate = null,
    photos = []
} = {}) {
    const choices = templateChoices(templates);
    const selectedTemplate = sheet
        ? choices.find(template => template.id === sheet.templateId) || null
        : null;
    const assignments = Array.isArray(sheet?.design?.assignments)
        ? sheet.design.assignments
        : [];
    const assignedBySlot = new Map(assignments.map(assignment => [
        assignment.slotLayerId,
        assignment
    ]));
    const assignedByPhoto = new Map(assignments.map(assignment => [
        assignment.photoKey,
        assignment.slotLayerId
    ]));
    const availablePhotoKeys = new Set();
    const tray = photoTray(photos, assignedByPhoto, availablePhotoKeys);
    for (const photo of (Array.isArray(photos) ? photos : []).slice(
        tray.items.length
    )) {
        const photoKey = photoDecisionKey(photo);
        if (photoKey) availablePhotoKeys.add(photoKey);
    }

    let status = ManualDesignerStatus.NO_SHEET;
    if (sheet && !selectedTemplate) {
        status = ManualDesignerStatus.TEMPLATE_MISSING;
    } else if (sheet && activeTemplate?.projectTemplateId !== sheet.templateId) {
        status = ManualDesignerStatus.TEMPLATE_NOT_LOADED;
    }

    const slots = [];
    if (sheet && status !== ManualDesignerStatus.TEMPLATE_MISSING &&
        activeTemplate?.projectTemplateId === sheet.templateId) {
        const seen = new Set();
        for (const slot of Array.isArray(activeTemplate.smartObjects)
            ? activeTemplate.smartObjects
            : []) {
            const slotLayerId = Number(slot?.layerId);
            if (!Number.isInteger(slotLayerId) || slotLayerId <= 0 ||
                seen.has(slotLayerId)) continue;
            seen.add(slotLayerId);
            const assignment = assignedBySlot.get(slotLayerId) || null;
            slots.push(Object.freeze({
                slotLayerId,
                name: safeText(slot?.layerName, `Slot ${slots.length + 1}`),
                bounds: slotBounds(slot?.bounds),
                photoKey: assignment?.photoKey || null,
                cropFocus: assignment?.cropFocus || null,
                assigned: !!assignment,
                photoAvailable: !!assignment && availablePhotoKeys.has(
                    assignment.photoKey
                )
            }));
        }
        status = slots.length
            ? ManualDesignerStatus.READY
            : ManualDesignerStatus.NO_SLOTS;
    }

    return Object.freeze({
        status,
        sheet: sheet ? Object.freeze({
            id: safeText(sheet.id),
            label: safeText(sheet.label, safeText(sheet.id)),
            templateId: safeText(sheet.templateId)
        }) : null,
        templates: choices,
        selectedTemplate,
        slots: Object.freeze(slots),
        assignedCount: slots.filter(slot => slot.assigned).length,
        photos: tray
    });
}
