import { MapManager } from './mapManager.js';
import { StorageManager } from './storageManager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Modules
    const mapUI = new MapManager('map');
    const storage = new StorageManager();
    await storage.init();

    // 2. Customizing icons on demand
    let currentStyle = 'plane';
    document.getElementById('btn-toggle-icon').addEventListener('click', () => {
        currentStyle = currentStyle === 'plane' ? 'arrow' : 'plane';
        const color = currentStyle === 'plane' ? '#00ff00' : '#ff00ff';
        mapUI.setAircraftStyle(currentStyle, color);
    });

    // 3. Handling PDF File Upload Pipeline
    document.getElementById('file-input').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Save binary payload to offline DB
            await storage.savePDF(file.name, file);
            console.log(`Successfully stored ${file.name} to device local memory.`);

            // To fetch later and parse into PDF.js:
            // const pdfBlob = await storage.getPDF(file.name);
            // const blobUrl = URL.createObjectURL(pdfBlob);

        } catch (error) {
            console.error(error);
        }
    });

    // 4. Low-Overhead GPS Tracking Simulation Loop
    // Simulates an aircraft track vector walking Northwest
    let lng = -122.4194;
    let lat = 37.7749;
    let heading = 315;

    setInterval(() => {
        if ('geolocation' in navigator) {
            const geoOptions = {
                enableHighAccuracy: true, // Forces iPad to use internal GPS chip rather than Wi-Fi triangulation
                maximumAge: 0,            // Do not use cached positions
                timeout: 5000             // Timeout if GPS drops out for 5 seconds
            };

            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    lat = position.coords.latitude;
                    lng = position.coords.longitude;

                    // iOS Hardware Core Optimization Note (See Section 2 below)
                    heading = position.coords.heading;
                    if (heading === null || isNaN(heading)) {
                        heading = 0; // Fallback default if device is stationary
                    }

                    console.log(`GPS Update: Lat ${lat}, Lng ${lng}, Heading ${heading}°`);

                    // Inject the true hardware coordinates directly into your MapManager loop
                    mapUI.updateAircraft(lng, lat, heading);
                },
                (error) => {
                    console.error(`Error code (${error.code}): ${error.message}`);
                },
                geoOptions
            );
        } else {
            alert("Geolocation hardware is not supported or restricted on this iPad.");
        }
    }, 1000);
});