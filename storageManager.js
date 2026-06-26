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
}