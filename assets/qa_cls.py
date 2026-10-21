# -*- coding: utf-8 -*-
"""I2 验证：字体 swap 前后布局位移对比。
配置 A（线上 CSS，FB-Pixel 度量对齐）vs 配置 B（旧字体栈，无对齐）。
流程：屏蔽 CDN 字体 CSS（模拟首屏回退态）量高度 → 放行字体、等待加载 → 再量高度。
两个配置的 swap 前后高度差都应接近 0，但 A 的绝对差应 <= B 的绝对差。
"""
from playwright.sync_api import sync_playwright

FONT_CSS_SUB = "Fusion-Pixel-12px-Proportional-Simplified-Chinese.css"
BASE = "http://127.0.0.1:8901/index.html"

MEASURE = """() => {
    const out = { docH: document.documentElement.scrollHeight, els: {} };
    document.querySelectorAll('.screen-title, .rbtn, .dish-name, .zone-page-tip, .stat-t, .btn-ico').forEach((el, i) => {
        if (i < 12) {
            const r = el.getBoundingClientRect();
            out.els[(el.className || el.tagName) + '#' + i] = [Math.round(r.height * 100) / 100, Math.round(r.width * 100) / 100];
        }
    });
    return out;
}"""


def run(ctx_factory, label):
    with sync_playwright() as p:
        b = p.chromium.launch()
        results = {}
        for cfg in ("blocked", "loaded"):
            ctx = b.new_context(viewport={"width": 390, "height": 844})
            pg = ctx.new_page()
            state = {"block": cfg == "blocked"}

            def handler(route):
                if FONT_CSS_SUB in route.request.url and state["block"]:
                    route.fulfill(status=200, content_type="text/css", body="/* blocked */")
                else:
                    route.continue_()

            pg.route("**/*", handler)
            pg.goto(BASE, wait_until="networkidle")
            if cfg == "loaded":
                pg.evaluate("() => document.fonts.ready.then(() => new Promise(r => setTimeout(r, 1200)))")
                pg.wait_for_timeout(800)
            pg.wait_for_timeout(500)
            # 触发 select 屏渲染，保证有卡片可量
            if cfg == "loaded" and pg.evaluate("() => document.getElementById('home').hidden"):
                pg.click("#backBtn")
                pg.wait_for_timeout(300)
            pg.fill("#search", "炒饭")
            pg.press("#search", "Enter")
            pg.wait_for_timeout(500)
            results[cfg] = pg.evaluate(MEASURE)
            ctx.close()
        b.close()
        return results


def compare(res):
    a, c = res["blocked"], res["loaded"]
    d_doc = abs(a["docH"] - c["docH"])
    d_els = 0
    for k in a["els"]:
        if k in c["els"]:
            d_els = max(d_els, abs(a["els"][k][0] - c["els"][k][0]), abs(a["els"][k][1] - c["els"][k][1]))
    return d_doc, d_els


with sync_playwright() as p:
    b = p.chromium.launch()

    # 配置 A：线上 CSS（FB-Pixel 对齐）
    resA = {}
    for cfg in ("blocked", "loaded"):
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        state = {"block": cfg == "blocked"}

        def handlerA(route):
            if FONT_CSS_SUB in route.request.url and state["block"]:
                route.fulfill(status=200, content_type="text/css", body="/* blocked */")
            else:
                route.continue_()

        pg.route("**/*", handlerA)
        pg.goto(BASE, wait_until="networkidle")
        if cfg == "loaded":
            pg.evaluate("() => document.fonts.ready.then(() => new Promise(r => setTimeout(r, 1200)))")
            pg.wait_for_timeout(800)
        pg.wait_for_timeout(400)
        pg.fill("#search", "炒饭")
        pg.press("#search", "Enter")
        pg.wait_for_timeout(500)
        resA[cfg] = pg.evaluate(MEASURE)
        ctx.close()

    # 配置 B：注入旧字体栈（无度量对齐）
    resB = {}
    for cfg in ("blocked", "loaded"):
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        state = {"block": cfg == "blocked"}

        def handlerB(route):
            if FONT_CSS_SUB in route.request.url and state["block"]:
                route.fulfill(status=200, content_type="text/css", body="/* blocked */")
            else:
                route.continue_()

        pg.route("**/*", handlerB)
        pg.add_style_tag(content=':root { --font-px: "Fusion Pixel 12px Proportional Simplified Chinese", "Microsoft YaHei", "PingFang SC", sans-serif; }')
        pg.goto(BASE, wait_until="networkidle")
        if cfg == "loaded":
            pg.evaluate("() => document.fonts.ready.then(() => new Promise(r => setTimeout(r, 1200)))")
            pg.wait_for_timeout(800)
        pg.wait_for_timeout(400)
        pg.fill("#search", "炒饭")
        pg.press("#search", "Enter")
        pg.wait_for_timeout(500)
        resB[cfg] = pg.evaluate(MEASURE)
        ctx.close()

    b.close()

for label, res in (("A FB-Pixel 对齐", resA), ("B 旧栈无对齐", resB)):
    a, c = res["blocked"], res["loaded"]
    d_doc = abs(a["docH"] - c["docH"])
    d_els = 0
    worst = ""
    for k in a["els"]:
        if k in c["els"]:
            d = max(abs(a["els"][k][0] - c["els"][k][0]), abs(a["els"][k][1] - c["els"][k][1]))
            if d > d_els:
                d_els, worst = d, f"{k}: {a['els'][k]} -> {c['els'][k]}"
    print(f"{label}: 文档高度差 {d_doc}px，元素最大差 {d_els}px" + (f"（{worst}）" if worst else ""))
