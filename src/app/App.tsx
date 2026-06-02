import { useEffect, useRef, useState } from "react";
import { EditorCanvas } from "../editor/EditorCanvas";
import { Inspector } from "../editor/Inspector";
import { SlidePanel } from "../editor/SlidePanel";
import { Toolbar } from "../editor/Toolbar";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../model/types";
import { createBlankProject } from "../model/factory";
import { buildAssetMap } from "../renderer/assets";
import { SlideStage } from "../renderer/SlideStage";
import { getLastProjectId, getStore } from "../engine/storage/store";
import { useEditor } from "../store/editorStore";
import { ExportPanel } from "./ExportPanel";
import { GeneratePanel } from "./GeneratePanel";
import { PresentationPlayer } from "./PresentationPlayer";
import { LibraryPanel } from "./LibraryPanel";
import { ImagePanel } from "./ImagePanel";
import { AudioPanel } from "./AudioPanel";
import { SettingsPanel } from "./SettingsPanel";
import { SnapshotsPanel } from "./SnapshotsPanel";
import { OnboardingPanel } from "./OnboardingPanel";
import { isOnboardingDismissed, setOnboardingDismissed } from "./onboarding";

export function App() {
  const [showAI, setShowAI] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [restored, setRestored] = useState(false);
  const exportStageRef = useRef<HTMLDivElement>(null);

  const project = useEditor((s) => s.project);
  const currentSlide = useEditor((s) => s.project.deck.slides.find((x) => x.id === s.currentSlideId));
  const currentSlideId = useEditor((s) => s.currentSlideId);
  const selectSlide = useEditor((s) => s.selectSlide);
  const loadProject = useEditor((s) => s.loadProject);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const deleteSelected = useEditor((s) => s.deleteSelected);
  const relayoutCurrentSlide = useEditor((s) => s.relayoutCurrentSlide);
  const selection = useEditor((s) => s.selection);

  // 啟動時還原最近一次的簡報
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lastId = getLastProjectId();
      if (lastId) {
        try {
          const saved = await getStore().load(lastId);
          if (saved && !cancelled) loadProject(saved);
        } catch {
          /* 還原失敗則保留空白簡報 */
        }
      }
      if (!cancelled) setRestored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProject]);

  // 自動存檔（debounce）— 還原完成後才啟用，避免覆寫已存內容
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => {
      void getStore().save(project);
    }, 600);
    return () => clearTimeout(t);
  }, [project, restored]);

  // 首次使用導覽：若未標記為關閉，啟動時顯示。
  useEffect(() => {
    if (!restored) return;
    if (!isOnboardingDismissed()) setShowOnboarding(true);
  }, [restored]);

  // 關閉前盡力存檔（防瀏覽器當掉 / 直接關閉）
  useEffect(() => {
    const flush = () => {
      void getStore().save(project);
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [project]);

  const onNewFile = () => {
    const ok = window.confirm(
      "開新檔案前，目前的簡報已自動儲存。\n確定要建立一份新的空白簡報嗎？",
    );
    if (!ok) return;
    void getStore().save(project);
    loadProject(createBlankProject());
  };

  // 快捷鍵
  useEffect(() => {
    const gotoAdjacentSlide = (dir: -1 | 1) => {
      const slides = project.deck.slides;
      const idx = slides.findIndex((x) => x.id === currentSlideId);
      const next = slides[idx + dir];
      if (next) selectSlide(next.id);
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      // 全螢幕播放：Ctrl+Alt+P / F12 / F5
      if (
        ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "p") ||
        e.key === "F12" ||
        e.key === "F5"
      ) {
        e.preventDefault();
        setShowPlayer(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !editing && selection.length > 0) {
        e.preventDefault();
        deleteSelected();
      } else if ((e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") && !editing) {
        // 上一張投影片（PowerPoint 體驗）
        e.preventDefault();
        gotoAdjacentSlide(-1);
      } else if ((e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown") && !editing) {
        // 下一張投影片
        e.preventDefault();
        gotoAdjacentSlide(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelected, selection, project, currentSlideId, selectSlide]);

  const assets = buildAssetMap(project.assets);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Toolbar
        onOpenAI={() => setShowAI(true)}
        onExport={() => setShowExport(true)}
        onNewFile={onNewFile}
        onPlay={() => setShowPlayer(true)}
        onOpenLibrary={() => setShowLibrary(true)}
        onOpenImage={() => setShowImage(true)}
        onOpenAudio={() => setShowAudio(true)}
        onOpenSettings={() => setShowSettings(true)}
        onRelayout={() => relayoutCurrentSlide()}
        onOpenSnapshots={() => setShowSnapshots(true)}
      />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <SlidePanel />
        <EditorCanvas />
        <Inspector />
      </div>

      {showAI && <GeneratePanel onClose={() => setShowAI(false)} />}
      {showExport && (
        <ExportPanel onClose={() => setShowExport(false)} getStageNode={() => exportStageRef.current} />
      )}
      {showPlayer && <PresentationPlayer onClose={() => setShowPlayer(false)} />}
      {showImage && <ImagePanel onClose={() => setShowImage(false)} />}
      {showAudio && <AudioPanel onClose={() => setShowAudio(false)} />}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onOpenOnboarding={() => {
            setOnboardingDismissed(false);
            setShowOnboarding(true);
          }}
        />
      )}
      {showSnapshots && <SnapshotsPanel onClose={() => setShowSnapshots(false)} />}
      {showOnboarding && <OnboardingPanel onClose={() => setShowOnboarding(false)} />}
      {showLibrary && (
        <LibraryPanel
          onClose={() => setShowLibrary(false)}
          onPick={(p) => {
            loadProject(p);
            setShowLibrary(false);
          }}
        />
      )}

      {/* 離螢幕全尺寸舞台 — 供 PNG 匯出 */}
      <div
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          pointerEvents: "none",
        }}
      >
        <div ref={exportStageRef}>
          {currentSlide && <SlideStage slide={currentSlide} theme={project.theme} assets={assets} />}
        </div>
      </div>
    </div>
  );
}

export default App;
