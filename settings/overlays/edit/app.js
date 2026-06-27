import { StorageManager } from './../../../storageManager.js';

const storage = new StorageManager();
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 1. Extract Target Filename from URL params
const urlParams = new URLSearchParams(window.location.search);
const targetPdfName = urlParams.get('pdf');

// State Variables for Matrix Calculations
let baseCenter = [0, 0]; // Map center point used as calibration anchor
let currentScale = 0.015;
let currentRotation = 0;
let shiftLat = 0;
let shiftLng = 0;

const SOURCE_ID = 'overlay-preview-source';
const LAYER_ID = 'overlay-preview-layer';

// UI DOM references
const sliderScale = document.getElementById('slider-scale');
const sliderRotate = document.getElementById('slider-rotate');
const sliderLat = document.getElementById('slider-lat');
const sliderLng = document.getElementById('slider-lng');

// Initialize MapLibre
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json', // Replace with your standard style config
    center: [0, 0],
    zoom: 2
});

map.on('load', async () => {
    if (!targetPdfName) {
        alert("No chart target file specified for calibration.");
        return;
    }
    document.getElementById('target-pdf-display').textContent = targetPdfName;

    // Set base reference position to center screen map coordinates
    const mapCenter = map.getCenter();
    baseCenter = [mapCenter.lng, mapCenter.lat];

    await storage.init();
    await initializeImageOverlayPipeline();
});

/**
 * Builds the PDF bitmap texture string and initializes Maplibre layers
 */
async function initializeImageOverlayPipeline() {
    try {
        const blob = await storage.getPDF(targetPdfName);
        if (!blob) throw new Error("Document structure completely missing from local device memory store.");

        // Convert Blob into canvas image data URL string
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

        // Move map viewport focal scope directly onto calibration anchor point
        map.jumpTo({ center: baseCenter, zoom: 12 });

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
            paint: { 'raster-opacity': 0.75 }
        });

        // Register range input interactive event listeners
        setupSliderChangeListeners();

    } catch (err) {
        console.error(err);
        alert("Failed to render overlay target asset canvas vector stream.");
    }
}

/**
 * Attaches real-time listeners to range fields
 */
function setupSliderChangeListeners() {
    const updatePipeline = () => {
        currentScale = parseFloat(sliderScale.value);
        currentRotation = parseFloat(sliderRotate.value);
        shiftLat = parseFloat(sliderLat.value);
        shiftLng = parseFloat(sliderLng.value);

        // Update Text labels
        document.getElementById('val-scale').textContent = currentScale.toFixed(4);
        document.getElementById('val-rotate').textContent = `${currentRotation.toFixed(1)}°`;
        document.getElementById('val-lat').textContent = shiftLat.toFixed(4);
        document.getElementById('val-lng').textContent = shiftLng.toFixed(4);

        // Re-compute bounding corners and apply directly to map matrix
        const updatedCorners = computeActiveCorners();
        const source = map.getSource(SOURCE_ID);
        if (source) {
            source.setCoordinates(updatedCorners); // Warps map on the fly without blinking
        }
    };

    sliderScale.addEventListener('input', updatePipeline);
    sliderRotate.addEventListener('input', updatePipeline);
    sliderLat.addEventListener('input', updatePipeline);
    sliderLng.addEventListener('input', updatePipeline);
}

/**
 * Computes bounding coordinate matrices using base layout anchors + shifts
 */
function computeActiveCorners() {
    // Add real-time user sliding offsets to original center reference points
    const finalCenterLng = baseCenter[0] + shiftLng;
    const finalCenterLat = baseCenter[1] + shiftLat;

    const rad = (currentRotation * Math.PI) / 180;
    const localCorners = [
        [-currentScale, currentScale], // Top-Left
        [currentScale, currentScale], // Top-Right
        [currentScale, -currentScale], // Bottom-Right
        [-currentScale, -currentScale]  // Bottom-Left
    ];

    const latCorrection = Math.cos((finalCenterLat * Math.PI) / 180);

    return localCorners.map(([lx, ly]) => {
        const rotatedX = lx * Math.cos(rad) - ly * Math.sin(rad);
        const rotatedY = lx * Math.sin(rad) + ly * Math.cos(rad);
        return [
            finalCenterLng + (rotatedX / latCorrection),
            finalCenterLat + rotatedY
        ];
    });
}

// SAVE BUTTON LOGIC: Persist config parameters directly to IndexedDB Store
document.getElementById('save-config-btn').addEventListener('click', async () => {
    const finalCenterLng = baseCenter[0] + shiftLng;
    const finalCenterLat = baseCenter[1] + shiftLat;

    // Build unique alphanumeric key identifier string profile configuration record
    const configRecord = {
        configId: `cfg-${Date.now()}`,
        pdf_name: targetPdfName,
        center: [finalCenterLng, finalCenterLat],
        scale: currentScale,
        orientation: currentRotation
    };

    try {
        await storage.saveChartConfig(configRecord);
        alert(`Overlay profile saved for ${targetPdfName}! Returning to index...`);
        window.location.href = './index.html';
    } catch (err) {
        alert("Failed to commit settings configuration records to object store.");
    }
});