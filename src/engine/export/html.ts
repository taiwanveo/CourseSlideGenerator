/**
 * HTML 匯出 — 產出單一自包含 .html：每頁一個 1920×1080 舞台，
 * 內含動效 keyframes 與簡易播放 runtime（方向鍵 / 點擊切頁、進場動畫重播）。
 */
import { renderToStaticMarkup } from "react-dom/server";
import type { Project } from "../../model/types";
import { buildKeyframesCss } from "../motion/catalog";
import { buildAssetMap } from "../../renderer/assets";
import { SlideStage } from "../../renderer/SlideStage";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../model/types";

export function exportHtml(project: Project): string {
  const assets = buildAssetMap(project.assets);
  const slidesHtml = project.deck.slides
    .map((slide, i) => {
      const inner = renderToStaticMarkup(
        SlideStage({ slide, theme: project.theme, assets }),
      );
      return `<section class="csg-slide" data-index="${i}">${inner}</section>`;
    })
    .join("\n");

  const keyframes = buildKeyframesCss();

  return `<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(project.meta.title)}</title>
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { height: 100%; background: #000; overflow: hidden; font-family: system-ui, sans-serif; }
  #stage { position: fixed; inset: 0; display: grid; place-items: center; }
  .csg-deck { position: relative; width: ${CANVAS_WIDTH}px; height: ${CANVAS_HEIGHT}px; transform-origin: center; }
  .csg-slide { position: absolute; inset: 0; opacity: 0; pointer-events: none; transition: opacity .5s ease; }
  .csg-slide.active { opacity: 1; pointer-events: auto; }
  .csg-nav { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 10px; align-items: center; color: #fff; font-size: 14px;
    background: rgba(0,0,0,.5); padding: 8px 14px; border-radius: 999px; backdrop-filter: blur(8px); z-index: 10; }
  .csg-nav button { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; }
  ${keyframes}
</style>
</head>
<body>
  <div id="stage"><div class="csg-deck">${slidesHtml}</div></div>
  <div class="csg-nav">
    <button id="prev">‹</button><span id="counter"></span><button id="next">›</button>
  </div>
<script>
  (function(){
    var deck = document.querySelector('.csg-deck');
    var slides = Array.prototype.slice.call(document.querySelectorAll('.csg-slide'));
    var counter = document.getElementById('counter');
    var idx = 0;
    function fit(){
      var s = Math.min(window.innerWidth/${CANVAS_WIDTH}, window.innerHeight/${CANVAS_HEIGHT});
      deck.style.transform = 'scale('+s+')';
    }
    function show(n){
      idx = Math.max(0, Math.min(slides.length-1, n));
      slides.forEach(function(el,i){ el.classList.toggle('active', i===idx); });
      counter.textContent = (idx+1)+' / '+slides.length;
    }
    document.getElementById('prev').onclick = function(){ show(idx-1); };
    document.getElementById('next').onclick = function(){ show(idx+1); };
    window.addEventListener('keydown', function(e){
      if(e.key==='ArrowRight'||e.key===' ') show(idx+1);
      if(e.key==='ArrowLeft') show(idx-1);
    });
    window.addEventListener('resize', fit);
    fit(); show(0);
  })();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}
