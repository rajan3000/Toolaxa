// ======================================================
// ATMS PROJECT MANAGEMENT - STORAGE ENGINE
// localStorage : Project records
// IndexedDB   : PDF, invoices, photos & large attachments
// ======================================================

const STORE_KEY = "ATMS_PM_V1";
const DB_NAME = "ATMS_PM_FILES_V1";
const DB_VERSION = 1;
const FILE_STORE = "attachments";

const modules = [
    "inventory",
    "vendors",
    "procurement",
    "sitc",
    "daily",
    "civil",
    "faults"
];

// ------------------------------------------------------
// IndexedDB CONNECTION
// ------------------------------------------------------

let idbPromise = null;
let pendingWrites = [];

function openFileDB() {
    if (idbPromise) return idbPromise;

    idbPromise = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("IndexedDB is not supported in this browser."));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains(FILE_STORE)) {
                database.createObjectStore(FILE_STORE, {
                    keyPath: "id"
                });
            }
        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => {
            idbPromise = null;
            reject(request.error || new Error("Unable to open file database."));
        };

        request.onblocked = () => {
            console.warn("ATMS attachment database upgrade is blocked.");
        };
    });

    return idbPromise;
}

// ------------------------------------------------------
// ATTACHMENT STORAGE
// ------------------------------------------------------

function dataURLtoBlob(dataURL) {
    const parts = dataURL.split(",");
    const mimeMatch = parts[0].match(/:(.*?);/);

    const mime = mimeMatch
        ? mimeMatch[1]
        : "application/octet-stream";

    const binary = atob(parts[1] || "");
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
}

export async function saveAttachment(id, fileOrBlob, name = "attachment") {
    const database = await openFileDB();

    const blob = fileOrBlob instanceof Blob
        ? fileOrBlob
        : dataURLtoBlob(fileOrBlob);

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(FILE_STORE, "readwrite");
        const store = transaction.objectStore(FILE_STORE);

        store.put({
            id: String(id),
            name,
            blob,
            size: blob.size,
            type: blob.type || "application/octet-stream",
            updatedAt: new Date().toISOString()
        });

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(
            transaction.error || new Error("Attachment save aborted.")
        );
    });
}

export async function getAttachment(id) {
    if (id === undefined || id === null) return null;

    const database = await openFileDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(FILE_STORE, "readonly");
        const request = transaction.objectStore(FILE_STORE).get(String(id));

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteAttachment(id) {
    if (id === undefined || id === null) return;

    const database = await openFileDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(FILE_STORE, "readwrite");
        transaction.objectStore(FILE_STORE).delete(String(id));

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
    });
}

// ------------------------------------------------------
// HELPERS TO KEEP FILES OUT OF localStorage
// ------------------------------------------------------

function attachmentID(record) {
    return record.attachmentId || `ATMS_FILE_${record.id}`;
}

function stripAttachmentData(record) {
    const copy = { ...record };

    delete copy.attachmentData;

    return copy;
}

function queueAttachmentWrite(id, data, name) {
    const task = saveAttachment(id, data, name)
        .catch(error => {
            console.error("ATMS attachment storage error:", error);

            alert(
                "Attachment could not be saved.\n" +
                "Please download a project backup and try again."
            );

            throw error;
        });

    pendingWrites.push(task);

    task.finally(() => {
        pendingWrites = pendingWrites.filter(p => p !== task);
    });

    // Avoid unhandled rejection warning when the caller is not awaiting it.
    task.catch(() => {});

    return task;
}

export async function waitForAttachmentWrites() {
    while (pendingWrites.length) {
        await Promise.allSettled([...pendingWrites]);
    }
}

// ------------------------------------------------------
// MIGRATE EXISTING BASE64 ATTACHMENTS
// ------------------------------------------------------

async function migrateAttachments() {
    let data;

    try {
        data = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
        return;
    }

    let changed = false;

    for (const module of modules) {
        if (!Array.isArray(data[module])) continue;

        for (const record of data[module]) {
            if (!record || !record.attachmentData) continue;

            const id = attachmentID(record);

            try {
                await saveAttachment(
                    id,
                    record.attachmentData,
                    record.attachmentName || "attachment"
                );

                record.attachmentId = id;
                delete record.attachmentData;

                changed = true;
            } catch (error) {
                console.error("Attachment migration failed:", error);
            }
        }
    }

    if (changed) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error("Could not update migrated records:", error);
        }
    }
}

// ------------------------------------------------------
// DATABASE LOAD
// ------------------------------------------------------

export function loadDB() {
    try {
        const data = JSON.parse(
            localStorage.getItem(STORE_KEY) || "{}"
        );

        modules.forEach(module => {
            if (!Array.isArray(data[module])) {
                data[module] = [];
            }
        });

        // Migrate older Base64 files in the background.
        migrateAttachments().catch(error => {
            console.warn("ATMS attachment migration issue:", error);
        });

        return data;

    } catch (error) {
        console.error("ATMS database load error:", error);
        return createEmptyDB();
    }
}

export function createEmptyDB() {
    const data = {};

    modules.forEach(module => {
        data[module] = [];
    });

    return data;
}

// ------------------------------------------------------
// DATABASE SAVE
// Attachments are moved out of localStorage automatically.
// ------------------------------------------------------

export function saveDB(data) {
    try {
        const safeData = JSON.parse(JSON.stringify(data));

        modules.forEach(module => {
            if (!Array.isArray(safeData[module])) {
                safeData[module] = [];
            }

            safeData[module] = safeData[module].map(record => {
                if (!record || !record.attachmentData) return record;

                const id = attachmentID(record);

                // Queue file for IndexedDB
                queueAttachmentWrite(
                    id,
                    record.attachmentData,
                    record.attachmentName || "attachment"
                );

                // Keep only attachment reference in localStorage
                const copy = stripAttachmentData(record);
                copy.attachmentId = id;

                return copy;
            });
        });

        localStorage.setItem(STORE_KEY, JSON.stringify(safeData));

        // Update caller's data so app can use the attachment reference.
        modules.forEach(module => {
            if (!Array.isArray(data[module])) return;

            data[module].forEach(record => {
                if (record && record.attachmentData) {
                    record.attachmentId = attachmentID(record);
                    delete record.attachmentData;
                }
            });
        });

        return true;

    } catch (error) {
        console.error("ATMS save error:", error);

        alert(
            "Storage error!\n\n" +
            "Your records could not be saved.\n" +
            "Please download a backup and check browser storage."
        );

        return false;
    }
}

// ------------------------------------------------------
// BACKUP EXPORT
// Includes attachments from IndexedDB in Base64 format.
// ------------------------------------------------------

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);

        reader.readAsDataURL(blob);
    });
}

export async function exportBackup(data) {
    try {
        await waitForAttachmentWrites();

        const backupData = JSON.parse(JSON.stringify(data));

        for (const module of modules) {
            if (!Array.isArray(backupData[module])) continue;

            for (const record of backupData[module]) {
                if (!record || !record.attachmentId) continue;

                const attachment = await getAttachment(record.attachmentId);

                if (attachment && attachment.blob) {
                    record.attachmentData = await blobToDataURL(
                        attachment.blob
                    );

                    record.attachmentName =
                        attachment.name || record.attachmentName || "attachment";
                }
            }
        }

        const backup = {
            app: "ATMS Project Management System",
            version: 2,
            exportedAt: new Date().toISOString(),
            data: backupData
        };

        const blob = new Blob(
            [JSON.stringify(backup, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "ATMS_Project_Backup.json";
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 10000);

        return true;

    } catch (error) {
        console.error("ATMS backup error:", error);

        alert(
            "Backup failed.\n\n" +
            "Some attachments may not have been exported."
        );

        return false;
    }
}

// ------------------------------------------------------
// BACKUP IMPORT
// Supports older backup format also.
// ------------------------------------------------------

export function importBackup(file, callback) {
    const reader = new FileReader();

    reader.onload = async () => {
        try {
            const backup = JSON.parse(reader.result);
            const data = backup.data || backup;

            modules.forEach(module => {
                if (!Array.isArray(data[module])) {
                    throw new Error("Invalid backup file: " + module);
                }
            });

            // Store backed-up attachments in IndexedDB
            for (const module of modules) {
                for (const record of data[module]) {
                    if (!record || !record.attachmentData) continue;

                    const id = attachmentID(record);

                    await saveAttachment(
                        id,
                        record.attachmentData,
                        record.attachmentName || "attachment"
                    );

                    record.attachmentId = id;
                    delete record.attachmentData;
                }
            }

            callback(data);

        } catch (error) {
            console.error("ATMS restore error:", error);
            alert("Invalid backup file or attachment restore failed!");
        }
    };

    reader.onerror = () => alert("Could not read backup file.");
    reader.readAsText(file);
}

// ------------------------------------------------------
// STORAGE INFO
// ------------------------------------------------------

export async function getStorageInfo() {
    let estimate = null;

    if (navigator.storage && navigator.storage.estimate) {
        estimate = await navigator.storage.estimate();
    }

    return {
        usage: estimate?.usage || 0,
        quota: estimate?.quota || 0,
        usageMB: ((estimate?.usage || 0) / 1024 / 1024).toFixed(2),
        quotaMB: ((estimate?.quota || 0) / 1024 / 1024).toFixed(2),
        percentUsed: estimate?.quota
            ? Math.round((estimate.usage / estimate.quota) * 100)
            : 0
    };
}

// Request persistent browser storage when supported.
export async function requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
        return await navigator.storage.persist();
    }

    return false;
}