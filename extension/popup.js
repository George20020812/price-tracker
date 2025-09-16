// --- DOM Element References ---
const appContainer = document.getElementById('app-container');
const header = document.getElementById('header');
const viewTitle = document.getElementById('viewTitle');
const backBtn = document.getElementById('backBtn');
const viewListBtn = document.getElementById('viewListBtn');
const addBtn = document.getElementById('addBtn');

const viewAdd = document.getElementById('view-add');
const postUrlDisplay = document.getElementById('postUrlDisplay');
const trackBtn = document.getElementById('trackBtn');

// New elements for multi-item input
const newItemNameInput = document.getElementById('newItemNameInput');
const newItemPriceInput = document.getElementById('newItemPriceInput');
const addToListBtn = document.getElementById('addToListBtn');
const itemsToTrackList = document.getElementById('itemsToTrackList');

// Selector Picker elements
const productNameSelectorInput = document.getElementById('productNameSelector');
const productPriceSelectorInput = document.getElementById('productPriceSelector');
const selectNameBtn = document.getElementById('selectNameBtn');
const selectPriceBtn = document.getElementById('selectPriceBtn');
const clearNameSelectorBtn = document.getElementById('clearNameSelectorBtn');
const clearPriceSelectorBtn = document.getElementById('clearPriceSelectorBtn');
const loadSelectedBtn = document.getElementById('loadSelectedBtn');
const trackSelectedBtn = document.getElementById('trackSelectedBtn');

const viewList = document.getElementById('view-list');
const trackedItemsList = document.getElementById('trackedItemsList');

const viewDetail = document.getElementById('view-detail');
const detailItemName = document.getElementById('detailItemName');
const detailCurrentPrice = document.getElementById('detailCurrentPrice');
const detailPostUrl = document.getElementById('detailPostUrl');
const priceChartCanvas = document.getElementById('priceChart');
const deleteItemBtn = document.getElementById('deleteItemBtn');

const messageArea = document.getElementById('messageArea');

// --- Global State ---
let currentView = 'add'; // 'add', 'list', 'detail'
let previousView = '';
let currentItemId = null; // For detail view
let allTrackedItems = []; // Cache for list view
let priceChartInstance = null; // Chart.js instance
let itemsToTrack = []; // Array to hold items before tracking the post
let currentPageUrl = ''; // To store the URL of the current active tab
let storedNameSelector = null;
let storedPriceSelector = null;
let backgroundPort = null;

const API_BASE_URL = 'http://127.0.0.1:5001/api';

// --- Utility Functions ---
function formatUrlForDisplay(url) {
    let displayUrl = url.replace(/^https?:\/\//, ''); // 移除 http:// 或 https://
    if (displayUrl.length <= 40) { // 如果網址夠短，直接顯示
        return displayUrl;
    }
    const start = displayUrl.substring(0, 20); // 取前面20個字元
    const end = displayUrl.substring(displayUrl.length - 15); // 取後面15個字元
    return `${start}...${end}`;
}
function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
    currentView = viewId.replace('view-', '');

    // Update header buttons visibility
    backBtn.classList.add('hidden');
    viewListBtn.classList.add('hidden');
    addBtn.classList.add('hidden');

    if (currentView === 'add') {
        viewTitle.textContent = '追蹤新商品';
        viewListBtn.classList.remove('hidden');
    } else if (currentView === 'list') {
        viewTitle.textContent = '我的追蹤';
        backBtn.classList.remove('hidden'); // Back to add view
        addBtn.classList.remove('hidden'); // Option to add from list
    } else if (currentView === 'detail') {
        viewTitle.textContent = '商品詳情';
        backBtn.classList.remove('hidden'); // Back to list view
    }
}

function showMessage(type, message) {
    messageArea.textContent = message;
    messageArea.className = ''; // Clear previous classes
    messageArea.classList.add('message-area');
    if (type === 'success') {
        messageArea.classList.add('success');
    } else if (type === 'error') {
        messageArea.classList.add('error');
    } else if (type === 'info') {
        messageArea.classList.add('info');
    }
    messageArea.classList.remove('hidden');
    setTimeout(() => {
        messageArea.classList.add('hidden');
    }, 3000);
}

async function fetchApi(endpoint, method = 'GET', body = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Network response was not ok');
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showMessage('error', `操作失敗: ${error.message}`);
        throw error; // Re-throw to allow calling functions to handle
    }
}

// --- Selector Picker Functions ---
function loadStoredSelectors() {
    chrome.storage.local.get(['productNameSelector', 'productPriceSelector'], (result) => {
        storedNameSelector = result.productNameSelector || null;
        storedPriceSelector = result.productPriceSelector || null; 
        productNameSelectorInput.value = storedNameSelector || '';
        productPriceSelectorInput.value = storedPriceSelector || '';
        console.log('Loaded selectors:', storedNameSelector, storedPriceSelector); // DEBUG
    });
}

function activatePickerMode(type) {
    if (backgroundPort) {
        backgroundPort.postMessage({ action: "disablePopup" });
    } else {
        console.error("Background port not established.");
        showMessage('error', '無法與背景服務通訊，請重新載入擴充功能。');
        if (backgroundPort) {
            backgroundPort.postMessage({ action: "enablePopup" });
        }
    }

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0] && tabs[0].id) {
            const tabId = tabs[0].id;

            try {
                // Dynamically inject content_script.js
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content_script.js']
                });
                console.log('content_script.js injected successfully.');

                // Now send message to the injected script
                const response = await chrome.tabs.sendMessage(tabId, { action: "activatePickerMode", type: type });

                if (chrome.runtime.lastError) {
                    console.error("Error sending message to content script (activatePickerMode):", chrome.runtime.lastError.message);
                    showMessage('error', `無法啟動選擇模式: ${chrome.runtime.lastError.message}`);
                    if (backgroundPort) {
                        backgroundPort.postMessage({ action: "enablePopup" });
                    }
                    return;
                }
                console.log('Picker activation response from content script:', response);

            } catch (error) {
                console.error("Error injecting content script or sending message:", error);
                showMessage('error', `無法啟動選擇模式: ${error.message}. 請確保您在一個可訪問的網頁上。`);
                if (backgroundPort) {
                    backgroundPort.postMessage({ action: "enablePopup" });
                }
            }
        } else {
            showMessage('error', '沒有活動中的分頁來啟動選擇模式。');
            if (backgroundPort) {
                backgroundPort.postMessage({ action: "enablePopup" });
            }
        }
    });
}

function saveSelector(type, selector) {
    if (type === 'name') {
        chrome.storage.local.set({ productNameSelector: selector }, () => {
            storedNameSelector = selector;
            productNameSelectorInput.value = selector;
            showMessage('success', '商品名稱選擇器已儲存！');
        });
    } else if (type === 'price') {
        chrome.storage.local.set({ productPriceSelector: selector }, () => {
            storedPriceSelector = selector;
            productPriceSelectorInput.value = selector;
            showMessage('success', '商品價格選擇器已儲存！');
        });
    }
}

function clearSelector(type) {
    if (type === 'name') {
        chrome.storage.local.remove('productNameSelector', () => {
            storedNameSelector = null;
            productNameSelectorInput.value = '';
            showMessage('success', '商品名稱選擇器已清除！');
        });
    } else if (type === 'price') {
        chrome.storage.local.remove('productPriceSelector', () => {
            storedPriceSelector = null;
            productPriceSelectorInput.value = '';
            showMessage('success', '商品價格選擇器已清除！');
        });
    }
}

async function loadSelectedProductInfo() {
    if (!storedNameSelector || !storedPriceSelector) {
        showMessage('info', '請先設定商品名稱和價格選擇器。');
        return;
    }

    // Send message to background script, which forwards to content script
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0] && tabs[0].id) {
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                action: "getProductInfoWithSelectors",
                nameSelector: storedNameSelector,
                priceSelector: storedPriceSelector
            });

            if (chrome.runtime.lastError) {
                console.error("Error sending message to content script (getProductInfoWithSelectors):", chrome.runtime.lastError.message);
                showMessage('error', `自動讀取失敗: ${chrome.runtime.lastError.message}`);
                return;
            }

            if (response && response.name && response.price) {
                newItemNameInput.value = response.name;
                newItemPriceInput.value = response.price;
                showMessage('success', '已載入選取商品資訊。');
            } else {
                showMessage('error', '無法從選取器中讀取商品資訊，請檢查選擇器是否正確或網頁結構是否改變。');
            }
        } else {
            showMessage('error', '沒有活動中的分頁來載入商品資訊。');
        }
    });
}

// --- Multi-item tracking functions ---
function renderItemsToTrack() {
    itemsToTrackList.innerHTML = '';
    if (itemsToTrack.length === 0) {
        itemsToTrackList.innerHTML = '<li class="empty-message">尚未添加任何商品。</li>';
        trackBtn.disabled = true; // Disable track button if no items
        return;
    }

    itemsToTrack.forEach((item, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'item-to-track';
        listItem.innerHTML = `
            <div class="item-name">${item.name}</div>
            <div class="item-price">${item.price}</div>
            <button class="remove-item-btn" data-index="${index}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
            </button>
        `;
        itemsToTrackList.appendChild(listItem);
    });
    trackBtn.disabled = false; // Enable track button if items exist

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const index = parseInt(event.currentTarget.dataset.index);
            removeItemFromList(index);
        });
    });
}

function addItemToList() {
    const name = newItemNameInput.value.trim();
    const price = parseFloat(newItemPriceInput.value);

    if (!name || isNaN(price) || price <= 0) {
        showMessage('error', '請輸入有效的商品名稱和價格。');
        return;
    }

    itemsToTrack.push({ name, price });
    newItemNameInput.value = '';
    newItemPriceInput.value = '';
    renderItemsToTrack();
    showMessage('success', '商品已添加到列表。');
}

function removeItemFromList(index) {
    itemsToTrack.splice(index, 1);
    renderItemsToTrack();
    showMessage('info', '商品已從列表中移除。');
}

// --- View Loaders ---
async function loadAddView() {
    showView('view-add');
    previousView = ''; // No back from add view initially
    itemsToTrack = []; // Clear items when entering add view
    renderItemsToTrack(); // Render empty list
    loadStoredSelectors(); // Load selectors for picker

    // Get current page URL
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0] && tabs[0].url) {
            currentPageUrl = tabs[0].url;
            postUrlDisplay.textContent = formatUrlForDisplay(currentPageUrl);
        } else {
            currentPageUrl = '無法獲取當前頁面URL';
            postUrlDisplay.textContent = currentPageUrl;
            showMessage('error', '無法獲取當前頁面URL。');
        }
    });
}

async function loadListView() {
    showView('view-list');
    previousView = currentView; // Set previous view for back button
    trackedItemsList.innerHTML = '<li class="loading-message">載入中...</li>';

    try {
        allTrackedItems = await fetchApi('/items');
        trackedItemsList.innerHTML = ''; // Clear loading message

        if (allTrackedItems.length === 0) {
            trackedItemsList.innerHTML = '<li class="empty-message">尚未追蹤任何商品。</li>';
            return;
        }

        allTrackedItems.forEach(item => {
            const listItem = document.createElement('li');
            listItem.dataset.itemId = item.id;
            listItem.innerHTML = `
                <div class="item-name">${item.itemName}</div>
                <div class="item-price">當前價格: ${item.currentPrice}</div>
            `;
            listItem.addEventListener('click', () => loadDetailView(item.id));
            trackedItemsList.appendChild(listItem);
        });
    } catch (error) {
        trackedItemsList.innerHTML = '<li class="empty-message">載入商品列表失敗。</li>';
    }
}

async function loadDetailView(itemId) {
    showView('view-detail');
    previousView = currentView; // Set previous view for back button
    currentItemId = itemId;

    detailItemName.textContent = '載入中...';
    detailCurrentPrice.textContent = '';
    detailPostUrl.href = '#';
    detailPostUrl.textContent = '載入中...';

    try {
        const item = allTrackedItems.find(i => i.id === itemId);
        if (!item) {
            throw new Error('Item not found in cache.');
        }

        detailItemName.textContent = item.itemName;
        detailCurrentPrice.textContent = `NT$ ${item.currentPrice}`;
        detailPostUrl.href = item.postUrl;
        detailPostUrl.textContent = formatUrlForDisplay(item.postUrl);

        const history = await fetchApi(`/items/${itemId}/history`);
        renderPriceChart(history);

    } catch (error) {
        showMessage('error', `載入商品詳情失敗: ${error.message}`);
        detailItemName.textContent = '載入失敗';
        detailPostUrl.textContent = '';
    }
}

function renderPriceChart(history) {
    if (priceChartInstance) {
        priceChartInstance.destroy(); // Destroy previous chart instance
    }

    const labels = history.map(entry => {
        const date = new Date(entry.timestamp);
        return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }); // 只顯示月份和日期
    });
    const data = history.map(entry => entry.price);

    priceChartInstance = new Chart(priceChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '價格趨勢',
                data: data,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '時間'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '價格'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// --- Event Listeners ---
backBtn.addEventListener('click', () => {
    if (currentView === 'list') {
        loadAddView();
    } else if (currentView === 'detail') {
        loadListView();
    }
});

viewListBtn.addEventListener('click', () => {
    loadListView();
});

addBtn.addEventListener('click', () => {
    loadAddView();
});

addToListBtn.addEventListener('click', addItemToList); // New event listener

selectNameBtn.addEventListener('click', () => activatePickerMode('name'));
selectPriceBtn.addEventListener('click', () => activatePickerMode('price'));
clearNameSelectorBtn.addEventListener('click', () => clearSelector('name'));
clearPriceSelectorBtn.addEventListener('click', () => clearSelector('price'));
loadSelectedBtn.addEventListener('click', loadSelectedProductInfo);
trackSelectedBtn.addEventListener('click', async () => {
    // Use the same tracking logic as the main trackBtn
    // First, load the selected product info into the input fields
    await loadSelectedProductInfo();

    // Then, add it to the itemsToTrack list
    const name = newItemNameInput.value.trim();
    const price = parseFloat(newItemPriceInput.value);

    if (!name || isNaN(price) || price <= 0) {
        showMessage('error', '無法追蹤選取商品：請確認商品名稱和價格已正確載入。');
        return;
    }
    
    // Clear existing itemsToTrack and add the loaded item
    itemsToTrack = [{ name, price }];
    renderItemsToTrack();

    // Trigger the main tracking logic
    trackBtn.click();
});

// Listen for messages from background script (forwarded from content script)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Popup received message (from background):', request);
    if (request.action === "selectorSelected") {
        saveSelector(request.type, request.selector);
        // Clear the session storage after processing
        chrome.storage.session.remove('pickedSelector');
    }
});

trackBtn.addEventListener('click', async () => {
    if (itemsToTrack.length === 0) {
        showMessage('error', '請先添加至少一個商品到列表中。');
        return;
    }

    if (!currentPageUrl || currentPageUrl === '無法獲取當前頁面URL') {
        showMessage('error', '無法追蹤：無法獲取當前頁面URL。');
        return;
    }

    try {
        // Send all items in one go to the backend
        await fetchApi('/items', 'POST', {
            postUrl: currentPageUrl,
            items: itemsToTrack // Send an array of items
        });
        showMessage('success', `成功追蹤 ${itemsToTrack.length} 個商品！`);
        itemsToTrack = []; // Clear the list after successful tracking
        renderItemsToTrack();
        // Optionally switch to list view after tracking
        // loadListView();
    } catch (error) {
        // Error already shown by fetchApi
    }
});

deleteItemBtn.addEventListener('click', async () => {
    if (!currentItemId) return;

    if (confirm('確定要刪除此商品的所有追蹤紀錄嗎？')) {
        try {
            await fetchApi(`/items/${currentItemId}`, 'DELETE');
            showMessage('success', '商品刪除成功！');
            loadListView(); // Go back to list after deletion
        } catch (error) {
            // Error already shown by fetchApi
        }
    }
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Check if there's a pending selector from a previous picker session
    const result = await chrome.storage.session.get(['pickedSelector']);
    if (result.pickedSelector) {
        const { type, selector } = result.pickedSelector;
        saveSelector(type, selector);
        // Clear the session storage after processing
        chrome.storage.session.remove('pickedSelector');
    }

    // Establish connection to background script
    backgroundPort = chrome.runtime.connect({ name: "popup-port" });
    backgroundPort.onDisconnect.addListener(() => {
        console.log("Popup port disconnected.");
        backgroundPort = null;
    });

    loadAddView(); // Load the add view normally
});