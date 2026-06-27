import { StorageManager } from '../../storageManager.js';

const storage = new StorageManager();

// DOM References
const pdfList = document.getElementById('pdf-list');
const addPdfBtn = document.getElementById('add-pdf-btn');
const fileInput = document.getElementById('pdf-file-input');
const statusMessage = document.getElementById('status-message');

// Initialize Storage and load interface
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await storage.init();
        await renderChartList();
    } catch (err) {
        showStatus('Failed to connect to local database storage.', 'error');
    }
});

// Setup File Selection Hooks
addPdfBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);

/**
 * Reads all documents out of IndexedDB and renders them to the UI
 */
async function renderChartList() {
    pdfList.innerHTML = '';

    try {
        // 1. Get the list of all stored keys
        const chartNames = await storage.getAllPDFNames();

        if (chartNames.length === 0) {
            pdfList.innerHTML = '<li class="loading-state">No charts downloaded yet. Click above to add your first PDF.</li>';
            return;
        }

        // 2. Build rows for each record
        for (const name of chartNames) {
            // Fetch object directly to inspect the actual binary Blob payload length
            const transaction = storage.db.transaction(['pdf_charts'], 'readonly');
            const store = transaction.objectStore('pdf_charts');

            store.get(name).onsuccess = (event) => {
                const record = event.target.result;
                if (!record) return;

                const sizeString = formatBytes(record.blob.size);
                createChartRow(name, sizeString);
            };
        }
    } catch (err) {
        showStatus('Error pulling saved chart configurations.', 'error');
    }
}

/**
 * Compiles a list row with metadata indicators and custom button listeners
 */
function createChartRow(name, sizeString) {
    const li = document.createElement('li');
    li.className = 'pdf-item';

    li.innerHTML = `
        <div class="pdf-info">
            <div class="pdf-name">${escapeHTML(name)}</div>
            <div class="pdf-meta">Storage: <strong>${sizeString}</strong></div>
        </div>
        <div class="pdf-actions">
            <button class="btn action-btn overlay-btn" data-action="overlay">Overlay on Map</button>
            <button class="btn action-btn compress-btn" data-action="compress">Compress PDF</button>
            <button class="btn action-btn delete-btn" data-action="delete">Delete</button>
        </div>
    `;

    // Map Button Direct Action Delegates
    li.querySelector('[data-action="overlay"]').addEventListener('click', () => {
        executeMapOverlayAction(name);
    });

    li.querySelector('[data-action="compress"]').addEventListener('click', () => {
        executeCompressionPlaceholder(name);
    });

    li.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (confirm(`Remove "${name}" from offline application storage?`)) {
            try {
                await storage.deletePDF(name);
                showStatus(`Successfully deleted ${name}`, 'success');
                await renderChartList();
            } catch (err) {
                showStatus('Could not clear file selection.', 'error');
            }
        }
    });

    pdfList.appendChild(li);
}

/**
 * Event: Upload and store binary file structure
 */
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        showStatus('Invalid format. Please select an authentic .pdf file extension.', 'error');
        fileInput.value = ''; // clear input
        return;
    }

    showStatus(`Saving ${file.name} directly to offline device partition...`, 'success');

    try {
        // Store name string alongside the raw binary file context object
        await storage.savePDF(file.name, file);
        showStatus(`Successfully locked ${file.name} to persistent storage!`, 'success');
        fileInput.value = ''; // reset file picker element
        await renderChartList();
    } catch (err) {
        showStatus('Database write transaction allocation faulted.', 'error');
        console.error(err);
    }
}

/**
 * Trigger Action: Overlay PDF Map Contextual Identifier Hook
 */
function executeMapOverlayAction(identifier) {
    window.location.href = `./../overlays/edit/?pdf=${encodeURIComponent(identifier)}`;
}

/**
 * Trigger Action: Compressed Structural Optimization Placeholder
 */
function executeCompressionPlaceholder(identifier) {
    console.log(`Triggered file compression utility request configuration profile mapping for: ${identifier}`);
    alert(`Compression processing utility framework initialized for: "${identifier}"`);
}

/**
 * Utility: File size calculation parser
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Utility: Sanitization Helper
 */
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

/**
 * Utility: UI banner alerts
 */
function showStatus(msg, type) {
    statusMessage.textContent = msg;
    statusMessage.className = `status-msg ${type}`;
    setTimeout(() => statusMessage.className = 'status-msg hidden', 4000);
}