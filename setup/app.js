import { StorageManager } from './../storageManager.js';

const storage = new StorageManager();
await storage.init();

// State Management Engine
const setupState = {
    identityValid: false,
    locationValid: false
};

// DOM Node Cache
const elements = {
    username: document.getElementById('username'),
    stepIdentity: document.getElementById('step-identity'),
    btnLocation: document.getElementById('btn-location'),
    stepLocation: document.getElementById('step-location'),
    btnFinish: document.getElementById('btn-finish'),
    pdfInput: document.getElementById('setup-pdf-input'),
    chartList: document.getElementById('chart-list'),
    stepCharts: document.getElementById('step-charts')
};
let uploadedChartNames = [];

// 1. Monitor Input Event (Callsign Setup)
elements.username.addEventListener('input', () => {
    const value = elements.username.value.trim();

    if (value.length >= 3 && !setupState.identityValid) {
        setupState.identityValid = true;
        elements.stepIdentity.classList.add('completed');
        evalGlobalState();
    } else if (value.length < 3 && setupState.identityValid) {
        setupState.identityValid = false;
        elements.stepIdentity.classList.remove('completed');
        evalGlobalState();
    }
});

// 2. Hardware Access Authorization (Location Setup)
elements.btnLocation.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(
        () => {
            setupState.locationValid = true;
            elements.btnLocation.disabled = true;
            elements.btnLocation.textContent = "Telemetry Link Active";
            elements.stepLocation.classList.add('completed');
            evalGlobalState();
        },
        (error) => {
            console.warn("Hardware Access Refused:", error);
            alert("Permission failed. Location tracking is required for live telemetry maps.");
        },
        { enableHighAccuracy: true }
    );
});

elements.pdfInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    // Clear previous items in list array
    uploadedChartNames = [];
    elements.chartList.innerHTML = "";

    // Append each filename to the display UI list
    for (let i = 0; i < files.length; i++) {
        uploadedChartNames.push(files[i].name);

        const li = document.createElement('li');
        li.textContent = `📄 ${files[i].name}`;
        li.style.marginTop = "4px";
        elements.chartList.appendChild(li);
    }



    elements.stepCharts.classList.add('completed');
});

// 3. Evaluate Step Compliance Matrix
function evalGlobalState() {
    if (setupState.identityValid && setupState.locationValid) {
        elements.btnFinish.disabled = false;
    } else {
        elements.btnFinish.disabled = false;
    }
}

// 4. State Flash Writing and Safe Application Handoff
elements.btnFinish.addEventListener('click', async () => {

    // Convert FileList → Array so we can loop cleanly
    const files = [...elements.pdfInput.files];

    // Await each save operation
    for (const file of files) {
        await storage.savePDF(file.name, file);
    }

    // Write configurations to non-volatile LocalStorage
    localStorage.setItem('flighttrack_setup_complete', 'true');
    localStorage.setItem('flighttrack_username', elements.username.value.trim());

    // Pull out of setup folder and move back to main index application root
    window.location.replace('./../index.html');
});