export class StorageManager {
    constructor() {
        this.dbName = 'AviationPWA_Storage';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject('Database failed to open');
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Store charts keyed by a distinct filename or airport string identifier
                if (!db.objectStoreNames.contains('pdf_charts')) {
                    db.createObjectStore('pdf_charts', { keyPath: 'name' });
                }
            };
        });
    }

    async savePDF(name, fileBlob) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pdf_charts'], 'readwrite');
            const store = transaction.objectStore('pdf_charts');

            const dataRecord = {
                name: name,
                blob: fileBlob,
                timestamp: Date.now()
            };

            const request = store.put(dataRecord);
            request.onsuccess = () => resolve();
            request.onerror = () => reject('Failed to write binary PDF payload to DB');
        });
    }

    async getPDF(name) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pdf_charts'], 'readonly');
            const store = transaction.objectStore('pdf_charts');
            const request = store.get(name);

            request.onsuccess = () => resolve(request.result ? request.result.blob : null);
            request.onerror = () => reject('Error fetching PDF from DB');
        });
    }

    /**
     * Retrieves an array of strings representing all saved PDF records.
     * Uses a key cursor to optimize performance and conserve active device memory.
     * @returns {Promise<string[]>} List of all stored chart names
     */
    async getAllPDFNames() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pdf_charts'], 'readonly');
            const store = transaction.objectStore('pdf_charts');
            const fileNames = [];

            // openKeyCursor reads solely the primary keys ('name'), ignoring the 'blob' payloads
            const request = store.openKeyCursor();

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    fileNames.push(cursor.key);
                    cursor.continue(); // Move to the next index key entry
                } else {
                    resolve(fileNames); // End of database records reached
                }
            };

            request.onerror = () => reject('Error scanning PDF chart library indices');
        });
    }

    /**
     * Deletes a specific PDF record from the object store by its name identifier.
     * @param {string} name - The key identifier of the PDF chart to remove
     * @returns {Promise<void>}
     */
    async deletePDF(name) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pdf_charts'], 'readwrite');
            const store = transaction.objectStore('pdf_charts');

            const request = store.delete(name);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(`Failed to delete PDF chart: ${name}`);
        });
    }
}