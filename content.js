/**
 * This content script runs on every page load.
 * It checks for saved instructions for the current site and applies them.
 */
(async function() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySavedInstructions);
    } else {
        applySavedInstructions();
    }

    /**
     * Retrieves and applies all saved instructions for the current website's hostname.
     */
    async function applySavedInstructions() {
        try {
            const { hostname } = window.location;
            const data = await chrome.storage.local.get(hostname);

            if (data[hostname] && Array.isArray(data[hostname])) {
                console.log(`Morpheus: Applying ${data[hostname].length} saved instruction(s) for ${hostname}.`);
                for (const item of data[hostname]) {
                    if (item.instructions) {
                        executeInstructions(item.instructions);
                    }
                }
            }
        } catch (error) {
            console.error("Morpheus (Content Script) Error:", error);
        }
    }

    /**
     * Executes a set of style instructions on the page.
     * @param {object} instructions - An object like { actions: [{ selector, style }] }.
     */
    function executeInstructions(instructions) {
        try {
            if (instructions && instructions.actions) {
                instructions.actions.forEach(action => {
                    const elements = document.querySelectorAll(action.selector);
                    elements.forEach(el => {
                        Object.assign(el.style, action.style);
                    });
                });
            }
        } catch (e) {
            console.error("Error executing stored Morpheus instructions:", e);
        }
    }
})();
