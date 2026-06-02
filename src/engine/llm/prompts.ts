import { presetCatalogForPrompt } from "../layout/presets";

export const TRANSLATE_SYSTEM = `你是專業的繁體中文教學內容編輯。將使用者提供的原始素材整理成「適合做成教學簡報」的繁體中文內容。
規則：
- 若原文非中文，翻譯成自然、專業的繁體中文（台灣用語）。
- 保留重點與專有名詞，去除冗詞贅句。
- 不要加入原文沒有的事實。
- 直接輸出整理後的內文，不要加說明或標題。`;

export const OUTLINE_SYSTEM = `你是教學簡報的架構規劃師。把整理後的內文拆解成三層大綱（章 > 節 > 重點）。
輸出 JSON，格式：
{"outline":[{"level":1,"text":"章標題","keyPoint":false,"children":[{"level":2,"text":"節標題","keyPoint":false,"children":[{"level":3,"text":"重點句","keyPoint":true,"children":[]}]}]}]}

【鐵律｜完整覆蓋，不得遺漏】
- 必須涵蓋原始內文的「每一個段落、每一個知識點、每一個範例、每一條定義、每一個步驟與數據」。寧可頁數多，也不可省略或合併掉任何知識點。
- 不要為了精簡而刪除內容；若內容很多，就拆成更多節與更多重點，確保 1:1 對應原文。
- 不要新增原文沒有的事實，但原文有的都要保留。

規則：
- level 只能是 1、2、3。
- 章節與重點數量「依內容多寡自動決定」，不要刻意壓低；內容豐富時可有很多章節與重點。
- keyPoint 標記是否為需強調的關鍵句。
- 只輸出單一合法 JSON 物件，不要加註解或說明文字。
- 字串內的雙引號需以 \\" 轉義、換行以 \\n 表示；不得有尾逗號；務必輸出完整且括號閉合的 JSON。`;

export function intentSystem(): string {
  return `你是教學簡報的版面設計顧問。依大綱為每一頁選擇最合適的版型（preset），並把內容填入版型的槽位（slot）。
你只負責「語意」：選版型、填文字。不要計算座標、像素或寫程式碼，版面引擎會自動排版。

可用版型清單：
${presetCatalogForPrompt()}

輸出 JSON，格式：
{"slides":[
  {"slideTitle":"頁面標題","presetId":"版型id","reason":"選此版型的原因","slots":[
     {"slotName":"槽位名稱","contentType":"text|list|image|chart|table","text":"文字內容","listItems":["項目"],"ordered":false}
  ],"emphasisPoints":["要強調的關鍵詞"]}
]}

【鐵律｜完整覆蓋，不得遺漏】
- 大綱中的「每一個重點、每一個節」都必須出現在某一頁的內容裡，不可省略或合併掉任何知識點。
- 頁數「由內容多寡自動決定」：內容多就多分頁。不要硬性限制頁數，也不要為了精簡而砍內容。
- 每頁聚焦單一概念，但所有概念加總起來必須 100% 覆蓋整份大綱。
- 單頁條列建議 3-7 項，超過就拆成多頁（例如「(1/2)」「(2/2)」），而不是塞爆一頁或刪掉。

規則：
- presetId 必須是清單中的 id。
- slotName 必須符合該版型的槽位（標題槽通常叫 title，條列槽常叫 bullets/left/right）。
- 條列內容用 listItems；單純文字用 text。
- 開場用 title-subtitle 或 section-divider；條列重點用 bullet-list 或 two-column-bullets；比較用 compare-2col；關鍵數字用 big-number-callout。
- 只輸出單一合法 JSON 物件，不要加註解或說明文字。
- 字串內的雙引號需以 \\" 轉義、換行以 \\n 表示；不得有尾逗號；務必輸出完整且括號閉合的 JSON。`;
}

export function userOutlinePrompt(
  text: string,
  opts?: { pageStrategy?: "compact" | "balanced" | "full"; emphasisKeywords?: string[] },
): string {
  const pageHint =
    opts?.pageStrategy === "compact"
      ? "頁數策略：偏精簡，但不可遺漏。"
      : opts?.pageStrategy === "full"
        ? "頁數策略：優先完整覆蓋，必要時大量分頁。"
        : "頁數策略：平衡可讀性與完整性。";
  const kw =
    opts?.emphasisKeywords && opts.emphasisKeywords.length > 0
      ? `\n需特別強調關鍵詞：${opts.emphasisKeywords.join("、")}`
      : "";
  return `以下是整理後的教學內文，請拆成三層大綱。\n${pageHint}${kw}\n\n${text}`;
}

export function userIntentPrompt(
  outlineJson: string,
  availableImages?: { id: string; name: string }[],
  opts?: { deckStyle?: "teaching" | "business" | "academic" | "casual"; pageStrategy?: "compact" | "balanced" | "full" },
): string {
  let imgPrompt = "";
  if (availableImages && availableImages.length > 0) {
    imgPrompt =
      `\n\n【可用附圖清單】\n` +
      `以下是原文提取出的圖片資源，請盡可能安排在內容相關的頁面中（放入 contentType="image" 的 slot，並填寫 imageAssetId 為該圖片的 id）。\n` +
      `若大綱或內文出現 [Image: <id>] 標籤，該 id 的圖片必須在對應頁面放入。\n` +
      `${JSON.stringify(availableImages, null, 2)}`;
  }
  const styleHint =
    opts?.deckStyle === "business"
      ? "風格：商務，句子精煉、結論導向。"
      : opts?.deckStyle === "academic"
        ? "風格：學術，術語完整、定義嚴謹。"
        : opts?.deckStyle === "casual"
          ? "風格：口語教學，易懂且有引導感。"
          : "風格：教學，清楚分段、重點明確。";
  const pageHint =
    opts?.pageStrategy === "compact"
      ? "頁數策略：偏精簡，但不得遺漏。"
      : opts?.pageStrategy === "full"
        ? "頁數策略：優先完整覆蓋，必要時多頁。"
        : "頁數策略：平衡可讀性與完整性。";
  return `以下是教學大綱（JSON），請為每頁選版型並填內容。\n${styleHint}\n${pageHint}\n\n${outlineJson}${imgPrompt}`;
}
