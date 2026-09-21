import {photoDuplicateRevisionKey} from "./PhotoDuplicateModel";
import {normalizePhotoEventChapters, photoDecisionKey} from "./PhotoBrowserModel";

// Capture metadata only: file modification times and filename order are not chronology.
export function photoEventCaptureTime(photo) {
    for (const value of [photo.metadata?.dateTaken, photo.metadata?.dateTimeOriginal, photo.dateTaken]) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
        if (typeof value === "string" && value.trim()) {
            const normalized = value.trim().replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T");
            const time = Date.parse(normalized);
            if (Number.isFinite(time) && time > 0) return time;
        }
    }
    return null;
}

export function suggestedEventName(categories, index) {
    const names = {"Individual Portraits":"Portraits", "Couple Portraits":"Couple Portraits", "Family & Guests":"Family & Guests", "Getting Ready":"Getting Ready", "Ceremony":"Ceremony", "Details":"Details"};
    const dominant = Object.entries(categories).sort((a,b) => b[1]-a[1])[0]?.[0];
    return `${index + 1}. ${names[dominant] || "Photos"}`;
}

// Event occurrences are contiguous in capture order. Photo categories describe
// contents within an occurrence; matching category names never merge occurrences.
export function proposePhotoEvents(photos, evidence) {
    if (!Array.isArray(evidence)) throw new Error("Image analysis results are unavailable.");
    const byKey = new Map(photos.map(photo => [photoDecisionKey(photo), photo]));
    const seen = new Set(), accepted = new Map(), review = new Set(), reviewReasons = {};
    let dimensions = null;
    const hold = (key, reason) => {review.add(key); reviewReasons[key] = reason;};
    for (const item of evidence) {
        const key = item?.photoKey;
        if (!byKey.has(key) || seen.has(key)) throw new Error("Image analysis does not match this library.");
        seen.add(key);
        if (item.scoreKind === "model-scene-context") {
            if (item.status !== "complete" || !["same","different","uncertain"].includes(item.contextRelation) ||
                typeof item.category !== "string" || !item.category.trim() || item.category === "Other" || item.requiresReview !== false) {
                hold(key,"Check photo category or context"); continue;
            }
            accepted.set(key,{category:item.category.trim().slice(0,80),unit:null,
                context:item.context,
                description:typeof item.description === "string" ? item.description.replace(/\s+/g," ").trim().slice(0,240) : "",
                relation:item.contextRelation,previousPhotoKey:item.previousPhotoKey});
            continue;
        }
        const vector = item.embedding;
        if (item.status !== "complete" || !Array.isArray(vector) || !vector.length ||
            vector.length > 4096 || !vector.every(Number.isFinite)) {
            hold(key, "Image context unavailable"); continue;
        }
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        if (!norm || (dimensions !== null && dimensions !== vector.length)) {
            hold(key, "Image context unavailable"); continue;
        }
        dimensions = vector.length;
        const category = typeof (item.category ?? item.label) === "string" ? (item.category ?? item.label).trim().slice(0, 80) : "";
        const acceptedMatch = item.requiresReview !== true && (item.scoreKind === "uncalibrated-scene-match"
            ? item.requiresReview === false
            : Number.isFinite(item.confidence) && item.confidence >= .8 && item.confidence <= 1);
        if (!category || category === "Other" || !acceptedMatch) {
            hold(key, "Check photo category"); continue;
        }
        accepted.set(key, {category, unit:vector.map(value => value / norm)});
    }
    const ordered = photos.map(photo => ({key:photoDecisionKey(photo), time:photoEventCaptureTime(photo)}))
        .sort((a,b) => (a.time ?? Infinity) - (b.time ?? Infinity) || a.key.localeCompare(b.key));
    const groups = [];
    let current = null, last = null, interrupted = false;
    const similarity = (a,b) => a.reduce((sum,value,index) => sum + value*b[index],0);
    for (const {key,time} of ordered) {
        if (!seen.has(key)) hold(key, "Image analysis unavailable");
        if (time === null) hold(key, "Capture time unavailable — confirm photo order");
        if (review.has(key)) {
            if (current) {current.requiresReview = true; current.reviewReason = "Check photos around an analysis gap";}
            current = null; last = null; interrupted = true; continue;
        }
        const item = accepted.get(key);
        const gap = last ? time-last.time : Infinity;
        const score = current && item.unit && last.unit && current.anchor ? Math.min(similarity(item.unit,last.unit), similarity(item.unit,current.anchor)) : -1;
        // The 30-minute boundary is a conservative proposal limit, not an event truth.
        const contiguous = current && gap <= 30*60*1000;
        const linked = item.previousPhotoKey === last?.key;
        const cues = ["setting","attire","activity","flow"].map(field => item.context?.[field]);
        const sameCues = cues.filter(value => value === "same").length;
        const changedCue = cues.includes("different");
        // Several agreeing cues can keep an ambiguous pair together for review.
        // Never bridge an explicit new occasion or a contradictory context cue.
        const supported = linked && !changedCue && sameCues >= 2;
        const contextSame = linked && item.relation === "same" && !changedCue;
        const tentative = supported && item.relation === "uncertain";
        const extended = current && supported && contextSame && gap <= 2*60*60*1000;
        const join = item.unit ? contiguous && gap > 0 && score >= .80
            : current && gap >= 0 && (contiguous || extended) && (contextSame || tentative);
        if (join && !item.unit && (gap === 0 || tentative || !contiguous)) {
            current.requiresReview = true;
            current.reviewReason = gap === 0 ? "Matching context with equal capture times — check camera order"
                : tentative ? "Context cues agree; confirm event continuity" : "Matching context across a longer time gap";
        }
        if (!join) {
            const uncertain = !!contiguous || interrupted;
            if (uncertain && current) {current.requiresReview = true; current.reviewReason = "Check scene transition or camera timing";}
            current = {id:`suggestion-${groups.length+1}`, label:`Event ${groups.length+1}`,
                anchor:item.unit, descriptions:[], photoKeys:[], categories:Object.create(null), startTime:time, endTime:time,
                requiresReview:uncertain, reviewReason:uncertain ? "Check scene transition or camera timing" : ""};
            groups.push(current);
        }
        if (item.description && current.descriptions.length < 3 && !current.descriptions.includes(item.description)) current.descriptions.push(item.description);
        current.photoKeys.push(key);
        current.categories[item.category] = (current.categories[item.category] || 0)+1;
        current.endTime = time;
        last = {key,time, unit:item.unit};
        interrupted = false;
    }
    // Missing timestamps could place photos anywhere in the sequence, so remaining
    // proposals also require inspection rather than pretending the timeline is complete.
    const incompleteTimeline = ordered.some(item => item.time === null);
    return {groups:groups.map(({anchor,descriptions,...group},index) => ({...group, label:suggestedEventName(group.categories,index), description:descriptions.join(" "),
            requiresReview:group.requiresReview || incompleteTimeline,
            reviewReason:incompleteTimeline ? "Some photos have no capture time" : group.reviewReason})),
        reviewPhotoKeys:[...review], reviewReasons, sourcePhotoKeys:[...byKey.keys()],
        sourceCaptureTimes:Object.fromEntries(ordered.map(item => [item.key,item.time])),
        sourceRevisions:Object.fromEntries(photos.map(photo => [photoDecisionKey(photo), photoDuplicateRevisionKey(photo)]))};
}

// Apply only explicitly approved groups. Untouched photos, custom names, event
// order and original memberships remain intact. The caller saves once through
// the existing event persistence/Undo transaction.
export function applyPhotoEventProposals(current, photos, proposal, approvedIds) {
    const keys = new Set(photos.map(photoDecisionKey));
    if (keys.size !== proposal.sourcePhotoKeys.length ||
        proposal.sourcePhotoKeys.some(key => !keys.has(key)) ||
        (proposal.sourceRevisions && photos.some(photo => proposal.sourceRevisions[photoDecisionKey(photo)] !== photoDuplicateRevisionKey(photo)))) {
        throw new Error("The photo library changed. Analyze it again.");
    }
    if (proposal.sourceCaptureTimes && photos.some(photo => proposal.sourceCaptureTimes[photoDecisionKey(photo)] !== photoEventCaptureTime(photo))) {
        throw new Error("Photo capture times changed. Analyze it again.");
    }
    const approved = new Set(approvedIds);
    const groups = proposal.groups.filter(group => approved.has(group.id));
    if (groups.length !== approved.size) throw new Error("Unknown event suggestion.");
    const moving = new Set();
    groups.forEach(group => {
        if (!group.label.trim() || !group.photoKeys.length) throw new Error("Name the suggested event first.");
        group.photoKeys.forEach(key => {
            if (!keys.has(key) || moving.has(key)) throw new Error("Conflicting event suggestions.");
            moving.add(key);
        });
    });
    const previous = normalizePhotoEventChapters(current, photos);
    if (previous.items.length + groups.length > 200) throw new Error("Too many events. Apply fewer suggestions or merge existing events first.");
    let next = 1 + Math.max(0, ...previous.items.map(item => Number(item.chapterId.slice(8))));
    const items = previous.items.map(item => ({...item,
        photoKeys:item.photoKeys.filter(key => !moving.has(key))}));
    groups.forEach(group => items.push({chapterId:`chapter-${next++}`, name:group.label, description:group.description, photoKeys:[...group.photoKeys]}));
    return normalizePhotoEventChapters({items}, photos);
}

export async function analyzePhotoEvents(photos, provider, {isCurrent = () => true, onProgress = () => {}} = {}) {
    if (!provider?.analyzeScene) throw new Error("Set up an image-analysis model to use Auto Events.");
    photos = [...photos].sort((a,b) => (photoEventCaptureTime(a) ?? Infinity)-(photoEventCaptureTime(b) ?? Infinity) || photoDecisionKey(a).localeCompare(photoDecisionKey(b)));
    const evidence = [], timings = [];
    const startedAt = Date.now();
    for (let index = 0; index < photos.length; index++) {
        if (!isCurrent()) throw new Error("Event analysis cancelled.");
        const photo = photos[index], photoStartedAt=Date.now();
        onProgress({completed:index,total:photos.length,phase:"Preparing preview",photoStartedAt,startedAt,timings:[...timings]});
        try {
            const result = await provider.analyzeScene(photo, phase => onProgress({completed:index,total:photos.length,phase,photoStartedAt,startedAt,timings:[...timings]}));
            evidence.push({...result, photoKey:photoDecisionKey(photo)});
        } catch (error) {
            if (!isCurrent()) throw new Error("Event analysis cancelled.");
            if (error.fatal) throw error;
            evidence.push({photoKey:photoDecisionKey(photo), status:"failed"});
        }
        if (!isCurrent()) throw new Error("Event analysis cancelled.");
        timings.push({photoKey:photoDecisionKey(photo), durationMs:Date.now()-photoStartedAt});
        onProgress({completed:index + 1, total:photos.length,startedAt,timings:[...timings]});
    }
    const proposal = proposePhotoEvents(photos, evidence);
    proposal.timings = timings;
    proposal.durationMs = Date.now()-startedAt;
    proposal.failedPhotoKeys = evidence.filter(item => item.status !== "complete").map(item => item.photoKey);
    return proposal;
}
