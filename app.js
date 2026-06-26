import { MapManager } from './mapManager.js';
import { StorageManager } from './storageManager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Modules
    const mapUI = new MapManager('map');
    const storage = new StorageManager();
    await storage.init();

    // UI Selector Caches
    const btnTogglePanel = document.getElementById('btn-toggle-panel');
    const notesPanel = document.getElementById('notes-panel');
    const menuToggleBtn = document.getElementById('btn-menu-toggle');
    const menuCloseBtn = document.getElementById('btn-menu-close');
    const navDrawer = document.getElementById('nav-drawer');

    // Manage Toggle Action for the Note Section Expansion Matrix
    btnTogglePanel.addEventListener('click', () => {
        const isCollapsed = notesPanel.classList.toggle('collapsed');

        if (isCollapsed) {
            btnTogglePanel.textContent = "▲ Show Notes";
        } else {
            btnTogglePanel.textContent = "▼ Hide Notes";
        } setTimeout(() => {
            map.resize();
        }, 320);
    });

    menuToggleBtn.addEventListener('click', () => {
        navDrawer.classList.add('open');
    });

    menuCloseBtn.addEventListener('click', () => {
        navDrawer.classList.remove('open');
    });

    // Structural placeholders for arrow behaviors
    document.getElementById('nav-prev').addEventListener('click', () => console.log('Previous Track Action'));
    document.getElementById('nav-next').addEventListener('click', () => console.log('Next Track Action'));


    // 4. Low-Overhead GPS Tracking Simulation Loop
    // Simulates an aircraft track vector walking Northwest
    let lng = 47.374;
    let lat = 8.541;
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