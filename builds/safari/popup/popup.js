// src/popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
  const activeModelName = document.getElementById('active-model-name');
  const btnToggleIsland = document.getElementById('btn-toggle-island');
  const btnToggleSize = document.getElementById('btn-toggle-size');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const kbdToggle = document.getElementById('kbd-toggle');
  const kbdResize = document.getElementById('kbd-resize');

  // Load state and apply theme
  chrome.storage.local.get({
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    hotkeyToggle: 'Alt+Shift+S',
    hotkeyResize: 'Alt+Shift+Z',
    theme: 'dark',
    accentColor: '#2563eb'
  }, (data) => {
    activeModelName.textContent = `${data.provider.toUpperCase()} (${data.model})`;
    kbdToggle.textContent = data.hotkeyToggle;
    kbdResize.textContent = data.hotkeyResize;

    // Apply theme
    if (data.theme === 'light') {
      document.body.classList.add('theme-light');
    }
    document.documentElement.style.setProperty('--popup-accent', data.accentColor || '#2563eb');
  });

  function sendToActiveTab(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action }).catch(() => {
          alert('Не удалось открыть островок на этой системной вкладке. Перейдите на любой веб-сайт.');
        });
      }
    });
  }

  btnToggleIsland.addEventListener('click', () => {
    sendToActiveTab('toggle-island');
    window.close();
  });

  btnToggleSize.addEventListener('click', () => {
    sendToActiveTab('toggle-size');
    window.close();
  });

  btnOpenOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
});
