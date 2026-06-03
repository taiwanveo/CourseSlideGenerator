import { useRef, useState, type ReactNode } from "react";
import { generatePresentation } from "../engine/ai/generate";
import { parseFile, parsePastedText, parseUrl, type ParsedImage } from "../engine/import/parse-document";
import type { GenerationQualityReport, OutlineCoverageReport } from "../model/types";
import { isTauri } from "../platform";
import { useEditor } from "../store/editorStore";
import { useSettings } from "../store/settingsStore";

interface Props {
  onClose: () => void;
}

export function GeneratePanel({ onClose }: Props) {
  const settings = useSettings();
  const loadProject = useEditor((s) => s.loadProject);

  const [text, setText] = useState("");
  const [images, setImages] = useState<ParsedImage[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [refine, setRefine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<OutlineCoverageReport | null>(null);
  const [quality, setQuality] = useState<{
    factualConsistencyPercent: number;
    unsupportedClaims: string[];
    denseSlidesBeforePatch: number;
    denseSlidesAfterPatch: number;
    splitSlidesAdded: number;
  } | null>(null);
  const [showCoverageDetails, setShowCoverageDetails] = useState(false);
  const [showQualityDetails, setShowQualityDetails] = useState(false);
  const [deckStyle, setDeckStyle] = useState<"teaching" | "business" | "academic" | "casual">("teaching");
  const [pageStrategy, setPageStrategy] = useState<"compact" | "balanced" | "full">("balanced");
  const [emphasisKeywords, setEmphasisKeywords] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = async (file: File) => {
    setError(null);
    setStage(`解析 ${file.name}…`);
    try {
      const doc = await parseFile(file);
      setText(doc.text);
      setImages(doc.images);
      if (!title) setTitle(doc.sourceName.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "檔案解析失敗");
    } finally {
      setStage("");
    }
  };

  const onFetchUrl = async () => {
    if (!url.trim()) return;
    setError(null);
    setFetchingUrl(true);
    setStage("抓取網頁中…");
    try {
      const doc = await parseUrl(url.trim());
      setText(doc.text);
      setImages(doc.images);
      if (!title) setTitle(doc.sourceName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "網址抓取失敗");
    } finally {
      setFetchingUrl(false);
      setStage("");
    }
  };

  const onGenerate = async () => {
    setError(null);
    setCoverage(null);
    setQuality(null);
    setShowCoverageDetails(false);
    setShowQualityDetails(false);
    const creds = settings.credentials();
    if (!creds) {
      setError("請先輸入 API Key");
      return;
    }
    const content = parsePastedText(text).text;
    if (content.length < 20) {
      setError("請提供至少 20 個字的內容");
      return;
    }
    setBusy(true);
    try {
      const project = await generatePresentation({
        rawText: content,
        title: title || undefined,
        creds,
        refine,
        images,
        minCoverageThreshold: settings.coverageThreshold,
        deckStyle,
        pageStrategy,
        emphasisKeywords: emphasisKeywords
          .split(/[,\n，、]/)
          .map((x) => x.trim())
          .filter(Boolean),
        onProgress: setStage,
      });
      loadProject(project);
      setCoverage(project.source.coverage ?? null);
      setQuality(project.source.quality ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失敗");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <Modal onClose={onClose} title="AI 生成教學簡報" wide>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 20, alignItems: "start" }}>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="csg-input"
            placeholder="簡報標題（可留空）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="csg-input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="貼上網址（如文章頁），按「抓取」匯入內文"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onFetchUrl();
              }}
            />
            <button
              className="csg-btn"
              style={{ flexShrink: 0 }}
              onClick={() => void onFetchUrl()}
              disabled={fetchingUrl || !url.trim()}
            >
              {fetchingUrl ? "抓取中…" : "抓取"}
            </button>
          </div>
          {!isTauri() && (
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: -2 }}>
              小提醒：有些網站會限制瀏覽器直接讀取頁面內容，所以你可能會看到「無法連線」。
              若遇到此情況，可改用桌面模式、改貼文章內文，或上傳檔案匯入。
            </div>
          )}
          <textarea
            className="csg-input"
            style={{ minHeight: 200, resize: "vertical" }}
            placeholder="貼上教學內容（文章 / 講稿 / 大綱），或從上方匯入網址 / 檔案…"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (images.length > 0) setImages([]);
            }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="csg-btn" style={{ flexShrink: 0 }} onClick={() => fileRef.current?.click()}>
              ⬆ 上傳檔案
            </button>
            <span style={{ fontSize: 12, color: "var(--app-muted)" }}>PDF / Word / TXT / MD / HTML</span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.markdown,.html,.htm,.docx"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
            />
          </div>
          {images.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--app-accent)" }}>
              已擷取 {images.length} 張圖片，將一併放入簡報（不會捨棄）
            </div>
          )}
        </div>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--app-muted)" }}>
            覆蓋率門檻：{settings.coverageThreshold}%（AI 模型與金鑰請在上方工具列「設定」調整）
          </div>

          <label className="csg-field-label">生成風格</label>
          <select className="csg-select" value={deckStyle} onChange={(e) => setDeckStyle(e.target.value as typeof deckStyle)}>
            <option value="teaching">教學（清楚分段）</option>
            <option value="business">商務（結論導向）</option>
            <option value="academic">學術（術語嚴謹）</option>
            <option value="casual">口語（容易理解）</option>
          </select>

          <label className="csg-field-label">頁數策略</label>
          <select className="csg-select" value={pageStrategy} onChange={(e) => setPageStrategy(e.target.value as typeof pageStrategy)}>
            <option value="compact">精簡</option>
            <option value="balanced">平衡</option>
            <option value="full">完整覆蓋優先</option>
          </select>

          <label className="csg-field-label">重點關鍵詞（可選）</label>
          <input
            className="csg-input"
            value={emphasisKeywords}
            onChange={(e) => setEmphasisKeywords(e.target.value)}
            placeholder="例如：定義、公式、結論（用逗號分隔）"
          />

          <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
            <input type="checkbox" checked={refine} onChange={(e) => setRefine(e.target.checked)} />
            翻譯／潤飾內容
          </label>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 6,
            }}
          >
            {stage && <span style={{ fontSize: 13, color: "var(--app-muted)" }}>{stage}</span>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              {(coverage || quality) && (
                <button
                  className="csg-btn"
                  onClick={() => exportQualityReport(coverage, quality)}
                  disabled={busy}
                  title="匯出覆蓋率與品質檢查報告"
                >
                  匯出報告 JSON
                </button>
              )}
              <button className="csg-btn" onClick={onClose} disabled={busy}>
                {coverage ? "完成" : "取消"}
              </button>
              <button className="csg-btn csg-btn-accent" onClick={onGenerate} disabled={busy}>
                {busy ? "生成中…" : "開始生成"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 12 }}>{error}</div>}
      {coverage && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--app-border)",
            background: "var(--app-canvas-bg)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>覆蓋率檢查完成</div>
          <div>
            大綱節點：{coverage.requiredNodes}，覆蓋率：{coverage.coveragePercentBefore}% → {coverage.coveragePercentAfter}%
          </div>
          <div>自動補頁：{coverage.patchedSlides} 張</div>
          {coverage.missingAfterPatch.length > 0 ? (
            <div style={{ color: "#ff6b6b" }}>
              仍有缺漏：{coverage.missingAfterPatch.slice(0, 5).join("、")}
              {coverage.missingAfterPatch.length > 5 ? "…" : ""}
            </div>
          ) : (
            <div style={{ color: "var(--app-accent)" }}>已達成完整覆蓋（不漏字）。</div>
          )}
          <button
            className="csg-btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => setShowCoverageDetails((v) => !v)}
          >
            {showCoverageDetails ? "隱藏詳細清單" : "查看詳細清單"}
          </button>
          {showCoverageDetails && (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <CoverageList
                title={`補頁前缺漏 (${coverage.missingBeforePatch.length})`}
                items={coverage.missingBeforePatch}
                emptyText="補頁前無缺漏。"
              />
              <CoverageList
                title={`補頁後缺漏 (${coverage.missingAfterPatch.length})`}
                items={coverage.missingAfterPatch}
                emptyText="補頁後已無缺漏。"
                critical
              />
            </div>
          )}
        </div>
      )}
      {quality && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--app-border)",
            background: "var(--app-canvas-bg)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>內容品質檢查完成</div>
          <div>事實一致性：{quality.factualConsistencyPercent}%</div>
          <div>
            過密頁面：{quality.denseSlidesBeforePatch} → {quality.denseSlidesAfterPatch}（自動拆頁 +{quality.splitSlidesAdded}）
          </div>
          <button className="csg-btn-sm" style={{ marginTop: 8 }} onClick={() => setShowQualityDetails((v) => !v)}>
            {showQualityDetails ? "隱藏品質細節" : "查看品質細節"}
          </button>
          {showQualityDetails && (
            <div style={{ marginTop: 10 }}>
              <CoverageList
                title={`疑似新增主張 (${quality.unsupportedClaims.length})`}
                items={quality.unsupportedClaims}
                emptyText="未偵測到疑似新增主張。"
                critical={quality.unsupportedClaims.length > 0}
              />
            </div>
          )}
        </div>
      )}

    </Modal>
  );
}

function exportQualityReport(
  coverage: OutlineCoverageReport | null,
  quality: GenerationQualityReport | null,
): void {
  const payload = {
    generatedAt: new Date().toISOString(),
    coverage,
    quality,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `csg-quality-report-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Modal({
  title,
  headerExtra,
  children,
  onClose,
  wide,
}: {
  title: string;
  headerExtra?: ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 30000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: wide ? 880 : 460,
          maxWidth: "92vw",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--app-panel)",
          border: "1px solid var(--app-border)",
          borderRadius: 14,
          padding: 22,
          boxShadow: "0 24px 80px rgba(0,0,0,.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 17, margin: 0, flex: 1, minWidth: 0 }}>{title}</h2>
          {headerExtra}
        </div>
        {children}
      </div>
    </div>
  );
}

function CoverageList({
  title,
  items,
  emptyText,
  critical,
}: {
  title: string;
  items: string[];
  emptyText: string;
  critical?: boolean;
}) {
  return (
    <div style={{ border: "1px solid var(--app-border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 6 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: critical ? "#ff6b6b" : "var(--app-accent)" }}>{emptyText}</div>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: "grid", gap: 4 }}>
          {items.map((item, idx) => (
            <li key={`${idx}-${item.slice(0, 20)}`} style={{ wordBreak: "break-word" }}>
              {item}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
