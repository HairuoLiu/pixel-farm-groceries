# -*- coding: utf-8 -*-
"""最终 QA v2：成品菜纯文字 + 食材图标接入验证"""
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8901/index.html"
OUT = "assets/qa_final"

errors, console_msgs, failed_req = [], [], []

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("requestfailed", lambda r: failed_req.append(f"{r.url} :: {r.failure}"))
    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_timeout(800)

    # L1 首页
    pg.screenshot(path=f"{OUT}_home.png")

    # 搜"炒饭" → L2 结果页
    pg.fill("#search", "炒饭")
    pg.press("#search", "Enter")
    pg.wait_for_timeout(700)
    pg.screenshot(path=f"{OUT}_search_friedrice.png", full_page=True)

    # 断言：菜品卡零图片（纯文字）
    dish_stats = pg.evaluate("""() => {
        const cards = [...document.querySelectorAll('.dish-card')];
        return {
            cards: cards.length,
            imgs: cards.reduce((n, c) => n + c.querySelectorAll('img').length, 0),
            svgs: cards.reduce((n, c) => n + c.querySelectorAll('svg').length, 0), // 仅允许 pick/add-btn 控件图标
            tiles: document.querySelectorAll('.dish-tile').length,
            names: cards.map(c => c.querySelector('.dish-name') && c.querySelector('.dish-name').textContent)
        };
    }""")
    print("DISH:", json.dumps(dish_stats, ensure_ascii=False))

    # 加两道菜进菜篮 → 导览页（食材图标主场景）
    pg.click(".dish-card:nth-child(1) .add-btn")
    pg.wait_for_timeout(200)
    pg.click(".dish-card:nth-child(2) .add-btn")
    pg.wait_for_timeout(200)
    cart_n = pg.evaluate("window.__app.cart.size")
    print("CART:", cart_n)
    pg.click("#backBtn")
    pg.wait_for_timeout(200)
    pg.evaluate("window.__app && window.__app.goGuide && window.__app.goGuide()")
    pg.wait_for_timeout(500)
    pg.screenshot(path=f"{OUT}_guide.png", full_page=True)

    guide_stats = pg.evaluate("""() => {
        const items = [...document.querySelectorAll('.item')];
        return {
            items: items.length,
            ingIcons: items.filter(i => i.querySelector('.ing-ico svg')).length,
            noIcon: items.filter(i => !i.querySelector('.ing-ico svg')).map(i => i.querySelector('.item-name').textContent)
        };
    }""")
    print("GUIDE:", json.dumps(guide_stats, ensure_ascii=False))

    # 总览页
    pg.evaluate("window.__app && window.__app.goOverview && window.__app.goOverview('guide')")
    pg.wait_for_timeout(500)
    pg.screenshot(path=f"{OUT}_overview.png", full_page=True)
    ov_stats = pg.evaluate("""() => {
        const items = [...document.querySelectorAll('.item')];
        return { items: items.length, ingIcons: items.filter(i => i.querySelector('.ing-ico svg')).length };
    }""")
    print("OVERVIEW:", json.dumps(ov_stats, ensure_ascii=False))

    # 清单图 canvas 导出（含食材图标绘制）
    pg.evaluate("window.__app && window.__app.generateListImage && window.__app.generateListImage()")
    pg.wait_for_timeout(1200)
    modal_open = pg.evaluate("!document.getElementById('shareModal').hidden")
    img_ok = pg.evaluate("""() => { const i = document.getElementById('shareImg'); return i.src.startsWith('data:image/png') && i.naturalWidth > 0; }""")
    print("SHARE: modal=%s img=%s" % (modal_open, img_ok))
    pg.screenshot(path=f"{OUT}_share.png")

    b.close()

print("PAGEERRORS:", len(errors))
for e in errors: print("  ", e)
print("FAILED_REQ:", len(failed_req))
for r in failed_req: print("  ", r)
print("CONSOLE(warn/error):", len(console_msgs))
for m in console_msgs[:20]: print("  ", m)
print("QA-DONE")
