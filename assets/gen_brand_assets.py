# -*- coding: utf-8 -*-
"""参赛品牌资产生成：OG 分享图 / favicon / apple-touch-icon。
全部用项目自研像素图标引擎 + 设计系统调色板渲染，Playwright 截图出图。
输出：assets/og-image.png (2400x1260@2x)、assets/favicon.png (32x32)、
      assets/apple-touch-icon.png (180x180)
"""
from playwright.sync_api import sync_playwright
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT_CSS = "https://cdn.jsdelivr.net/npm/@vp-tw/cjk-web-fonts-fusion-pixel-font@0.0.1/dist/12px/proportional/zh_hans/Fusion-Pixel-12px-Proportional-Simplified-Chinese.css"

# 与 styles.css 一致的设计令牌
TOKENS = """
  --c-ink:#3B2A20; --c-wood-d:#5C3D2E; --c-wood:#A9724A; --c-wood-l:#C89B6A;
  --c-cream:#FFF1D6; --c-paper:#FFF8EA; --c-cream-d:#EBD9B4; --c-field:#A8CF8B;
  --c-tomato:#E0533F; --c-tomato-d:#B83A2B; --c-corn:#F2C14E; --c-corn-l:#FBEED3;
  --c-sky:#6BB8DE; --c-cart-bg:#E9F5DB;
"""

# ---------- OG 图 1200x630 ----------
OG_HTML = f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="{FONT_CSS}">
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  :root{{{TOKENS}}}
  body{{width:1200px;height:630px;font-family:"Fusion Pixel 12px Proportional Simplified Chinese","Microsoft YaHei",sans-serif;
        background:var(--c-cream);color:var(--c-ink);overflow:hidden;position:relative}}
  /* 像素格纹底 */
  body::before{{content:"";position:absolute;inset:0;
    background-image:linear-gradient(rgba(59,42,32,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(59,42,32,.05) 1px,transparent 1px);
    background-size:24px 24px}}
  .stage{{position:absolute;inset:48px;display:flex;gap:48px}}
  .left{{flex:1.25;display:flex;flex-direction:column;justify-content:center}}
  .eyebrow{{font-size:20px;letter-spacing:2px;color:var(--c-wood-d);margin-bottom:20px}}
  h1{{font-size:64px;line-height:1.15;text-shadow:4px 4px 0 var(--c-corn);margin-bottom:24px}}
  .tagline{{font-size:26px;line-height:1.5;color:#5a463a;max-width:560px;margin-bottom:36px}}
  .chips{{display:flex;gap:14px;flex-wrap:wrap}}
  .chip{{background:var(--c-paper);border:3px solid var(--c-ink);box-shadow:4px 4px 0 var(--c-ink);
         padding:10px 18px;font-size:22px}}
  .chip b{{color:var(--c-tomato-d)}}
  /* 右侧：迷你清单卡（复刻分享图样式） */
  .right{{flex:1;display:flex;align-items:center;justify-content:center}}
  .card{{width:420px;background:var(--c-paper);border:4px solid var(--c-ink);box-shadow:8px 8px 0 var(--c-ink);padding:24px}}
  .card h2{{font-size:26px;display:flex;align-items:center;gap:10px;margin-bottom:6px}}
  .card .sub{{font-size:18px;color:var(--c-ink);opacity:.75;margin-bottom:16px}}
  .zone{{display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:10px;
         border:3px solid var(--c-ink);font-size:20px;background:var(--c-cart-bg)}}
  .zone.meat{{background:#F7DCCF}} .zone.sea{{background:#D9EDF7}} .zone.sea2{{background:#FBEED3}}
  .box{{width:26px;height:26px;border:3px solid var(--c-ink);background:var(--c-paper);flex:none;
        display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--c-tomato-d)}}
  .foot{{position:absolute;left:0;right:0;bottom:0;height:56px;background:linear-gradient(var(--c-wood-l),var(--c-wood));
         border-top:4px solid var(--c-ink);display:flex;align-items:center;padding:0 48px;gap:16px;
         color:var(--c-paper);font-size:20px;text-shadow:2px 2px 0 var(--c-ink)}}
  .foot .dot{{width:14px;height:14px;background:var(--c-corn);border:2px solid var(--c-ink)}}
</style></head><body>
<div class="stage">
  <div class="left">
    <div class="eyebrow">FARM QUEST · 今日任务</div>
    <h1>像素农场<br>采购记</h1>
    <p class="tagline">把「今天吃什么」变成一场 16-bit 农场冒险——选几道菜，闯 8 个市集分区，导出一张能直接发给家人的像素清单图。</p>
    <div class="chips">
      <span class="chip"><b>104</b> 道菜</span>
      <span class="chip"><b>122</b> 种食材</span>
      <span class="chip"><b>125</b> 个手绘像素图标</span>
      <span class="chip"><b>0</b> 依赖</span>
    </div>
  </div>
  <div class="right">
    <div class="card">
      <h2><span id="barnIco"></span>采购清单图</h2>
      <div class="sub">红烧肉 · 蛋炒饭 · 番茄炒蛋</div>
      <div class="zone"><span class="box">✓</span>蔬菜区 · 番茄 2 个</div>
      <div class="zone meat"><span class="box">✓</span>肉禽区 · 五花肉 300g</div>
      <div class="zone sea"><span class="box">✓</span>调料区 · 生抽 / 冰糖</div>
      <div class="zone sea2"><span class="box">·</span>已勾 3 / 9 · 继续闯关</div>
    </div>
  </div>
</div>
<div class="foot"><span class="dot"></span>WorkBuddy 1024 造物挑战 · 参赛作品&nbsp;&nbsp;|&nbsp;&nbsp;零框架 · 零后端 · 离线可玩</div>
<script src="../icons.js"></script>
<script>document.getElementById('barnIco').innerHTML = PXIcon.svg('barn', {{scale: 24}});</script>
</body></html>"""

# ---------- favicon / apple-touch-icon ----------
ICON_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}
html,body{width:100%;height:100%;background:#FFF1D6}
body{display:flex;align-items:center;justify-content:center}
svg{display:block;image-rendering:pixelated}
</style></head><body><div id="i"></div>
<script src="../icons.js"></script>
<script>document.getElementById('i').innerHTML = PXIcon.svg('barn', {scale: SCALE, mono: null});</script>
</body></html>"""


def render(pg, html, path, w, h, dsf=1):
    tmp = ROOT / "assets" / "_tmp_render.html"
    tmp.write_text(html, encoding="utf-8")
    pg.set_viewport_size({"width": w, "height": h})
    pg.goto(tmp.resolve().as_uri(), wait_until="networkidle")
    pg.wait_for_timeout(1200)
    pg.screenshot(path=str(path), clip={"x": 0, "y": 0, "width": w, "height": h})
    tmp.unlink(missing_ok=True)


def new_page(b, dsf):
    ctx = b.new_context(device_scale_factor=dsf)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: print("PAGEERROR:", e))
    return pg


with sync_playwright() as p:
    b = p.chromium.launch()

    pg2 = new_page(b, 2)
    render(pg2, OG_HTML, ROOT / "assets" / "og-image.png", 1200, 630, 2)
    print("og-image.png 生成（2400x1260 @2x）")

    pg1 = new_page(b, 1)
    render(pg1, ICON_HTML.replace("SCALE", "24"), ROOT / "assets" / "favicon.png", 32, 32, 1)
    print("favicon.png 生成（32x32）")

    render(pg1, ICON_HTML.replace("SCALE", "144"), ROOT / "assets" / "apple-touch-icon.png", 180, 180, 1)
    print("apple-touch-icon.png 生成（180x180）")

    b.close()
    for f in ["og-image.png", "favicon.png", "apple-touch-icon.png"]:
        sz = (ROOT / "assets" / f).stat().st_size
        print(f"  {f}: {sz // 1024} KB")
