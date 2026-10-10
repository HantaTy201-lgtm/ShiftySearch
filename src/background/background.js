// src/background/background.js
// Background Service Worker for ShiftySearch

chrome.runtime.onInstalled.addListener(() => {
  // Create Context Menu item for selected text
  chrome.contextMenus.create({
    id: 'shifty-search-selection',
    title: '🔍 Спросить у ShiftySearch (AI)',
    contexts: ['selection']
  });

  console.log('ShiftySearch extension installed successfully.');
});

// Context Menu Click Handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'shifty-search-selection' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'ask-selection',
      text: info.selectionText
    }).catch(err => {
      // Content script may not be injected on restricted pages (e.g. chrome://)
      console.warn('Could not send message to active tab:', err);
    });
  }
});

// Browser Commands (Global Shortcuts)
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0 || !tabs[0].id) return;
    const tabId = tabs[0].id;

    if (command === 'toggle-island') {
      chrome.tabs.sendMessage(tabId, { action: 'toggle-island' }).catch(() => {});
    } else if (command === 'toggle-size') {
      chrome.tabs.sendMessage(tabId, { action: 'toggle-size' }).catch(() => {});
    }
  });
});

// Message listener from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ status: 'ok' });
  }
});
