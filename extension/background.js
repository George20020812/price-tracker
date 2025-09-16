// Listen for messages from content scripts and popup
// Listen for messages from content scripts and popup
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "popup-port") {
        console.log("Popup connected.");
        port.onMessage.addListener((message) => {
            if (message.action === "disablePopup") {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id) {
                        chrome.action.disable(tabs[0].id);
                    }
                });
            } else if (message.action === "enablePopup") {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id) {
                        chrome.action.enable(tabs[0].id);
                    }
                });
            }
        });
        port.onDisconnect.addListener(() => {
            console.log("Popup disconnected.");
            // Optionally re-enable popup when disconnected if it was disabled
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.action.enable(tabs[0].id);
                }
            });
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request, 'from sender:', sender); // DEBUG

    if (sender.tab) {
        // Message is from a content script (sender.tab exists)
        if (request.action === "selectorSelected") {
            // Store the picked selector in session storage
            chrome.storage.session.set({ pickedSelector: { type: request.type, selector: request.selector, value: request.value } }, () => {
                // Re-enable popup
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id) {
                        chrome.action.enable(tabs[0].id);
                        // No need to open popup explicitly, popup.js will handle it on load
                    }
                });
            });
            // Forward the message to the popup script
            chrome.runtime.sendMessage(request);
        }
    } else {
        // Message is from the popup (sender.tab does not exist, or sender.id is the extension ID)
        if (request.action === "getProductInfo") {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    const tabId = tabs[0].id;
                    // Forward the request to the content script to get the URL
                    chrome.tabs.sendMessage(tabId, { action: "getProductInfo" }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("Error sending message to content script (getProductInfo):", chrome.runtime.lastError.message);
                            sendResponse(null);
                            return;
                        }
                        console.log('Response from content script (getProductInfo):', response);
                        sendResponse(response);
                    });
                } else {
                    console.error('Background script: No active tab found to forward message to.');
                    sendResponse({ error: 'No active tab found.' });
                }
            });
            return true; // Indicate that sendResponse will be called asynchronously
        } else if (request.action === "activatePickerMode") {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "activatePickerMode", type: request.type }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("Error sending message to content script (activatePickerMode):", chrome.runtime.lastError.message);
                            sendResponse(null);
                            // Re-enable popup if error
                            chrome.action.enable(tabs[0].id);
                            return;
                        }
                        console.log('Response from content script (activatePickerMode):', response);
                        sendResponse(response);
                    });
                } else {
                    sendResponse(null);
                }
            });
            return true; // Indicate that sendResponse will be called asynchronously
        } else if (request.action === "getProductInfoWithSelectors") {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    const tabId = tabs[0].id;
                    chrome.tabs.sendMessage(tabId, { 
                        action: "getProductInfoWithSelectors", 
                        nameSelector: request.nameSelector, 
                        priceSelector: request.priceSelector 
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("Error sending message to content script (getProductInfoWithSelectors):", chrome.runtime.lastError.message);
                            sendResponse(null);
                            return;
                        }
                        console.log('Response from content script (getProductInfoWithSelectors):', response);
                        sendResponse(response);
                    });
                } else {
                    sendResponse(null);
                }
            });
            return true; // Indicate that sendResponse will be called asynchronously
        }
    }
});
