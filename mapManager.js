export class MapManager {
    constructor(containerId) {
        this.map = new maplibregl.Map({
            container: containerId,
            // Pass the OpenFreeMap style URL directly here
            style: 'https://tiles.openfreemap.org/styles/bright',
            center: [-122.4194, 37.7749], // San Francisco coordinates
            zoom: 14, // Zoom in closer to see houses, roads, and airport layouts
            maxTileCacheSize: 50 // Keep memory optimized for iOS Safari
        });
        this.aircraftCoordinates = [-122.4194, 37.7749];
        this.aircraftHeading = 0;
        this.iconConfig = {
            color: '#00ff00',
            size: 30,
            shape: 'plane' // 'plane' or 'arrow'
        };

        this.map.on('load', () => this._initAircraftLayer());
    }

    _initAircraftLayer() {
        // Create an invisible canvas to programmatically draw our dynamic aviation symbol
        this.canvasSourceId = 'aircraft-source';
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = 64;
        this.canvasElement.height = 64;
        this._drawAircraftIcon();

        // Register custom canvas source with MapLibre
        this.map.addSource(this.canvasSourceId, {
            type: 'canvas',
            canvas: this.canvasElement,
            coordinates: this._getSquareBounds(this.aircraftCoordinates, 0.01),
            animate: false
        });

        this.map.addLayer({
            id: 'aircraft-layer',
            type: 'raster',
            source: this.canvasSourceId
        });
    }

    // Redraws the dynamic icon canvas based on state
    _drawAircraftIcon() {
        const ctx = this.canvasElement.getContext('2d');
        ctx.clearRect(0, 0, 64, 64);
        ctx.save();
        ctx.translate(32, 32);
        ctx.rotate((this.aircraftHeading * Math.PI) / 180);

        ctx.fillStyle = this.iconConfig.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        if (this.iconConfig.shape === 'plane') {
            // Simple geometric Jet representation
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
            // General Aviation Style Arrow Track symbol
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
        if (!this.map.getSource(this.canvasSourceId)) return;

        this.aircraftCoordinates[0] = lng;
        this.aircraftCoordinates[1] = lat;
        this.aircraftHeading = heading;

        this._drawAircraftIcon();

        // Reposition the canvas footprint on the WebGL globe
        const newBounds = this._getSquareBounds(this.aircraftCoordinates, 0.01);
        this.map.getSource(this.canvasSourceId).setCoordinates(newBounds);
    }

    setAircraftStyle(shape, color) {
        this.iconConfig.shape = shape;
        this.iconConfig.color = color;
        this._drawAircraftIcon();
        // Force MapLibre to update the rendered source layer 
        this.updateAircraft(this.aircraftCoordinates[0], this.aircraftCoordinates[1], this.aircraftHeading);
    }

    // Helper math to ground canvas relative to GPS
    _getSquareBounds(center, size) {
        return [
            [center[0] - size, center[1] + size], // Top Left
            [center[0] + size, center[1] + size], // Top Right
            [center[0] + size, center[1] - size], // Bottom Right
            [center[0] - size, center[1] - size]  // Bottom Left
        ];
    }


}