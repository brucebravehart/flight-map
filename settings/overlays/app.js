import { StorageManager } from '../../storageManager.js';

const storage = new StorageManager();

// DOM References
const overlayList = document.getElementById('overlay-list');
const addOverlayBtn = document.getElementById('add-overlay-btn');
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
addOverlayBtn.addEventListener('click', () => addNewoverlay());

/**
 * Reads all documents out of IndexedDB and renders them to the UI
 */
async function renderChartList() {
    overlayList.innerHTML = '';

    try {
        // 1. Get the list of all stored keys
        const chartNames = await storage.getAllChartConfigNames();

        if (chartNames.length === 0) {
            overlayList.innerHTML = '<li class="loading-state">No overlays created yet. Click above to add your first Overlay.</li>';
            return;
        }

        // 2. Build rows for each record
        for (const name of chartNames) {
            // Fetch object directly to inspect the actual binary Blob payload length
            const transaction = storage.db.transaction(['chart_configs'], 'readonly');
            console.log(transaction)
            const store = transaction.objectStore('chart_configs');

            store.get(name).onsuccess = (event) => {
                const record = event.target.result;
                if (!record) return;


                createChartRow(record.pdf_name, record.configId);
            };
        }
    } catch (err) {
        showStatus('Error pulling saved chart configurations.', 'error');
    }
}

/**
 * Compiles a list row with metadata indicators and custom button listeners
 */
function createChartRow(name, configId) {
    const li = document.createElement('li');
    li.className = 'overlay-item';

    li.innerHTML = `
        <div class="overlay-info">
            <div class="overlay-name">${name}</div>
            <div class="overlay-meta">configId: <strong>${configId}</strong></div>
        </div>
        <div class="overlay-actions">
            <button class="btn action-btn edit-btn" data-action="overlay">Edit</button>
            <button class="btn action-btn delete-btn" data-action="delete">Delete</button>
        </div>
    `;

    // Map Button Direct Action Delegates
    li.querySelector('[data-action="overlay"]').addEventListener('click', () => {
        editOverlayAction(configId);
    });


    li.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (confirm(`Remove "${name}" from offline application storage?`)) {
            try {
                await storage.deleteChartConfig(configId);
                showStatus(`Successfully deleted ${name}`, 'success');
                await renderChartList();
            } catch (err) {
                showStatus('Could not clear overlay selection.', 'error');
            }
        }
    });

    overlayList.appendChild(li);
}


async function addNewoverlay() {


    window.location.href = './edit'
}


function editOverlayAction(configId) {
    window.location.href = `./edit/?configId=${encodeURIComponent(configId)}`;
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