export class MapManager {
    constructor(containerId) {
        this.map = new maplibregl.Map({
            container: containerId,
            style: 'https://tiles.openfreemap.org/styles/bright',
            center: [8.541, 47.374], // Zurich
            zoom: 14,
            maxTileCacheSize: 50
        });

        this.aircraftCoordinates = [8.541, 47.374];
        this.aircraftHeading = 0;
        this.iconConfig = {
            color: '#00ff00',
            size: 30,
            shape: 'plane'
        };

        this.sourceId = 'aircraft-source';
        this.layerId = 'aircraft-layer';
        this.imageId = 'aircraft-icon';

        // Set up the temporary canvas helper
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = 64;
        this.canvasElement.height = 64;

        this.map.on('load', () => this._initAircraftLayer());
    }

    _initAircraftLayer() {
        // 1. Generate the icon graphic on our canvas
        this._drawAircraftIcon();

        // 2. Add the canvas as a re-usable map image asset
        this.map.addImage(this.imageId, this.canvasElement);

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
}