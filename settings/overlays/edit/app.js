import { StorageManager } from './../../../storageManager.js';

const storage = new StorageManager();
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Parse query options out of active environment location string parameters
const urlParams = new URLSearchParams(window.location.search);
let targetConfigId = urlParams.get('configId');
let targetPdfName = urlParams.get('pdf');

// Core Spatial Variables
let baseCenter = [0, 0];
let currentScale = 0.015;
let currentRotation = 0;
let isLayerRendered = false;

const SOURCE_ID = 'overlay-preview-source';
const LAYER_ID = 'overlay-preview-layer';

// Interface Selectors
const pdfSelector = document.getElementById('pdf-selector');
const pdfDropdownContainer = document.getElementById('pdf-dropdown-container');
const sliderScale = document.getElementById('slider-scale');
const sliderRotate = document.getElementById('slider-rotate');

// Initialize MapLibre Engine Instance
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: [8.541, 47.374], // Zurich
    zoom: 1,
    maxTileCacheSize: 50
});

map.on('load', async () => {
    await storage.init();

    // Generate configId if missing from incoming params
    if (!targetConfigId) {
        targetConfigId = `cfg-${Date.now()}`;
        console.log(`Generated explicit config ID token tracking slot: ${targetConfigId}`);
    }

    // Try loading config if one was passed
    await loadExistingConfigData();

    // Populate drop-down list from IndexedDB names
    await populatePdfSelectorDropdown();

    if (targetPdfName) {
        // Hide dropdown panel space if target was locked from URL parameter routes
        pdfDropdownContainer.style.display = 'none';
        document.getElementById('target-pdf-display').textContent = `Document: ${targetPdfName}`;
        initializeOverlayDisplay();
    } else {
        document.getElementById('target-pdf-display').textContent = "Awaiting document selection...";
    }

    // Capture dragging and movement to reposition the overlay
    map.on('move', () => {
        if (!isLayerRendered) return;

        const mapCenter = map.getCenter();
        baseCenter = [mapCenter.lng, mapCenter.lat];

        const updatedCorners = computeActiveCorners();
        const source = map.getSource(SOURCE_ID);
        if (source) {
            source.setCoordinates(updatedCorners);
        }
    });
});

/**
 * Checks database records to pre-fill layout positions if editing an existing overlay
 */
async function loadExistingConfigData() {
    if (!urlParams.get('configId')) return;

    try {
        // Query database via transactions safely to find targeted configuration record blocks
        const tx = storage.db.transaction(['chart_configs'], 'readonly');
        const store = tx.objectStore('chart_configs');

        return new Promise((resolve) => {
            const req = store.get(targetConfigId);
            req.onsuccess = () => {
                const config = req.result;
                if (config) {
                    targetPdfName = config.pdf_name;
                    baseCenter = config.center;
                    currentScale = config.scale;
                    currentRotation = config.orientation;

                    // Sync parameters onto physical UI controller states
                    sliderScale.value = currentScale;
                    sliderRotate.value = currentRotation;

                    document.getElementById('val-scale').textContent = currentScale.toFixed(4);
                    document.getElementById('val-rotate').textContent = `${currentRotation.toFixed(1)}°`;

                    // Center layout immediately over the saved coordinates
                    map.jumpTo({ center: baseCenter, zoom: 12 });
                }
                resolve();
            };
            req.onerror = () => resolve();
        });
    } catch (err) {
        console.warn("Could not find configuration matching targetConfigId identifier key string.", err);
    }
}

/**
 * Builds the drop-down elements
 */
async function populatePdfSelectorDropdown() {
    try {
        const fileNames = await storage.getAllPDFNames();
        fileNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            if (name === targetPdfName) {
                option.selected = true;
            }
            pdfSelector.appendChild(option);
        });

        // Add context selection monitor hooks
        pdfSelector.addEventListener('change', (e) => {
            targetPdfName = e.target.value;
            if (targetPdfName) {
                document.getElementById('target-pdf-display').textContent = `Document: ${targetPdfName}`;

                // Set alignment frame onto current map view space center 
                const currentCenter = map.getCenter();
                baseCenter = [currentCenter.lng, currentCenter.lat];
                map.setZoom(12);

                initializeOverlayDisplay();
            } else {
                clearActiveMapOverlays();
            }
        });
    } catch (err) {
        console.error("Error building dashboard drop-down selectors:", err);
    }
}

/**
 * Compiles the selected PDF into an image stream matrix
 */
async function initializeOverlayDisplay() {
    if (!targetPdfName) return;

    try {
        clearActiveMapOverlays();

        const blob = await storage.getPDF(targetPdfName);
        if (!blob) throw new Error("Target document binary block payload not present within local database storage partitions.");

        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        const imageSrcUrl = canvas.toDataURL('image/png');

        // If baseCenter is uninitialized [0, 0], read center position coordinates out of view matrix context bounds
        if (baseCenter[0] === 0 && baseCenter[1] === 0) {
            const currentCenter = map.getCenter();
            baseCenter = [currentCenter.lng, currentCenter.lat];
            map.jumpTo({ center: baseCenter, zoom: 12 });
        }

        const initialCorners = computeActiveCorners();

        map.addSource(SOURCE_ID, {
            type: 'image',
            url: imageSrcUrl,
            coordinates: initialCorners
        });

        map.addLayer({
            id: LAYER_ID,
            type: 'raster',
            source: SOURCE_ID,
            paint: { 'raster-opacity': 0.4 }
        });

        isLayerRendered = true;
        setupSliderChangeListeners();

    } catch (err) {
        console.error(err);
        alert("Pipeline parsing validation failure occurred during vector extraction phases.");
    }
}

/**
 * Listens to size scales and rotational structural inputs
 */
function setupSliderChangeListeners() {
    const updatePipeline = () => {
        currentScale = parseFloat(sliderScale.value);
        currentRotation = parseFloat(sliderRotate.value);

        document.getElementById('val-scale').textContent = currentScale.toFixed(4);
        document.getElementById('val-rotate').textContent = `${currentRotation.toFixed(1)}°`;

        const updatedCorners = computeActiveCorners();
        const source = map.getSource(SOURCE_ID);
        if (source) {
            source.setCoordinates(updatedCorners);
        }
    };

    sliderScale.addEventListener('input', updatePipeline);
    sliderRotate.addEventListener('input', updatePipeline);
}

/**
 * Standard Coordinate Georeference Corner Calculator
 */
function computeActiveCorners() {
    const rad = (currentRotation * Math.PI) / 180;
    const localCorners = [
        [-currentScale, currentScale], // Top-Left
        [currentScale, currentScale], // Top-Right
        [currentScale, -currentScale], // Bottom-Right
        [-currentScale, -currentScale]  // Bottom-Left
    ];

    const latCorrection = Math.cos((baseCenter[1] * Math.PI) / 180);

    return localCorners.map(([lx, ly]) => {
        const rotatedX = lx * Math.cos(rad) - ly * Math.sin(rad);
        const rotatedY = lx * Math.sin(rad) + ly * Math.cos(rad);
        return [
            baseCenter[0] + (rotatedX / latCorrection),
            baseCenter[1] + rotatedY
        ];
    });
}

function clearActiveMapOverlays() {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    isLayerRendered = false;
}

// Persist the parameters to IndexedDB
document.getElementById('save-config-btn').addEventListener('click', async () => {
    if (!targetPdfName) {
        alert("Please select a target PDF chart document to complete the map configuration update.");
        return;
    }

    const configRecord = {
        configId: targetConfigId, // Keeps matching ID string if modifying an existing profile entry
        pdf_name: targetPdfName,
        center: [baseCenter[0], baseCenter[1]],
        scale: currentScale,
        orientation: currentRotation
    };

    try {
        await storage.saveChartConfig(configRecord);

        window.location.href = '../';
    } catch (err) {
        alert("Failed to write map positioning layout tracking configurations back to IndexedDB system data streams.");
    }
});