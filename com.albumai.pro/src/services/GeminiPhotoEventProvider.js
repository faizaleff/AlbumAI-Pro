import {storage} from "uxp";
import renderer from "./SoftwareJpegRenderer";
import encodeJpeg from "jpeg-js/lib/encoder";
import {photoEventCaptureTime} from "./PhotoAutoEvents";
import {photoDecisionKey} from "./PhotoBrowserModel";

const MODEL = "gemini-3.1-flash-lite", KEY = "albumai-gemini-key";
const categories = ["Getting Ready","Ceremony","Couple Portraits","Individual Portraits","Family & Guests","Reception","Dance & Celebration","Details & Venue","Other"];
const fatal = message => Object.assign(new Error(message), {fatal:true});
export function onlineRequestFailure(error, stage) {
    // Match locally, emit fixed text only: host errors may contain credentials.
    const message=String(error?.message || "").toLowerCase();
    if (error?.name === "AbortError") return fatal("Online request cancelled or timed out [ABORTED]. No automatic retry.");
    if (/permission|not allowed|not permitted|manifest|not authorized/.test(message)) return fatal("Photoshop blocked network access [NETWORK_PERMISSION]. Unload and Load the plugin in UXP Developer Tools so the updated manifest is applied.");
    if (/redirect/.test(message)) return fatal("Photoshop rejected the request redirect setting [REDIRECT]. No automatic retry.");
    if (stage === "response") return fatal("Google response could not be read [RESPONSE_JSON]. No automatic retry.");
    if (stage === "classification") return fatal("Google classification was not valid JSON [CLASSIFICATION_JSON]. No automatic retry.");
    return fatal("Photoshop could not complete the Google request [NETWORK_REQUEST]. Check connection to test without photos. No automatic retry.");
}
function base64(bytes) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let out = "";
    for (let i=0;i<bytes.length;i+=3) {
        const bits=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);
        out+=alphabet[bits>>>18]+alphabet[(bits>>>12)&63]+(i+1<bytes.length?alphabet[(bits>>>6)&63]:"=")+(i+2<bytes.length?alphabet[bits&63]:"=");
    }
    return out;
}
export async function onlinePhotoPreview(photo, check) {
    if (!/\.(jpg|jpeg)$/i.test(photo.name || "") || !photo.file?.read) throw new Error("Online preview supports JPEG photos currently.");
    check();
    const binary = await photo.file.read({format:storage.formats.binary});
    const pixels = await renderer.render(binary,{maxEdge:768,pixelsOnly:true,lifecycle:{throwIfCancelled:check}});
    check();
    const jpeg = encodeJpeg({data:pixels.data,width:pixels.width,height:pixels.height},78);
    const data = base64(jpeg.data);
    check();
    return {mimeType:"image/jpeg",data};
}
export class GeminiPhotoEventProvider {
    constructor({vault=storage.secureStorage, request=(...args)=>fetch(...args), preview=onlinePhotoPreview}={}) {
        this.vault=vault; this.request=request; this.preview=preview;
    }
    async setKey(key) {
        if (!/^[\x21-\x7e]{20,256}$/.test(key.trim())) throw new Error("Enter a valid API key.");
        await this.vault.setItem(KEY,key.trim());
    }
    async forgetKey() {await this.vault.removeItem(KEY);}
    async ready() {
        try { const bytes=await this.vault.getItem(KEY); if (!bytes?.length) throw new Error(); return true; }
        catch (_) {throw fatal("Add your Google AI Studio API key first.");}
    }
    async checkConnection() {
        await this.ready();
        const bytes=await this.vault.getItem(KEY);
        const key=typeof bytes === "string" ? bytes : Array.from(bytes,b=>String.fromCharCode(b)).join("");
        const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),30000);
        let stage="request";
        try {
            const response=await this.request(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
                method:"POST",redirect:"error",credentials:"omit",signal:controller.signal,
                headers:{"Content-Type":"application/json","x-goog-api-key":key},
                body:JSON.stringify({contents:[{parts:[{text:"Reply OK."}]}],generationConfig:{maxOutputTokens:32}})});
            if (!response.ok) throw fatal(`Google connection test failed [HTTP_${response.status}]. Check API access, quota and billing.`);
            stage="response";
            await response.json();
            return "Google connection works. No photos were sent.";
        } catch(error) {if(error.fatal)throw error;throw onlineRequestFailure(error,stage);}
        finally {clearTimeout(timer);}
    }
    // New session only after the UI's explicit consent for the displayed photo set.
    async session(photos, consent, isCurrent=()=>true) {
        if (!consent) throw fatal("Approve sending these previews to Google first.");
        await this.ready();
        const bytes=await this.vault.getItem(KEY);
        const key=typeof bytes === "string" ? bytes : Array.from(bytes,b=>String.fromCharCode(b)).join("");
        const allowed=new Set(photos.map(photoDecisionKey)), attempted=new Set();
        const ordered=[...photos].sort((a,b)=>(photoEventCaptureTime(a)??Infinity)-(photoEventCaptureTime(b)??Infinity)||photoDecisionKey(a).localeCompare(photoDecisionKey(b)));
        const positions=new Map(ordered.map((photo,index)=>[photoDecisionKey(photo),index]));
        const prepared=new Map();
        let previous=null;
        const check=()=>{if (!isCurrent()) throw fatal("Event analysis cancelled.");};
        const prepare=photo=>{
            const key=photoDecisionKey(photo);
            if (!prepared.has(key)) prepared.set(key, Promise.resolve().then(()=>this.preview(photo,check)).then(value=>({value}),error=>({error})));
            return prepared.get(key);
        };
        return {analyzeScene:async (photo,onStage=()=>{})=>{
            check();
            const photoKey=photoDecisionKey(photo);
            if (!allowed.has(photoKey)||attempted.has(photoKey)) throw fatal("Photo analysis session changed. Start a new review.");
            let preview;
            onStage("Preparing preview");
            const ready=await prepare(photo); prepared.delete(photoKey);
            if (ready.error) {previous=null;throw ready.error;}
            preview=ready.value;
            check(); attempted.add(photoKey);
            const parts=[{text:"Classify the LAST image by visible photo category. If two images are supplied, compare their event context: same only when they plausibly show the same continuous occasion, different only for a supported new occasion, uncertain when not clear. Compare setting, attire, activity and event flow separately as same/different/unknown. A pose, crop, camera angle, close-up, background not visible, or moving from individual to couple portraits is not a new occasion. Clothing or activity changes alone are not proof of a new event; consider all visible cues together. Do not guess addresses or GPS locations. Different photo categories alone do not mean different events. Do not identify people, infer specific rituals or treat matching outfits as proof. Mark ambiguous content needsReview. First image alone: boundary uncertain. Return a brief reason and a short factual sceneDescription of the LAST image (visible setting/activity only, no names or guessed ritual)."}];
            if (previous) parts.push({inlineData:previous.preview});
            parts.push({inlineData:preview});
            const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),90000);
            const cancel=setInterval(()=>{if (!isCurrent()) controller.abort();},200);
            // Prepare at most one following image while the current request is in flight.
            const next=ordered[positions.get(photoKey)+1];
            if (next) prepare(next);
            let stage="request";
            onStage("Waiting for review");
            try {
                const response=await this.request(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
                    method:"POST",redirect:"error",credentials:"omit",signal:controller.signal,
                    headers:{"Content-Type":"application/json","x-goog-api-key":key},
                    body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{temperature:1,maxOutputTokens:512,
                        thinkingConfig:{thinkingLevel:"minimal"},responseMimeType:"application/json",
                        responseJsonSchema:{type:"object",properties:{category:{type:"string",enum:categories},boundary:{type:"string",enum:["same","different","uncertain"]},needsReview:{type:"boolean"},reason:{type:"string"},sceneDescription:{type:"string"},context:{type:"object",properties:Object.fromEntries(["setting","attire","activity","flow"].map(field=>[field,{type:"string",enum:["same","different","unknown"]}])),required:["setting","attire","activity","flow"],additionalProperties:false}},required:["category","boundary","needsReview","reason","sceneDescription","context"],additionalProperties:false}}})});
                check();
                if (!response.ok) throw fatal(`Google request failed (${response.status}). Check API access, quota and billing. No automatic retry.`);
                onStage("Reading result");
                stage="response";
                const body=await response.json(), candidate=body.candidates?.[0];
                if (candidate?.finishReason!=="STOP") throw fatal("Google returned an incomplete analysis. No automatic retry.");
                stage="classification";
                const result=JSON.parse(candidate.content.parts.filter(p=>!p.thought).map(p=>p.text||"").join(""));
                if (!categories.includes(result.category)||!["same","different","uncertain"].includes(result.boundary)||typeof result.needsReview!=="boolean") throw fatal("Google returned invalid analysis. No automatic retry.");
                check();
                const evidence={status:"complete",category:result.category,contextRelation:result.boundary,previousPhotoKey:previous?.key||null,
                    context:result.context,
                    description:typeof result.sceneDescription === "string" ? result.sceneDescription.replace(/\s+/g," ").trim().slice(0,240) : "",
                    scoreKind:"model-scene-context",requiresReview:result.needsReview};
                previous={key:photoKey,preview};
                return evidence;
            } catch (error) {if (error.fatal) throw error; throw onlineRequestFailure(error,stage);}
            finally {clearTimeout(timer); clearInterval(cancel);}
        }};
    }
}
export default new GeminiPhotoEventProvider();
