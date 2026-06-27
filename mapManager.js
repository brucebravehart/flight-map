import { StorageManager } from './storageManager.js';

export class MapManager {
    constructor(containerId, storage) {
        this.map = new maplibregl.Map({
            container: containerId,
            style: 'https://tiles.openfreemap.org/styles/bright',
            center: [8.541, 47.374], // Zurich
            zoom: 1,
            maxTileCacheSize: 50
        });

        this.aircraftCoordinates = [8.541, 47.374];
        this.aircraftHeading = 0;
        this.iconConfig = {
            color: '#00ff00',
            size: 30,
            shape: 'plane'
        };

        this.storage = storage
        this.sourceId = 'aircraft-source';
        this.layerId = 'aircraft-layer';
        this.imageId = 'aircraft-icon';

        // Set up the temporary canvas helper
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = 64;
        this.canvasElement.height = 64;

        const initializeFeatures = () => {
            this._initAircraftLayer();
            this._loadOverlays();
        };

        if (this.map.loaded()) {
            // If cache made it load instantly, run it immediately
            initializeFeatures();
        } else {
            // Otherwise wait for the thread event
            this.map.on('load', initializeFeatures);
        }
    }

    _initAircraftLayer() {
        // 1. Generate the icon graphic on our canvas
        this._drawAircraftIcon();

        // 2. EXTRACT THE IMAGE DATA (Fixes the WebGL hanging/deadlock)
        const ctx = this.canvasElement.getContext('2d');
        // Read the exact 64x64 pixel square boundaries out of canvas RAM
        const imgData = ctx.getImageData(0, 0, 64, 64);

        // Pass the raw pixel data array instead of the canvas element container
        if (this.map.hasImage(this.imageId)) {
            this.map.removeImage(this.imageId); // Prevent collision crashes if re-initializing
        }
        this.map.addImage(this.imageId, imgData);

        // 3. Create a clean GeoJSON Point source for the aircraft tracking
        this.map.addSource(this.sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: this.aircraftCoordinates
                    },
                    properties: {
                        heading: this.aircraftHeading
                    }
                }]
            }
        });

        // 4. Create a Symbol layer that anchors the icon and handles rotation
        this.map.addLayer({
            id: this.layerId,
            type: 'symbol',
            source: this.sourceId,
            layout: {
                'icon-image': this.imageId,
                'icon-size': 1,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                // Tell MapLibre to rotate the icon based on our GeoJSON feature's property
                'icon-rotate': ['get', 'heading'],
                'icon-rotation-alignment': 'map' // Keeps heading aligned with True North
            }
        });
    }

    _drawAircraftIcon() {
        const ctx = this.canvasElement.getContext('2d');
        ctx.clearRect(0, 0, 64, 64);
        ctx.save();
        ctx.translate(32, 32);

        // Note: Removed context rotation here because MapLibre's symbol layer 
        // will handle rotation via the 'icon-rotate' property dynamically.

        ctx.fillStyle = this.iconConfig.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        if (this.iconConfig.shape === 'plane') {
            ctx.beginPath();
            ctx.moveTo(0, -25);  // Nose
            ctx.lineTo(5, -10);  // Cockpit
            ctx.lineTo(25, 5);   // Right Wing Tip
            ctx.lineTo(5, 5);    // Trailing Wing Edge
            ctx.lineTo(5, 20);   // Tail Fuselage
            ctx.lineTo(15, 25);  // Right Elevator
            ctx.lineTo(0, 22);   // Tail Cone
            ctx.lineTo(-15, 25); // Left Elevator
            ctx.lineTo(-5, 20);  // Left Tail Fuselage
            ctx.lineTo(-5, 5);   // Left Trailing Wing
            ctx.lineTo(-25, 5);  // Left Wing Tip
            ctx.lineTo(-5, -10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(0, -25);
            ctx.lineTo(20, 15);
            ctx.lineTo(0, 5);
            ctx.lineTo(-20, 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    // High performance UI update loop
    updateAircraft(lng, lat, heading) {
        const source = this.map.getSource(this.sourceId);
        if (!source) return;

        this.aircraftCoordinates = [lng, lat];
        this.aircraftHeading = heading;

        // Efficiently update just the data without forcing redraws of the underlying layout
        source.setData({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: this.aircraftCoordinates
                },
                properties: {
                    heading: this.aircraftHeading
                }
            }]
        });
    }

    setAircraftStyle(shape, color) {
        this.iconConfig.shape = shape;
        this.iconConfig.color = color;

        // Redraw the canvas
        this._drawAircraftIcon();

        // Update the internal image reference texture inside MapLibre
        if (this.map.hasImage(this.imageId)) {
            this.map.updateImage(this.imageId, this.canvasElement);
        }
    }

    async _loadOverlays() {


        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';



        for (const name of await this.storage.getAllChartConfigNames()) {
            const item = await this.storage.getChartConfig(name)
            try {


                // 1. Calculate the 4 outer corner GPS coordinates from center, scale, and rotation
                const finalCoordinates = this._calculateBoundingBox(item.center, item.scale, item.orientation);

                // 2. Fetch the raw PDF Blob using the filename primary key
                const pdfBlob = await this.storage.getPDF(item.pdf_name);
                if (!pdfBlob) {
                    console.warn(`⚠️ Skipping static overlay: "${item.pdf_name}" not found in local IndexedDB archive.`);
                    continue;
                }

                // 3. Process PDF vectors into a raster image string completely offline
                const arrayBuffer = await pdfBlob.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const viewport = page.getViewport({ scale: 2.0 }); // High-res render scale

                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                const imageSrcUrl = canvas.toDataURL('image/png');

                // 4. Inject into the MapLibre engine layers
                const safeId = item.pdf_name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                const sourceId = `src-${safeId}`;
                const layerId = `lyr-${safeId}`;

                this.map.addSource(sourceId, {
                    type: 'image',
                    url: imageSrcUrl,
                    coordinates: finalCoordinates
                });

                this.map.addLayer({
                    id: layerId,
                    type: 'raster',
                    source: sourceId,
                    paint: {
                        'raster-opacity': 0.70 // Slight transparency to keep background terrain visible
                    }
                });

                console.log(`✅ Loaded static overlay layer for: ${item.pdf_name}`);

            } catch (overlayError) {
                console.error(`❌ Failed processing overlay sequence for ${item.pdf_name}:`, overlayError);
            }
        }

    }

    _calculateBoundingBox(center, scale, orientationDegrees) {
        const [cx, cy] = center;
        const rad = (orientationDegrees * Math.PI) / 180;

        // Define unrotated local offset extents relative to center
        const localCorners = [
            [-scale, scale], // Top-Left
            [scale, scale], // Top-Right
            [scale, -scale], // Bottom-Right
            [-scale, -scale]  // Bottom-Left
        ];

        // Apply 2D Rotation Matrix transformations onto geographic plane
        return localCorners.map(([lx, ly]) => {
            const rotatedX = lx * Math.cos(rad) - ly * Math.sin(rad);
            const rotatedY = lx * Math.sin(rad) + ly * Math.cos(rad);

            // Approximate coordinate adjustment scaling for latitude squish
            const latCorrection = Math.cos((cy * Math.PI) / 180);

            return [
                cx + (rotatedX / latCorrection),
                cy + rotatedY
            ];
        });
    }


}




