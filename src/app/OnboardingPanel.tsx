import { useMemo, useState } from "react";
import { Modal } from "./GeneratePanel";
import { setOnboardingDismissed } from "./onboarding";

interface Props {
  onClose: () => void;
}

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "1. 從 AI 生成開始",
    body: "點工具列「✦ AI 生成」，貼上文章或匯入檔案，系統會自動規劃大綱與投影片。",
  },
  {
    title: "2. 設定覆蓋率門檻",
    body: "到工具列「設定」可調整覆蓋率門檻（預設 90%），不足時會自動補頁。",
  },
  {
    title: "3. 批次頁面操作",
    body: "左側面板可多選頁面，批次套用主題與轉場，快速統一整份簡報風格。",
  },
  {
    title: "4. 版本快照與還原",
    body: "點工具列「快照」建立命名版本，隨時可回到任一快照狀態。",
  },
  {
    title: "5. 匯出與報告",
    body: "在「匯出」可輸出 HTML、PPTX、講者備忘稿與品質報告 JSON。",
  },
];

export function OnboardingPanel({ onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const step = STEPS[idx]!;
  const canPrev = idx > 0;
  const isLast = idx === STEPS.length - 1;
  const progress = useMemo(() => `${idx + 1} / ${STEPS.length}`, [idx]);

  const closeAndRemember = () => {
    setOnboardingDismissed(true);
    onClose();
  };

  return (
    <Modal title="快速導覽" onClose={closeAndRemember}>
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            border: "1px solid var(--app-border)",
            borderRadius: 10,
            padding: 14,
            background: "var(--app-canvas-bg)",
            minHeight: 150,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 6 }}>步驟 {progress}</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{step.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>{step.body}</div>
        </div>

        <label style={{ fontSize: 12, color: "var(--app-muted)", display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            defaultChecked
            onChange={(e) => setOnboardingDismissed(!e.target.checked)}
          />
          下次啟動自動顯示快速導覽
        </label>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button className="csg-btn" disabled={!canPrev} onClick={() => setIdx((x) => Math.max(0, x - 1))}>
            上一步
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="csg-btn" onClick={closeAndRemember}>稍後再看</button>
            <button
              className="csg-btn csg-btn-accent"
              onClick={() => (isLast ? closeAndRemember() : setIdx((x) => Math.min(STEPS.length - 1, x + 1)))}
            >
              {isLast ? "完成導覽" : "下一步"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
