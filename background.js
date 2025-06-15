// This is the background service worker for the extension.

// Listens for messages from the popup script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle a command to apply new styles
    if (request.command) {
        (async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) {
                    sendResponse({ status: "No active tab found." });
                    return;
                }

                // Generate a JSON instruction set from the user's command.
                const instructions = await generateInstructionsFromCommand(request.command, tab.url);

                if (instructions && instructions.actions) {
                    // Execute the instructions on the active tab.
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: executeInstructions,
                        args: [instructions]
                    });
                    
                    // Save the successful instructions for this website.
                    await saveInstructionsForSite(tab.url, request.command, instructions);
                    sendResponse({ status: "Morpheus has reshaped the web." });
                } else {
                    sendResponse({ status: instructions.status || "Could not generate command. Try rephrasing." });
                }
            } catch (error) {
                console.error("Morpheus Error:", error);
                sendResponse({ status: `An error occurred: ${error.message}` });
            }
        })();
        return true; // Indicate async response.
    }

    // Handle a request to revert all changes for the current site
    if (request.action === 'revert') {
        (async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab || !tab.url) {
                    sendResponse({ status: "No active tab found." });
                    return;
                }
                const { hostname } = new URL(tab.url);

                // Remove the saved settings for the site
                await chrome.storage.local.remove(hostname);
                
                // Reload the page to clear any injected styles
                await chrome.tabs.reload(tab.id);

                sendResponse({ status: `Effects for ${hostname} reverted.`});

            } catch (error) {
                console.error("Morpheus Revert Error:", error);
                sendResponse({ status: `An error occurred during revert: ${error.message}`});
            }
        })();
        return true; // Indicate async response.
    }
});

/**
 * Executes a set of style instructions on the page. This is injected.
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
        console.error("Error executing Morpheus instructions:", e);
    }
}

/**
 * Saves the command and the generated instructions for a specific site.
 * @param {string} url - The URL of the site.
 * @param {string} command - The user's natural language command.
 * @param {object} instructions - The generated JSON instructions.
 */
async function saveInstructionsForSite(url, command, instructions) {
    try {
        const { hostname } = new URL(url);
        const data = await chrome.storage.local.get(hostname);
        const siteData = data[hostname] || [];
        
        if (!siteData.some(c => c.command === command)) {
            siteData.push({ command, instructions });
            await chrome.storage.local.set({ [hostname]: siteData });
        }
    } catch (e) {
        console.log(`Could not save settings for URL: ${url}`);
    }
}

/**
 * Uses the Gemini API to convert a command into a JSON object of instructions.
 * @param {string} command - The natural language command.
 * @param {string} url - The URL of the page for context.
 * @returns {Promise<object>} - A promise that resolves to the instructions object or an error object.
 */
async function generateInstructionsFromCommand(command, url) {
    const { apiKey } = await chrome.storage.sync.get('apiKey');
    if (!apiKey) {
        return { status: "API Key not found. Please set it in the extension options." };
    }

    const prompt = `
        You are an expert web developer AI. Your task is to convert a user's natural language command into a JSON object that describes DOM style manipulations.
        RULES:
        1.  The output MUST be ONLY a valid JSON object. No explanations, no markdown, no comments, just the JSON.
        2.  The JSON object must have a single key "actions", which is an array of action objects.
        3.  Each action object must have a "selector" key (a CSS selector string) and a "style" key (an object of CSS properties in camelCase format, with string values).
        4.  Be smart about selectors. For page-wide changes, select multiple relevant tags to ensure the style is applied broadly.

        EXAMPLES:
        User Command: "make the background dark gray and the text light gray"
        Your Output:
        {
          "actions": [
            { "selector": "body", "style": { "backgroundColor": "#333" } },
            { "selector": "p, h1, h2, h3, a, span, div, li, td, th, main, section, article, header, footer, strong, em", "style": { "color": "#ccc", "backgroundColor": "transparent" } }
          ]
        }

        User Command: "hide every image on this page"
        Your Output:
        { "actions": [ { "selector": "img, figure, [style*='background-image']", "style": { "display": "none" } } ] }
        
        User Command: "add a 2px solid red border to all divs"
        Your Output:
        { "actions": [ { "selector": "div", "style": { "border": "2px solid red" } } ] }
        ---
        Now, process the following command for the website: ${url}
        User Command: "${command}"
    `;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 403) return { status: "Permission denied. Check API key." };
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const result = await response.json();
        const rawText = result.candidates[0]?.content?.parts[0]?.text || '{}';
        
        // ** FIX **: Clean up the response to remove markdown and control characters before parsing.
        const cleanedText = rawText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .replace(/[\n\r\t]/g, '') // Remove newlines, carriage returns, and tabs
            .trim();
            
        return JSON.parse(cleanedText);

    } catch (error) {
        console.error('Error calling or parsing Gemini API:', error);
        return { status: "Error processing AI response. Check console." };
    }
}
