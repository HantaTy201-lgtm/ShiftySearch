// src/background/background.js
// Background Service Worker for ShiftySearch

import { sendAiRequest } from '../api/ai-client.js';

chrome.runtime.onInstalled.addListener(() => {
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

// Port-based stream bridge: Executes AI requests in background worker to bypass page CORS & CSP
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'shifty-stream') {
    const abortController = new AbortController();

    port.onDisconnect.addListener(() => {
      abortController.abort();
    });

    port.onMessage.addListener(async (msg) => {
      if (msg.action === 'send') {
        try {
          await sendAiRequest({
            ...msg.payload,
            signal: abortController.signal,
            onChunk: (chunk, accumulated) => {
              try {
                port.postMessage({ type: 'chunk', chunk, accumulated });
              } catch (e) {}
            },
            onDone: (finalText) => {
              try {
                port.postMessage({ type: 'done', finalText });
              } catch (e) {}
            },
            onError: (err) => {
              try {
                port.postMessage({ type: 'error', error: err.message || 'Ошибка запроса' });
              } catch (e) {}
            }
          });
        } catch (err) {
          try {
            port.postMessage({ type: 'error', error: err.message || 'Ошибка запроса' });
          } catch (e) {}
        }
      }
    });
  }
});
