# -*- coding: utf-8 -*-
"""I1 多标签页购物篮同步 QA。

同一浏览器 context 开两个页（等同两个标签页，共享 localStorage）：
  Tab A 加菜/减菜/勾选 → Tab B 应收到 storage 事件并同步内存 + 重渲染，反之亦然。
覆盖：加菜同步、select 屏卡片态同步、反向移除同步、勾选同步、总览内容刷新。
用法：先起本地服务（python -m http.server 8901），再运行本脚本。
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8901/index.html"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS  " if cond else "FAIL  ") + name + (("  -> " + str(detail)) if detail and not cond else ""))


errors = []


def go_home(pg):
    """搜索框在首页区，先确保回到首页（返回栈逐级回退）。"""
    for _ in range(4):
        if pg.evaluate("() => !document.getElementById('home').hidden"):
            return True
        pg.click("#backBtn")
        pg.wait_for_timeout(250)
    return pg.evaluate("() => !document.getElementById('home').hidden")


def do_search(pg, q):
    assert go_home(pg), "无法回到首页"
    pg.fill("#search", q)
    pg.press("#search", "Enter")
    pg.wait_for_timeout(400)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    tabA = ctx.new_page()
    tabB = ctx.new_page()
    tabA.on("pageerror", lambda e: errors.append("A:" + str(e)))
    tabB.on("pageerror", lambda e: errors.append("B:" + str(e)))
    tabA.goto(BASE, wait_until="networkidle")
    tabB.goto(BASE, wait_until="networkidle")
    tabA.wait_for_timeout(400)
    tabB.wait_for_timeout(400)

    # ---------- 1. Tab B 先搜索停留在 select 屏（验证卡片态同步） ----------
    do_search(tabB, "炒饭")
    check("Tab B 停留在 select 屏", tabB.evaluate("() => !document.getElementById('select').hidden"))

    # ---------- 2. Tab A 搜索并加两道菜 ----------
    do_search(tabA, "炒饭")
    cards = tabA.query_selector_all("#select .dish-card")
    check("Tab A 搜索有结果卡", len(cards) >= 2, f"cards={len(cards)}")
    for c in cards[:2]:
        c.query_selector(".add-btn").click()
        tabA.wait_for_timeout(150)
    check("Tab A 菜篮 = 2", tabA.evaluate("() => window.__app.cart.size") == 2)

    # ---------- 3. Tab B 收到同步 ----------
    tabB.wait_for_timeout(700)
    check("Tab B 内存菜篮同步为 2", tabB.evaluate("() => window.__app.cart.size") == 2)
    check("Tab B 顶栏菜篮计数同步", tabB.evaluate(
        "() => !document.getElementById('cartPill').hidden && document.getElementById('cartCount').textContent === '2'"))
    check("Tab B select 屏卡片态同步（有 in-cart）", tabB.evaluate(
        "() => !!document.querySelector('#select .dish-card.in-cart')"))
    a_ls = tabA.evaluate("() => localStorage.getItem('grocery-cart-v3')")
    b_ls = tabB.evaluate("() => localStorage.getItem('grocery-cart-v3')")
    check("双 Tab localStorage 一致", b_ls == a_ls and bool(a_ls), f"A={a_ls} B={b_ls}")

    # ---------- 4. Tab B 移除在篮中的菜 → Tab A 同步 ----------
    tabB.evaluate("""() => {
        document.querySelectorAll('#select .dish-card.in-cart .add-btn').forEach(b => b.click());
    }""")
    tabB.wait_for_timeout(300)
    tabA.wait_for_timeout(700)
    check("Tab A 同步 Tab B 的移除（回到 0）", tabA.evaluate("() => window.__app.cart.size") == 0)

    # ---------- 5. 勾选同步：Tab A 加 1 道菜，进导览打勾 ----------
    do_search(tabA, "蛋炒饭")
    tabA.query_selector("#select .dish-card .add-btn").click()
    tabA.wait_for_timeout(200)
    check("Tab A 重新加 1 道菜", tabA.evaluate("() => window.__app.cart.size") == 1)
    tabA.click("#floatCheckout")   # → 总览
    tabA.wait_for_timeout(300)
    tabA.click("#cartPill")        # 总览上再点菜篮图标 → 逐区导览
    tabA.wait_for_timeout(400)
    check("Tab A 进入导览屏", tabA.evaluate("() => !document.getElementById('guide').hidden"))
    tabA.click("#zonePage .item")
    tabA.wait_for_timeout(200)
    check("Tab A 导览打勾 1 项", tabA.evaluate(
        "() => (JSON.parse(localStorage.getItem('grocery-checked-v3') || '[]')).length >= 1"))

    # ---------- 6. Tab B 打开总览，应同步勾选态 ----------
    tabB.wait_for_timeout(700)
    tabB.click("#floatCheckout")
    tabB.wait_for_timeout(500)
    check("Tab B 总览同步勾选态", tabB.evaluate(
        "() => document.querySelectorAll('#ovPage .item.checked').length >= 1"))

    # ---------- 7. Tab B 加一道新菜 → Tab A 总览内容刷新 ----------
    do_search(tabB, "番茄炒蛋")
    tabB.query_selector("#select .dish-card .add-btn").click()
    tabB.wait_for_timeout(200)
    # Tab A 从导览回总览（cartPill 在导览中 → 总览）
    tabA.click("#cartPill")
    tabA.wait_for_timeout(300)
    check("Tab A 回到总览屏", tabA.evaluate("() => !document.getElementById('overview').hidden"))
    tabA.wait_for_timeout(700)
    check("Tab A 内存同步新菜（=2）", tabA.evaluate("() => window.__app.cart.size") == 2)
    ov_text = tabA.evaluate("() => document.getElementById('ovPage').textContent")
    check("Tab A 总览内容已刷新（含新菜）", "番茄炒蛋" in ov_text, ov_text[:60])

print()
print("===== 汇总 =====")
n = len(results)
ok = sum(1 for _, c, _ in results if c)
print(f"共 {n} 项，通过 {ok}，失败 {n - ok}")
print("PAGEERRORS:", len(errors))
for e in errors:
    print("  !", e)
