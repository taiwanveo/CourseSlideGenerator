# 桌面打包評估：Tauri vs Electron

> 需求關鍵句：「希望可以讓一般人在 Windows 桌面直接**雙擊滑鼠就可以開啟，不用額外下載什麼、不用安裝即可開始使用**。」
> 這句話對打包方案有決定性影響，本文逐項評估。

---

## 1. 先釐清「雙擊即開、免安裝」的真正含義

| 解讀 | 技術意涵 | 可行性 |
|---|---|---|
| (a) 不需要使用者先裝 Node / Python / 瀏覽器 | 產物要自帶 runtime | Tauri、Electron 皆可 |
| (b) 不需要跑安裝程式（NSIS/MSI），下載即用 | 提供 **portable 單一 .exe** | Tauri ✅ 容易 ｜ Electron ⚠️ 需打包成 portable，體積大 |
| (c) 完全離線、不連網也能用編輯器 | AI 以外功能本機化 | 兩者皆可（AI 仍需 API Key + 網路） |

> 結論：要做到「雙擊即開、免安裝」最務實的形式是 **單一 portable .exe**。這點 **Tauri 明顯較佳**。

---

## 2. 逐項比較

| 比較面向 | **Tauri 2.0** | **Electron** | 對本專案的影響 |
|---|---|---|---|
| 安裝包體積 | ~3–10 MB | ~80–150 MB | 「免下載安裝」訴求 → Tauri 勝 |
| 執行時記憶體 | 低（系統 WebView2） | 高（自帶 Chromium） | 一般人舊筆電也順 → Tauri 勝 |
| Windows runtime 需求 | 依賴 **WebView2**（Win10/11 多數已內建；缺則需 runtime） | 自帶 Chromium，無外部依賴 | ⚠️ 唯一對 Tauri 不利點，見 §3 |
| Portable 單一 exe | 原生支援，容易 | 需額外設定，且檔案大 | Tauri 勝 |
| 啟動速度 | 快 | 較慢 | Tauri 勝 |
| 後端語言 | Rust | Node.js | Electron 對 JS 團隊較友善 |
| 檔案系統 / SQLite | 官方 plugin（fs / sql） | Node fs / better-sqlite3 | 兩者皆成熟 |
| 繞過 CORS 呼叫 LLM | Rust HTTP plugin，乾淨 | Node net，亦可 | 平手 |
| 加密金鑰存放（API Key） | `tauri-plugin-stronghold` | keytar / safeStorage | 平手 |
| 既有程式碼複用 | 前端 React 100% 複用，後端要寫 Rust | 前後端都 JS | 引擎是純前端 TS → 兩者前端都能複用 |
| 安全性（預設） | 嚴格白名單、attack surface 小 | 較寬鬆，需自行收斂 | Tauri 勝 |
| 自動更新 | 官方 updater | electron-updater 成熟 | 平手 |
| 生態 / 範例量 | 較新、較少 | 龐大成熟 | Electron 勝 |
| 學習曲線（需碰 Rust） | 中（Rust 指令層） | 低 | Electron 勝 |

---

## 3. Tauri 唯一風險：WebView2 依賴

- Tauri 在 Windows 用系統的 **Edge WebView2 Runtime** 渲染畫面。
- **Windows 11 與大多數 Windows 10** 已預載 WebView2，使用者多數無感。
- 少數老舊 / 精簡版 Windows 可能缺，這時有三種對策：
  1. **Evergreen Bootstrapper**（小型，自動下載安裝 WebView2，需短暫網路）。
  2. **Fixed Version 內嵌**（把 WebView2 一起打包，體積增加約 ~120MB，但回到「完全免依賴」）。
  3. 預設用 (1)，並提供 (2) 的離線版下載。
- 對「免安裝」訴求而言，可發佈兩個版本：**精簡 portable（多數人用）** + **完整內嵌版（保險）**。

---

## 4. 決策建議

### ✅ 採用 **Tauri 2.0**

理由排序：
1. **最符合「免下載安裝、雙擊即開」**：portable .exe 體積小、啟動快。
2. **資源占用低**，一般人電腦友善。
3. **安全模型嚴格**，適合處理使用者 API Key。
4. 引擎是純前端 TypeScript，**React 部分 100% 沿用 CourseFlow**，Rust 只需寫薄薄的 fs / sql / http 指令層。

### 可接受的代價
- 需學一點 Rust（但僅止於 plugin 設定與少量 command，非重度 Rust 開發）。
- WebView2 依賴 → 用 §3 的雙版本策略化解。

### 何時改選 Electron？
- 若團隊完全不想碰 Rust，且不在意 ~100MB 體積與較高記憶體 → Electron 仍可達成需求，只是「免安裝」體驗略遜。
- 若需要某個只有 Node 生態才有的原生模組，且無 Rust 替代。

---

## 5. Tauri 落地清單

| 項目 | Plugin / 作法 |
|---|---|
| 檔案系統（圖片/音檔/匯出） | `@tauri-apps/plugin-fs` |
| 本機資料庫 | `@tauri-apps/plugin-sql`（SQLite） |
| 呼叫 LLM（繞 CORS） | `@tauri-apps/plugin-http` 或 Rust command 內 `reqwest` |
| API Key 加密 | `@tauri-apps/plugin-stronghold` |
| 對話框（開檔/存檔） | `@tauri-apps/plugin-dialog` |
| PDF / 列印 | webview print to PDF |
| 自動更新（可選） | `@tauri-apps/plugin-updater` |
| 打包 | `tauri build`（產 portable exe + 可選 NSIS/MSI） |

### tauri.conf.json 重點設定（示意）
```jsonc
{
  "bundle": {
    "targets": ["nsis"],          // 另可加 "app" 產 portable
    "windows": {
      "webviewInstallMode": { "type": "embedBootstrapper" }  // 多數人用；保險版改 "offlineInstaller" 或 fixedVersion
    }
  },
  "app": {
    "security": { "csp": "..." }  // 嚴格 CSP，僅允許必要的 LLM 網域
  }
}
```

---

## 6. 一句話總結

> **用 Tauri。** 體積小、雙擊即開、資源省、安全嚴，最貼合「給一般人、免安裝即用」的目標；唯一的 WebView2 依賴用「Bootstrapper + 內嵌完整版」雙版本策略即可化解。
