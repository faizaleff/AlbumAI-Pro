import { normalizePhotoEventChapters, photoDecisionKey } from "./PhotoBrowserModel";

const nextId = items => `chapter-${1 + Math.max(0, ...items.map(item => Number(item.chapterId.slice(8))))}`;
const clean = items => normalizePhotoEventChapters({items: items.filter(item => item.originKeys || item.photoKeys.length)});

// Original memberships survive moves and empty-group hiding. Never move files.
export function eventWorkspace(value, photos, groups) {
    const items = normalizePhotoEventChapters(value, photos).items.map(item => ({...item,
        photoKeys: [...item.photoKeys], ...(item.originKeys ? {originKeys: [...item.originKeys]} : {})}));
    const known = new Set(items.flatMap(item => item.originKeys || []));
    const assigned = new Set(items.flatMap(item => item.photoKeys));
    const byId = new Map(photos.map(photo => [photo.id, photoDecisionKey(photo)]));
    const grouped = new Set(groups.flatMap(group => group.photoIds));
    for (const group of [...groups, {label: "Unassigned", photoIds: photos.filter(photo => !grouped.has(photo.id)).map(photo => photo.id)}]) {
        const keys = group.photoIds.map(id => byId.get(id)).filter(Boolean);
        const fresh = keys.filter(key => !known.has(key));
        if (!fresh.length) continue;
        let target = items.find(item => item.originKeys?.some(key => keys.includes(key)));
        if (!target) {
            target = {chapterId: nextId(items), name: group.label, photoKeys: [], originKeys: []};
            items.push(target);
        }
        target.originKeys.push(...fresh);
        target.photoKeys.push(...fresh.filter(key => !assigned.has(key)));
        fresh.forEach(key => known.add(key));
    }
    return clean(items);
}

export function editEvent(value, action, id, keys = [], name = "New event") {
    const items = value.items.map(item => ({...item, photoKeys: [...item.photoKeys]}));
    let target = items.find(item => item.chapterId === id);
    if (action === "new") {
        target = {chapterId: nextId(items), name, photoKeys: []}; items.push(target);
    }
    if (action === "rename" && target) target.name = name;
    if ((action === "before" || action === "after") && target && id !== name && items.some(item => item.chapterId === name)) {
        items.splice(items.indexOf(target), 1);
        items.splice(items.findIndex(item => item.chapterId === name) + (action === "after" ? 1 : 0), 0, target);
    }
    if (action === "up" || action === "down") {
        const index = items.indexOf(target), next = index + (action === "up" ? -1 : 1);
        if (index >= 0 && next >= 0 && next < items.length) [items[index], items[next]] = [items[next], items[index]];
    }
    if (action === "merge" || action === "delete") keys = target?.photoKeys || [];
    if (action === "merge") {
        if (id === name) return value;
        target = items.find(item => item.chapterId === name);
    }
    if (["new", "move", "merge", "delete", "restore"].includes(action)) {
        if (["new", "move", "merge"].includes(action) && !target) return value;
        const moving = new Set(keys);
        items.forEach(item => { item.photoKeys = item.photoKeys.filter(key => !moving.has(key)); });
        if (action === "delete" || action === "restore") {
            keys.forEach(key => {
                const origin = items.find(item => item.originKeys?.includes(key));
                // Deleting an automatic event removes its membership, not photos.
                if (origin && !(action === "delete" && origin === target)) origin.photoKeys.push(key);
                else {
                    let loose = items.find(item => !item.originKeys && item.name === "Unassigned");
                    if (!loose) { loose = {chapterId: nextId(items), name: "Unassigned", photoKeys: []}; items.push(loose); }
                    loose.photoKeys.push(key);
                }
            });
        } else target.photoKeys.push(...keys);
    }
    return clean(items);
}
