// src/popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
  const activeModelName = document.getElementById('active-model-name');
  const btnToggleIsland = document.getElementById('btn-toggle-island');
  const btnToggleSize = document.getElementById('btn-toggle-size');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const kbdToggle = document.getElementById('kbd-toggle');
  const kbdResize = document.getElementById('kbd-resize');

  // Load active state from storage
  chrome.storage.local.get({
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    hotkeyToggle: 'Alt+Shift+S',
    hotkeyResize: 'Alt+Shift+Z'
  }, (data) => {
    activeModelName.textContent = `${data.provider.toUpperCase()} (${data.model})`;
    kbdToggle.textContent = data.hotkeyToggle;
    kbdResize.textContent = data.hotkeyResize;
  });

  // Helper to send message to active tab
  function sendToActiveTab(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action }).catch(() => {
          alert('Не удалось открыть островок на этой странице (системные страницы браузера защищены). Откройте обычный сайт.');
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
