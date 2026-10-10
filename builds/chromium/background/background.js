(() => {
  // src/background/background.js
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "shifty-search-selection",
      title: "\u{1F50D} \u0421\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0443 ShiftySearch (AI)",
      contexts: ["selection"]
    });
    console.log("ShiftySearch extension installed successfully.");
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "shifty-search-selection" && tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: "ask-selection",
        text: info.selectionText
      }).catch((err) => {
        console.warn("Could not send message to active tab:", err);
      });
    }
  });
  chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) return;
      const tabId = tabs[0].id;
      if (command === "toggle-island") {
        chrome.tabs.sendMessage(tabId, { action: "toggle-island" }).catch(() => {
        });
      } else if (command === "toggle-size") {
        chrome.tabs.sendMessage(tabId, { action: "toggle-size" }).catch(() => {
        });
      }
    });
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openOptions") {
      chrome.runtime.openOptionsPage();
      sendResponse({ status: "ok" });
    }
  });
})();
