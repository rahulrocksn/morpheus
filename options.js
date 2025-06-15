document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const saveButton = document.getElementById('save-button');
    const statusMessage = document.getElementById('status-message');

    // Load any previously saved API key
    chrome.storage.sync.get('apiKey', (data) => {
        if (data.apiKey) {
            apiKeyInput.value = data.apiKey;
        }
    });

    // Save the new API key
    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.sync.set({ apiKey: apiKey }, () => {
                statusMessage.textContent = 'API Key saved successfully!';
                statusMessage.classList.remove('text-red-500');
                statusMessage.classList.add('text-green-400');
                setTimeout(() => {
                    statusMessage.textContent = '';
                }, 3000);
            });
        } else {
            statusMessage.textContent = 'Please enter an API key.';
            statusMessage.classList.remove('text-green-400');
            statusMessage.classList.add('text-red-500');
        }
    });
});
