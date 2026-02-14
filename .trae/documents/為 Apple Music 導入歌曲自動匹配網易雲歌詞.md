# 修復 Apple Music 導入後無歌詞的問題

目前 Apple Music 導入的歌曲只包含元數據（標題、藝人等），但由於沒有對應的網易雲音樂 ID（`songId`），系統不會自動抓取歌詞。

我將通過以下步驟修復此問題：

## 1. 新增歌曲搜索功能
在 `lib/netease-lyrics.ts` 中新增一個 `searchSong` 函數。
- 該函數將使用網易雲的搜索 API (`/cloudsearch`)。
- 根據「歌名 + 藝人名」進行搜索，並返回最匹配的網易雲歌曲 ID。

## 2. 修改批量導入邏輯
修改 `app/api/albums/batch/route.ts` 中的導入流程：
- 在處理每首歌曲時，檢查是否已有 `songId`。
- 如果沒有 `songId`（如 Apple Music 來源），則調用 `searchSong` 嘗試找到對應的網易雲歌曲。
- 獲取到 `songId` 後，繼續調用現有的 `fetchNeteaseLyrics` 獲取歌詞。
- 將獲取的 `songId` 和 `lyrics` 一併存入數據庫。

這樣，無論歌曲來自哪個平台，只要網易雲音樂庫中有這首歌，就能自動匹配並導入歌詞。

## 3. 驗證
- 我將編寫代碼並在本地構建。
- 您可以重新導入 Apple Music 歌單進行測試，查看「詩的歌」頁面是否已有歌詞。
