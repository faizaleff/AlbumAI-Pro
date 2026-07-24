class AtomicJsonFileWriter {

    constructor() {

        this.queues = new Map();

    }

    write({
        folder,
        fileName,
        serialized,
        currentFile: _staleCurrentFile = null,
        reason = "UNSPECIFIED"
    }) {

        if (!folder) {
            return Promise.reject(
                new Error("A destination folder is required.")
            );
        }

        // Complete serialization and validation before touching temp files.
        JSON.parse(serialized);

        const queueKey =
            `${folder.nativePath || folder.name}:${fileName}`;
        const previous = this.queues.get(queueKey) ||
            Promise.resolve();
        const write = previous
            .catch(() => {})
            .then(() => this.commit({
                folder,
                fileName,
                serialized,
                reason
            }));

        this.queues.set(queueKey, write);

        return write.finally(() => {
            if (this.queues.get(queueKey) === write) {
                this.queues.delete(queueKey);
            }
        });

    }

    async commit({
        folder,
        fileName,
        serialized,
        reason
    }) {

        const isProjectFile = fileName === "project.json";
        const temporaryName = `${fileName}.tmp`;
        const backupName = `${fileName}.bak`;
        const backupTemporaryName = `${backupName}.tmp`;

        this.projectLog(isProjectFile, "PROJECT_SAVE_BEGIN", {
            reason,
            bytes: serialized.length
        });

        // Resolve every entry freshly. Cached Entry objects may refer to a
        // file that has already been replaced by an earlier queued save.
        const live = await this.findEntry(folder, fileName);
        const liveState = await this.readValidJson(live);
        const staleTemp = await this.findEntry(
            folder,
            temporaryName
        );
        const staleTempState =
            await this.readValidJson(staleTemp);

        if (staleTemp && !staleTempState) {
            await this.removeEntry(
                staleTemp,
                "invalid stale project temp"
            );
        }

        await this.reconcileBackupTemp({
            folder,
            backupName,
            backupTemporaryName
        });

        const existingBackup = await this.findEntry(
            folder,
            backupName
        );
        const existingBackupState =
            await this.readValidJson(existingBackup);
        const backupContent = liveState?.content ||
            existingBackupState?.content ||
            staleTempState?.content ||
            serialized;

        const verifiedBackup = await this.writeVerifiedBackup({
            folder,
            backupName,
            backupTemporaryName,
            content: backupContent,
            isProjectFile,
            reason
        });

        // A valid interrupted temp remains available until a verified backup
        // exists. It is safe to replace only after this point.
        const currentStaleTemp = await this.findEntry(
            folder,
            temporaryName
        );

        if (currentStaleTemp) {
            await this.removeEntry(
                currentStaleTemp,
                "stale project temp after backup"
            );
        }

        const temporary = await folder.createFile(
            temporaryName,
            { overwrite: false }
        );

        await temporary.write(serialized);

        this.projectLog(
            isProjectFile,
            "PROJECT_SAVE_TMP_WRITTEN",
            { reason, bytes: serialized.length }
        );

        await this.verifyEntry(temporary, serialized);

        this.projectLog(
            isProjectFile,
            "PROJECT_TEMP_VERIFIED",
            { reason }
        );
        this.projectLog(
            isProjectFile,
            "PROJECT_SAVE_VERIFY_OK",
            { reason }
        );

        this.projectLog(
            isProjectFile,
            "PROJECT_SWAP_BEGIN",
            { reason }
        );

        let committed;

        try {
            await this.rename(folder, temporary, fileName);

            this.projectLog(
                isProjectFile,
                "PROJECT_SWAP_DONE",
                { reason }
            );
            this.projectLog(
                isProjectFile,
                "PROJECT_SAVE_RENAME_OK",
                { reason }
            );

            committed = await this.findEntry(
                folder,
                fileName
            );
            await this.verifyEntry(committed, serialized);

            this.projectLog(
                isProjectFile,
                "PROJECT_COMMIT_VERIFIED",
                { reason }
            );
        } catch (commitError) {
            await this.rollback({
                folder,
                fileName,
                temporaryName,
                backup: verifiedBackup,
                backupContent,
                isProjectFile,
                reason,
                commitError
            });
            throw commitError;
        }

        this.projectLog(isProjectFile, "PROJECT_SAVE_DONE", {
            reason,
            bytes: serialized.length
        });

        return committed;

    }

    async reconcileBackupTemp({
        folder,
        backupName,
        backupTemporaryName
    }) {

        const backupTemp = await this.findEntry(
            folder,
            backupTemporaryName
        );

        if (!backupTemp) return;

        const backupTempState =
            await this.readValidJson(backupTemp);

        if (!backupTempState) {
            await this.removeEntry(
                backupTemp,
                "invalid stale backup temp"
            );
            return;
        }

        const backup = await this.findEntry(
            folder,
            backupName
        );
        const backupState = await this.readValidJson(backup);

        if (backupState) {
            await this.removeEntry(
                backupTemp,
                "superseded backup temp"
            );
            return;
        }

        // Preserve the valid interrupted backup temp before starting a newer
        // backup. The source is removed only by a successful rename.
        await this.rename(folder, backupTemp, backupName);
        const promoted = await this.findEntry(
            folder,
            backupName
        );
        await this.verifyEntry(
            promoted,
            backupTempState.content
        );

    }

    async writeVerifiedBackup({
        folder,
        backupName,
        backupTemporaryName,
        content,
        isProjectFile,
        reason
    }) {

        this.projectLog(
            isProjectFile,
            "PROJECT_BACKUP_BEGIN",
            { reason }
        );

        const staleBackupTemp = await this.findEntry(
            folder,
            backupTemporaryName
        );

        if (staleBackupTemp) {
            await this.removeEntry(
                staleBackupTemp,
                "backup temp before new backup"
            );
        }

        const backupTemporary = await folder.createFile(
            backupTemporaryName,
            { overwrite: false }
        );

        await backupTemporary.write(content);
        await this.verifyEntry(backupTemporary, content);

        // Only now may the older backup be replaced. Until this point either
        // project.json.bak or the fully verified .bak.tmp remains valid.
        await this.rename(
            folder,
            backupTemporary,
            backupName
        );

        const backup = await this.findEntry(
            folder,
            backupName
        );
        await this.verifyEntry(backup, content);

        this.projectLog(
            isProjectFile,
            "PROJECT_BACKUP_VERIFIED",
            { reason }
        );

        return backup;

    }

    async rollback({
        folder,
        fileName,
        temporaryName,
        backup,
        backupContent,
        isProjectFile,
        reason,
        commitError
    }) {

        this.projectLog(
            isProjectFile,
            "PROJECT_ROLLBACK_BEGIN",
            {
                reason,
                commitError:
                    commitError?.message || String(commitError)
            }
        );

        try {
            // Resolve and verify the backup freshly; the object passed from
            // backup creation may be stale after a host-level rename.
            const freshBackup = await this.findEntry(
                folder,
                `${fileName}.bak`
            ) || backup;
            await this.verifyEntry(
                freshBackup,
                backupContent
            );

            const staleRollbackTemp = await this.findEntry(
                folder,
                temporaryName
            );

            if (staleRollbackTemp) {
                await this.removeEntry(
                    staleRollbackTemp,
                    "temp before rollback"
                );
            }

            const rollbackTemp = await folder.createFile(
                temporaryName,
                { overwrite: false }
            );
            await rollbackTemp.write(backupContent);
            await this.verifyEntry(
                rollbackTemp,
                backupContent
            );
            await this.rename(
                folder,
                rollbackTemp,
                fileName
            );

            const restored = await this.findEntry(
                folder,
                fileName
            );
            await this.verifyEntry(restored, backupContent);

            this.projectLog(
                isProjectFile,
                "PROJECT_ROLLBACK_DONE",
                { reason }
            );
        } catch (rollbackError) {
            commitError.rollbackError =
                rollbackError?.message || String(rollbackError);
            console.error(
                "PROJECT_ROLLBACK_FAILED",
                {
                    reason,
                    commitError:
                        commitError?.message ||
                        String(commitError),
                    rollbackError:
                        commitError.rollbackError
                }
            );
        }

    }

    async verifyEntry(entry, expectedContent) {

        if (!entry) {
            throw new Error("Expected JSON entry is missing.");
        }

        const content = await entry.read();
        JSON.parse(content);

        if (content !== expectedContent) {
            throw new Error(
                "JSON entry verification failed."
            );
        }

        return content;

    }

    async readValidJson(entry) {

        if (!entry || entry.isFolder) return null;

        try {
            const content = await entry.read();
            return {
                content,
                value: JSON.parse(content)
            };
        } catch (_) {
            return null;
        }

    }

    async removeEntry(entry, description) {

        if (!entry) return;

        if (typeof entry.delete !== "function") {
            throw new Error(
                `Cannot safely remove ${description}.`
            );
        }

        await entry.delete();

    }

    async rename(folder, source, fileName) {

        if (typeof folder.renameEntry === "function") {
            await folder.renameEntry(
                source,
                fileName,
                { overwrite: true }
            );
            return;
        }

        if (typeof source.moveTo === "function") {
            await source.moveTo(folder, {
                newName: fileName,
                overwrite: true
            });
            return;
        }

        throw new Error(
            "Verified JSON swap is unsupported by this UXP host."
        );

    }

    async findEntry(folder, name) {

        try {
            return typeof folder.getEntry === "function"
                ? await folder.getEntry(name)
                : (await folder.getEntries()).find(
                    entry => entry.name === name
                ) || null;
        } catch (_) {
            return null;
        }

    }

    projectLog(enabled, operation, details) {

        if (enabled) {
            console.info(operation, details);
        }

    }

}

export default new AtomicJsonFileWriter();
