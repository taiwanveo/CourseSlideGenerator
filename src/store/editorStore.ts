/**
 * 編輯器狀態 — Zustand + Immer，含 undo/redo 歷史。
 * Project 為唯一真相；selection 與 history 為 UI 狀態。
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { current, isDraft } from "immer";
import type { AssetRef, Element, NamedSnapshot, Project, Slide, Transform } from "../model/types";
import { createBlankProject, createBlankSlide, createImageElement, findElement } from "../model/factory";

const HISTORY_LIMIT = 80;

export interface EditorState {
  project: Project;
  currentSlideId: string;
  selection: string[]; // element ids
  past: Project[];
  future: Project[];
  zoom: number; // 0 = fit
  snapshots: NamedSnapshot[];
  // actions
  loadProject: (p: Project) => void;
  selectSlide: (slideId: string) => void;
  selectElements: (ids: string[]) => void;
  toggleSelect: (id: string, additive: boolean) => void;
  clearSelection: () => void;
  updateTransform: (id: string, patch: Partial<Transform>, commit: boolean) => void;
  fitTextSize: (id: string, width: number, height: number) => void;
  updateElement: (id: string, mutate: (el: Element) => void) => void;
  addElement: (el: Element) => void;
  addImage: (asset: AssetRef) => void;
  deleteSelected: () => void;
  addSlide: () => void;
  deleteSlide: (slideId: string) => void;
  moveSlide: (slideId: string, dir: -1 | 1) => void;
  reorderElement: (id: string, dir: "front" | "back" | "forward" | "backward") => void;
  setTheme: (themeId: string) => void;
  setThemeOverrides: (overrides: Record<string, string>) => void;
  setTitle: (title: string) => void;
  updateSlideAudio: (
    slideId: string,
    asset: AssetRef | string | null,
    opts: { mode: "bgm" | "slide"; loop: boolean; volume: number }
  ) => void;
  updateSlideTransition: (slideId: string, patch: Partial<{ preset: string; duration: number; easing: string }>) => void;
  relayoutCurrentSlide: () => void;
  applyThemeToSlides: (slideIds: string[], themeId: string) => void;
  applyTransitionToSlides: (slideIds: string[], preset: string) => void;
  saveSnapshot: (name: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  undo: () => void;
  redo: () => void;
  commit: () => void;
}

function currentSlide(p: Project, slideId: string): Slide | undefined {
  return p.deck.slides.find((s) => s.id === slideId);
}

function snapshot(state: EditorState) {
  state.past.push(structuredCloneSafe(state.project));
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = [];
}

function structuredCloneSafe<T>(v: T): T {
  // 在 immer producer 內，state 是 draft proxy，structuredClone 會失敗；先還原成純物件。
  const plain = isDraft(v) ? (current(v as object) as T) : v;
  return typeof structuredClone === "function"
    ? structuredClone(plain)
    : (JSON.parse(JSON.stringify(plain)) as T);
}

const initialProject = createBlankProject();

export const useEditor = create<EditorState>()(
  immer((set) => ({
    project: initialProject,
    currentSlideId: initialProject.deck.slides[0]!.id,
    selection: [],
    past: [],
    future: [],
    zoom: 0,
    snapshots: [],

    loadProject: (p) =>
      set((s) => {
        s.project = p;
        s.currentSlideId = p.deck.slides[0]?.id ?? "";
        s.selection = [];
        s.past = [];
        s.future = [];
      }),

    selectSlide: (slideId) =>
      set((s) => {
        s.currentSlideId = slideId;
        s.selection = [];
      }),

    selectElements: (ids) =>
      set((s) => {
        s.selection = ids;
      }),

    toggleSelect: (id, additive) =>
      set((s) => {
        if (additive) {
          const i = s.selection.indexOf(id);
          if (i >= 0) s.selection.splice(i, 1);
          else s.selection.push(id);
        } else {
          s.selection = [id];
        }
      }),

    clearSelection: () =>
      set((s) => {
        s.selection = [];
      }),

    updateTransform: (id, patch, commit) =>
      set((s) => {
        if (commit) snapshot(s);
        const slide = currentSlide(s.project, s.currentSlideId);
        if (!slide) return;
        const el = findElement(slide.elements, id);
        if (el && !el.locked) Object.assign(el.transform, patch);
        s.project.meta.updatedAt = Date.now();
      }),

    fitTextSize: (id, width, height) =>
      set((s) => {
        const slide = currentSlide(s.project, s.currentSlideId);
        if (!slide) return;
        const el = findElement(slide.elements, id);
        if (!el || el.type !== "text" || el.locked) return;
        // 僅在尺寸實際變動時更新，避免無限量測迴圈與無謂的自動存檔
        if (Math.abs(el.transform.width - width) < 1 && Math.abs(el.transform.height - height) < 1) return;
        el.transform.width = width;
        el.transform.height = height;
        s.project.meta.updatedAt = Date.now();
      }),

    updateElement: (id, mutate) =>
      set((s) => {
        snapshot(s);
        const slide = currentSlide(s.project, s.currentSlideId);
        if (!slide) return;
        const el = findElement(slide.elements, id);
        if (el) mutate(el);
        s.project.meta.updatedAt = Date.now();
      }),

    addElement: (el) =>
      set((s) => {
        snapshot(s);
        const slide = currentSlide(s.project, s.currentSlideId);
        if (!slide) return;
        const maxZ = slide.elements.reduce((m, e) => Math.max(m, e.transform.zIndex), 0);
        el.transform.zIndex = maxZ + 1;
        slide.elements.push(el);
        s.selection = [el.id];
      }),

    addImage: (asset) =>
      set((s) => {
        snapshot(s);
        const slide = currentSlide(s.project, s.currentSlideId);
        if (!slide) return;
        if (!s.project.assets.some((a) => a.id === asset.id)) s.project.assets.push(asset);
        // 依原圖比例計算初始尺寸，最長邊不超過 900 design-px，置中於畫布
        const aspect = asset.width && asset.height ? asset.width / asset.height : 4 / 3;
        let w = 900;
        let h = w / aspect;
        if (h > 760) {
          h = 760;
          w = h * aspect;
        }
        const el = createImageElement(asset.id, {
          x: Math.round((1920 - w) / 2),
          y: Math.round((1080 - h) / 2),
          width: Math.round(w),
          height: Math.round(h),
        });
        const maxZ = slide.elements.reduce((m, e) => Math.max(m, e.transform.zIndex), 0);
        el.transform.zIndex = maxZ + 1;
        el.fit = "contain";
        slide.elements.push(el);
        s.selection = [el.id];
      }),

    deleteSelected: () =>
      set((s) => {
        snapshot(s);
        const slide = currentSlide(s.project, s.currentSlideId);
        if (!slide) return;
        slide.elements = slide.elements.filter(
          (e) => !s.selection.includes(e.id) || e.locked,
        );
        s.selection = [];
      }),

    addSlide: () =>
      set((s) => {
        snapshot(s);
        const slide = createBlankSlide();
        const idx = s.project.deck.slides.findIndex((x) => x.id === s.currentSlideId);
        s.project.deck.slides.splice(idx + 1, 0, slide);
        s.currentSlideId = slide.id;
        s.selection = [];
      }),

    deleteSlide: (slideId) =>
      set((s) => {
        if (s.project.deck.slides.length <= 1) return;
        snapshot(s);
        const idx = s.project.deck.slides.findIndex((x) => x.id === slideId);
        s.project.deck.slides.splice(idx, 1);
        if (s.currentSlideId === slideId) {
          const next = s.project.deck.slides[Math.max(0, idx - 1)];
          s.currentSlideId = next ? next.id : "";
        }
      }),

    moveSlide: (slideId, dir) =>
      set((s) => {
        const slides = s.project.deck.slides;
        const idx = slides.findIndex((x) => x.id === slideId);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= slides.length) return;
        snapshot(s);
        const [item] = slides.splice(idx, 1);
        if (item) slides.splice(target, 0, item);
      }),

    reorderElement: (id, dir) =>
      set((s) => {
        const slide = currentSlide(s.project, s.currentSlideId);
        if (!slide) return;
        snapshot(s);
        const sorted = slide.elements.slice().sort((a, b) => a.transform.zIndex - b.transform.zIndex);
        const idx = sorted.findIndex((e) => e.id === id);
        if (idx < 0) return;
        const el = sorted[idx]!;
        if (dir === "front") el.transform.zIndex = sorted[sorted.length - 1]!.transform.zIndex + 1;
        else if (dir === "back") el.transform.zIndex = sorted[0]!.transform.zIndex - 1;
        else if (dir === "forward" && idx < sorted.length - 1) {
          const nz = sorted[idx + 1]!.transform.zIndex;
          el.transform.zIndex = nz + 0.5;
        } else if (dir === "backward" && idx > 0) {
          const pz = sorted[idx - 1]!.transform.zIndex;
          el.transform.zIndex = pz - 0.5;
        }
        // 正規化為整數
        slide.elements
          .slice()
          .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
          .forEach((e, i) => {
            e.transform.zIndex = i + 1;
          });
      }),

    setTheme: (themeId) =>
      set((s) => {
        snapshot(s);
        s.project.theme.id = themeId;
      }),

    setThemeOverrides: (overrides) =>
      set((s) => {
        snapshot(s);
        s.project.theme.tokenOverrides = overrides;
      }),

    updateSlideAudio: (slideId, asset, opts) =>
      set((s) => {
        snapshot(s);
        const slide = s.project.deck.slides.find((x) => x.id === slideId);
        if (!slide) return;
        if (asset === null) {
          slide.audio = undefined;
          return;
        }
        let assetId: string;
        if (typeof asset === "string") {
          assetId = asset;
        } else {
          // Add new AssetRef to project if not present
          if (!s.project.assets.some((a) => a.id === (asset as AssetRef).id)) {
            s.project.assets.push(asset as AssetRef);
          }
          assetId = (asset as AssetRef).id;
        }
        slide.audio = { assetId, mode: opts.mode, loop: opts.loop, volume: opts.volume };
        s.project.meta.updatedAt = Date.now();
      }),

    updateSlideTransition: (slideId, patch) =>
      set((s) => {
        snapshot(s);
        const slide = s.project.deck.slides.find((x) => x.id === slideId);
        if (!slide) return;
        Object.assign(slide.transition, patch);
        s.project.meta.updatedAt = Date.now();
      }),

    relayoutCurrentSlide: () =>
      set((s) => {
        const slide = currentSlide(s.project, s.currentSlideId);
        if (!slide || slide.elements.length === 0) return;
        snapshot(s);
        relayoutSlideElements(slide);
        s.project.meta.updatedAt = Date.now();
      }),

    applyThemeToSlides: (slideIds, themeId) =>
      set((s) => {
        if (slideIds.length === 0) return;
        snapshot(s);
        const targets = new Set(slideIds);
        for (const slide of s.project.deck.slides) {
          if (targets.has(slide.id)) slide.themeId = themeId;
        }
        s.project.meta.updatedAt = Date.now();
      }),

    applyTransitionToSlides: (slideIds, preset) =>
      set((s) => {
        if (slideIds.length === 0) return;
        snapshot(s);
        const targets = new Set(slideIds);
        for (const slide of s.project.deck.slides) {
          if (targets.has(slide.id)) slide.transition.preset = preset;
        }
        s.project.meta.updatedAt = Date.now();
      }),

    saveSnapshot: (name) =>
      set((s) => {
        const trimmed = name.trim() || `快照 ${new Date().toLocaleString()}`;
        s.snapshots.unshift({
          id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: trimmed,
          createdAt: Date.now(),
          project: structuredCloneSafe(s.project),
        });
        if (s.snapshots.length > 30) s.snapshots.length = 30;
      }),

    restoreSnapshot: (snapshotId) =>
      set((s) => {
        const snap = s.snapshots.find((x) => x.id === snapshotId);
        if (!snap) return;
        snapshot(s);
        s.project = structuredCloneSafe(snap.project);
        s.currentSlideId = s.project.deck.slides[0]?.id ?? "";
        s.selection = [];
      }),

    deleteSnapshot: (snapshotId) =>
      set((s) => {
        s.snapshots = s.snapshots.filter((x) => x.id !== snapshotId);
      }),

    setTitle: (title) =>
      set((s) => {
        s.project.meta.title = title;
        s.project.meta.updatedAt = Date.now();
      }),

    undo: () =>
      set((s) => {
        const prev = s.past.pop();
        if (!prev) return;
        s.future.push(structuredCloneSafe(s.project));
        s.project = prev;
        if (!currentSlide(s.project, s.currentSlideId)) {
          s.currentSlideId = s.project.deck.slides[0]?.id ?? "";
        }
        s.selection = [];
      }),

    redo: () =>
      set((s) => {
        const next = s.future.pop();
        if (!next) return;
        s.past.push(structuredCloneSafe(s.project));
        s.project = next;
        s.selection = [];
      }),

    commit: () =>
      set((s) => {
        snapshot(s);
      }),
  })),
);

export function useCurrentSlide(): Slide | undefined {
  return useEditor((s) => s.project.deck.slides.find((x) => x.id === s.currentSlideId));
}

export { findElement, currentSlide };

function relayoutSlideElements(slide: Slide): void {
  const texts = slide.elements.filter((e): e is Extract<Element, { type: "text" }> => e.type === "text");
  const lists = slide.elements.filter((e): e is Extract<Element, { type: "list" }> => e.type === "list");
  const images = slide.elements.filter((e): e is Extract<Element, { type: "image" }> => e.type === "image");
  const shapes = slide.elements.filter((e): e is Extract<Element, { type: "shape" }> => e.type === "shape");

  // 標題文字放上方；其他文字放中段
  if (texts[0]) {
    texts[0].transform.x = 120;
    texts[0].transform.y = 88;
    texts[0].transform.width = 1680;
    texts[0].transform.height = 120;
  }
  for (let i = 1; i < texts.length; i++) {
    texts[i]!.transform.x = 120;
    texts[i]!.transform.y = 240 + (i - 1) * 96;
    texts[i]!.transform.width = 980;
    texts[i]!.transform.height = 88;
  }

  if (lists[0]) {
    lists[0].transform.x = 120;
    lists[0].transform.y = 260;
    lists[0].transform.width = images.length > 0 ? 920 : 1680;
    lists[0].transform.height = 700;
  }

  for (let i = 0; i < images.length; i++) {
    images[i]!.transform.x = images.length === 1 ? 1080 : 1040 + i * 420;
    images[i]!.transform.y = 220;
    images[i]!.transform.width = images.length === 1 ? 720 : 360;
    images[i]!.transform.height = images.length === 1 ? 720 : 320;
  }

  for (let i = 0; i < shapes.length; i++) {
    shapes[i]!.transform.x = 120 + i * 140;
    shapes[i]!.transform.y = 980;
    shapes[i]!.transform.width = 120;
    shapes[i]!.transform.height = 40;
    shapes[i]!.transform.opacity = 0.35;
  }

  // 重排 zIndex
  slide.elements
    .slice()
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
    .forEach((e, idx) => {
      e.transform.zIndex = idx + 1;
    });
}
