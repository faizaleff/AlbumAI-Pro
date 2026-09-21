// One Photoshop document at a time. Photos remain owned by visible PhotoImages.
export async function prepareTemplatePreviews({getTemplates, priority, ready, load, locked,
    cancelled, progress, pause = () => new Promise(resolve => setTimeout(resolve, 150))}) {
    const attempted = new Set();
    let failed = 0;
    while (!cancelled()) {
        const templates = getTemplates();
        const pending = templates.filter(item => !attempted.has(item.id) && !ready(item));
        if (!pending.length) {
            progress({phase:"ready",completed:templates.length,total:templates.length,
                message:failed ? `Previews loaded · ${failed} unavailable; use Update preview to retry.` : "Template and spread previews ready."});
            return;
        }
        await pause();
        if (cancelled()) return;
        if (locked()) continue;
        const preferred = priority();
        const item = pending.find(item => item.id === preferred) || pending[0];
        progress({phase:"preparing",completed:templates.length-pending.length,total:templates.length,
            message:`Loading template preview · ${item.name || item.fileName}`});
        try { await load(item); if (!ready(item)) failed++; }
        catch (_) { failed++; }
        attempted.add(item.id);
    }
}
