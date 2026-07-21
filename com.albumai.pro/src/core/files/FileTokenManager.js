import { storage } from "uxp";
import Logger from "../photoshop/Logger";

const fs = storage.localFileSystem;

export default class FileTokenManager {

    constructor() {

        this.sessionCache = new Map();

        this.persistentCache = new Map();

    }

    async createSessionToken(entry) {

        if (!entry) {

            throw new Error(
                "Entry is required."
            );

        }

        if (this.sessionCache.has(entry.nativePath)) {

            return this.sessionCache.get(entry.nativePath);

        }

        try {

            const token =
                await fs.createSessionToken(entry);

            this.sessionCache.set(
                entry.nativePath,
                token
            );

            return token;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async createPersistentToken(entry) {

        if (!entry) {

            throw new Error(
                "Entry is required."
            );

        }

        if (this.persistentCache.has(entry.nativePath)) {

            return this.persistentCache.get(
                entry.nativePath
            );

        }

        try {

            const token =
                await fs.createPersistentToken(entry);

            this.persistentCache.set(
                entry.nativePath,
                token
            );

            return token;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async getEntryFromPersistentToken(token) {

        if (!token) {

            throw new Error(
                "Persistent token is required."
            );

        }

        try {

            return await fs.getEntryForPersistentToken(
                token
            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async getEntryFromSessionToken(token) {

        if (!token) {

            throw new Error(
                "Session token is required."
            );

        }

        try {

            return await fs.getEntryForSessionToken(
                token
            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async refreshPersistentToken(token) {

        const entry =
            await this.getEntryFromPersistentToken(
                token
            );

        return this.createPersistentToken(entry);

    }

    clearCache() {

        this.sessionCache.clear();

        this.persistentCache.clear();

    }

    hasSessionToken(path) {

        return this.sessionCache.has(path);

    }

    hasPersistentToken(path) {

        return this.persistentCache.has(path);

    }

}