import {EventDescription} from "../src/components/EventManager";
import softwareRenderer from "../src/services/SoftwareJpegRenderer";
import decodeJpegPreview from "jpeg-js/lib/decoder";
import {GeminiPhotoEventProvider, onlineRequestFailure, onlinePhotoPreview} from "../src/services/GeminiPhotoEventProvider";
import {LocalPhotoEventProvider} from "../src/services/LocalPhotoEventProvider";
import {proposePhotoEvents, applyPhotoEventProposals, analyzePhotoEvents} from "../src/services/PhotoAutoEvents";
import assert from "assert";
import { bindLibraryScrollbarVisibility } from "../src/components/LibraryScrollbars";
import { suspendLibraryReviewScrollbars, libraryScrollSize, focusWithoutMovingLibrary } from "../src/components/PopupScrollbars";
import { thumbnailZoomState, thumbnailZoomValue } from "../src/components/ThumbnailZoom";
import { contextReviewState, eventFlyoutPosition, ContextMenuRow } from "../src/components/PhotoContextMenu";
import { checkLibraryDrag } from "./library-drag.test";
import { libraryLoadProgress, blockLibraryDuringLoad } from "../src/components/LibraryLoadGate";
import fs from "fs";
import path from "path";
import React from "react";
import useReviewRendering from "../src/components/useReviewRendering";
import { eventWorkspace, editEvent } from "../src/services/EventWorkspace";
import ThumbnailService from "../src/services/ThumbnailService";
import SoftwareJpegRenderer from "../src/services/SoftwareJpegRenderer";
import { reviewPointer, reviewZoomStep } from "../src/components/PhotoPreviewModel";
import SidebarButton from "../src/components/SidebarButton";
import { renderToStaticMarkup } from "react-dom/server";

import PhotoWorkspaceService from "../src/services/PhotoWorkspaceService";
import SelectionEngine from "../src/core/SelectionEngine";
import PhotoLibraryHistory, {
    PhotoLibraryHistoryKind
} from "../src/services/PhotoLibraryHistory";
import {
    clearPhotoBrowserFilters,
    visibleLibraryFocus,
    createPhotoDecisionLookup,
    normalizePhotoBrowserPreferences,
    normalizePhotoDecisions,
    normalizePhotoEventChapters,
    photoDecisionKey,
    normalizePhotoStoryOrder,
    queryPhotoBrowser,
    updatePhotoDecision
} from "../src/services/PhotoBrowserModel";
import {
    applyBurstReview,
    CullingFilterMode,
    CullingStatus,
    filterPhotosByCulling,
    normalizePhotoBurstReviews,
    summarizeCulling
} from "../src/services/PhotoCullingService";
import {
    createPhotoGroupingRevision,
    createCameraIdentityLookup,
    groupPhotosByBurst
} from "../src/services/PhotoGroupingEngine";
import {
    buildPhotoBrowserGroups,
    calculateGroupedPhotoBrowserWindow
} from "../src/components/ThumbnailGrid";
import { libraryToolbarLayout, libraryMenuPosition, libraryToolbarIcon, ToolbarIcon } from "../src/components/LibraryToolbar";
import { photoReviewKey, blocksPhotoReviewKeys, focusPhotoReviewViewport, photoNavigationEntry, bindPhotoReviewKeys, bindPhotoReviewPointerFocus } from "../src/components/PhotoReviewKeyboard";
import { previewPanelSize, previewSessionPhotos, previewGeometry, previewResolution, clampPreviewPan, dragPreviewScale, previewImagePlacement, previewFilmstripWindow, previewClickScale, zoomPreviewAt, createPreviewWheel, createPreviewGate } from "../src/components/PhotoPreviewModel";
import { getThumbnailCacheKey } from "../src/services/ThumbnailService";

let assertions = 0;
{
    const photo={id:"collage-test",file:{nativePath:"/collage.jpg"}};
    const tagged=updatePhotoDecision({},photo,{collage:true});
    assert.equal(createPhotoDecisionLookup(tagged)(photo).collage,true);
    const rated=updatePhotoDecision(tagged,photo,{rating:4});
    assert.equal(createPhotoDecisionLookup(rated)(photo).collage,true);
    const restored=normalizePhotoDecisions(JSON.parse(JSON.stringify(rated)));
    assert.equal(createPhotoDecisionLookup(restored)(photo).collage,true);
    const cleared=updatePhotoDecision(restored,photo,{collage:false});
    assert.equal(createPhotoDecisionLookup(cleared)(photo).rating,4);
    assert.ok(!createPhotoDecisionLookup(cleared)(photo).collage);
    assert.equal(updatePhotoDecision(tagged,photo,{collage:false}).items.length,0);
    assert.equal(updatePhotoDecision({},photo,{collage:"true"}).items.length,0);
    const html=renderToStaticMarkup(<EventDescription text={"Visible portrait scene. ".repeat(20)}/>);
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(html.includes('More'));
    assert.ok(!html.includes("Visible portrait scene. ".repeat(20)));
    assertions++;
}

{
    const photo = (id,time) => ({id:String(id),file:{nativePath:`/context/${id}.jpg`},metadata:{dateTaken:1700000000000+time*60000}});
    const run = (gap,relation,context) => {
        const photos=[photo(1,0),photo(2,gap)];
        return proposePhotoEvents(photos,photos.map((p,i)=>({photoKey:photoDecisionKey(p),status:"complete",category:i ? "Couple Portraits" : "Individual Portraits",scoreKind:"model-scene-context",requiresReview:false,contextRelation:i ? relation : "uncertain",previousPhotoKey:i ? photoDecisionKey(photos[0]) : null,context:i ? context : null})));
    };
    const cues={setting:"same",attire:"same",activity:"same",flow:"same"};
    assert.equal(run(0,"same",cues).groups.length,1);
    assert.ok(run(0,"same",cues).groups[0].requiresReview);
    assert.equal(run(1,"uncertain",cues).groups.length,1);
    assert.ok(run(1,"uncertain",cues).groups[0].requiresReview);
    assert.equal(run(1,"different",cues).groups.length,2);
    assert.equal(run(1,"uncertain",{attire:"same"}).groups.length,2);
    assert.equal(run(1,"same",{...cues,setting:"different"}).groups.length,2);
    assert.equal(run(60,"same",cues).groups.length,1);
    assert.ok(run(60,"same",cues).groups[0].requiresReview);
    assert.equal(run(180,"same",cues).groups.length,2);
    assertions++;
}


{
    const photos = [1,2].map(id => ({id:String(id),file:{nativePath:`/description/${id}.jpg`},metadata:{dateTaken:1700000000000+id*1000}}));
    const keys = photos.map(photoDecisionKey);
    const proposal = proposePhotoEvents(photos, photos.map((photo,index) => ({photoKey:keys[index],status:"complete",scoreKind:"model-scene-context",category:"Couple Portraits",requiresReview:false,contextRelation:index ? "same" : "uncertain",previousPhotoKey:index ? keys[0] : null,description:"Couple portraits in a garden."})));
    assert.equal(proposal.groups.length,1);
    assert.equal(proposal.groups[0].description,"Couple portraits in a garden.");
    const applied = applyPhotoEventProposals({items:[]},photos,proposal,[proposal.groups[0].id]);
    const restored = normalizePhotoEventChapters(JSON.parse(JSON.stringify(applied)),photos);
    assert.equal(restored.items[0].description,proposal.groups[0].description);
    assert.equal(editEvent(restored,"rename",restored.items[0].chapterId,[],"Garden portraits").items[0].description,proposal.groups[0].description);
    assert.ok(!normalizePhotoEventChapters({items:[{...restored.items[0],description:{bad:true}}]}).items[0].description);
    assertions++;
}


{
    const photos = [1,2,3,4].map(id => ({id:String(id), name:`scene-${id}.jpg`, metadata:{dateTaken:1700000000000+id*60000}, file:{nativePath:`/photos/scene-${id}.jpg`}}));
    const keys = photos.map(photoDecisionKey);
    const scene = (index, embedding, label = "Ceremony", confidence = .95) => ({photoKey:keys[index], embedding, label, confidence, status:"complete"});
    const proposal = proposePhotoEvents(photos, [scene(0, [1,0]), scene(1, [.99,.01]), scene(2, [0,1], "Portraits"), scene(3, [1,0], "Ceremony", .4)]);
    assert.equal(proposal.groups.length, 2);
    assert.deepStrictEqual(proposal.groups[0].photoKeys, keys.slice(0,2));
    assert.deepStrictEqual(proposal.reviewPhotoKeys, [keys[3]]);
    const current = {items:[{chapterId:"chapter-1",name:"My existing event",photoKeys:keys,originKeys:keys}]};
    const applied = applyPhotoEventProposals(current, photos, proposal, [proposal.groups[0].id]);
    assert.equal(applied.items[0].name, "My existing event");
    assert.deepStrictEqual(applied.items[0].photoKeys, keys.slice(2));
    assert.deepStrictEqual(applied.items[0].originKeys, keys);
    assert.deepStrictEqual(current.items[0].photoKeys, keys);
    assert.throws(() => applyPhotoEventProposals(current, photos.slice(1), proposal, []), /changed/);
    assert.throws(() => applyPhotoEventProposals(current, photos, proposal, ["missing"]), /Unknown/);
    assert.deepStrictEqual(proposePhotoEvents(photos, []).reviewPhotoKeys, keys);
    assert.throws(() => proposePhotoEvents(photos, [scene(0,[1,0]),scene(0,[1,0])]), /match/);
    assert.equal(proposePhotoEvents(photos, [scene(0,[NaN,0])]).groups.length, 0);
    assertions++;
}

{
    const make = (id, minutes) => ({id:String(id), name:`event-${id}.jpg`, file:{nativePath:`/events/${id}.jpg`},
        metadata:{dateTaken:minutes === null ? null : 1700000000000+minutes*60000}});
    const evidence = (photo, category, embedding=[1,0]) => ({photoKey:photoDecisionKey(photo), status:"complete", category, embedding, confidence:.95});
    const photos = [make(1,0),make(2,1),make(3,90),make(4,91)];
    const results = photos.map(photo => evidence(photo,"Family & Guests"));
    const separate = proposePhotoEvents([...photos].reverse(), [...results].reverse());
    assert.deepStrictEqual(separate.groups.map(g => g.photoKeys), [photos.slice(0,2).map(photoDecisionKey),photos.slice(2).map(photoDecisionKey)]);
    assert.equal(separate.groups[0].label,"1. Family & Guests");
    assert.equal(separate.groups[1].label,"2. Family & Guests");
    assert.equal(separate.groups[0].categories["Family & Guests"],2);
    const mixed = proposePhotoEvents(photos.slice(0,2), [evidence(photos[0],"Ceremony"),evidence(photos[1],"Family & Guests")]);
    assert.equal(mixed.groups.length,1);
    assert.equal(Object.keys(mixed.groups[0].categories).length,2);
    const changed = proposePhotoEvents(photos.slice(0,2), [evidence(photos[0],"Ceremony"),evidence(photos[1],"Ceremony",[0,1])]);
    assert.equal(changed.groups.length,2);
    assert.ok(changed.groups.every(g => g.requiresReview));
    const unknown = make(5,null);
    const incomplete = proposePhotoEvents([photos[0],unknown], [evidence(photos[0],"Ceremony"),evidence(unknown,"Ceremony")]);
    assert.deepStrictEqual(incomplete.reviewPhotoKeys,[photoDecisionKey(unknown)]);
    assert.ok(incomplete.groups[0].requiresReview);
    const gap = proposePhotoEvents(photos,[results[0],results[2],results[3]]);
    assert.ok(gap.groups.every(g => g.requiresReview));
    const tied = make(6,0);
    assert.ok(proposePhotoEvents([photos[0],tied],[results[0],evidence(tied,"Ceremony")]).groups.every(g => g.requiresReview));
    const changedTimes = photos.map(p => ({...p,metadata:{...p.metadata,dateTaken:p.metadata.dateTaken+1}}));
    assert.throws(() => applyPhotoEventProposals({items:[]},changedTimes,separate,[]),/capture times changed/);
    assertions++;
}

{
    const node = {style: {overflowX:"hidden", overflowY:"auto", paddingRight:"2px", paddingBottom:"0px"}, scrollTop:640, scrollLeft:12};
    Object.defineProperty(node, "clientWidth", {get:() => node.style.overflowY === "hidden" ? 512 : 500});
    Object.defineProperty(node, "clientHeight", {get:() => 400});
    const restore = suspendLibraryReviewScrollbars({querySelectorAll:() => [node]});
    assert.equal(node.style.overflowY, "hidden");
    assert.equal(node.style.paddingRight, "14px");
    assert.equal(libraryScrollSize(node, "clientWidth"), 500);
    for (let i = 0; i < 5; i++) {
        focusWithoutMovingLibrary({focus:() => {node.scrollTop = 0;}}, {querySelectorAll:() => [node]});
        assert.equal(node.style.overflowY, "hidden");
        assert.equal(node.scrollTop, 640);
    }
    restore();
    assert.equal(node.style.overflowY, "auto");
    assert.equal(node.style.paddingRight, "2px");
    assert.equal(node.scrollTop, 640);
    assert.equal(node.scrollLeft, 12);
    node.scrollTop = 700; restore();
    assert.equal(node.scrollTop, 700);
    assertions++;
}

{
    const before = normalizePhotoBrowserPreferences({thumbnailSize: 208,
        sort: {field: "taken", direction: "desc"}, search: "portrait",
        favoritesOnly: true, types: ["jpg"], orientations: ["portrait"],
        ratingFilter: {mode: "atLeast", value: 4}, duplicatesOnly: true, datePreset: "today"});
    const after = clearPhotoBrowserFilters(before);
    assert.strictEqual(after.thumbnailSize, before.thumbnailSize);
    assert.deepStrictEqual(after.sort, before.sort);
    assert.strictEqual(after.search, "");
    assert.strictEqual(after.favoritesOnly, false);
    assert.strictEqual(after.duplicatesOnly, false);
    assert.deepStrictEqual(after.types, []);
    assert.deepStrictEqual(after.orientations, []);
    assert.strictEqual(after.ratingFilter.mode, "any");
    assert.strictEqual(before.search, "portrait");
    const selected = new Set(["b"]);
    assert.strictEqual(visibleLibraryFocus([{id:"a"},{id:"b"}], "a", selected), "a");
    assert.strictEqual(visibleLibraryFocus([], "b", selected), null);
    assert.strictEqual(visibleLibraryFocus([{id:"b"}], null, selected), "b");
    assert.strictEqual(visibleLibraryFocus([{id:"a"}], "b", selected), null);
    assertions++;
}

{
    assert.strictEqual(reviewZoomStep(1, 0.25), 1.25);
    assert.strictEqual(reviewZoomStep(1.25, -0.25), 1);
    assert.strictEqual(reviewZoomStep(4, 0.12), 4);
    assert.strictEqual(reviewZoomStep(0.25, -0.12), 0.25);
    const rect = { left: 120, top: 80, width: 800, height: 600 };
    assert.deepStrictEqual(reviewPointer({ clientX: 620, clientY: 230 }, rect), { x: 100, y: -150 });
    assert.deepStrictEqual(reviewPointer({}, rect), { x: 0, y: 0 });
    for (const name of ["PhotoReviewPreview.jsx", "PhotoBrowserSection.jsx"]) {
        const source = fs.readFileSync(path.join(process.cwd(), "src/components", name), "utf8");
        assert.ok(source.includes("reviewZoomStep("), name);
        assert.ok(source.includes("reviewPointer(event,"), name);
    }
}

// Missing/tied scores must not be presented as an AI winner.
{
    const photos = [0, 1, 2].map(index => ({ id: String(index), dateTaken: 1000 + index * 100 }));
    assert.strictEqual(groupPhotosByBurst(photos)[0].hasQualityEvidence, false);
    photos[1].aiAnalysis = { aggregate: { rankScore: 0.9 } };
    assert.strictEqual(groupPhotosByBurst(photos)[0].bestPhotoId, "1");
    assert.strictEqual(groupPhotosByBurst(photos)[0].hasQualityEvidence, false);
    photos[0].rating = 5;
    photos[0].aiAnalysis = { aggregate: { rankScore: 0.2 } };
    photos[2].aiAnalysis = { aggregate: { rankScore: 0.3 } };
    assert.strictEqual(groupPhotosByBurst(photos)[0].bestPhotoId, "1");
    assert.strictEqual(groupPhotosByBurst(photos)[0].hasQualityEvidence, true);
    photos[2].aiAnalysis = { aggregate: { rankScore: 0.9 } };
    assert.strictEqual(groupPhotosByBurst(photos)[0].hasQualityEvidence, false);
}

// Layout-capable sidebar controls retain native button activation semantics.
{
    let activated = 0;
    const onDrop = () => {};
    const control = SidebarButton({ children: "Favorites", onClick: () => activated++, onDrop });
    assert.strictEqual(control.props.role, "button");
    assert.strictEqual(control.props.onDrop, onDrop);
    control.props.onClick({});
    for (const key of ["Enter", " "]) {
        let prevented = false;
        let stopped = false;
        control.props.onKeyDown({ key, preventDefault: () => prevented = true, stopPropagation: () => stopped = true });
        assert.ok(prevented && stopped);
    }
    control.props.onKeyDown({ key: "ArrowDown" });
    control.props.onKeyDown({ key: " ", repeat: true, preventDefault() {}, stopPropagation() {} });
    assert.strictEqual(activated, 3);
    const disabled = SidebarButton({ disabled: true, onClick: () => activated++ });
    disabled.props.onClick({});
    disabled.props.onKeyDown({ key: "Enter", preventDefault() {}, stopPropagation() {} });
    assert.strictEqual(disabled.props.tabIndex, -1);
    assert.strictEqual(activated, 3);
}

// Test the same key normalization/focus boundary used by the live document handler.
function checkReviewKeyboard() {
    for (const [input, expected] of [["Left", "ArrowLeft"], ["Right", "ArrowRight"], ["Up", "ArrowUp"], ["Down", "ArrowDown"], ["Space", " "], ["Spacebar", " "], ["Esc", "Escape"], ["ArrowLeft", "ArrowLeft"], ["F", "F"]]) {
        assert.equal(photoReviewKey({ key: input }), expected);
    }
    for (let rating = 0; rating <= 5; rating++) {
        assert.equal(photoReviewKey({ key: String(rating) }), String(rating));
        assert.equal(photoReviewKey({ key: "Unidentified", code: `Numpad${rating}` }), String(rating));
        assert.equal(photoReviewKey({ code: `Digit${rating}` }), String(rating));
    }
    assert.equal(photoReviewKey({ code: "KeyR" }), "r");
    assert.equal(photoReviewKey({ key: "Unidentified", keyCode: 32 }), " ");
    assert.equal(photoReviewKey({ keyCode: 27 }), "Escape");
    const receivers = new Map();
    const roots = [0, 1].map(id => ({
        addEventListener(type, listener, capture) { assert.equal(type, "keydown"); assert(capture); receivers.set(id, listener); },
        removeEventListener(type, listener, capture) { assert.equal(receivers.get(id), listener); assert(capture); receivers.delete(id); }
    }));
    let received = 0;
    const unbind = bindPhotoReviewKeys(() => received++, roots);
    for (const key of [" ", "Escape", " "]) {
        const event = { key, defaultPrevented: true };
        receivers.get(0)(event); receivers.get(1)(event);
    }
    assert.equal(received, 3, "one press must not be processed twice by the two roots");
    unbind();
    assert.equal(receivers.size, 0);
    assert.equal(blocksPhotoReviewKeys({ closest: () => ({}) }), true);
    assert.equal(blocksPhotoReviewKeys({ closest: () => null }), false);
    assert(blocksPhotoReviewKeys({closest: selector => selector.includes('[role="slider"]') ? {} : null}), "zoom arrows must not navigate photos");
    let focused = false;
    focusPhotoReviewViewport({ focus: () => { focused = true; } });
    assert.equal(focused, true);
    focusPhotoReviewViewport(null);
}

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-137 Slice 1: ${name}`);
}

function fixture({
    photos = [
        {
            id: "/photos/one.jpg",
            name: "one.jpg",
            file: { nativePath: "/photos/one.jpg" }
        },
        {
            id: "/photos/two.jpg",
            name: "two.jpg",
            file: { nativePath: "/photos/two.jpg" }
        },
        {
            id: "/photos/three.jpg",
            name: "three.jpg",
            file: { nativePath: "/photos/three.jpg" }
        }
    ]
} = {}) {
    let failSave = false;
    const initialStoryOrder = normalizePhotoStoryOrder({}, photos);
    let metadata = {
        id: "project-one",
        name: "Project One",
        schemaVersion: 1,
        photoCount: photos.length,
        photoDecisions: {},
        photoDuplicateEvidence: {},
        photoStoryOrder: initialStoryOrder,
        photoEventChapters: normalizePhotoEventChapters({}, photos)
    };
    const workspace = {
        cache: {
            metadata: {
                createFile: async () => ({
                    write: async () => {
                        return;
                    }
                })
            }
        }
    };
    const saved = [];
    const projectEngine = {
        isOpen: () => true,
        getProject: () => ({ metadata, workspace }),
        updateMetadata(values) {
            metadata = { ...metadata, ...values };
        }
    };
    const projectService = {
        saveProject: async (values, options) => {
            saved.push({ values, options });
            metadata = { ...metadata, ...values };
            if (failSave) {
                throw new Error("Injected save failure.");
            }
        }
    };
    const service = new PhotoWorkspaceService({
        library: {
            getPhotos: () => photos,
            load() {},
            get length() {
                return photos.length;
            }
        },
        selection: { clear: () => {} },
        projectEngine,
        projectService,
        localFileSystem: {},
        importFolder: async () => null,
        thumbnailService: { clear: async () => {} },
        thumbnailQueue: { clear: () => {} },
        refreshService: { refresh: () => {} },
        performance: {
            trace: () => {},
            timestamp: () => Date.now(),
            beginFolderLoad: () => {},
            markPickerComplete: () => {}
        }
    });
    return {
        service,
        photos,
        metadata: () => metadata,
        initialStoryOrder,
        saved,
        fail: value => { failSave = value; }
    };
}

async function run() {
    await test("online Events requires consent, sends only previews and respects context links", async () => {
        const photos=[1,2].map(id=>({id:String(id),name:`private-${id}.jpg`,file:{nativePath:`/private/${id}.jpg`},metadata:{dateTaken:1700000000000+id*1000}}));
        const calls=[];
        const online=new GeminiPhotoEventProvider({vault:{getItem:async()=>new Uint8Array([107,101,121])},
            preview:async()=>({mimeType:"image/png",data:"preview-only"}),request:async(url,options)=>{
                calls.push({url,options});return {ok:true,json:async()=>({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify({category:calls.length===1?"Ceremony":"Family & Guests",boundary:calls.length===1?"uncertain":"same",needsReview:false})}]}}]})};}});
        await assert.rejects(online.session(photos,false),/Approve/);
        assert.equal(calls.length,0);
        const session=await online.session(photos,true);
        const result=await analyzePhotoEvents([...photos].reverse(),session);
        assert.equal(result.groups.length,1);
        assert.equal(Object.keys(result.groups[0].categories).length,2);
        const bodies=calls.map(c=>JSON.parse(c.options.body));
        assert.equal(bodies[0].contents[0].parts.length,2);
        assert.equal(bodies[1].contents[0].parts.length,3);
        assert.ok(!JSON.stringify(bodies).includes("private-"));
        assert.ok(!JSON.stringify(bodies).includes("nativePath"));
        assert.equal(calls[0].options.redirect,"error");
        await assert.rejects(session.analyzeScene(photos[0]),/session changed/);
        assert.equal(calls.length,2);
        const cancelled=await online.session(photos,true,()=>false);
        await assert.rejects(cancelled.analyzeScene(photos[0]),/cancelled/);
        assert.equal(calls.length,2);
    });
    await test("online previews are compact JPEGs and preparation overlaps network waiting",async()=>{
        const render=softwareRenderer.render;
        softwareRenderer.render=async()=>({width:32,height:32,data:new Uint8Array(32*32*4).fill(128)});
        try {
            const encoded=await onlinePhotoPreview({name:"test.jpg",file:{read:async()=>new ArrayBuffer(0)}},()=>{});
            assert.equal(encoded.mimeType,"image/jpeg");
            const bytes=Buffer.from(encoded.data,"base64");
            assert.ok(bytes.length<32*32*4);
            assert.equal(decodeJpegPreview(bytes).width,32);
            assert.equal(bytes.indexOf(Buffer.from([255,225])),-1); // no EXIF APP1
        } finally {softwareRenderer.render=render;}
        const photos=[1,2,3].map(id=>({id:String(id),name:`p${id}.jpg`,file:{nativePath:`/${id}.jpg`},metadata:{dateTaken:1700000000000+id*1000}}));
        const prepared=[];let release,requests=0;
        const online=new GeminiPhotoEventProvider({vault:{getItem:async()=>new Uint8Array([107])},preview:async photo=>{prepared.push(photo.id);return {mimeType:"image/jpeg",data:"small"};},request:()=>{requests++;return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify({category:"Ceremony",boundary:"uncertain",needsReview:false})}]}}]})});});}});
        const session=await online.session(photos,true);
        const stages=[];const first=session.analyzeScene(photos[0],value=>stages.push(value));
        for(let i=0;i<12;i++)await Promise.resolve();
        assert.deepStrictEqual(prepared,["1","2"]);
        assert.equal(requests,1);
        assert.ok(stages.includes("Waiting for review"));
        release();await first;
    });
    await test("online connection test sends no images and reports secret-safe failure stages",async()=>{
        let sent;
        const online=new GeminiPhotoEventProvider({vault:{getItem:async()=>new Uint8Array([107,101,121])},request:async(_,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({})};}});
        assert.match(await online.checkConnection(),/No photos/);
        assert.deepStrictEqual(sent.contents,[{parts:[{text:"Reply OK."}]}]);
        assert.match(onlineRequestFailure(new Error("permission denied key-secret"),"request").message,/NETWORK_PERMISSION/);
        assert.ok(!onlineRequestFailure(new Error("permission denied key-secret"),"request").message.includes("key-secret"));
        assert.match(onlineRequestFailure(new SyntaxError("key-secret"),"classification").message,/CLASSIFICATION_JSON/);
        assert.match(onlineRequestFailure(new SyntaxError("key-secret"),"response").message,/RESPONSE_JSON/);
    });
    await test("online Events stops on service errors without exposing secrets", async () => {
        const photo={id:"one",name:"one.jpg",file:{nativePath:"/one.jpg"}};
        let attempts=0;
        const online=new GeminiPhotoEventProvider({vault:{getItem:async()=>new Uint8Array([107,101,121])},preview:async()=>({mimeType:"image/png",data:"preview"}),
            request:async()=>{attempts++;throw new Error("secret network response");}});
        const session=await online.session([photo],true);
        await assert.rejects(session.analyzeScene(photo),error=>error.fatal && !error.message.includes("secret"));
        await assert.rejects(session.analyzeScene(photo),/session changed/);
        assert.equal(attempts,1);
    });
    await test("local Auto Events stages one photo, publishes atomically and cleans up", async () => {
        const removed = [], files = new Map();
        const folder = {
            createFile: async name => {
                const entry = {name, nativePath:`/bridge/${name}`, write:async text => {entry.text = text;},
                    moveTo:async (_, options) => {assert.ok(entry.text); entry.name = options.newName;},
                    delete:async () => removed.push(entry.name)};
                files.set(name,entry); return entry;
            },
            getEntry:async name => ({read:async () => JSON.stringify(name === "ready.json"
                ? {protocol:"albumai-local-events-v1",updatedAt:Date.now()}
                : {status:"complete",embedding:[1,0],label:"Ceremony",confidence:.95}), delete:async () => removed.push(name)})
        };
        const local = new LocalPhotoEventProvider({}); local.folder = folder;
        let copied = false;
        const result = await local.analyzeScene({name:"photo.jpg",file:{copyTo:async (_, options) => {
            copied = true; const image = {nativePath:"/bridge/photo.jpg", moveTo:async (_, moved) => {image.nativePath = `/bridge/${moved.newName}`;},delete:async () => removed.push(image.nativePath.split("/").pop())}; return image;
        }}});
        assert.equal(result.status,"complete"); assert.equal(copied,true);
        assert.ok(removed.some(name => name.startsWith("image-")));
        assert.ok(removed.some(name => name.startsWith("request-")));
        assert.ok(removed.some(name => name.startsWith("response-")));
        assert.ok([...files.keys()].every(name => name.startsWith("pending-")));
    });
    await test("Auto Events requires real scene analysis and discards cancelled work", async () => {
        const photos = [1,2].map(id => ({id:String(id), name:`auto-${id}.jpg`}));
        await assert.rejects(analyzePhotoEvents(photos, null), /Set up/);
        let active = true, calls = 0;
        await assert.rejects(analyzePhotoEvents(photos, {analyzeScene:async () => {
            calls++; active = false; return {status:"complete", embedding:[1,0], label:"Ceremony", confidence:.95};
        }}, {isCurrent:() => active}), /cancelled/);
        assert.equal(calls, 1);
        const progress = [];
        const result = await analyzePhotoEvents(photos, {analyzeScene:async () => {throw new Error("decode failure");}}, {onProgress:value => progress.push(value.completed)});
        assert.equal(result.groups.length, 0);
        assert.equal(result.reviewPhotoKeys.length, 2);
        assert.deepStrictEqual(progress, [0,1,1,2]);
        assert.equal(result.timings.length,2);
        assert.ok(result.timings.every(item => Number.isFinite(item.durationMs) && item.durationMs >= 0));
        assert.ok(result.durationMs >= result.timings.reduce((sum,item) => sum+item.durationMs,0));
    });
    await test("moves wedding event photos exclusively and restores original memberships on delete", async () => {
        const photos = [1,2,3,4].map(id => ({id: String(id), name: `${id}.jpg`}));
        const groups = [{label:"Morning",photoIds:["1","2"]},{label:"Evening",photoIds:["3"]}];
        let value = eventWorkspace({}, photos, groups);
        const original = value.items.map(item => ({...item}));
        const reordered = editEvent(value, "after", original[0].chapterId, [], original[2].chapterId);
        assert.deepEqual(reordered.items.map(item => item.chapterId), [original[1].chapterId, original[2].chapterId, original[0].chapterId]);
        assert.deepEqual(editEvent(reordered, "before", original[0].chapterId, [], original[1].chapterId), value);
        assert.deepEqual(editEvent(value, "after", original[0].chapterId, [], original[0].chapterId), value);
        const keys = [photoDecisionKey(photos[0]), photoDecisionKey(photos[2])];
        value = editEvent(value, "new", "", keys, "Portraits");
        const manual = value.items.find(item => item.name === "Portraits").chapterId;
        assert.equal(value.items.flatMap(item => item.photoKeys).length, 4);
        assert.equal(value.items.find(item => item.name === "Evening").photoKeys.length, 0);
        value = normalizePhotoEventChapters(JSON.parse(JSON.stringify(value)), photos);
        value = editEvent(value, "rename", manual, [], "Couple");
        value = editEvent(value, "delete", manual);
        assert.deepEqual(value.items.map(item => ({...item, photoKeys: [...item.photoKeys].sort()})),
            original.map(item => ({...item, photoKeys: [...item.photoKeys].sort()})));
        value = editEvent(value, "merge", original[0].chapterId, [], original[1].chapterId);
        assert.equal(value.items.find(item => item.name === "Evening").photoKeys.length, 3);
        value = editEvent(value, "restore", "", [photoDecisionKey(photos[0])]);
        assert.equal(value.items.find(item => item.name === "Morning").photoKeys.length, 1);
        value = editEvent(value, "delete", original[1].chapterId);
        assert.equal(new Set(value.items.flatMap(item => item.photoKeys)).size, 4, "deleting automatic event never loses photos");
        assert.deepEqual(eventWorkspace(value, photos, groups), value, "reload preserves manual organization");
    });
    await test("preserves decoded image nodes during quality swaps and restores Burst focus", async () => {
        const image = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoImage.jsx"), "utf8");
        assert.match(image, /key=\{source\}/);
        assert.match(image, /src=\{source\}/);
        assert.doesNotMatch(image, /key=\{`\$\{cacheKey\}:pending/);
        const burst = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"), "utf8");
        assert.match(burst, /const release = bindPhotoReviewPointerFocus\(dialog\)/);
        assert.match(burst, /role="dialog" tabIndex=\{-1\}/);
        assert.match(burst, /if \(isEditable && !activeBurstGroup\) return/);
        assert.match(burst, /focusWithoutMovingLibrary\(dialog\)/);
        assert.doesNotMatch(burst, /sidebar.scrollTop = top/);
        const preview = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoReviewPreview.jsx"), "utf8");
        assert.match(preview, /reviewZoomStep\(next, 0\)/);
        assert.match(preview, /Number\(scale.toFixed\(2\)\)/);
    });
    await test("shares debounced quality upgrades and releases review resources on close", async () => {
        const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
        const saved = dispatcher.current, timers = new Map(), slots = [], effects = [];
        const oldSet = global.setTimeout, oldClear = global.clearTimeout, oldWindow = global.window;
        const originals = [SoftwareJpegRenderer.retainPreviewDecoded, ThumbnailService.holdBackgroundRefinements,
            ThumbnailService.clearReviewPreviews, ThumbnailService.cancelReviewRequests];
        let cursor = 0, sequence = 0, retained = 0, held = 0, cleared = 0;
        const cancelled = [];
        const effect = (fn, deps) => {
            const index = cursor++, old = slots[index];
            if (!old || deps.some((value, i) => value !== old.deps[i])) {
                effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
            }
        };
        try {
            global.window = { devicePixelRatio: 2 };
            global.setTimeout = fn => { timers.set(++sequence, fn); return sequence; };
            global.clearTimeout = id => timers.delete(id);
            SoftwareJpegRenderer.retainPreviewDecoded = () => { retained++; return () => retained--; };
            ThumbnailService.holdBackgroundRefinements = () => { held++; return () => held--; };
            ThumbnailService.clearReviewPreviews = () => cleared++;
            ThumbnailService.cancelReviewRequests = photo => cancelled.push(photo.id);
            dispatcher.current = { useEffect: effect, useLayoutEffect: effect, useState(initial) {
                const index = cursor++;
                if (!(index in slots)) slots[index] = initial;
                return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
            } };
            const geometry = previewGeometry({ width: 6000, height: 4000 }, 900, 600);
            const render = (id, scale) => {
                cursor = 0;
                const profile = useReviewRendering(id ? { id } : null, geometry, scale);
                effects.splice(0).forEach(fn => fn());
                return profile;
            };
            const flush = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); };
            assert.equal(render("a", 1), "review-1536");
            render("a", 2); render("a", 3);
            assert.equal(timers.size, 1, "rapid zoom replaces the pending refinement");
            flush();
            assert.equal(render("a", 3), "review-5400");
            render("a", 1); flush();
            assert.equal(render("a", 1), "review-5400", "zoom-out keeps the sharp raster");
            assert.equal(render("b", 1), "review-1536", "new photo starts at HD");
            assert.deepEqual(cancelled, ["a", "b"]);
            assert.equal(retained, 1); assert.equal(held, 1);
            render(null, 1);
            assert.equal(timers.size, 0); assert.equal(retained, 0); assert.equal(held, 0); assert.equal(cleared, 1);
        } finally {
            dispatcher.current = saved;
            global.setTimeout = oldSet; global.clearTimeout = oldClear; global.window = oldWindow;
            [SoftwareJpegRenderer.retainPreviewDecoded, ThumbnailService.holdBackgroundRefinements,
                ThumbnailService.clearReviewPreviews, ThumbnailService.cancelReviewRequests] = originals;
        }
    });
    await test("restores preview keys after native zoom, control clicks and filmstrip drags", async () => {
        const listeners = new Map();
        let focused = null;
        const target = id => ({
            addEventListener(name, handler, capture) { assert(capture); listeners.set(`${id}:${name}`, handler); },
            removeEventListener(name, handler) { assert.equal(listeners.get(`${id}:${name}`), handler); listeners.delete(`${id}:${name}`); },
            focus() { focused = id; }
        });
        const dialog = target("dialog"), root = target("document");
        const release = bindPhotoReviewPointerFocus(dialog, root);
        const settle = () => new Promise(resolve => setTimeout(resolve, 10));
        for (const action of ["mousedown", "click", "wheel"]) {
            listeners.get(`dialog:${action}`)();
            assert.equal(focused, "dialog", "keys stay available during interaction");
            focused = null; // UXP default focus loss / React native-control replacement.
            await settle();
            assert.equal(focused, "dialog", `${action} must restore focus after host defaults`);
        }
        listeners.get("document:mouseup")(); // Drag released outside the image/dialog.
        focused = null;
        await settle();
        assert.equal(focused, "dialog");
        focused = "another panel";
        listeners.get("document:mouseup")(); // No preview drag: leave other focus alone.
        await settle();
        assert.equal(focused, "another panel");
        listeners.get("dialog:click")();
        release();
        focused = "library";
        await settle();
        assert.equal(focused, "library", "closed preview must not reclaim focus");
        assert.equal(listeners.size, 0);
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoReviewPreview.jsx"), "utf8");
        assert.match(source, /bindPhotoReviewPointerFocus\(dialog\)/);
        assert.match(source, /releasePointerFocus\(\)/);
    });

    await test("keeps source-folder actions visible above the scrollable Library workspace", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        const styleSource = fs.readFileSync(
            path.join(process.cwd(), "src/styles.css"),
            "utf8"
        );
        assert.match(componentSource, /photo-library-source-actions/);
        assert.match(componentSource, />\s*Change Folder\s*</);
        assert.match(
            styleSource,
            /\.photo-library-source-actions\s*\{[\s\S]*?display:\s*flex;/
        );
    });

    await test("keeps the production Library focused, three-panel and free of duplicate diagnostics", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        const openFolderSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/OpenFolder.jsx"),
            "utf8"
        );
        const thumbnailCardSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/ThumbnailCard.jsx"),
            "utf8"
        );
        const styleSource = fs.readFileSync(
            path.join(process.cwd(), "src/styles.css"),
            "utf8"
        );
        const toolbarSource = componentSource.slice(
            componentSource.indexOf('<LibraryToolbar'),
            componentSource.indexOf('<div className={`photo-browser-content')
        );
        const libraryOwner = openFolderSource.slice(
            openFolderSource.indexOf('activeWorkspaceMode === "LIBRARY"'),
            openFolderSource.indexOf('activeWorkspaceMode === "DESIGNER"')
        );

        assert.match(openFolderSource, /PRODUCT_WORKFLOW_STEPS/);
        assert.match(openFolderSource, /library-workspace-container--production/);
        assert.doesNotMatch(libraryOwner, /<PreviewPanel/);
        assert.match(componentSource, /photo-workflow-tabs/);
        assert.match(componentSource, /const PHOTO_GROUP_OPTIONS/);
        assert.match(componentSource, /id: "photo-browser-sort"/);
        assert.match(componentSource, /id: "photo-browser-group"/);
        assert.match(componentSource, /photo-library-sidebar[\s\S]*photo-browser-content[\s\S]*photo-library-inspector/);
        assert.match(componentSource, /photo-inspector-actions/);
        assert.match(
            styleSource,
            /\.library-workspace-container--production \.photo-library-workspace\s*\{[\s\S]*?display:\s*flex;[\s\S]*?overflow:\s*hidden;/
        );
        assert.match(
            styleSource,
            /\.library-workspace-container--production \.photo-library-sidebar\s*\{[\s\S]*?flex:\s*0 0 220px;[\s\S]*?max-width:\s*220px;/
        );
        assert.match(
            styleSource,
            /\.photo-library-center\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?width:\s*0;/
        );
        assert.match(
            styleSource,
            /\.library-workspace-container--production \.photo-library-source-actions\s*\{[\s\S]*?display:\s*flex;/
        );
        assert.match(
            styleSource,
            /\.library-workspace-container--production \.photo-culling-pills\s*\{[\s\S]*?display:\s*flex;/
        );
        assert.match(
            styleSource,
            /\.library-workspace-container--production \.photo-inspector-tabs,[\s\S]*?display:\s*flex;/
        );
        assert.match(
            styleSource,
            /\.library-workspace-container--production \.photo-library-reset-filters\s*\{[\s\S]*?position:\s*static;/
        );
        assert.doesNotMatch(toolbarSource, /Assign \$\{rating\}-star rating/);
        assert.doesNotMatch(toolbarSource, />\s*New Event\s*</);
        assert.match(styleSource, /ALB-138: Production Library stabilization/);
        assert.match(styleSource, /ALB-138\.3: UXP-stable split Sort\/Group controls/);
        assert.match(styleSource, /ALB-138\.4: non-native controls/);
        assert.match(thumbnailCardSource, /StarRatingIcon/);
        assert.match(thumbnailCardSource, /RejectDecisionIcon/);
        assert.match(thumbnailCardSource, /photo-thumbnail-camera-overlay/);
        assert.match(thumbnailCardSource, /photo-thumbnail-footer-stars/);
        assert.match(thumbnailCardSource, /photo-thumbnail-rejected-dim/);
        assert.doesNotMatch(thumbnailCardSource, /photo-thumbnail-hover-review/);
        assert.match(styleSource, /\.photo-thumbnail-card:hover\s*\{[\s\S]*?transform:\s*none;/);
    });

    await test("contains Burst Review controls inside the available plugin panel", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        const styleSource = fs.readFileSync(
            path.join(process.cwd(), "src/styles.css"),
            "utf8"
        );
        assert.match(
            styleSource,
            /\.photo-preview-dialog\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*0;/
        );
        assert.doesNotMatch(styleSource, /\.photo-preview-dialog\s*\{[\s\S]*?height:\s*calc\(100%/);
        assert.match(
            styleSource,
            /\.photo-burst-review \.photo-preview-stage\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?min-height:\s*0;/
        );
        assert.match(styleSource, /\.photo-preview-dialog\.photo-burst-review\s*\{[^}]*width:\s*92%;[^}]*height:\s*92%;/);
        assert.match(componentSource, /activeBurstGroup && activeBurstPhoto && createPortal\(/);
        assert.match(componentSource, /if \(!burstReviewGroupId\) return;[\s\S]*?document.body.classList.add\("review-open"\)/);
        assert.match(
            styleSource,
            /\.photo-burst-frame\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?appearance:\s*none;/
        );
        assert.match(
            styleSource,
            /\.photo-burst-frame \.photo-image-container\s*\{[\s\S]*?height:\s*64px\s*!important;/
        );
        assert.match(
            componentSource,
            /<div[\s\S]*?className=\{`photo-burst-frame[\s\S]*?role="option"[\s\S]*?<PhotoImage/
        );
        assert.match(componentSource, /photo-preview-zoom-controls/);
        assert.match(
            componentSource,
            /!activeBurstGroup[\s\S]*?previewScale <= 1/
        );
    });

    await test("freezes Library order for zero/single selection and restricts multi-selection preview", async () => {
        const photos = [{ id: "a" }, { id: "b" }, { id: "c" }];
        assert.deepStrictEqual(previewSessionPhotos(photos, new Set()), photos);
        assert.deepStrictEqual(previewSessionPhotos(photos, new Set(["b"])), photos);
        assert.deepStrictEqual(previewSessionPhotos(photos, new Set(["a", "c"])), [photos[0], photos[2]]);
        const snapshot = previewSessionPhotos(photos, new Set(["b"]));
        photos.reverse();
        assert.deepStrictEqual(snapshot.map(photo => photo.id), ["a", "b", "c"]);
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.match(
            componentSource,
            /previewSession\?\.photos \|\| previewCandidates/
        );
        assert.match(
            componentSource,
            /if \(!previewPhotos\.length\) return;[\s\S]*?previewSelectedSet\(\)/
        );
    });

    await test("fits portrait and landscape in one stage and requests HD before native-resolution zoom", async () => {
        const landscape = previewGeometry({ width: 6000, height: 4000 }, 800, 600);
        const portrait = previewGeometry({ width: 4000, height: 6000 }, 800, 600);
        assert.strictEqual(landscape.width, 800);
        assert.strictEqual(portrait.height, 600);
        assert.strictEqual(previewResolution(landscape, 1), 1536);
        assert.strictEqual(previewResolution(landscape, 4), 3200);
        assert.strictEqual(previewResolution(landscape, 1, 2), 3072);
        assert.strictEqual(previewResolution(landscape, landscape.maxScale), 6000);
        const small = previewGeometry({ width: 300, height: 200 }, 800, 600);
        assert.strictEqual(small.maxScale, 1);
        assert.strictEqual(previewResolution(small, 1), 300);
        assert.strictEqual(dragPreviewScale(1, -100, 100, 6), 1);
        assert.ok(dragPreviewScale(1, 50, -50, 6) > 1);
        assert.strictEqual(dragPreviewScale(1, 9999, -9999, 6), 6);
        assert.deepStrictEqual(clampPreviewPan({ x: 10000, y: -10000 }, landscape, 1,
            { width: 800, height: 600 }), { x: 0, y: 0 });
        const pan = clampPreviewPan({ x: 10000, y: -10000 }, landscape, 2, { width: 800, height: 600 });
        assert.strictEqual(pan.x, 400);
        assert.ok(pan.y < 0 && pan.y > -234);
        const photo = { id: "resolution-test", width: 6000, height: 4000 };
        assert.notStrictEqual(getThumbnailCacheKey(photo, "review-1920"), getThumbnailCacheKey(photo, "review-6000"));
    });

    await test("isolates Space preview in a frameless dimmed popup with no internal scrollbar", async () => {
        assert.deepStrictEqual(previewPanelSize(918, 720), { width: 870, height: 672 });
        assert.deepStrictEqual(previewPanelSize(2000, 1200), { width: 1120, height: 720 });
        assert.deepStrictEqual(previewPanelSize(30, 30), { width: 1, height: 1 });
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoReviewPreview.jsx"), "utf8");
        const styles = fs.readFileSync(path.join(process.cwd(), "src/styles.css"), "utf8");
        assert.doesNotMatch(source, /uxpShowModal|\.showModal\(/);
        assert.match(source, /role="dialog" aria-modal="true"/);
        assert.match(source, /review-overlay[\s\S]*?document.body/);
        assert.match(source, /classList.add\("review-open"\)/);
        assert.match(source, /classList.remove\("review-open"\)/);
        assert.match(source, /document.body.getBoundingClientRect\(\)/);
        assert.match(source, /clearInterval\(measureTimer\)/);
        assert.match(source, /event.key === "Tab"/);
        assert.match(styles, /\.review-overlay[\s\S]*?transition: opacity 140ms/);
        assert.match(styles, /body.review-open[\s\S]*?visibility: hidden !important/);
        const grid = fs.readFileSync(path.join(process.cwd(), "src/components/ThumbnailGrid.jsx"), "utf8");
        assert.match(grid, /onDoubleClick=\{event =>/);
        assert.match(grid, /onPhotoPreview\?\.\(target\)/);
        assert.match(grid, /button, \[role="button"\]/);
        assert.match(source, /key=\{photo.id\}/);
        assert.match(source, /initialProfile="preview"/);
        const image = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoImage.jsx"), "utf8");
        assert.match(image, /profile: initialProfile \}\) \|\|/);
        assert.match(image, /profile: "thumbnail"/);
        assert.match(image, /profile: "draft", priority: 1/);
        assert.match(image, /if \(!active\) return;/);
        assert.match(image, /releaseDraft\(\)/);
        assert.match(source, /focusPhotoReviewViewport\(dialog\)/);
        assert.match(source, /bindPhotoReviewKeys\(keydown\)/);
        assert.match(source, /focusPhotoReviewViewport\(document.querySelector\(".photo-browser-viewport"\)\)/);
        assert.match(source, /role="dialog" aria-modal="true" tabIndex=\{1\}/);
        assert.doesNotMatch(source, /previousFocus|autoFocus|closeButtonRef/);
        assert.match(source, /target.addEventListener\(name, handler, true\)/);
        assert.doesNotMatch(source, /transform:/);
        assert.match(source, /culling: rejected \? CullingStatus.UNRATED : CullingStatus.REJECT/);
        assert.match(source, /onChangeDecision\(\{ rating:/);
        assert.match(styles, /\.review-stage\s*\{[^}]*overflow: hidden/);
        assert.doesNotMatch(styles, /\.review-[^}]+overflow[^;]*:\s*(?:auto|scroll)/);
    });

    await test("zooms into the entire preview frame and never pans smaller images off center", async () => {
        const stage = { width: 800, height: 600 };
        for (const photo of [{ width: 6000, height: 4000 }, { width: 4000, height: 6000 }, { width: 200, height: 100 }]) {
            const geometry = previewGeometry(photo, 800, 600);
            for (const scale of [1, 1.5, 2, geometry.maxScale, 1000]) {
                for (const offset of [{ x: -99999, y: -99999 }, { x: 99999, y: 99999 }, { x: 0, y: 0 }]) {
                    const image = previewImagePlacement(geometry, scale, offset, stage);
                    for (const [position, length, frame] of [[image.left, image.width, 800], [image.top, image.height, 600]]) {
                        if (length >= frame) {
                            assert(position <= 0.001 && position + length >= frame - 0.001);
                        } else assert.strictEqual(position, (frame - length) / 2);
                    }
                    assert(image.width <= photo.width + 0.001 && image.height <= photo.height + 0.001);
                    if (scale === 1) assert.deepStrictEqual(image, {
                        width: geometry.width, height: geometry.height,
                        left: (stage.width - geometry.width) / 2, top: (stage.height - geometry.height) / 2
                    });
                }
            }
        }
        const geometry = previewGeometry({ width: 6000, height: 4000 }, 800, 600);
        assert.strictEqual(previewImagePlacement(geometry, 2, { x: 0, y: 0 }, stage).width, 1600);
    });

    await test("keeps the active filmstrip thumbnail visible while bounding mounted thumbnails", async () => {
        for (const count of [1, 3, 72, 10000]) {
            for (const index of [0, Math.floor(count / 2), count - 1]) {
                for (const width of [320, 860]) {
                    const strip = previewFilmstripWindow(count, index, width);
                    assert(strip.start <= index && strip.end > index);
                    assert(strip.end <= count && strip.start >= 0);
                    assert(strip.end - strip.start <= strip.capacity);
                    assert(strip.capacity <= 12);
                }
            }
        }
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoReviewPreview.jsx"), "utf8");
        assert.match(source, /photos.slice\(strip.start, strip.end\)/);
        assert.match(source, /event.key === "Shift"\) setShiftHeld\(true\)/);
        const rendering = fs.readFileSync(path.join(process.cwd(), "src/components/useReviewRendering.js"), "utf8");
        assert.match(rendering, /clearReviewPreviews\(\{ keepSmall: true \}\)/);
        assert.match(rendering, /SoftwareJpegRenderer\.retainPreviewDecoded\(\)/);
        assert.match(rendering, /release\(\)/);
        assert.match(rendering, /holdBackgroundRefinements\(\)/);
        assert.match(rendering, /resume\(\)/);
        assert.match(source, /useReviewRendering\(photo, geometry, scale\)/);
        const burst = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"), "utf8");
        assert.match(burst, /useReviewRendering\(activeBurstPhoto, burstGeometry, previewScale\)/);
        assert.match(burst, /key=\{activeBurstPhoto.id\}/);
        assert.match(burst, /profile=\{burstProfile\}/);
        assert.match(source, /<div role="button"[^>]*className="review-thumbnail"/);
        assert.match(source, /<div className="review-thumb-image"><PhotoImage/);
        assert.doesNotMatch(source, /<span>\{photoIndex \+ 1\}<\/span>/);
    });

    await test("cycles absolute 25, 50, 100 percent then Fit, including small photos", async () => {
        const stage = { width: 800, height: 600 };
        for (const photo of [{ width: 6000, height: 4000 }, { width: 4000, height: 6000 },
            { width: 1600, height: 1200 }, { width: 300, height: 200 }]) {
            const geometry = previewGeometry(photo, stage.width, stage.height);
            for (let step = 0; step < 8; step++) {
                const scale = previewClickScale(step, geometry);
                const fraction = [0.25, 0.5, 1, geometry.fit][step % 4];
                const image = previewImagePlacement(geometry, scale, { x: 99999, y: -99999 }, stage);
                assert(Math.abs(image.width - photo.width * fraction) < 0.001);
                assert(Math.abs(image.height - photo.height * fraction) < 0.001);
                if (image.width < stage.width) assert.equal(image.left, (stage.width - image.width) / 2);
                if (image.height < stage.height) assert.equal(image.top, (stage.height - image.height) / 2);
            }
        }
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoReviewPreview.jsx"), "utf8");
        assert.match(source, /onDoubleClick=\{event =>[^\n]*zoomTo\(1\)/);
        assert.match(source, /if \(mode === "pan" \|\| moved.current \|\| event.shiftKey/);
        assert.match(source, /return \(\) => clearTimeout\(clickTimer.current\)/);
    });

    await test("binds pinch streams independently of photo-scroll navigation", async () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoReviewPreview.jsx"), "utf8");
        assert.match(source, /\["gesturestart", "gesturechange", "gestureend"\]/);
        assert.match(source, /zoomTo\(gestureBase.scale \* event.scale, gestureBase.anchor, gestureBase\)/);
        assert.match(source, /if \(gestureBase \|\| Date.now\(\) < pinchUntil\) return/);
        assert.match(source, /surface.addEventListener\("wheel", wheel, \{ passive: false \}\)/);
        assert.match(source, /surface.removeEventListener\("wheel", wheel\)/);
        assert.match(source, /event.deltaY > 0 \? -0.12 : 0.12/);
        assert.doesNotMatch(source, /state.onNavigate\(result.navigate\)/);
        assert.match(source, /gestureTargets = \[surface, dialogRef.current, document, window\]/);
        assert.match(source, /target.addEventListener\(name, gesture\)/);
        assert.match(source, /target.removeEventListener\(name, gesture\)/);
        assert.match(source, /if \(event === lastGesture\) return/);
        const styles = fs.readFileSync(path.join(process.cwd(), "src/styles.css"), "utf8");
        assert.match(styles, /\.review-stage \{[^}]*touch-action: auto/);
    });

    await test("retains the image point under the pointer through drag and pinch zoom", async () => {
        const state = { geometry: previewGeometry({ width: 6000, height: 4000 }, 800, 600),
            stage: { width: 800, height: 600 }, scale: 1, offset: { x: 0, y: 0 } };
        for (const anchor of [{ x: 100, y: -150 }, { x: -240, y: 130 }, { x: 0, y: 0 }]) {
            const result = zoomPreviewAt(state, 3, anchor);
            for (const axis of ["x", "y"]) {
                assert(Math.abs((anchor[axis] - result.offset[axis]) / result.scale - anchor[axis]) < 0.001);
            }
            const pinched = zoomPreviewAt({ ...state, ...result }, 4, anchor);
            const dragged = zoomPreviewAt({ ...state, ...result }, 4, anchor, state);
            assert.deepStrictEqual(pinched, dragged);
            assert.deepStrictEqual(zoomPreviewAt({ ...state, ...result }, 1), { scale: 1, offset: { x: 0, y: 0 } });
        }
        const huge = zoomPreviewAt(state, 1000, { x: 99999, y: 99999 });
        assert.equal(huge.scale, state.geometry.maxScale);
        assert.deepStrictEqual(huge.offset, clampPreviewPan(huge.offset, state.geometry, huge.scale, state.stage));
    });

    await test("ignores vertical Fit swipes, latches horizontal navigation and pans zoomed photos", async () => {
        const state = { geometry: previewGeometry({ width: 6000, height: 4000 }, 800, 600),
            stage: { width: 800, height: 600 }, scale: 1, offset: { x: 0, y: 0 } };
        const wheel = createPreviewWheel();
        for (let i = 0; i < 50; i++) assert.equal(wheel({ deltaX: 1, deltaY: 40 }, state, null, i * 10), null);
        assert.equal(wheel({ deltaX: 30, deltaY: 0 }, state, null, 1000), null);
        assert.deepStrictEqual(wheel({ deltaX: 50, deltaY: 0 }, state, null, 1010), { navigate: 1 });
        for (let i = 0; i < 50; i++) assert.equal(wheel({ deltaX: 40, deltaY: 0 }, state, null, 1020 + i * 20), null);
        assert.deepStrictEqual(wheel({ deltaX: -80, deltaY: 0 }, state, null, 3000), { navigate: -1 });
        const zoomed = { ...state, scale: 3 };
        const pan = wheel({ deltaX: 40, deltaY: -70 }, zoomed, null, 4000);
        assert.deepStrictEqual(pan, { scale: 3, offset: { x: 40, y: 70 } });
        assert.deepStrictEqual(wheel({ deltaX: -40, deltaY: 70 }, zoomed, null, 4001),
            { scale: 3, offset: { x: -40, y: -70 } });
        assert.equal(wheel({ deltaX: 99, deltaY: 0 }, state, null, 4010), null);
        const anchor = { x: 80, y: -90 };
        const pinch = wheel({ deltaX: 0, deltaY: -120, ctrlKey: true }, state, anchor, 5000);
        assert(pinch.scale > 1 && !pinch.navigate);
        const reverse = wheel({ deltaX: 0, deltaY: 120, ctrlKey: true }, { ...state, ...pinch }, anchor, 5010);
        assert(Math.abs(reverse.scale - 1) < 0.001);
        assert.equal(wheel({ deltaX: 90, deltaY: 0 }, state, anchor, 5020), null);
    });

    await test("holds a single preview lease without swallowing the next independent Space", async () => {
        const gate = createPreviewGate();
        assert(gate.acquire(1000));
        for (const time of [1001, 1010, 1100, 999999]) assert(!gate.acquire(time));
        gate.release(2000);
        assert(!gate.isActive());
        assert(gate.acquire(2001));
        assert(gate.isActive());
        assert(!gate.acquire(2501));
        for (let index = 0; index < 50; index++) {
            gate.release();
            assert(gate.acquire());
            assert(!gate.acquire(), "duplicate open cannot create another popup");
        }
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoReviewPreview.jsx"), "utf8");
        assert.match(source, /useLayoutEffect\(\(\) => \{/);
        assert.match(source, /clearTimeout\(closeTimer.current\)/);
        assert.match(source, /reviewPreviewGate.release\(\)/);
        assert.match(source, /if \(closing.current\) return/);
        assert.match(source, /state.requestClose\(\)/);
        assert.doesNotMatch(source, /\[dialog, "cancel", dismissed\]/);
        assert.match(source, /closeTimer.current = setTimeout\(\(\) => latest.current.onClose\(\), 140\)/);
        const browser = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"), "utf8");
        assert.match(browser, /!previewCandidates.length \|\| !reviewPreviewGate.acquire\(\)/);
        assert.match(browser, /reviewPreviewGate.isActive\(\)/);
        assert.match(browser, /bindPhotoReviewKeys\(handleKeyDown\)/);
    });

    await test("scrolls the filmstrip independently, clips its ends and suppresses drag clicks", async () => {
        for (const count of [1, 3, 72, 10000]) {
            for (const width of [320, 860]) {
                const maximum = Math.max(0, count * 70 - width);
                for (const offset of [-500, 0, 1, 35, 140, maximum, maximum + 500]) {
                    const strip = previewFilmstripWindow(count, 0, width, offset);
                    assert.equal(strip.offset, Math.max(0, Math.min(maximum, offset)));
                    assert(strip.start >= 0 && strip.end <= count);
                    assert(strip.end - strip.start <= Math.ceil(width / 70) + 1);
                    assert(strip.left <= 0 && strip.left > -70);
                    assert.equal(strip.start * 70 - strip.offset, strip.left);
                }
            }
        }
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoReviewPreview.jsx"), "utf8");
        assert.match(source, /film.addEventListener\("wheel", filmWheel, \{ passive: false \}\)/);
        assert.match(source, /film.removeEventListener\("wheel", filmWheel\)/);
        assert.match(source, /filmDrag.current.offset - dx/);
        assert.match(source, /if \(!filmMoved.current\) onNavigate/);
        assert.match(source, /opacity: photoIndex === index \? 1 : 0.35/);
        const handler = source.slice(source.indexOf("const filmWheel"), source.indexOf("const film ="));
        assert.doesNotMatch(handler, /onNavigate/);
        assert.match(handler, /event.stopPropagation\(\)/);
    });

    await test("uses cover thumbnails and unobtrusive frame controls without a second toolbar row", async () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoReviewPreview.jsx"), "utf8");
        const styles = fs.readFileSync(path.join(process.cwd(), "src/styles.css"), "utf8");
        assert.match(source, /objectFit: "cover"/);
        assert.doesNotMatch(source, /pageButton|wheelAt/);
        assert.match(styles, /\.review-tools\s*\{\s*position: absolute/);
        assert.match(styles, /\.review-stage \.review-nav \{[^}]*opacity: 0.1/);
        assert.match(styles, /\.review-thumbnail\[aria-pressed="true"\] \{[^}]*opacity: 1/);
        assert.equal(previewFilmstripWindow(72, 0, 840).start, previewFilmstripWindow(72, 10, 840).start);
    });

    await test("uses the approved compact comparison, unrated and five-star filter", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.match(componentSource, /PHOTO_RATING_COMPARISON_OPTIONS/);
        assert.match(componentSource, /photo-rating-unrated/);
        assert.match(componentSource, /photo-rating-stars/);
        assert.doesNotMatch(componentSource, /PHOTO_RATING_FILTER_OPTIONS/);
    });

    await test("uses concise equal View, Sort and Group controls", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        const styleSource = fs.readFileSync(
            path.join(process.cwd(), "src/styles.css"),
            "utf8"
        );
        assert.match(componentSource, /const PHOTO_VIEW_OPTIONS/);
        assert.match(componentSource, /id: "photo-browser-view"/);
        assert.doesNotMatch(componentSource, /<span aria-hidden="true">View ·<\/span>/);
        assert.doesNotMatch(componentSource, /<span aria-hidden="true">Sort ·<\/span>/);
        assert.doesNotMatch(componentSource, /<span aria-hidden="true">Group ·<\/span>/);
        assert.doesNotMatch(componentSource, /label: "Sort by ·/);
        assert.doesNotMatch(componentSource, /label: "Group by ·/);
        assert.match(componentSource, /<ThumbnailZoom viewMode=\{viewMode\}/);
        assert.match(componentSource, /<LibraryToolbar/);
        assert.doesNotMatch(componentSource, /className="photo-browser-toolbar"/);
        assert.match(styleSource, /\.library-toolbar \{[\s\S]*?overflow: visible;/);
    });

    await test("adapts to the center panel and keeps complete menus inside its edges", async () => {
        assert.equal(libraryToolbarLayout(1100), "wide");
        assert.equal(libraryToolbarLayout(600), "wide");
        assert.equal(libraryToolbarLayout(400), "compact");
        assert.equal(libraryToolbarLayout(300), "narrow");
        for (const width of [300, 600, 960]) {
            const toolbar = { left: 220, top: 200, width };
            for (const offset of [0, width / 2, width - 28]) {
                const anchor = { left: 220 + offset, top: 209, bottom: 241 };
                const menu = libraryMenuPosition(toolbar, anchor, 7, 800);
                assert.ok(menu.left >= 0);
                assert.ok(menu.left + menu.width <= width);
                assert.equal(menu.width, 236);
                assert.ok(toolbar.top + menu.top + 250 <= 800);
            }
        }
        const above = libraryMenuPosition(
            { left: 0, top: 550, width: 600 },
            { left: 200, top: 559, bottom: 591 }, 7, 620
        );
        assert.ok(550 + above.top + 250 < 559);
    });

    await test("normalizes review keys and transfers focus without stealing editor input", checkReviewKeyboard);

    await test("moves vertically by grid rows while retaining sequential list navigation", () => {
        for (const columns of [2, 3, 5]) {
            const entries = Array.from({ length: columns * 2 + 1 }, (_, index) => ({
                photo: { id: String(index) }, top: Math.floor(index / columns) * 100, left: (index % columns) * 80
            }));
            const move = (id, key, mode = "icons") => photoNavigationEntry(entries, String(id), key, mode).photo.id;
            assert.equal(move(1, "ArrowDown"), String(1 + columns));
            assert.equal(move(1 + columns, "ArrowUp"), "1");
            assert.equal(move(1, "ArrowRight"), "2");
            assert.equal(move(1, "ArrowLeft"), "0");
            assert.equal(move(1, "ArrowUp"), "1");
            assert.equal(move(columns * 2, "ArrowDown"), String(columns * 2));
            assert.equal(move(columns * 2 - 1, "ArrowDown"), String(columns * 2));
            assert.equal(move(1, "ArrowDown", "list"), "2");
            assert.equal(move(1, "ArrowUp", "list"), "0");
        }
        const grouped = calculateGroupedPhotoBrowserWindow({
            groups: [
                { key: "a", photos: [{ id: "a1" }, { id: "a2" }] },
                { key: "hidden", photos: [{ id: "hidden" }] },
                { key: "b", photos: [{ id: "b1" }, { id: "b2" }] }
            ], collapsedGroupKeys: new Set(["hidden"]), viewMode: "icons", reducedProfiles: true,
            viewportWidth: 500, viewportHeight: 150, scrollTop: 0, thumbnailSize: 144
        }).allEntries.filter(entry => entry.type === "photo");
        assert.equal(photoNavigationEntry(grouped, "a2", "ArrowDown", "icons").photo.id, "b2");
        assert.equal(photoNavigationEntry(grouped, "b2", "ArrowUp", "icons").photo.id, "a2");
        assert.equal(photoNavigationEntry([], "missing", "ArrowDown", "icons"), null);
    });

    await test("uses icon-only popup triggers and reflects the selected view", async () => {
        assert.equal(libraryToolbarIcon("View", "icons"), "Grid");
        assert.equal(libraryToolbarIcon("View", "list"), "List");
        assert.equal(libraryToolbarIcon("Sort", "created"), "Sort");
        assert.equal(libraryToolbarIcon("Group", "event"), "Group");
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/LibraryToolbar.jsx"), "utf8");
        assert.doesNotMatch(source, /library-toolbar-select-text|library-toolbar-chevron/);
        assert.match(source, /aria-haspopup="menu"/);
        assert.match(source, /library-toolbar-menu-heading/);
        assert.match(source, /kind="Search"/);
        const styles = fs.readFileSync(path.join(process.cwd(), "src/styles.css"), "utf8");
        assert.match(styles, /\.library-toolbar-search > input:focus,[\s\S]*?outline: none !important;/);
        assert.match(styles, /\.library-toolbar-search > input \{\s*appearance: none !important;/);
    });

    await test("paints every toolbar SVG primitive white without inherited SVG colors", async () => {
        for (const kind of ["Grid", "List", "Sort", "Group", "Search"]) {
            const markup = renderToStaticMarkup(React.createElement(ToolbarIcon, { kind }));
            const primitives = markup.match(/<(?:path|circle|rect)\b[^>]*>/g) || [];
            assert.ok(primitives.length > 0, `${kind} has visible geometry`);
            for (const primitive of primitives) {
                assert.match(primitive, /stroke="#f4f6fa"/);
                assert.match(primitive, /fill="none"/);
                assert.match(primitive, /stroke-width="1.5"/);
            }
        }
    });

    await test("keeps List headers visible and wires approved sortable columns", async () => {
        const gridSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/ThumbnailGrid.jsx"),
            "utf8"
        );
        const styleSource = fs.readFileSync(
            path.join(process.cwd(), "src/styles.css"),
            "utf8"
        );
        assert.match(gridSource, /onSortChange\?\.\("name"\)/);
        for (const field of ["created", "size", "type", "rating", "camera", "event"]) {
            assert.match(gridSource, new RegExp(`\\[\\"${field}\\"`));
        }
        assert.match(gridSource, /onClick=\{\(\) => onSortChange\?\.\(field\)\}/);
        assert.match(gridSource, /photo-list-identity/);
        assert.match(gridSource, /photo-list-review-actions/);
        assert.match(gridSource, /photo-list-camera-cell/);
        assert.match(gridSource, /photo-list-rating-cell/);
        assert.match(gridSource, /photo-list-rejected-dim/);
        assert.match(gridSource, /photo-list-name-resizer/);
        assert.match(gridSource, /onMouseMove=\{continueListNameResize\}/);
        assert.match(gridSource, /LIST_METADATA_TRACK_WIDTH = 238/);
        assert.match(gridSource, /LIST_REVIEW_ZONE_WIDTH = 286/);
        assert.match(gridSource, /photo-list-header-metadata-window/);
        assert.match(gridSource, /photo-list-header-review-zone/);
        assert.match(gridSource, /photo-list-metadata-scroll-row/);
        assert.match(gridSource, /style=\{\{ left: -metadataScrollLeft \}\}/);
        assert.match(gridSource, /photo\?\.fileSize \|\| photo\?\.size/);
        assert.match(gridSource, /const displayedRating = hoverRating \|\| decision\.rating \|\| 0/);
        assert.match(styleSource, /ALB-138\.6: soft inactive decisions and cumulative rating preview/);
        assert.match(styleSource, /ALB-138\.7: balanced List columns with subtle visual separation/);
        assert.match(styleSource, /ALB-138\.8: frozen List zones and non-reflowing controls for narrow UXP panels/);
        assert.match(styleSource, /ALB-138\.9: host-safe three-zone List; only metadata moves horizontally/);
        assert.match(styleSource, /\.photo-list-metadata-window,[\s\S]*?overflow:\s*hidden;/);
        assert.match(styleSource, /\.photo-list-review-zone,[\s\S]*?flex:\s*0 0 286px;/);
        assert.match(styleSource, /\.photo-list-header\s*\{[\s\S]*?flex:\s*0 0 28px;/);
        assert.match(styleSource, /ALB-138\.2: approved Library List-view parity/);
        assert.match(styleSource, /ALB-138\.5: host-safe, aligned List identity and decision cells/);
        assert.match(styleSource, /\.library-workspace-container--production \.photo-list-header\s*\{[\s\S]*?position:\s*relative;[\s\S]*?flex:\s*0 0 42px;/);
        assert.match(styleSource, /\.photo-list-header-name\s*\{[\s\S]*?grid-column:\s*1 \/ 5;/);
        assert.match(styleSource, /@media \(max-width:\s*1240px\)[\s\S]*?\.photo-library-inspector\s*\{[\s\S]*?display:\s*none;/);
    });

    await test("renders deterministic collapsible groups in Grid and List", async () => {
        const photos = [
            { id: "a-1", name: "a-1.jpg", event: "Event A" },
            { id: "a-2", name: "a-2.jpg", event: "Event A" },
            { id: "b-1", name: "b-1.jpg", event: "Event B" },
            { id: "b-2", name: "b-2.jpg", event: "Event B" }
        ];
        const groups = buildPhotoBrowserGroups(
            photos,
            photo => photo.event,
            "event"
        );
        assert.deepStrictEqual(
            groups.map(group => [group.key, group.label, group.photos.length]),
            [
                ["event:Event A", "Event A", 2],
                ["event:Event B", "Event B", 2]
            ]
        );
        const expanded = calculateGroupedPhotoBrowserWindow({
            groups,
            collapsedGroupKeys: new Set(),
            viewMode: "list",
            reducedProfiles: true,
            viewportWidth: 1000,
            viewportHeight: 1000,
            scrollTop: 0
        });
        assert.strictEqual(expanded.entries.filter(entry => entry.type === "group").length, 2);
        assert.strictEqual(expanded.entries.filter(entry => entry.type === "photo").length, 4);
        assert.strictEqual(expanded.totalHeight, 276);

        const collapsed = calculateGroupedPhotoBrowserWindow({
            groups,
            collapsedGroupKeys: new Set(["event:Event A"]),
            viewMode: "list",
            reducedProfiles: true,
            viewportWidth: 1000,
            viewportHeight: 1000,
            scrollTop: 0
        });
        assert.strictEqual(collapsed.entries.filter(entry => entry.type === "group").length, 2);
        assert.deepStrictEqual(
            collapsed.entries
                .filter(entry => entry.type === "photo")
                .map(entry => entry.photo.id),
            ["b-1", "b-2"]
        );
        assert.strictEqual(collapsed.totalHeight, 172);

        const gridSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/ThumbnailGrid.jsx"),
            "utf8"
        );
        const styleSource = fs.readFileSync(
            path.join(process.cwd(), "src/styles.css"),
            "utf8"
        );
        assert.match(gridSource, /aria-expanded=\{!entry\.collapsed\}/);
        assert.match(gridSource, /toggleGroup\(entry\.groupKey\)/);
        assert.match(styleSource, /ALB-138\.10: real collapsible group sections in Grid and List views/);
    });

    await test("accepts selected photo drops on persistent event targets", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.match(componentSource, /const handleEventDrop = useCallback/);
        assert.match(componentSource, /onDrop=\{handleEventDrop\}/);
        const eventUI = fs.readFileSync(path.join(process.cwd(), "src/components/EventManager.jsx"), "utf8");
        assert.match(eventUI, /onDoubleClick/);
        assert.match(eventUI, /else onDrop\(event, item.chapterId\)/);
        assert.match(eventUI, /value.startsWith\("event:"\)/);
        assert.doesNotMatch(eventUI, /createPortal|role="dialog"/);
        assert.match(componentSource, /saveEventEdit\("move", chapterId, "", targets\)/);
    });

    await test("animates Library lifts and drops with bounded images, exclusive moves and safe cancellation", checkLibraryDrag);

    await test("opens the workspace while background metadata reports honest progress", () => {
        assert.deepStrictEqual(libraryLoadProgress({phase:"reading",total:72,completed:36}), {active:true,percent:49,blocking:false});
        assert.deepStrictEqual(libraryLoadProgress({phase:"grouping",total:72,completed:72}), {active:true,percent:99,blocking:false});
        assert.deepStrictEqual(libraryLoadProgress({phase:"ready",total:72,completed:72}), {active:false,percent:100,blocking:false});
        assert.strictEqual(libraryLoadProgress({phase:"error",total:72,completed:1}).active, true);
        assert.strictEqual(libraryLoadProgress({}, true).percent, 0);
        assert.strictEqual(libraryLoadProgress({}, true).blocking, true);
        assert.deepStrictEqual(libraryLoadProgress({phase:"preparing",total:80,completed:40}), {active:true,percent:49,blocking:false});
        const listeners = new Map();
        const roots = [0,1].map(id => ({addEventListener: (_, fn) => listeners.set(id, fn), removeEventListener: () => listeners.delete(id)}));
        let focused = 0, prevented = 0;
        const control = {};
        const root = {style:{visibility:"visible"},setAttribute(){},removeAttribute(){},querySelector: () => ({focus: () => focused++})};
        const dialog = {contains: target => target === control, focus: () => focused++};
        const release = blockLibraryDuringLoad(root, dialog, ...roots);
        assert.strictEqual(root.style.visibility, "hidden");
        const key = {target:{},preventDefault: () => prevented++, stopImmediatePropagation(){}};
        listeners.get(0)(key); assert.strictEqual(prevented, 1);
        listeners.get(0)({...key,target:control}); assert.strictEqual(prevented, 1);
        release(); assert.strictEqual(root.style.visibility, "visible");
        assert.strictEqual(listeners.size, 0); assert.strictEqual(focused, 2);
    });

    await test("shared compiler helper preserves symbols, getters and safe own properties", () => {
        const symbol = Symbol("photo");
        let reads = 0;
        const source = Object.create({ inherited: 1 });
        Object.defineProperty(source, "hidden", { value: 2 });
        Object.defineProperty(source, "exposure", { enumerable: true, get: () => { reads++; return 3; } });
        source[symbol] = 4;
        const result = { ...source, get deferred() { return 5; }, ...JSON.parse('{"__proto__":{"unsafe":true}}'), ...null };
        assert.strictEqual(reads, 1);
        assert.strictEqual(result.exposure, 3);
        assert.strictEqual(result[symbol], 4);
        assert.strictEqual(result.hidden, undefined);
        assert.strictEqual(result.inherited, undefined);
        assert.strictEqual(typeof Object.getOwnPropertyDescriptor(result, "deferred").get, "function");
        assert.strictEqual(Object.getOwnPropertyDescriptor(result, "exposure").get, undefined);
        assert.strictEqual(Object.getPrototypeOf(result), Object.prototype);
        assert.strictEqual(result.unsafe, undefined);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "__proto__"), true);
    });

    await test("shows dynamic Single and Burst photo types plus collapsible file properties", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.match(componentSource, /label: "Single Photos"/);
        assert.match(componentSource, /label: "Burst Frames"/);
        assert.match(componentSource, /selectedPhotoKindKeys/);
        assert.match(componentSource, /File Properties/);
        assert.match(componentSource, /aria-expanded=\{inspectorFileOpen\}/);
    });

    await test("persists bounded thumbnail size and wires the bottom size control", async () => {
        const componentSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/PhotoBrowserSection.jsx"),
            "utf8"
        );
        assert.strictEqual(normalizePhotoBrowserPreferences({}).thumbnailSize, 144);
        assert.strictEqual(normalizePhotoBrowserPreferences({ thumbnailSize: 12 }).thumbnailSize, 124);
        assert.strictEqual(normalizePhotoBrowserPreferences({ thumbnailSize: 999 }).thumbnailSize, 172);
        assert.match(componentSource, /photo-thumbnail-size-control/);
        assert.match(componentSource, /thumbnailSize=\{preferences\.thumbnailSize\}/);
    });

    await test("reconciles story-order cache when photos are removed from source", async () => {
        const state = fixture();
        state.service.reconcilePhotoStoryOrderCache(state.photos.slice(0, 2));
        assert.deepStrictEqual(
            state.service.getPhotoStoryOrder().items,
            state.initialStoryOrder.items.slice(0, 2)
        );
        assert.deepStrictEqual(
            state.metadata().photoStoryOrder,
            state.initialStoryOrder
        );
    });

    await test("persists story-order move and rolls back on persistence failure", async () => {
        const state = fixture();
        await state.service.updatePhotoStoryOrder(
            state.photos[0],
            state.photos[2],
            [state.photos[0]]
        );
        const previous = state.service.getPhotoStoryOrder();
        const moved = await state.service.updatePhotoStoryOrder(
            state.photos[0],
            state.photos[2],
            [state.photos[0]]
        );
        assert.deepStrictEqual(
            moved.items,
            [state.initialStoryOrder.items[1], state.initialStoryOrder.items[0], state.initialStoryOrder.items[2]]
        );
        assert.strictEqual(state.saved.at(-1).options.reason, "PHOTO_STORY_ORDER_UPDATE");

        state.fail(true);
        await assert.rejects(
            () => state.service.updatePhotoStoryOrder(
                state.photos[1],
                state.photos[2],
                [state.photos[1]]
            ),
            /Injected save failure/
        );
        assert.deepStrictEqual(
            state.service.getPhotoStoryOrder().items,
            previous.items
        );
        assert.deepStrictEqual(
            state.metadata().photoStoryOrder.items,
            previous.items
        );
    });

    await test("creates, renames, assigns and removes photos in event chapters", async () => {
        const state = fixture();
        const created = await state.service.createPhotoEventChapter([state.photos[0]]);
        const [chapter] = created.items;
        assert.strictEqual(created.items.length, 1);
        assert.deepStrictEqual(
            chapter.photoKeys,
            [state.initialStoryOrder.items[0]]
        );

        const renamed = await state.service.renamePhotoEventChapter(
            chapter.chapterId,
            "Wedding Day"
        );
        assert.strictEqual(renamed.items[0].name, "Wedding Day");

        const assigned = await state.service.assignPhotosToEventChapter(
            chapter.chapterId,
            [state.photos[1], state.photos[2]]
        );
        assert.deepStrictEqual(
            assigned.items[0].photoKeys,
            [...state.initialStoryOrder.items]
        );

        const removed = await state.service.removePhotosFromEventChapters([
            state.photos[1]
        ]);
        assert.deepStrictEqual(
            removed.items[0].photoKeys,
            [state.initialStoryOrder.items[0], state.initialStoryOrder.items[2]]
        );

        const emptied = await state.service.removePhotosFromEventChapters([
            state.photos[0],
            state.photos[2]
        ]);
        const deleted = await state.service.deleteEmptyPhotoEventChapter(
            chapter.chapterId
        );
        assert.strictEqual(deleted.items.length, 0);

        assert.strictEqual(state.saved.at(-1).options.reason, "PHOTO_EVENT_CHAPTER_DELETE");
    });

    await test("observes trackpad scrolling without consuming gestures or changing scroll geometry", async () => {
        const listeners = new Map(), timers = new Map(), classes = new Set();
        let timerId = 0;
        const node = {closest:() => node, classList:{add:value => classes.add(value), remove:value => classes.delete(value)}};
        Object.defineProperty(node, "scrollTop", {get:() => 75, set:() => {throw new Error("native scroll position must not be changed");}});
        const root = {contains:target => target === node,
            addEventListener(type, handler, options) {listeners.set(type, handler); if (type === "wheel") assert.equal(options.passive, true);},
            removeEventListener:type => listeners.delete(type)};
        const dispose = bindLibraryScrollbarVisibility(root, {
            later:callback => {timers.set(++timerId, callback); return timerId;}, cancel:id => timers.delete(id)
        });
        const event = {target:node, deltaX:90, deltaY:-150,
            preventDefault:() => {throw new Error("trackpad gesture consumed");},
            stopPropagation:() => {throw new Error("trackpad gesture stopped");}};
        listeners.get("wheel")(event); listeners.get("scroll")(event);
        assert(classes.has("is-scroll-active")); assert.equal(timers.size, 1);
        assert.equal(node.scrollTop, 75);
        [...timers.values()][0](); assert(!classes.size);
        listeners.get("wheel")(event); dispose();
        assert.equal(listeners.size, 0); assert(!classes.size);
    });

    await test("keeps native overflow and Library positions stable when UXP focus ignores preventScroll", async () => {
        const sidebar = {scrollTop:180, scrollLeft:0};
        const viewport = {scrollTop:620, scrollLeft:20};
        for (const node of [sidebar, viewport]) {
            node.style = new Proxy({}, {set:() => {throw new Error("focus must never change overflow/layout");}});
        }
        const root = {scrollTop:0, scrollLeft:0, querySelectorAll:() => [sidebar, viewport]};
        const target = {focus:options => {
            assert.equal(options.preventScroll, true);
            sidebar.scrollTop = 0; viewport.scrollTop = 0; viewport.scrollLeft = 0;
        }};
        focusWithoutMovingLibrary(target, root);
        assert.equal(sidebar.scrollTop, 180); assert.equal(viewport.scrollTop, 620); assert.equal(viewport.scrollLeft, 20);
        viewport.scrollTop = 740;
        focusWithoutMovingLibrary(target, root);
        assert.equal(viewport.scrollTop, 740, "each focus preserves the current position, not a stale popup-open snapshot");
    });

    await test("connects the zoom bar to List then the full thumbnail range", async () => {
        assert.deepStrictEqual(thumbnailZoomState(0), {viewMode:"list", thumbnailSize:124});
        assert.deepStrictEqual(thumbnailZoomState(1), {viewMode:"icons", thumbnailSize:124});
        assert.deepStrictEqual(thumbnailZoomState(49), {viewMode:"icons", thumbnailSize:172});
        assert.equal(thumbnailZoomState(-5).viewMode, "list");
        assert.equal(thumbnailZoomState(80).thumbnailSize, 172);
        assert.equal(thumbnailZoomValue("list", 172), 0);
        for (let size = 124; size <= 172; size++) {
            assert.equal(thumbnailZoomState(thumbnailZoomValue("icons", size)).thumbnailSize, size);
        }
        const row = renderToStaticMarkup(React.createElement(ContextMenuRow, {onClick:() => {}}, "Favorite"));
        assert(!row.includes("<button"), "UXP popup actions must not become native pill buttons");
        assert(row.includes('role="menuitem"'));
    });

    await test("summarizes mixed context-menu decisions and keeps hover destinations inside the panel", async () => {
        const photos = [{rating: 2, favorite: true, culling: CullingStatus.REJECT}, {rating: 5, favorite: false}];
        assert.deepStrictEqual(contextReviewState(photos, photo => photo), {rating:null, favorite:false, rejected:false});
        assert.deepStrictEqual(contextReviewState([photos[0]], photo => photo), {rating:2, favorite:true, rejected:true});
        const bounds = {left:0, top:0, right:800, bottom:600, width:800, height:600};
        const right = eventFlyoutPosition({left:100, right:300, top:100}, bounds, 4);
        assert.equal(right.left, 298, "overlap avoids a dead hover gap");
        const left = eventFlyoutPosition({left:570, right:770, top:560}, bounds, 30);
        assert.equal(left.left, 352);
        assert(left.top + left.maxHeight <= 590, "long event lists scroll inside the panel");
        const state = fixture();
        for (const photo of state.photos.slice(0, 2)) await state.service.updatePhotoDecision(photo, {rating:4, favorite:true, culling:CullingStatus.REJECT});
        const decisions = state.service.getPhotoDecisions();
        assert.equal(createPhotoDecisionLookup(decisions)(state.photos[0]).rating, 4);
        assert.equal(createPhotoDecisionLookup(decisions)(state.photos[1]).favorite, true);
        assert(!decisions.items.some(item => item.photoKey === photoDecisionKey(state.photos[2])), "outside photos are unchanged");
    });

    await test("persists every captured photo in a single event move and named event", async () => {
        const state = fixture();
        const keys = state.photos.map(photoDecisionKey);
        let workspace = eventWorkspace({}, state.photos, [{ label: "Original", photoIds: state.photos.map(photo => photo.id) }]);
        workspace = editEvent(workspace, "new", "", [keys[2]], "Destination");
        const destination = workspace.items.find(item => item.name === "Destination").chapterId;
        const moved = await state.service.savePhotoEventChapters(editEvent(workspace, "move", destination, keys.slice(0, 2)), "PHOTO_EVENT_EDIT");
        assert.deepStrictEqual(new Set(moved.items.find(item => item.chapterId === destination).photoKeys), new Set(keys));
        assert.deepStrictEqual(state.metadata().photoEventChapters.items, moved.items);
        const captured = keys.slice(0, 2);
        const named = await state.service.savePhotoEventChapters(editEvent(moved, "new", "", captured, "Named drop"), "PHOTO_EVENT_EDIT");
        assert.deepStrictEqual(named.items.find(item => item.name === "Named drop").photoKeys, captured);
        assert.deepStrictEqual(named.items.find(item => item.chapterId === destination).photoKeys, [keys[2]]);
        assert.deepStrictEqual(state.metadata().photoEventChapters.items, named.items);
    });

    await test("restores event chapters for undo and rolls back a failed restore", async () => {
        const state = fixture();
        const empty = state.service.getPhotoEventChapters();
        await state.service.createPhotoEventChapter([state.photos[0]]);
        const created = state.service.getPhotoEventChapters();
        const restored = await state.service.savePhotoEventChapters(
            empty,
            "PHOTO_LIBRARY_EVENT_UNDO"
        );
        assert.strictEqual(restored.items.length, 0);
        assert.strictEqual(state.saved.at(-1).options.reason, "PHOTO_LIBRARY_EVENT_UNDO");

        state.fail(true);
        await assert.rejects(
            () => state.service.savePhotoEventChapters(
                created,
                "PHOTO_LIBRARY_EVENT_REDO"
            ),
            /Injected save failure/
        );
        assert.deepStrictEqual(state.service.getPhotoEventChapters(), restored);
    });

    await test("folder remove persists reset story-order and event chapter state", async () => {
        const state = fixture();
        await state.service.createPhotoEventChapter([state.photos[0], state.photos[1]]);
        await state.service.updatePhotoStoryOrder(state.photos[1], state.photos[2], [state.photos[1]]);
        await state.service.removePhotos();
        const lastSave = state.saved.at(-1);
        assert.deepStrictEqual(lastSave.values.photoCount, 0);
        assert.deepStrictEqual(lastSave.values.photoStoryOrder, normalizePhotoStoryOrder());
        assert.deepStrictEqual(
            lastSave.values.photoEventChapters,
            normalizePhotoEventChapters()
        );
        assert.deepStrictEqual(state.service.getPhotoStoryOrder(), normalizePhotoStoryOrder());
        assert.deepStrictEqual(state.service.getPhotoEventChapters(), normalizePhotoEventChapters());
    });

    await test("uses included-by-default review semantics without losing legacy KEEP data", async () => {
        const photos = fixture().photos;
        let decisions = updatePhotoDecision({}, photos[0], {
            culling: CullingStatus.KEEP
        });
        decisions = updatePhotoDecision(decisions, photos[1], {
            culling: CullingStatus.REJECT
        });
        const lookup = createPhotoDecisionLookup(decisions);
        assert.deepStrictEqual(
            filterPhotosByCulling(
                photos,
                CullingFilterMode.INCLUDED,
                lookup
            ).map(photo => photo.id),
            [photos[0].id, photos[2].id]
        );
        assert.deepStrictEqual(
            summarizeCulling(photos, lookup).included,
            2
        );
        assert.strictEqual(lookup(photos[0]).culling, CullingStatus.KEEP);
    });

    await test("assigns stable automatic C-number camera identities", async () => {
        const photos = [
            { id: "b", cameraMake: "Nikon", cameraModel: "Z8" },
            { id: "a", cameraMake: "Canon", cameraModel: "R5" },
            { id: "c", cameraMake: "Canon", cameraModel: "R5" }
        ];
        const identity = createCameraIdentityLookup(photos);
        assert.strictEqual(identity(photos[1]).tag, "C1");
        assert.strictEqual(identity(photos[2]).tag, "C1");
        assert.strictEqual(identity(photos[0]).tag, "C2");
        assert.notStrictEqual(identity(photos[0]).color, identity(photos[1]).color);
    });

    await test("invalidates temporal grouping when asynchronous metadata mutates photo models", async () => {
        const photos = [
            { id: "burst-a", dateTaken: null },
            { id: "burst-b", dateTaken: null },
            { id: "burst-c", dateTaken: null }
        ];
        const before = createPhotoGroupingRevision(photos);
        assert.strictEqual(groupPhotosByBurst(photos).length, 0);
        photos.forEach((photo, index) => {
            photo.dateTaken = 1_700_000_000_000 + index * 250;
        });
        const after = createPhotoGroupingRevision(photos);
        assert.notStrictEqual(after, before);
        assert.strictEqual(groupPhotosByBurst(photos).length, 1);
    });

    await test("supports professional rating operators with legacy preference compatibility", async () => {
        const photos = [0, 1, 3, 5].map(rating => ({
            id: `rating-${rating}`,
            name: `rating-${rating}.jpg`,
            rating
        }));
        assert.strictEqual(
            normalizePhotoBrowserPreferences({ minimumRating: 3 }).ratingFilter.mode,
            "atLeast"
        );
        assert.deepStrictEqual(
            queryPhotoBrowser(photos, {
                ratingFilter: { mode: "exact", value: 3 }
            }).photos.map(photo => photo.rating),
            [3]
        );
        assert.deepStrictEqual(
            queryPhotoBrowser(photos, {
                ratingFilter: { mode: "atMost", value: 1 }
            }).photos.map(photo => photo.rating),
            [0, 1]
        );
        assert.deepStrictEqual(
            queryPhotoBrowser(photos, {
                ratingFilter: { mode: "unrated", value: 0 }
            }).photos.map(photo => photo.rating),
            [0]
        );
    });

    await test("supports replace, toggle, range and additive range selection deterministically", async () => {
        const photos = [1, 2, 3, 4, 5].map(number => ({
            id: `p${number}`,
            selected: false
        }));
        const selection = new SelectionEngine({ getPhotos: () => photos });
        selection.setOrderedPhotos(photos);
        selection.handleClick(photos[1]);
        selection.handleClick(photos[3], { shiftKey: true });
        assert.deepStrictEqual([...selection.selectedIds()], ["p2", "p3", "p4"]);
        selection.handleClick(photos[0], { metaKey: true, shiftKey: true });
        assert.deepStrictEqual([...selection.selectedIds()], ["p2", "p3", "p4", "p1"]);
        selection.handleClick(photos[2], { ctrlKey: true });
        assert.deepStrictEqual([...selection.selectedIds()], ["p2", "p4", "p1"]);
        selection.replace(["p5", "missing"], "p5");
        assert.deepStrictEqual([...selection.selectedIds()], ["p5"]);
    });

    await test("undoes and redoes mixed Library actions in chronological order", async () => {
        const history = new PhotoLibraryHistory({ limit: 4 });
        const current = {
            [PhotoLibraryHistoryKind.SELECTION]: ["p3"],
            [PhotoLibraryHistoryKind.DECISION]: { version: 2 },
            [PhotoLibraryHistoryKind.EVENT]: { version: 2 }
        };

        history.push(PhotoLibraryHistoryKind.SELECTION, ["p1"]);
        history.push(PhotoLibraryHistoryKind.DECISION, { version: 1 });
        history.push(PhotoLibraryHistoryKind.EVENT, { version: 1 });

        const eventUndo = history.undo(kind => current[kind]);
        assert.strictEqual(eventUndo.kind, PhotoLibraryHistoryKind.EVENT);
        assert.deepStrictEqual(eventUndo.snapshot, { version: 1 });
        current[eventUndo.kind] = eventUndo.snapshot;

        const decisionUndo = history.undo(kind => current[kind]);
        assert.strictEqual(decisionUndo.kind, PhotoLibraryHistoryKind.DECISION);
        assert.deepStrictEqual(decisionUndo.snapshot, { version: 1 });
        current[decisionUndo.kind] = decisionUndo.snapshot;

        const decisionRedo = history.redo(kind => current[kind]);
        assert.strictEqual(decisionRedo.kind, PhotoLibraryHistoryKind.DECISION);
        assert.deepStrictEqual(decisionRedo.snapshot, { version: 2 });
        current[decisionRedo.kind] = decisionRedo.snapshot;

        history.push(PhotoLibraryHistoryKind.SELECTION, ["p2"]);
        assert.strictEqual(history.redo(kind => current[kind]), null);
    });

    await test("deduplicates identical selection checkpoints and enforces its history limit", async () => {
        const history = new PhotoLibraryHistory({ limit: 2 });
        const sameSelection = (left, right) =>
            left.length === right.length &&
            left.every((id, index) => id === right[index]);

        assert.strictEqual(history.push(
            PhotoLibraryHistoryKind.SELECTION,
            ["p1"],
            { equals: sameSelection }
        ), true);
        assert.strictEqual(history.push(
            PhotoLibraryHistoryKind.SELECTION,
            ["p1"],
            { equals: sameSelection }
        ), false);
        history.push(PhotoLibraryHistoryKind.DECISION, { version: 1 });
        history.push(PhotoLibraryHistoryKind.EVENT, { version: 1 });
        assert.strictEqual(history.undoStack.length, 2);
        assert.strictEqual(history.undoStack[0].kind, PhotoLibraryHistoryKind.DECISION);
    });

    await test("applies multi-pick burst review and rejects only unselected frames", async () => {
        const photos = [0, 1, 2, 3, 4].map(index => ({
            id: `burst-${index}`,
            name: `burst-${index}.jpg`,
            file: { nativePath: `/photos/burst-${index}.jpg` },
            dateTaken: 1000 + index * 200,
            qualityScore: index === 2 ? 0.95 : 0.5
        }));
        const bursts = groupPhotosByBurst(photos, 3000);
        const result = applyBurstReview({
            value: normalizePhotoBurstReviews(),
            photos,
            bursts,
            groupId: bursts[0].groupId,
            selectedPhotos: [photos[1], photos[2]],
            decisions: {},
            updateDecisionFn: updatePhotoDecision,
            appliedAt: "2026-09-04T00:00:00.000Z"
        });
        const lookup = createPhotoDecisionLookup(result.decisions);
        assert.strictEqual(result.reviews.items[0].reviewed, true);
        assert.strictEqual(result.reviews.items[0].selectedPhotoKeys.length, 2);
        assert.strictEqual(lookup(photos[0]).culling, CullingStatus.REJECT);
        assert.notStrictEqual(lookup(photos[1]).culling, CullingStatus.REJECT);
        assert.notStrictEqual(lookup(photos[2]).culling, CullingStatus.REJECT);
        assert.strictEqual(lookup(photos[4]).culling, CullingStatus.REJECT);
    });

    console.info(
        `ALB-137 slice 1 persistence tests complete: ${assertions} assertions.`
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
