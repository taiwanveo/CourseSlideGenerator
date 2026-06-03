import type { Element, ElementAnimation, ImageElement, ListElement, ShapeElement, TextElement } from "../model/types";
import { plainText } from "../model/factory";
import { useEditor, useCurrentSlide } from "../store/editorStore";
import { ENTER_PRESETS, EMPHASIS_PRESETS, TRANSITION_PRESETS } from "../engine/motion/catalog";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
      <span style={{ fontSize: 11, color: "var(--app-muted)" }}>{label}</span>
      <input
        className="csg-input"
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span style={{ color: "var(--app-muted)" }}>{label}</span>
      <input
        type="color"
        value={cssColorToHex(value)}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 34, height: 24, padding: 0, border: "none", background: "none", cursor: "pointer" }}
      />
    </label>
  );
}

function TextInspector({ el }: { el: TextElement }) {
  const updateElement = useEditor((s) => s.updateElement);
  const slides = useEditor((s) => s.project.deck.slides);
  const text = el.content.spans.map((s) => s.text).join("");
  return (
    <>
      <Section title="文字">
        <textarea
          className="csg-input"
          rows={4}
          value={text}
          onChange={(e) =>
            updateElement(el.id, (x) => {
              if (x.type === "text") x.content = plainText(e.target.value);
            })
          }
        />
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          <label style={{ fontSize: 11, color: "var(--app-muted)" }}>超連結類型</label>
          <select
            className="csg-select"
            value={el.link?.kind ?? "none"}
            onChange={(e) =>
              updateElement(el.id, (x) => {
                if (x.type !== "text") return;
                if (e.target.value === "none") x.link = undefined;
                else if (e.target.value === "url") x.link = { kind: "url", value: "", target: "blank" };
                else x.link = { kind: "slide", value: slides[0]?.id ?? "" };
              })
            }
          >
            <option value="none">無</option>
            <option value="url">網址</option>
            <option value="slide">頁內跳轉</option>
          </select>
          {el.link?.kind === "url" && (
            <>
              <input
                className="csg-input"
                placeholder="https://example.com"
                value={el.link.value}
                onChange={(e) =>
                  updateElement(el.id, (x) => {
                    if (x.type === "text" && x.link?.kind === "url") x.link.value = e.target.value.trim();
                  })
                }
              />
              <select
                className="csg-select"
                value={el.link.target ?? "blank"}
                onChange={(e) =>
                  updateElement(el.id, (x) => {
                    if (x.type === "text" && x.link?.kind === "url") x.link.target = e.target.value as "self" | "blank";
                  })
                }
              >
                <option value="blank">新分頁開啟</option>
                <option value="self">同分頁開啟</option>
              </select>
            </>
          )}
          {el.link?.kind === "slide" && (
            <select
              className="csg-select"
              value={el.link.value}
              onChange={(e) =>
                updateElement(el.id, (x) => {
                  if (x.type === "text" && x.link?.kind === "slide") x.link.value = e.target.value;
                })
              }
            >
              {slides.map((s, i) => (
                <option key={s.id} value={s.id}>
                  第 {i + 1} 頁
                </option>
              ))}
            </select>
          )}
        </div>
      </Section>
      <Section title="樣式">
        <div style={{ display: "flex", gap: 8 }}>
          <NumberField
            label="字級"
            value={el.style.fontSize}
            onChange={(v) =>
              updateElement(el.id, (x) => {
                if (x.type === "text") x.style.fontSize = v;
              })
            }
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
            <span style={{ fontSize: 11, color: "var(--app-muted)" }}>對齊</span>
            <select
              className="csg-select"
              value={el.style.align}
              onChange={(e) =>
                updateElement(el.id, (x) => {
                  if (x.type === "text") x.style.align = e.target.value as TextElement["style"]["align"];
                })
              }
            >
              <option value="left">左</option>
              <option value="center">中</option>
              <option value="right">右</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <button
            className="csg-btn-sm"
            onClick={() =>
              updateElement(el.id, (x) => {
                if (x.type === "text") x.style.fontWeight = (x.style.fontWeight ?? 400) >= 700 ? 400 : 700;
              })
            }
          >
            粗體
          </button>
          <ColorField
            label="色彩"
            value={el.style.color}
            onChange={(v) =>
              updateElement(el.id, (x) => {
                if (x.type === "text") x.style.color = v;
              })
            }
          />
        </div>
      </Section>
    </>
  );
}

function ListInspector({ el }: { el: ListElement }) {
  const updateElement = useEditor((s) => s.updateElement);
  const text = el.items.map((it) => it.spans.map((s) => s.text).join("")).join("\n");
  return (
    <>
      <Section title="條列項目（每行一項）">
        <textarea
          className="csg-input"
          rows={6}
          value={text}
          onChange={(e) =>
            updateElement(el.id, (x) => {
              if (x.type === "list") x.items = e.target.value.split("\n").map((t) => plainText(t));
            })
          }
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={el.ordered}
            onChange={(e) =>
              updateElement(el.id, (x) => {
                if (x.type === "list") x.ordered = e.target.checked;
              })
            }
          />
          有序編號（1. 2. 3.）
        </label>
      </Section>
      <Section title="樣式">
        <div style={{ display: "flex", gap: 8 }}>
          <NumberField
            label="字級"
            value={el.style.fontSize}
            onChange={(v) =>
              updateElement(el.id, (x) => {
                if (x.type === "list") x.style.fontSize = v;
              })
            }
          />
          <NumberField
            label="行距×10"
            value={(el.style.lineHeight ?? 1.6) * 10}
            onChange={(v) =>
              updateElement(el.id, (x) => {
                if (x.type === "list") x.style.lineHeight = Math.max(8, v) / 10;
              })
            }
          />
          <NumberField
            label="項距"
            value={el.style.itemGap ?? 16}
            onChange={(v) =>
              updateElement(el.id, (x) => {
                if (x.type === "list") x.style.itemGap = Math.max(0, v);
              })
            }
          />
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <ColorField
            label="文字"
            value={el.style.color}
            onChange={(v) =>
              updateElement(el.id, (x) => {
                if (x.type === "list") x.style.color = v;
              })
            }
          />
          <ColorField
            label="符號"
            value={el.style.markerColor ?? "var(--accent)"}
            onChange={(v) =>
              updateElement(el.id, (x) => {
                if (x.type === "list") x.style.markerColor = v;
              })
            }
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11, color: "var(--app-muted)" }}>對齊</span>
            <select
              className="csg-select"
              value={el.style.align}
              onChange={(e) =>
                updateElement(el.id, (x) => {
                  if (x.type === "list") x.style.align = e.target.value as ListElement["style"]["align"];
                })
              }
            >
              <option value="left">左</option>
              <option value="center">中</option>
              <option value="right">右</option>
            </select>
          </label>
        </div>
      </Section>
    </>
  );
}

function ShapeInspector({ el }: { el: ShapeElement }) {
  const updateElement = useEditor((s) => s.updateElement);
  const isStrokeShape = el.shape === "line" || el.shape === "arrow";
  const strokeWidth = el.stroke?.width ?? 0;
  return (
    <Section title="圖形樣式">
      {!isStrokeShape && (
        <div style={{ marginBottom: 10 }}>
          <ColorField
            label="填滿顏色"
            value={el.fill ?? "var(--accent)"}
            onChange={(v) =>
              updateElement(el.id, (x) => {
                if (x.type === "shape") x.fill = v;
              })
            }
          />
        </div>
      )}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <ColorField
          label={isStrokeShape ? "線條顏色" : "邊框顏色"}
          value={el.stroke?.color ?? "var(--accent)"}
          onChange={(v) =>
            updateElement(el.id, (x) => {
              if (x.type === "shape") x.stroke = { color: v, width: x.stroke?.width ?? 4 };
            })
          }
        />
        <NumberField
          label={isStrokeShape ? "線條粗細" : "邊框粗細"}
          value={strokeWidth}
          onChange={(v) =>
            updateElement(el.id, (x) => {
              if (x.type !== "shape") return;
              const w = Math.max(0, v);
              if (w === 0) x.stroke = undefined;
              else x.stroke = { color: x.stroke?.color ?? "var(--accent)", width: w };
            })
          }
        />
      </div>
      {el.shape === "rect" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <NumberField
            label="圓角"
            value={el.cornerRadius ?? 0}
            onChange={(v) =>
              updateElement(el.id, (x) => {
                if (x.type === "shape") x.cornerRadius = Math.max(0, v);
              })
            }
          />
        </div>
      )}
    </Section>
  );
}

function ImageInspector({ el }: { el: ImageElement }) {
  const updateElement = useEditor((s) => s.updateElement);
  return (
    <Section title="圖片">
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
          <span style={{ fontSize: 11, color: "var(--app-muted)" }}>填充方式</span>
          <select
            className="csg-select"
            value={el.fit}
            onChange={(e) =>
              updateElement(el.id, (x) => {
                if (x.type === "image") x.fit = e.target.value as ImageElement["fit"];
              })
            }
          >
            <option value="contain">完整顯示</option>
            <option value="cover">裁切填滿</option>
            <option value="fill">拉伸填滿</option>
          </select>
        </label>
        <NumberField
          label="圓角"
          value={el.cornerRadius ?? 0}
          onChange={(v) =>
            updateElement(el.id, (x) => {
              if (x.type === "image") x.cornerRadius = Math.max(0, v);
            })
          }
        />
      </div>
    </Section>
  );
}

function AnimationInspector({ el }: { el: Element }) {
  const updateElement = useEditor((s) => s.updateElement);
  const previewElementAnimation = useEditor((s) => s.previewElementAnimation);

  const enterAnim = el.animations.find((a) => a.kind === "enter");
  const emphasisAnim = el.animations.find((a) => a.kind === "emphasis");

  const setEnterPreset = (preset: string) => {
    updateElement(el.id, (x) => {
      const idx = x.animations.findIndex((a) => a.kind === "enter");
      const p = ENTER_PRESETS.find((e) => e.id === preset);
      const newAnim: ElementAnimation = {
        kind: "enter",
        preset,
        delay: enterAnim?.delay ?? 0,
        duration: p?.defaultDuration ?? 500,
        easing: p?.defaultEasing ?? "ease-out",
      };
      if (idx >= 0) x.animations[idx] = newAnim;
      else x.animations.push(newAnim);
    });
  };

  const setEmphasisPreset = (preset: string) => {
    updateElement(el.id, (x) => {
      const idx = x.animations.findIndex((a) => a.kind === "emphasis");
      if (preset === "none") {
        if (idx >= 0) x.animations.splice(idx, 1);
        return;
      }
      const p = EMPHASIS_PRESETS.find((e) => e.id === preset);
      const newAnim: ElementAnimation = {
        kind: "emphasis",
        preset,
        delay: emphasisAnim?.delay ?? 0,
        duration: p?.defaultDuration ?? 700,
        easing: p?.defaultEasing ?? "ease-in-out",
      };
      if (idx >= 0) x.animations[idx] = newAnim;
      else x.animations.push(newAnim);
    });
  };

  const setDelay = (kind: "enter" | "emphasis", v: number) => {
    updateElement(el.id, (x) => {
      const anim = x.animations.find((a) => a.kind === kind);
      if (anim) anim.delay = Math.max(0, v);
    });
  };

  return (
    <Section title="動畫">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button className="csg-btn-sm" onClick={() => previewElementAnimation(el.id)}>
          預覽動畫
        </button>
        {/* 進場動效 */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: "var(--app-muted)" }}>進場動效</span>
          <select
            className="csg-select"
            value={enterAnim?.preset ?? "fade-up"}
            onChange={(e) => setEnterPreset(e.target.value)}
          >
            {ENTER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.nameZh}</option>
            ))}
          </select>
        </label>
        {enterAnim && (
          <NumberField
            label="進場延遲 (ms)"
            value={enterAnim.delay}
            onChange={(v) => setDelay("enter", v)}
          />
        )}
        {/* 強調動效 */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: "var(--app-muted)" }}>強調動效</span>
          <select
            className="csg-select"
            value={emphasisAnim?.preset ?? "none"}
            onChange={(e) => setEmphasisPreset(e.target.value)}
          >
            <option value="none">無</option>
            {EMPHASIS_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.nameZh}</option>
            ))}
          </select>
        </label>
        {emphasisAnim && (
          <NumberField
            label="強調延遲 (ms)"
            value={emphasisAnim.delay}
            onChange={(v) => setDelay("emphasis", v)}
          />
        )}
      </div>
    </Section>
  );
}

function SlideTransitionInspector() {
  const slide = useCurrentSlide();
  const currentSlideId = useEditor((s) => s.currentSlideId);
  const updateSlideTransition = useEditor((s) => s.updateSlideTransition);

  if (!slide) return null;
  return (
    <Section title="投影片轉場">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: "var(--app-muted)" }}>轉場特效</span>
          <select
            className="csg-select"
            value={slide.transition.preset}
            onChange={(e) => updateSlideTransition(currentSlideId, { preset: e.target.value })}
          >
            {TRANSITION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.nameZh}</option>
            ))}
          </select>
        </label>
        <NumberField
          label="時長 (ms)"
          value={slide.transition.duration}
          onChange={(v) => updateSlideTransition(currentSlideId, { duration: Math.max(100, v) })}
        />
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid var(--app-border)", padding: "12px 14px" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--app-muted)", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function cssColorToHex(c: string): string {
  if (c.startsWith("#")) return c;
  return "#ffffff";
}

export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const slide = useEditor((s) => s.project.deck.slides.find((x) => x.id === s.currentSlideId));
  const updateTransform = useEditor((s) => s.updateTransform);

  const el: Element | undefined =
    selection.length === 1 && slide ? slide.elements.find((x) => x.id === selection[0]) : undefined;

  return (
    <div
      style={{
        width: 272,
        flexShrink: 0,
        borderLeft: "1px solid var(--app-border)",
        background: "var(--app-panel)",
        overflowY: "auto",
      }}
    >
      {!el ? (
        <div style={{ padding: 20, color: "var(--app-muted)", fontSize: 13 }}>
          選取一個物件以編輯屬性。
        </div>
      ) : (
        <>
          <Section title="位置與尺寸">
            <div style={{ display: "flex", gap: 8 }}>
              <NumberField label="X" value={el.transform.x} onChange={(v) => updateTransform(el.id, { x: v }, true)} />
              <NumberField label="Y" value={el.transform.y} onChange={(v) => updateTransform(el.id, { y: v }, true)} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <NumberField label="寬" value={el.transform.width} onChange={(v) => updateTransform(el.id, { width: v }, true)} />
              <NumberField label="高" value={el.transform.height} onChange={(v) => updateTransform(el.id, { height: v }, true)} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <NumberField label="旋轉°" value={el.transform.rotation} onChange={(v) => updateTransform(el.id, { rotation: v }, true)} />
              <NumberField
                label="透明%"
                value={el.transform.opacity * 100}
                onChange={(v) => updateTransform(el.id, { opacity: Math.max(0, Math.min(1, v / 100)) }, true)}
              />
            </div>
          </Section>

          {el.type === "text" && <TextInspector el={el} />}
          {el.type === "list" && <ListInspector el={el} />}
          {el.type === "shape" && <ShapeInspector el={el} />}
          {el.type === "image" && <ImageInspector el={el} />}
          <AnimationInspector el={el} />
        </>
      )}
      <SlideTransitionInspector />
    </div>
  );
}
