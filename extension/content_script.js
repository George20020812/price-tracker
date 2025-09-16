console.log("FB Price Tracker content script loaded!");

let pickerMode = false;
let currentHighlightedElement = null;
let selectedSelectorType = null; // 'name' or 'price'

function highlightElement(event) {
    if (pickerMode && event.target) {
        if (currentHighlightedElement) {
            currentHighlightedElement.style.outline = '';
        }
        currentHighlightedElement = event.target;
        currentHighlightedElement.style.outline = '2px solid blue';
        // console.log('Highlighting:', currentHighlightedElement); // DEBUG
    }
}

function unhighlightElement(event) {
    if (pickerMode && currentHighlightedElement) {
        currentHighlightedElement.style.outline = '';
        currentHighlightedElement = null;
    }
}

function getCssSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) {
        // console.log('getCssSelector: Invalid element', el); // DEBUG
        return null;
    }

    const path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();
        if (current.id) {
            selector += '#' + current.id;
            path.unshift(selector);
            break; // ID is unique, stop here
        } else {
            let classNames = Array.from(current.classList).filter(c => c !== 'highlight-picker').join('.');
            if (classNames) {
                selector += '.' + classNames;
            }
            
            // Check if selector is unique among siblings
            let siblings = Array.from(current.parentNode.children).filter(child => child.nodeName.toLowerCase() === current.nodeName.toLowerCase());
            if (siblings.length > 1) {
                let nth = Array.from(current.parentNode.children).indexOf(current) + 1;
                selector += `:nth-child(${nth})`;
            }
        }
        path.unshift(selector);
        current = current.parentNode;
    }
    const fullSelector = path.join(' > ');
    // console.log('Generated Selector:', fullSelector, 'for element:', el); // DEBUG
    return fullSelector;
}


function selectElement(event) {
    if (pickerMode && event.target) {
        event.preventDefault(); // Prevent default click action
        event.stopPropagation(); // Stop propagation to avoid triggering other handlers
        // console.log('selectElement fired for:', event.target); // DEBUG

        const selector = getCssSelector(event.target);
        if (selector) {
            // console.log('Sending message (to background): selectorSelected', selector); // DEBUG
            // Send message to background script
            chrome.runtime.sendMessage({
                action: "selectorSelected",
                type: selectedSelectorType,
                selector: selector,
                value: event.target.innerText.trim()
            });
        } else {
            console.warn('No selector generated for element:', event.target); // DEBUG
        }
        exitPickerMode();
    }
}

function enterPickerMode(type) {
    pickerMode = true;
    selectedSelectorType = type;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mouseover', highlightElement);
    document.addEventListener('mouseout', unhighlightElement);
    document.addEventListener('click', selectElement, true); // Use capture phase

    console.log('Picker mode entered for type:', type); // DEBUG
}

function exitPickerMode() {
    pickerMode = false;
    selectedSelectorType = null;
    document.body.style.cursor = 'default';
    if (currentHighlightedElement) {
        currentHighlightedElement.style.outline = '';
        currentHighlightedElement = null;
    }
    document.removeEventListener('mouseover', highlightElement);
    document.removeEventListener('mouseout', unhighlightElement);
    document.removeEventListener('click', selectElement, true);

    console.log('Picker mode exited.'); // DEBUG
}

// Listen for messages from background script (forwarded from popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message (from background):', request); // DEBUG
    if (request.action === "getProductInfo") {
        console.log('Content script handling getProductInfo (URL only)...'); // DEBUG
        const url = window.location.href;
        sendResponse({ url: url });
        return true; // Indicate that sendResponse will be called asynchronously
    } else if (request.action === "activatePickerMode") {
        console.log('Content script handling activatePickerMode...'); // DEBUG
        enterPickerMode(request.type);
        sendResponse({ status: "picker mode activated" });
    } else if (request.action === "getProductInfoWithSelectors") {
        console.log('Content script handling getProductInfoWithSelectors...'); // DEBUG
        const url = window.location.href;
        let name = null;
        let price = null;

        if (request.nameSelector && request.priceSelector) {
            const nameElement = document.querySelector(request.nameSelector);
            const priceElement = document.querySelector(request.priceSelector);

            if (nameElement) {
                name = nameElement.innerText.trim();
            } else {
                console.warn('Name element not found with selector:', request.nameSelector);
            }

            if (priceElement) {
                const priceText = priceElement.innerText.trim();
                const numericPrice = parseFloat(priceText.replace(/[^\d.]/g, ''));
                if (!isNaN(numericPrice)) {
                    price = numericPrice.toFixed(2);
                } else {
                    console.warn('Could not parse price from text:', priceText);
                }
            } else {
                console.warn('Price element not found with selector:', request.priceSelector);
            }
        }
        sendResponse({ name: name, price: price, url: url });
        return true; // Indicate that sendResponse will be called asynchronously
    }
});