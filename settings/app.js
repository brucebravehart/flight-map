document.addEventListener('DOMContentLoaded', () => {
    const updateBtn = document.getElementById('update-btn');
    const updateStatus = document.getElementById('update-status');

    let registrationWithUpdate = null;

    // Helper to UI transition into "Update Ready" state
    function showUpdateAvailable(reg) {
        registrationWithUpdate = reg;
        updateStatus.textContent = "New files are downloaded and queued.";
        updateBtn.textContent = "Update App";
        updateBtn.disabled = false;
    }

    // 1. Monitor the PWA registration for updates automatically on load
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (!reg) return;

            // Case A: There is already a worker waiting in the background
            if (reg.waiting) {
                showUpdateAvailable(reg);
            }

            // Case B: A new worker is currently downloading/installing
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New files completely cached and ready
                        showUpdateAvailable(reg);
                    }
                });
            });
        });

        // 2. Listen for the controlling service worker changing (restarting app)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }

    // 3. Button Click Logic
    updateBtn.addEventListener('click', async () => {
        // State A: Button is in "Check for Update" mode
        if (!registrationWithUpdate) {
            updateStatus.textContent = "Checking for new files...";
            updateBtn.disabled = true;

            if ('serviceWorker' in navigator) {
                try {
                    const reg = await navigator.serviceWorker.getRegistration();
                    if (reg) {
                        // Force the service worker to fetch the server's manifest/sw file
                        await reg.update();

                        // Give it a brief moment to check state. If no update found:
                        setTimeout(() => {
                            if (!reg.waiting && !reg.installing) {
                                updateStatus.textContent = "Your app is up to date.";
                                updateBtn.disabled = false;
                            }
                        }, 1000);
                    } else {
                        updateStatus.textContent = "PWA is not currently active.";
                        updateBtn.disabled = false;
                    }
                } catch (err) {
                    console.error("Update check failed:", err);
                    updateStatus.textContent = "Error checking for updates.";
                    updateBtn.disabled = false;
                }
            } else {
                updateStatus.textContent = "PWA features not supported in this browser.";
                updateBtn.disabled = false;
            }

            // State B: Button is in "Update App" mode (files are ready)
        } else {
            const confirmUpdate = confirm("Would you like to apply the updates and restart the application now?");

            if (confirmUpdate) {
                updateStatus.textContent = "Applying updates and restarting...";
                updateBtn.disabled = true;

                // Send the skip waiting signal to the background worker
                if (registrationWithUpdate.waiting) {
                    registrationWithUpdate.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            }
        }
    });
});