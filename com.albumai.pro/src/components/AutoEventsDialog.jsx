import React, {useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import SidebarButton from "./SidebarButton";
import PhotoImage from "./PhotoImage";
import {photoDecisionKey} from "../services/PhotoBrowserModel";
import {analyzePhotoEvents} from "../services/PhotoAutoEvents";
import provider from "../services/LocalPhotoEventProvider";
import onlineProvider from "../services/GeminiPhotoEventProvider";
import {focusWithoutMovingLibrary, suspendLibraryReviewScrollbars} from "./PopupScrollbars";

function Samples({keys, byKey, timings = []}) {
    const [page, setPage] = useState(0);
    const offset = page * 12;
    const durations = new Map(timings.map(item => [item.photoKey,item.durationMs]));
    return <><div className="auto-events-samples">{keys.slice(offset, offset + 12).map(key => <div key={key} title={byKey.get(key)?.name}><PhotoImage photo={byKey.get(key)} profile="thumbnail" style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}} alt={byKey.get(key)?.name}/>{durations.has(key) && <small className="auto-events-photo-time">{(durations.get(key)/1000).toFixed(1)}s</small>}</div>)}</div>
        {keys.length > 12 && <div className="auto-events-pages"><SidebarButton disabled={!page} onClick={() => setPage(value => value - 1)}>Previous</SidebarButton><small>{offset + 1}–{Math.min(offset + 12, keys.length)} / {keys.length}</small><SidebarButton disabled={offset + 12 >= keys.length} onClick={() => setPage(value => value + 1)}>Next</SidebarButton></div>}</>;
}

export default function AutoEventsDialog({photos, onApply, onClose}) {
    const [clock,setClock] = useState(Date.now());
    useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return ()=>clearInterval(timer);},[]);
    const [progress, setProgress] = useState(null), [proposal, setProposal] = useState(null);
    const [approved, setApproved] = useState(new Set()), [error, setError] = useState("");
    const [mode,setMode] = useState("local"), [key,setKey] = useState(""), [onlineReady,setOnlineReady] = useState(false), [consent,setConsent] = useState(false);
    useEffect(() => {onlineProvider.ready().then(()=>{if(alive.current)setOnlineReady(true);}).catch(()=>{});},[]);
    const [connected, setConnected] = useState(false);
    useEffect(() => {provider.ready().then(() => {if (alive.current) setConnected(true);}).catch(() => {});}, []);
    const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
    const alive = useRef(true), generation = useRef(0), dialog = useRef(null);
    const byKey = new Map(photos.map(photo => [photoDecisionKey(photo), photo]));
    useLayoutEffect(() => {
        const restore = suspendLibraryReviewScrollbars();
        document.body.classList.add("review-open");
        focusWithoutMovingLibrary(dialog.current);
        return () => { alive.current = false; generation.current++; restore(); document.body.classList.remove("review-open");
            focusWithoutMovingLibrary(document.querySelector(".photo-browser-viewport")); };
    }, []);
    useEffect(() => { generation.current++; setProposal(null); setBusy(false); setProgress(null); setConsent(false); }, [photos]);
    const analyze = async () => {
        const run = ++generation.current;
        const current = () => alive.current && generation.current === run;
        setBusy(true); setError(""); setProposal(null); setProgress({completed:0, total:photos.length,startedAt:Date.now(),timings:[]});
        try {
            let active;
            if (mode === "online") active = await onlineProvider.session(photos,consent,current);
            else {await provider.ready(); active = {analyzeScene:photo => provider.analyzeScene(photo,current)};}
            const result = await analyzePhotoEvents(photos, active,
                {isCurrent:current, onProgress:value => {if (current()) setProgress(value);}});
            if (!current()) return;
            setProposal(result); setApproved(new Set(result.groups.filter(group => !group.requiresReview).map(group => group.id)));
        } catch (failure) { if (current()) setError(failure.message); }
        finally { if (current()) {setBusy(false); setConsent(false);} }
    };
    const close = () => { if (!saving) {generation.current++; onClose();} };
    const save = async () => {
        if (saving || !approved.size) return;
        setSaving(true); setError("");
        try { await onApply(proposal, [...approved]); onClose(); }
        catch (failure) { if (alive.current) {setError(failure.message); setSaving(false);} }
    };
    return createPortal(<div className="auto-events-overlay" onMouseDown={event => event.stopPropagation()}>
        <section ref={dialog} className={`auto-events-dialog${proposal ? " has-results" : ""}`} role="dialog" aria-modal="true" aria-label="Auto Events" tabIndex={-1}
            onKeyDown={event => {
                event.stopPropagation();
                if (event.key === "Escape") {event.preventDefault(); close();}
                if (event.key === "Tab") {
                    const controls = Array.from(dialog.current.querySelectorAll('input, [role="button"]')).filter(node => node.getAttribute("aria-disabled") !== "true");
                    const index = controls.indexOf(document.activeElement);
                    event.preventDefault();
                    focusWithoutMovingLibrary(controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]);
                }
            }}>
            <header><strong>Auto Events</strong><SidebarButton onClick={close} disabled={saving}>{busy ? "Cancel" : "Close"}</SidebarButton></header>
            <p>{mode === "local" ? "Find event suggestions from your photos. Analysis stays on this computer." : "Compare photo content and nearby photos to suggest events."}</p>
            {!busy && !proposal && <div className="auto-events-start"><SidebarButton aria-pressed={mode === "local"} onClick={()=>{setMode("local");setConsent(false);setError("");}}>Local AI</SidebarButton><SidebarButton aria-pressed={mode === "online"} onClick={()=>{setMode("online");setConsent(false);setError("");}}>Online AI</SidebarButton></div>}
            {!busy && !proposal && mode === "online" && <div className="auto-events-group-main auto-events-online">
                <p>Gemini 3.1 Flash-Lite · Internet required. Sends reduced previews (up to 768px), including the preceding preview for context. Filenames and EXIF are not sent. JPEG photos supported; other formats stay for review.</p>
                <p>Connection check sends a tiny test text; token charges may apply. Estimated rates: $0.25/M input tokens, $1.50/M output tokens. Google billing applies. Check that your key's project has paid billing enabled: unpaid data may be used for improvement; paid-service terms still allow some retention.</p>
                <input type="password" aria-label="Google AI Studio API key" placeholder={onlineReady ? "Replace saved API key" : "Google AI Studio API key"} value={key} onChange={event=>setKey(event.target.value)}/>
                <div className="auto-events-start"><SidebarButton disabled={!key.trim()} onClick={async()=>{try{await onlineProvider.setKey(key);setKey("");setOnlineReady(true);setError("");}catch(_){setError("Could not save the key securely. Check it and try again.");}}}>Save key securely</SidebarButton>
                <SidebarButton disabled={!onlineReady || saving} onClick={async()=>{setSaving(true);setError("");try{const message=await onlineProvider.checkConnection();if(alive.current)setError(message);}catch(failure){if(alive.current)setError(failure.message);}finally{if(alive.current)setSaving(false);}}}>Check connection (no photos)</SidebarButton>
                <SidebarButton disabled={!onlineReady} onClick={async()=>{try{await onlineProvider.forgetKey();setOnlineReady(false);setConsent(false);}catch(_){setError("Could not remove the saved key.");}}}>Remove key</SidebarButton></div>
                <Samples keys={photos.map(photoDecisionKey)} byKey={byKey}/>
                <SidebarButton aria-pressed={consent} onClick={()=>setConsent(value=>!value)}>{consent ? "✓" : "○"} I checked billing and approve sending these {photos.length} photo previews to Google</SidebarButton>
                <SidebarButton className="is-primary" disabled={saving || !onlineReady || !consent || !photos.length} onClick={analyze}>Analyze online</SidebarButton>
            </div>}
            {error && <p role="alert" className="auto-events-error">{error}</p>}
            {busy && <div role="status">
                <p>Analyzing {progress?.completed || 0} / {photos.length} · Total {Math.max(0,Math.floor((clock-progress.startedAt)/1000))}s</p>
                {progress?.phase && <p>{progress.phase} · Current photo {Math.max(0,Math.floor((clock-progress.photoStartedAt)/1000))}s</p>}
                <div className="auto-events-progress"><div style={{width:`${100 * (progress?.completed || 0) / Math.max(1, photos.length)}%`}} /></div>
                <div className="auto-events-timings">{(progress?.timings || []).map((item,index) => <small key={item.photoKey}>{index+1}. {byKey.get(item.photoKey)?.name} · {(item.durationMs/1000).toFixed(1)}s</small>)}</div>
            </div>}
            {!busy && !proposal && mode === "local" && <div className="auto-events-start">
                <SidebarButton disabled={saving} onClick={async () => {try {await provider.connect(); if (alive.current) {setConnected(true); setError("");}} catch (failure) {if (alive.current) setError(failure.message);}}}>{connected ? "Reconnect model" : "Connect local model"}</SidebarButton>
                <SidebarButton className="is-primary" onClick={analyze} disabled={!photos.length}>Analyze photos</SidebarButton>
                <small>{connected ? "Local model connected · Offline analysis" : "First connection: select the local model’s connection folder."}</small>
            </div>}
            {proposal && <>
                <p>{proposal.groups.length} suggested events · {proposal.groups.filter(group => group.requiresReview).length} event boundaries need review · {proposal.reviewPhotoKeys.length} photos left unassigned{proposal.failedPhotoKeys?.length ? ` (${proposal.failedPhotoKeys.length} could not be analyzed)` : ""}. Check event names and transitions before applying. Categories describe photos within each event.</p>
                <div className="auto-events-start">
                    <SidebarButton disabled={saving} onClick={() => setApproved(new Set(proposal.groups.map(group => group.id)))}>Select all</SidebarButton>
                    <SidebarButton disabled={saving} onClick={() => setApproved(new Set())}>Clear selection</SidebarButton>
                    <small>{approved.size} / {proposal.groups.length} selected · Total {((proposal.durationMs || 0)/1000).toFixed(1)}s</small>
                </div>
                <div className="auto-events-results">
                    {proposal.groups.map(group => <div className="auto-events-group" key={group.id}>
                        <SidebarButton disabled={saving} aria-pressed={approved.has(group.id)} onClick={() => setApproved(previous => {const next = new Set(previous); next.has(group.id) ? next.delete(group.id) : next.add(group.id); return next;})}>{approved.has(group.id) ? "✓" : "○"}</SidebarButton>
                        <div className="auto-events-group-main"><input aria-label="Suggested event name" value={group.label} maxLength={80} disabled={saving} onChange={event => {const label = event.target.value; setProposal(previous => ({...previous, groups:previous.groups.map(item => item.id === group.id ? {...item,label} : item)}));}} />
                        {group.description && <p className="photo-event-description">{group.description}</p>}
                        <small>{group.photoKeys.length} photos · {Object.entries(group.categories || {}).map(([name,count]) => `${name} ${count}`).join(" · ")}</small>
                        <small>{new Date(group.startTime).toLocaleString()} – {new Date(group.endTime).toLocaleTimeString()}{group.requiresReview ? ` · Review: ${group.reviewReason}` : ""}</small>
                        <Samples keys={group.photoKeys} byKey={byKey} timings={proposal.timings}/></div>
                    </div>)}
                    {proposal.reviewPhotoKeys.length > 0 && <div className="auto-events-group-main"><strong>Needs review — check image analysis and capture times; kept in current events</strong><Samples keys={proposal.reviewPhotoKeys} byKey={byKey} timings={proposal.timings}/></div>}
                </div>
                <footer><span>Approved photos move into new events. Undo is available.</span><SidebarButton className="is-primary" disabled={saving || !approved.size} onClick={save}>{saving ? "Saving…" : `Apply ${approved.size} ${approved.size === 1 ? "event" : "events"}`}</SidebarButton></footer>
            </>}
        </section>
    </div>, document.body);
}
