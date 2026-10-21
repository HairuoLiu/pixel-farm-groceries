# -*- coding: utf-8 -*-
"""I2 字体度量实测：测量 Fusion Pixel webfont 与回退字体的度量差异，
计算 @font-face 度量覆盖描述符（ascent/descent/line-gap/size-adjust）。
输出可直接粘贴进 styles.css 的值。
"""
from playwright.sync_api import sync_playwright
import json

FONT_CSS = "https://cdn.jsdelivr.net/npm/@vp-tw/cjk-web-fonts-fusion-pixel-font@0.0.1/dist/12px/proportional/zh_hans/Fusion-Pixel-12px-Proportional-Simplified-Chinese.css"
WF = "Fusion Pixel 12px Proportional Simplified Chinese"

MEASURE_JS = """
(fonts) => {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const out = {};
  const SAMPLES = ['采购小助手', '像素农场买菜记', '红烧牛肉 100g', '加入菜篮', '已勾 3/12 区', 'Steak 42元'];
  fonts.forEach(f => {
    // 家族名必须加引号：Fusion Pixel 名里含 "12px" 维度令牌，不加引号 font 简写解析失败
    ctx.font = `100px "${f}"`;
    const resolved = ctx.font;
    let asc = 0, desc = 0, wsum = 0;
    SAMPLES.forEach(s => {
      const m = ctx.measureText(s);
      asc = Math.max(asc, m.fontBoundingBoxAscent);
      desc = Math.max(desc, m.fontBoundingBoxDescent);
      wsum += m.width;
    });
    out[f] = { ascent: asc, descent: desc, width: wsum / SAMPLES.length, resolved: resolved };
  });
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto("http://127.0.0.1:8901/index.html", wait_until="networkidle")
    # 注入 CDN 字体 CSS 并等待字体真正可用（含 CJK 子集）
    pg.evaluate(f"""() => new Promise(res => {{
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = '{FONT_CSS}';
        l.onload = res; l.onerror = res;
        document.head.appendChild(l);
    }})""")
    pg.evaluate(f"""() => Promise.all([
        document.fonts.load('100px "{WF}"', '采购小助手像素农场'),
        document.fonts.load('100px "{WF}"', 'Steak 42元')
    ])""")
    pg.wait_for_timeout(1500)
    loaded = pg.evaluate(f"""() => Array.from(document.fonts).filter(f => f.family === '{WF}' && f.status === 'loaded').length""")
    print("webfont 已加载子集数:", loaded)

    fonts = [WF, "Microsoft YaHei", "PingFang SC", "sans-serif"]
    data = pg.evaluate(MEASURE_JS, fonts)
    print(json.dumps(data, indent=2, ensure_ascii=False))

    w = data[WF]
    for fb in ["Microsoft YaHei", "PingFang SC", "sans-serif"]:
        f = data.get(fb)
        if not f or f["width"] == 0:
            print(f"{fb}: 本机不可用，跳过")
            continue
        asc = w["ascent"] / f["ascent"] * 100 if f["ascent"] else 0
        desc = w["descent"] / f["descent"] * 100 if f["descent"] else 0
        # size-adjust：回退字宽 / webfont 字宽（让回退字体缩放到与 webfont 同宽）
        sa = f["width"] / w["width"] * 100 if w["width"] else 0
        print(f"\n== 回退 {fb} 的覆盖值 ==")
        print(f"  ascent-override: {asc:.1f}%;")
        print(f"  descent-override: {desc:.1f}%;")
        print(f"  line-gap-override: 0%;")
        print(f"  size-adjust: {sa:.1f}%;")
        print(f"  (webfont: ascent={w['ascent']:.1f} descent={w['descent']:.1f} width={w['width']:.1f} @100px)")
        print(f"  (fallback: ascent={f['ascent']:.1f} descent={f['descent']:.1f} width={f['width']:.1f} @100px)")
