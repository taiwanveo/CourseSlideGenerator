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

export const PARAGRAPH_ANALYSIS_SYSTEM = `你是教學簡報編輯。請「逐段」分析文章，不可合併段落、不可跳過、不可省略任何一段。

對每一段，必須依下列順序思考並輸出：
1. 先做重點摘要：把該段內容拆成 2–8 個條列要點（Bullet Point），保留人名、數字、術語、步驟、範例與定義，不可過度精簡。
2. 再依該段主旨，提煉「簡報標題」：用精簡但完整的繁體中文概括該段（建議 8–22 字）。須換句話說、不可複製整段原文，且禁止使用省略號（… 或 ...）。

輸出 JSON，格式：
{"paragraphs":[
  {"index":0,"bullets":["要點一","要點二"],"title":"簡報標題"}
]}

【鐵律】
- paragraphs 陣列必須覆蓋輸入的每一段，index 與段落序號一一對應，不得遺漏。
- bullets 不可為空；title 在 bullets 之後才歸納，需反映整段主旨而非只抄第一句。
- 不要新增原文沒有的事實；原文有的細節都要進 bullets。
- 只輸出單一合法 JSON 物件。`;

export function userParagraphAnalysisPrompt(
  batch: Array<{ index: number; source: string }>,
  pageStrategy?: "compact" | "balanced" | "full",
): string {
  const hint =
    pageStrategy === "compact"
      ? "條列可稍精簡，但不得刪掉知識點。"
      : pageStrategy === "full"
        ? "條列要完整，寧可多不可少。"
        : "條列清楚且完整。";
  const body = batch.map((p) => `【段落 ${p.index}】\n${p.source}`).join("\n\n");
  return `${hint}\n\n以下共 ${batch.length} 段，請逐段輸出 bullets 與 title：\n\n${body}`;
}

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
- title 槽只放「短標題」（建議 ≤ 20 字）；詳細說明、數據、步驟必須放在 bullets / body / subtitle 槽，不可全部塞在 title。
- 使用 bullet-list、two-column-bullets 等版型時，bullets 槽必填，至少 3 個 listItems（keyPoints 可直接轉成條列）。
- 每一筆 slideSpecs 至少對應一張投影片；section 類型必須有 bullets 內容，chapter 類型用 section-divider。
- 若 slideSpec 含 imageAssetId，必須使用含 image 槽的版型（如 text-left-image-right），並在 image 槽填入該 id。
- 若 slideSpec 含 sourceExcerpt，須把其中知識點寫入 bullets，不可省略。
- 禁止只填 title 而留空 bullets / body / subtitle 等必填或主要內容槽。
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
  payloadJson: string,
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
  return `以下是待製作的投影片規格（JSON 的 slideSpecs 陣列）。請為每一筆 spec 各產生至少一張投影片，選版型並填滿槽位。
- title 槽：短標題（≤ 20 字）
- bullets 槽：必須包含 spec.keyPoints 的全部項目（可再補充，不可刪減）
- 有 imageAssetId 時：用 text-left-image-right，image 槽填該 id
- 有 sourceExcerpt 時：把摘要中的句子寫入 bullets
${styleHint}
${pageHint}

${payloadJson}${imgPrompt}`;
}

export function ARTICLE_TO_STRUCTURE_SYSTEM(
  pageStrategy: "compact" | "balanced" | "full" = "full",
): string {
  const coverageRule =
    pageStrategy === "full"
      ? `【鐵律｜full 教學完整模式】
- 原文的每一段（以【段落 N】標號）都必須至少出現在某張 slide 的 sourceRefs 中，不得遺漏。
- 不可在 omitted 中省略任何段落；omitted 必須為空陣列 []。
- 可重組敘事順序，但所有知識點都要進入 keyPoints。
- 寧可投影片數量多，不可刪除知識點。`
      : pageStrategy === "balanced"
        ? `【鐵律｜balanced 平衡模式】
- 至少 90% 的原文段落必須出現在 sourceRefs 中。
- 僅可省略重複、極弱或與主旨無關的段落，並列入 omitted 且說明 reason。
- 優先訊息驅動標題與清晰敘事，但保留主要知識點。`
        : `【鐵律｜compact 精簡模式】
- 聚焦核心論述，可合併段落；omitted 需說明原因。
- 目標精簡投影片數量，但 coreMessage 須準確。`;

  return `你是教學簡報架構設計師（article_to_presentation_structure）。
任務：把長文轉成「簡報邏輯」，不是逐段摘要。須提取論點、重組敘事、設計 slide-level 結構。

${coverageRule}

【流程】
1. 判斷簡報情境（受眾、目的、語氣）→ objective, audience
2. 提取核心訊息 → coreMessage（一句話）
3. 選敘事弧 → narrativeFlow（如 Problem→Solution、What→Why→How）
4. 為每張 slide 產出：
   - title：訊息驅動標題（結論句，非「概述」「背景」）
   - mainMessage：本頁唯一主張
   - keyPoints：3–7 條，保留術語/數字/步驟，不可整段複製
   - suggestedVisual：title|agenda|section-divider|executive-summary|bullet-list|comparison|timeline|process|framework|chart|case|quote|problem|recommendation|closing|image-focus
   - speakerNote：講者口語說明（可比 slide 上文字更詳）
   - sourceRefs：對應【段落 N】的 N 整數陣列
   - kind：title|section|chapter（可選）

【品質】
- 繁體中文（台灣用語）
- 禁止標題用省略號（… 或 ...）
- 不要新增原文沒有的事實

輸出 JSON：
{"objective":"...","audience":"...","coreMessage":"...","narrativeFlow":"...","slides":[{"slideNo":1,"title":"...","mainMessage":"...","keyPoints":["..."],"suggestedVisual":"bullet-list","speakerNote":"...","sourceRefs":[0],"kind":"section"}],"omitted":[]}
只輸出單一合法 JSON 物件。`;
}

export function userArticleToStructurePrompt(
  content: string,
  paragraphs: string[],
  opts?: {
    pageStrategy?: "compact" | "balanced" | "full";
    deckStyle?: "teaching" | "business" | "academic" | "casual";
    emphasisKeywords?: string[];
  },
): string {
  const paraBlock = paragraphs
    .map((p, i) => `【段落 ${i}】\n${p.slice(0, 1200)}`)
    .join("\n\n");
  const style =
    opts?.deckStyle === "business"
      ? "商務簡報"
      : opts?.deckStyle === "academic"
        ? "學術報告"
        : opts?.deckStyle === "casual"
          ? "輕鬆分享"
          : "教學簡報";
  const kw =
    opts?.emphasisKeywords?.length ? `\n強調關鍵詞：${opts.emphasisKeywords.join("、")}` : "";
  return `模式：${opts?.pageStrategy ?? "full"}｜風格：${style}${kw}

【段落索引清單】（sourceRefs 必須引用此處的段落編號）
${paraBlock}

【完整內文】
${content.slice(0, 24000)}`;
}

export const PRESENTATION_GENERATION_SYSTEM = `你是教學簡報內容設計師（presentation_generation）。
輸入為已規劃好的簡報架構（每頁含 title、mainMessage、keyPoints、suggestedVisual、speakerNote）。
任務：為每一頁選擇合適版型並填滿槽位，產出可放映的投影片語意層。你只負責語意，不算座標。

可用版型清單：
${presetCatalogForPrompt()}

【鐵律】
- 每一筆架構 slide 對應一張投影片，不可合併或跳過
- title 槽放短標題；keyPoints 全部進入 bullets 槽（listItems），不可刪減
- speakerNote 與 mainMessage 寫入 reason 欄位（講者備註）
- presetId 必須來自版型清單；有 imageAssetIds 時用 text-left-image-right 並填 image 槽
- 繁體中文；禁止省略號截斷

輸出 JSON：
{"slides":[{"slideTitle":"...","presetId":"...","reason":"講者備註\\n\\n核心訊息","slots":[...],"emphasisPoints":[]}]}
只輸出單一合法 JSON 物件。`;

export function userPresentationGenerationPrompt(
  structure: { objective: string; coreMessage: string; narrativeFlow: string },
  chunk: Array<{
    slideNo: number;
    title: string;
    mainMessage: string;
    keyPoints: string[];
    suggestedVisual: string;
    speakerNote?: string;
    imageAssetIds?: string[];
    kind?: string;
  }>,
  availableImages?: { id: string; name: string }[],
  opts?: { deckStyle?: string; pageStrategy?: string },
): string {
  let img = "";
  if (availableImages?.length) {
    img = `\n【附圖】\n${JSON.stringify(availableImages, null, 2)}`;
  }
  return `簡報目的：${structure.objective}
核心訊息：${structure.coreMessage}
敘事：${structure.narrativeFlow}
風格：${opts?.deckStyle ?? "teaching"}｜頁數策略：${opts?.pageStrategy ?? "full"}

請為以下 ${chunk.length} 張架構 slide 各產出一張投影片 JSON：
${JSON.stringify(chunk, null, 2)}${img}`;
}
