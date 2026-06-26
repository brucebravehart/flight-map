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
    btnFinish: document.getElementById('btn-finish')
};

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

// 3. Evaluate Step Compliance Matrix
function evalGlobalState() {
    if (setupState.identityValid && setupState.locationValid) {
        elements.btnFinish.disabled = false;
    } else {
        elements.btnFinish.disabled = true;
    }
}

// 4. State Flash Writing and Safe Application Handoff
elements.btnFinish.addEventListener('click', () => {
    // Write configurations to non-volatile LocalStorage
    localStorage.setItem('flighttrack_setup_complete', 'true');
    localStorage.setItem('flighttrack_username', elements.username.value.trim());

    // Pull out of setup folder and move back to main index application root
    window.location.replace('../index.html');
});