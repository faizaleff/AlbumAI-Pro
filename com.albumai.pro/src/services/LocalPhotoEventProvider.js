import {storage} from "uxp";
const PROTOCOL = "albumai-local-events-v1";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export class LocalPhotoEventProvider {
    constructor(fileSystem = storage.localFileSystem) { this.fs = fileSystem; this.folder = null; }
    async connect() {
        const folder = await this.fs.getFolder();
        if (!folder) throw new Error("Model connection cancelled.");
        await this.check(folder);
        const token = await this.fs.createPersistentToken(folder);
        const data = await this.fs.getDataFolder();
        const config = await data.createFile("local-auto-events.json", {overwrite:true});
        await config.write(JSON.stringify({token}));
        this.folder = folder;
    }
    async check(folder) {
        let status;
        try { status = JSON.parse(await (await folder.getEntry("ready.json")).read()); }
        catch (_) { throw new Error("Choose the running local model's connection folder."); }
        if (status.protocol !== PROTOCOL || !Number.isFinite(status.updatedAt) ||
            Math.abs(Date.now() - status.updatedAt) > 120000) {
            throw new Error("Start the local model, then try again.");
        }
        return status;
    }
    async ready() {
        if (!this.folder) {
            try {
                const data = await this.fs.getDataFolder();
                const config = JSON.parse(await (await data.getEntry("local-auto-events.json")).read());
                this.folder = await this.fs.getEntryForPersistentToken(config.token);
            } catch (_) { throw new Error("Connect the local model first."); }
        }
        return this.check(this.folder);
    }
    async analyzeScene(photo, isCurrent = () => true) {
        try { await this.ready(); }
        catch (error) {error.fatal = true; throw error;}
        if (!photo.file) throw new Error("Photo is unavailable locally.");
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const name = `request-${id}.json`, response = `response-${id}.json`;
        let image;
        const request = await this.folder.createFile(`pending-${id}.tmp`, {overwrite:false});
        try {
            const extension = String(photo.extension || photo.name?.split(".").pop() || "").toLowerCase();
            if (!/^(jpg|jpeg|png|webp|tif|tiff|bmp)$/.test(extension)) throw new Error("This image format needs review.");
            // Photoshop has access to the chosen source folder. Copy one photo
            // into the private bridge, so the helper never needs source-folder
            // permissions (e.g. macOS Downloads). Remove it after this request.
            const imageName = `image-${id}.${extension}`;
            if (photo.file.copyTo) {
                image = await photo.file.copyTo(this.folder, {overwrite:false});
                await image.moveTo(this.folder, {newName:imageName, overwrite:false});
            }
            else {
                image = await this.folder.createFile(imageName, {overwrite:false});
                await image.write(await photo.file.read({format:storage.formats.binary}), {format:storage.formats.binary});
            }
            await request.write(JSON.stringify({protocol:PROTOCOL, path:image.nativePath, createdAt:Date.now()}));
            await request.moveTo(this.folder, {newName:name, overwrite:false});
            const deadline = Date.now() + 120000;
            while (Date.now() < deadline) {
                if (!isCurrent()) throw new Error("Event analysis cancelled.");
                let entry;
                try { entry = await this.folder.getEntry(response); } catch (_) {}
                if (entry) {
                    try { return JSON.parse(await entry.read()); }
                    finally { await entry.delete(); }
                }
                await pause(200);
            }
            const error = new Error("Local model timed out. Check that it is running.");
            error.fatal = true; throw error;
        } finally {
            try { await request.delete(); } catch (_) {}
            try { if (image) await image.delete(); } catch (_) {}
        }
    }
}
export default new LocalPhotoEventProvider();
