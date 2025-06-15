document.addEventListener('DOMContentLoaded', function () {
  const commandInput = document.getElementById('command-input');
  const applyButton = document.getElementById('apply-button');
  const speechToTextButton = document.getElementById('speech-to-text');
  const responseDiv = document.getElementById('response');

  // Function to handle sending the command
  const applyCommand = () => {
      const command = commandInput.value.trim();
      if (command) {
          responseDiv.textContent = 'Processing...';
          applyButton.disabled = true;

          // Send command to the background script
          chrome.runtime.sendMessage({ command: command }, (response) => {
              if (chrome.runtime.lastError) {
                  responseDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
              } else {
                  responseDiv.textContent = response.status;
              }
              applyButton.disabled = false;
          });
      } else {
          responseDiv.textContent = 'Please enter a command.';
      }
  };

  // Event listener for the apply button
  applyButton.addEventListener('click', applyCommand);

  // Event listener for pressing Enter in the textarea
  commandInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          applyCommand();
      }
  });

  // --- Speech to Text Functionality ---
  if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      speechToTextButton.addEventListener('click', () => {
          recognition.start();
          speechToTextButton.classList.add('text-red-500');
          responseDiv.textContent = 'Listening...';
      });

      recognition.onresult = (event) => {
          const speechResult = event.results[0][0].transcript;
          commandInput.value = speechResult;
          responseDiv.textContent = 'Command captured. Click "Apply Magic".';
      };

      recognition.onspeechend = () => {
          recognition.stop();
          speechToTextButton.classList.remove('text-red-500');
           responseDiv.textContent = '';
      };

      recognition.onerror = (event) => {
          speechToTextButton.classList.remove('text-red-500');
          responseDiv.textContent = 'Error recognizing speech: ' + event.error;
      };

  } else {
      speechToTextButton.style.display = 'none';
      responseDiv.textContent = 'Speech recognition not supported.';
  }
});
