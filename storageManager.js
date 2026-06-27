export class StorageManager {
    constructor() {
        this.dbName = 'AviationPWA_Storage';
        this.dbVersion = 2;
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

                if (!db.objectStoreNames.contains('chart_configs')) {
                    // Use a unique configId as the main key
                    const configStore = db.createObjectStore('chart_configs', { keyPath: 'configId' });

                    // 2. CRITICAL: Create an index so we can search configs by their parent PDF name
                    configStore.createIndex('by_pdf', 'pdf_name', { unique: false });
                }
            };
        });
    }

    /**
     * Saves or updates a map positioning layout config
     * @param {Object} configRecord - Structural mapping config
     */
    async saveChartConfig(configRecord) {
        // Example payload structure:
        // { configId: 'jfk-rwy4', pdf_name: 'KJFK.pdf', center: [lng, lat], scale: 0.01, orientation: 12 }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chart_configs'], 'readwrite');
            const store = transaction.objectStore('chart_configs');

            const request = store.put(configRecord);
            request.onsuccess = () => resolve();
            request.onerror = () => reject('Failed to write chart map configuration data');
        });
    }

    /**
     * Saves or updates a map positioning layout config
     * @param {Object} configRecord - Structural mapping config
     */
    async getChartConfig(configId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chart_configs'], 'readonly');
            const store = transaction.objectStore('chart_configs');
            const request = store.get(configId);

            request.onsuccess = () => resolve(request.result ? request.result : null);
            request.onerror = () => reject('Error fetching PDF from DB');
        });
    }

    /**
     * Uses the 'by_pdf' index to quickly return ALL configurations belonging to a specific PDF
     * @param {string} pdfName - Primary key of the parent document
     */
    async getConfigsForPDF(pdfName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chart_configs'], 'readonly');
            const store = transaction.objectStore('chart_configs');
            const index = store.index('by_pdf');

            // Get all records matching our foreign key name criteria
            const request = index.getAll(pdfName);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(`Error reading configurations associated with: ${pdfName}`);
        });
    }

    /**
     * Deletes an individual overlay config
     */
    async deleteChartConfig(configId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chart_configs'], 'readwrite');
            const store = transaction.objectStore('chart_configs');
            const request = store.delete(configId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(`Failed to delete config: ${configId}`);
        });
    }

    /**
     * Retrieves an array of strings representing all saved PDF records.
     * Uses a key cursor to optimize performance and conserve active device memory.
     * @returns {Promise<string[]>} List of all stored chart names
     */
    async getAllChartConifgNames() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chart_configs'], 'readonly');
            const store = transaction.objectStore('chart_configs');
            const chartConfigNames = [];

            // openKeyCursor reads solely the primary keys ('name'), ignoring the 'blob' payloads
            const request = store.openKeyCursor();

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    chartConfigNames.push(cursor.key);
                    cursor.continue(); // Move to the next index key entry
                } else {
                    resolve(chartConfigNames); // End of database records reached
                }
            };

            request.onerror = () => reject('Error scanning chartConfigs library indices');
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