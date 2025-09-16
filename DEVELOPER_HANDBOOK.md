# 開發手冊 (Developer Handbook)

本手冊旨在為參與 `FB Price Tracker` 專案的開發人員提供全面的指南，涵蓋專案概覽、環境設定、開發流程、關鍵組件說明及故障排除等。

## 1. 專案概覽

`FB Price Tracker` 是一個用於追蹤 Facebook Marketplace 商品價格的應用程式。它由兩大部分組成：

-   **後端服務 (Backend Service):** 負責資料儲存、管理和 API 服務。
-   **瀏覽器擴充功能 (Browser Extension):** 作為前端介面，負責手動輸入商品資訊、與後端互動並展示追蹤結果。**本專案支援手動輸入商品資訊，並提供 Marketplace 頁面專用的元素選擇器模式。**

## 2. 環境設定

### 2.1. 後端設定

1.  **複製專案**
    ```bash
    git clone <your-repository-url>
    cd fb-price-tracker/backend
    ```

2.  **建立並啟用 Python 虛擬環境**
    -   Windows:
        ```bash
        python -m venv venv
        .\venv\Scripts\activate
        ```
    -   macOS/Linux:
        ```bash
        python3 -m venv venv
        source venv/bin/activate
        ```

3.  **安裝依賴套件**
    ```bash
    pip install Flask Flask-SQLAlchemy Flask-CORS
    # 建議將依賴寫入 requirements.txt 並使用 pip install -r requirements.txt
    ```

4.  **初始化資料庫 (僅需執行一次)**
    在啟用虛擬環境後，執行：
    ```bash
    flask init-db
    ```
    這將在 `backend` 資料夾中創建 `tracker.db` 檔案及所需的資料表。

5.  **啟動後端服務**
    ```bash
    # Windows 使用 start_backend.bat
    E:\priceRecord\fb-price-tracker\start_backend.bat
    # 或直接執行 Flask 命令
    flask run --host=127.0.0.1 --port=5001
    ```
    確保服務在 `http://127.0.0.1:5001` 運行。

### 2.2. 瀏覽器擴充功能設定

1.  **載入擴充功能** (以 Chrome/Edge 為例)：
    *   打開瀏覽器，在網址列輸入 `chrome://extensions`。
    *   **打開「開發人員模式」開關**。
    *   點擊「**載入未封裝項目**」按鈕。
    *   選擇 `fb-price-tracker/extension` 資料夾。
    *   載入成功後，擴充功能圖示會出現在瀏覽器工具列。

## 3. 專案結構

```
fb-price-tracker/
├── CHANGELOG.md
├── README.md
├── DEVELOPER_HANDBOOK.md (此文件)
├── start_backend.bat
├── backend/
│   ├── app.py              # Flask 應用主程式，包含 API 路由和資料庫模型
│   ├── tracker.db          # SQLite 資料庫檔案 (初始化後生成)
│   └── venv/               # Python 虛擬環境
└── extension/
    ├── background.js       # 擴充功能背景腳本，處理事件和訊息轉發
    ├── chart.min.js        # Chart.js 庫，用於繪製圖表
    ├── content_script.js   # 內容腳本，注入到網頁中獲取當前 URL 及支援元素選擇器模式
    ├── manifest.json       # 擴充功能配置檔
    ├── popup.css           # 彈出視窗樣式
    ├── popup.html          # 彈出視窗 HTML 結構
    ├── popup.js            # 彈出視窗邏輯，處理 UI 互動和 API 呼叫
    └── icons/              # 擴充功能圖示
```

## 4. 關鍵組件與概念

### 4.1. 後端 (`backend/app.py`)

-   **Flask 應用**: 輕量級 Python Web 框架。
-   **SQLAlchemy**: ORM (物件關係映射) 工具，用於與 SQLite 資料庫互動，定義了 `Post`, `TrackedItem`, `PriceHistory` 模型。
-   **API 端點**: 提供 RESTful API 供前端呼叫，例如 `/api/items` (POST/GET), `/api/items/<id>/history` (GET), `/api/items/<id>` (DELETE)。
    *   `POST /api/items` 現在支援在單一請求中追蹤多個商品。
-   **CORS**: `Flask-CORS` 允許跨域請求，確保瀏覽器擴充功能可以訪問後端 API。

### 4.2. 瀏覽器擴充功能 (`extension/`)

-   **Manifest V3**: 擴充功能基於 Manifest V3 標準開發。
-   **`manifest.json`**: 定義擴充功能的名稱、版本、權限 (`activeTab`, `host_permissions`)、背景腳本、內容腳本和彈出視窗。
-   **`background.js`**: 作為服務工作者 (Service Worker) 運行，負責監聽瀏覽器事件，並在 `popup.js` 和 `content_script.js` 之間轉發訊息，包括獲取 URL、啟動元素選擇器模式和處理選取的選擇器。
-   **`content_script.js`**: 注入到網頁中。它負責：
    *   獲取當前頁面的 URL。
    *   **啟用「元素選擇器模式」**：讓使用者手動選擇頁面元素 (例如商品名稱和價格)。
    *   根據儲存的 CSS 選擇器，從頁面提取商品名稱和價格 (用於「載入選取商品資訊」功能)。
    *   將提取的資料或選取的選擇器傳遞給 `background.js`。
-   **`popup.html`, `popup.css`, `popup.js`**: 構成擴充功能的彈出視窗介面。`popup.js` 處理所有 UI 互動，包括：
    *   獲取當前頁面 URL。
    *   提供輸入欄位供使用者手動輸入商品名稱和價格。
    *   允許使用者將多個商品添加到一個臨時列表。
    *   **提供元素選擇器功能**：允許使用者在 Marketplace 頁面手動點擊元素來獲取其 CSS 選擇器，並儲存這些選擇器。
    *   **「載入選取商品資訊」功能**：使用儲存的選擇器從當前頁面提取商品名稱和價格，並填充到手動輸入欄位中。
    *   將臨時列表中的所有商品連同當前頁面 URL 一起發送到後端 API 進行追蹤。
-   **訊息傳遞 (Message Passing)**: 擴充功能的不同部分 (popup, background, content script) 之間透過 `chrome.runtime.sendMessage` 和 `chrome.runtime.onMessage.addListener` 進行通訊。

### 4.3. 資料流 (Data Flow)

1.  使用者打開任何網頁，點擊擴充功能圖示。
2.  `popup.js` 啟動，向 `background.js` 發送 `getProductInfo` 請求以獲取當前頁面 URL。
3.  `background.js` 將請求轉發給 `content_script.js`。
4.  `content_script.js` 獲取 `window.location.href` 並回傳給 `background.js`。
5.  `background.js` 將 URL 轉發回 `popup.js`。
6.  `popup.js` 顯示當前頁面 URL。
7.  **元素選擇器模式 (Marketplace 專用)**：
    *   使用者點擊「選擇名稱」或「選擇價格」按鈕，`popup.js` 向 `background.js` 發送 `activatePickerMode` 請求。
    *   `background.js` 將請求轉發給 `content_script.js`，並暫時禁用彈出視窗。**同時，`content_script.js` 會在網頁上添加一個半透明遮罩，提供視覺提示。**
    *   `content_script.js` 進入選擇器模式，使用者點擊頁面元素。
    *   `content_script.js` 獲取選定元素的 CSS 選擇器和值，並將 `selectorSelected` 訊息發送給 `background.js`。**同時，`content_script.js` 會移除網頁上的半透明遮罩。**
    *   `background.js` 儲存選擇器到 `chrome.storage.local`，並將訊息轉發給 `popup.js`，同時重新啟用彈出視窗。
    *   `popup.js` 接收選取的選擇器，更新顯示並儲存。
    *   使用者可以點擊「載入選取商品資訊」按鈕，`popup.js` 會向 `background.js` 發送 `getProductInfoWithSelectors` 請求，其中包含儲存的選擇器。
    *   `background.js` 將請求轉發給 `content_script.js`。
    *   `content_script.js` 使用提供的選擇器從頁面提取商品名稱和價格，並回傳給 `background.js`。
    *   `background.js` 將結果轉發回 `popup.js`。
    *   `popup.js` 將提取的名稱和價格填充到手動輸入欄位中。
    *   **「追蹤選取商品」功能**：使用者可以點擊「追蹤選取商品」按鈕，這會嘗試使用儲存的選擇器載入商品資訊，並將其添加到當前貼文的追蹤列表中，然後立即觸發追蹤。
8.  **手動輸入與多品項追蹤**：
    *   使用者在「商品名稱」和「價格」輸入框中手動輸入商品資訊 (或使用「載入選取商品資訊」填充)。
    *   點擊「添加」按鈕將商品添加到臨時列表。可以重複此步驟添加多個商品。
    *   確認所有要追蹤的商品都已添加到列表後，點擊「追蹤此貼文中的所有商品」按鈕，`popup.js` 會將臨時列表中的所有商品連同當前頁面 URL 一起，作為一個陣列發送到後端 API (`POST /api/items`) 儲存。
9.  使用者也可以在 `popup.js` 中查看追蹤列表 (`GET /api/items`) 和商品詳情 (`GET /api/items/<id>/history`)。

## 5. 開發流程

### 5.1. 啟動開發環境

-   確保後端服務正在運行 (`start_backend.bat` 或 `flask run`)。
-   確保瀏覽器擴充功能已載入並啟用「開發人員模式」。

### 5.2. 程式碼修改與測試

-   **後端**: 修改 `app.py` 後，通常需要重啟 Flask 服務才能看到變更。對於資料庫模型變更，可能需要重新執行 `flask init-db` (這會清除現有資料，請謹慎)。
-   **前端 (擴充功能)**: 修改 `extension/` 資料夾下的任何檔案後，您需要在 `chrome://extensions` 頁面點擊擴充功能卡片上的「重新載入」按鈕來應用變更。

### 5.3. 變數更名最佳實踐

-   **優先使用 IDE 重構工具**：對於程式碼中的變數、函式名等，請始終使用 IDE (如 VS Code) 提供的「重新命名」功能。這能確保所有引用都被正確更新。
-   **全域搜尋與手動檢查**：對於可能出現在純文字檔案 (如 `.bat` 腳本、設定檔、文件) 或字串中的變數名，請使用全域搜尋功能 (例如 `Ctrl+Shift+F` 或 `search_file_content` 工具) 進行查找，並手動確認和修改。
-   **測試**：任何更名操作後，務必執行完整的測試，確保功能不受影響。

## 6. 故障排除

-   **擴充功能無法載入/運行**: 檢查 `manifest.json` 語法錯誤，確保「開發人員模式」已開啟，並嘗試重新載入擴充功能。
-   **後端無法啟動**: 檢查 Python 環境、依賴套件是否安裝，以及 Port 是否被佔用。
-   **擴充功能無法與後端通訊**: 檢查 `manifest.json` 中的 `host_permissions` 是否正確包含後端 URL (`http://127.0.0.1:5001/*`)，以及後端服務是否正在運行。
-   **元素選擇器無法正常工作**: 確保您在 Marketplace 頁面使用選擇器。如果網頁結構變更，儲存的選擇器可能失效，需要重新選取並儲存新的選擇器。
-   **資料庫問題**: 如果遇到資料庫錯誤，可以嘗試刪除 `tracker.db` 檔案並重新執行 `flask init-db` (這會清除所有追蹤資料)。
-   **錯誤訊息: `Error sending message to background (activatePickerMode): Could not establish connection. Receiving end does not exist.`**
    *   **原因**: 這個錯誤通常發生在瀏覽器擴充功能中，當 `popup.js` 嘗試向 `background.js` (服務工作者) 發送訊息時，如果 `background.js` 沒有在運行，或者沒有正確監聽訊息，就會出現這個錯誤。Manifest V3 的服務工作者是事件驅動的，它們會在閒置一段時間後被瀏覽器終止以節省資源。當 `popup.js` 嘗試發送訊息時，如果服務工作者恰好處於非活動狀態，就會出現「接收端不存在」的錯誤。
    *   **解決方案**: 
        1.  **確保 `background.js` 服務工作者在需要時保持活動**：雖然服務工作者會自動啟動以響應事件，但在某些情況下，`popup.js` 可能會在服務工作者尚未完全啟動時發送訊息。
        2.  **在 `popup.js` 中處理錯誤**：在發送訊息給 `background.js` 的地方，添加錯誤處理機制。例如，對於 `chrome.runtime.sendMessage`，可以檢查 `chrome.runtime.lastError`。如果發生錯誤，可以嘗試重新發送訊息，或者向使用者顯示錯誤訊息。
        3.  **重新載入擴充功能**：在開發過程中，如果遇到此錯誤，最簡單的解決方法是前往 `chrome://extensions` 頁面，找到您的擴充功能，然後點擊「重新載入」按鈕。這會強制重新啟動服務工作者。

## 7. 多品項追蹤資料格式 (POST /api/items)

當您透過 `POST /api/items` 端點追蹤一個貼文中的多個商品時，請求的 JSON 負載 (payload) 必須遵循以下嚴格格式：

```json
{
  "postUrl": "[當前頁面的完整 URL，例如：https://www.facebook.com/marketplace/item/1234567890]",
  "items": [
    {
      "name": "[商品名稱 1，字串]",
      "price": [商品價格 1，浮點數或整數，必須大於 0]
    },
    {
      "name": "[商品名稱 2，字串]",
      "price": [商品價格 2，浮點數或整數，必須大於 0]
    },
    // ... 更多商品物件
  ]
}
```

**格式要求細節：**

-   `postUrl` (字串): 必須提供，代表該批商品所屬的原始貼文或頁面連結。
-   `items` (陣列): 必須提供，且必須是一個非空的陣列。陣列中的每個元素都必須是一個物件，代表一個要追蹤的商品。
    -   每個商品物件必須包含：
        -   `name` (字串): 商品的名稱。必須提供。
        -   `price` (數字): 商品的價格。必須提供，且必須是有效的浮點數或整數，並且值必須大於 0。

**後端驗證：**

後端會對 `postUrl` 和 `items` 陣列的結構進行嚴格驗證。如果格式不符、`items` 陣列為空，或任何商品物件中的 `name` 或 `price` 無效，請求將會被拒絕並返回錯誤訊息。

## 8. 貢獻指南

歡迎對本專案做出貢獻！請遵循以下步驟：

1.  Fork 本專案。
2.  創建一個新的分支 (`git checkout -b feature/your-feature-name`)。
3.  進行您的修改。
4.  確保程式碼符合現有風格，並通過測試。
5.  提交您的變更 (`git commit -m 'feat: Add new feature'`)。
6.  推送到您的分支 (`git push origin feature/your-feature-name`)。
7.  創建一個 Pull Request。
