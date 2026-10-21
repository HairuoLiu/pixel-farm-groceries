# -*- coding: utf-8 -*-
"""文档配图截图：DESIGN-pixel.md / showcase.html / README 用。
输出 docs/shots/*.png（移动 390 视口 + 桌面 1280 布局，2x 清晰度）。
统计面板用预置 gp_history 点亮，分享弹层走真实生成流程。
"""
from playwright.sync_api import sync_playwright
import pathlib

BASE = "http://127.0.0.1:8901/index.html"
OUT = pathlib.Path("docs/shots")
OUT.mkdir(parents=True, exist_ok=True)

SEED = """() => {
    localStorage.setItem('gp_history', JSON.stringify({
        lists: 3, items: 47, days: ['2026-07-14','2026-07-18','2026-07-21'],
        dishes: {'番茄炒蛋': 4, '红烧肉': 3, '蛋炒饭': 2, '可乐鸡翅': 2},
        checks: 38
    }));
}"""

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- 移动视口 ----------
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE, wait_until="networkidle")
    pg.evaluate(SEED)
    pg.evaluate("() => localStorage.clear()")
    pg.evaluate(SEED)
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(1200)
    pg.screenshot(path=str(OUT / "m-home.png"), full_page=True)

    pg.fill("#search", "鸡")
    pg.press("#search", "Enter")
    pg.wait_for_timeout(700)
    pg.screenshot(path=str(OUT / "m-select.png"), full_page=True)

    for i in range(3):
        pg.click(f"#select .dish-card:nth-child({i+1}) .add-btn")
        pg.wait_for_timeout(120)
    pg.screenshot(path=str(OUT / "m-select-cart.png"), full_page=True)

    pg.click("#floatCheckout")
    pg.wait_for_timeout(700)
    pg.screenshot(path=str(OUT / "m-overview.png"), full_page=True)

    pg.click("#cartPill")   # 总览 → 导览
    pg.wait_for_timeout(600)
    pg.click("#zonePage .item")   # 打勾一个
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / "m-guide.png"), full_page=True)

    pg.click("#cartPill")   # 导览 → 总览
    pg.wait_for_timeout(400)
    pg.click("#ovImg")      # 生成清单图 → 分享弹层
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(OUT / "m-share.png"), full_page=True)
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)

    # ---------- 桌面布局 ----------
    pg2 = b.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
    pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.goto(BASE, wait_until="networkidle")
    pg2.evaluate(SEED)
    pg2.evaluate("() => localStorage.clear()")
    pg2.evaluate(SEED)
    pg2.reload(wait_until="networkidle")
    pg2.wait_for_timeout(1200)
    pg2.screenshot(path=str(OUT / "d-home.png"))
    pg2.fill("#search", "牛肉")
    pg2.press("#search", "Enter")
    pg2.wait_for_timeout(700)
    for i in range(4):
        pg2.click(f"#select .dish-card:nth-child({i+1}) .add-btn")
        pg2.wait_for_timeout(120)
    pg2.click("#floatCheckout")
    pg2.wait_for_timeout(700)
    pg2.screenshot(path=str(OUT / "d-overview.png"))

    b.close()
    print("截图完成：", errs and ("PAGEERRORS: " + str(errs)) or "0 pageerror")
    for f in sorted(OUT.glob("*.png")):
        print(f"  {f.name}  {f.stat().st_size // 1024} KB")
