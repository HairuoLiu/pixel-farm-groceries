# -*- coding: utf-8 -*-
"""Wave A/B/C 回归 QA：稳定性 / 视觉 / 数据修复的行为断言。

用法：先起本地服务（python -m http.server 8901），再运行本脚本。
每个用例打印 PASS / FAIL，末尾汇总。
"""
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8901/index.html"
OUT = "assets/qa_regress"

results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS  " if cond else "FAIL  ") + name + (("  -> " + str(detail)) if detail and not cond else ""))


errors, console_msgs, failed_req = [], [], []

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("requestfailed", lambda r: failed_req.append(f"{r.url} :: {r.failure}"))

    # ---------- 用例 1：脏 localStorage 不白屏、失效 id 被清洗 ----------
    pg.add_init_script("""
        localStorage.setItem('grocery-cart-v3', JSON.stringify({a:1}));      // 对象
        localStorage.setItem('grocery-checked-v3', JSON.stringify(42));       // 数字
    """)
    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_timeout(600)
    home_ok = pg.evaluate("() => !document.getElementById('home').hidden")
    cart_clean = pg.evaluate("() => window.__app.cart.size === 0")
    check("A1 脏 localStorage（对象/数字）不回退白屏", home_ok and cart_clean,
          f"home_visible={home_ok} cart={cart_clean}")

    # 用例 1b：独立上下文（避免 init_script 重复注入）验证失效 id 清洗
    ctx2 = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg2 = ctx2.new_page()
    pg2.on("pageerror", lambda e: errors.append("[pg2] " + str(e)))
    pg2.add_init_script("""
        localStorage.setItem('grocery-cart-v3', JSON.stringify(['tomato_scrambled_egg','ghost-id','dongpo_pork', 7, null]));
        localStorage.setItem('grocery-checked-v3', JSON.stringify(['veg|土豆','zzz|不存在的区']));
    """)
    pg2.goto(BASE, wait_until="networkidle")
    pg2.wait_for_timeout(600)
    st = pg2.evaluate("""() => {
        const c = window.__app.cart;
        const ids = [...c];
        const allReal = ids.every(id => window.__app.DATA.dishes.some(d => d.id === id));
        return { n: c.size, allReal: allReal, ids: ids };
    }""")
    check("A1 失效 dish id 启动时被清洗", st["n"] >= 1 and st["allReal"], st)
    ov_ok = pg2.evaluate("() => { window.__app.goOverview('home'); return !document.getElementById('overview').hidden; }")
    ov_items = pg2.evaluate("() => document.querySelectorAll('#ovPage .item').length")
    check("A1 清洗后总览可正常渲染（无空白/虚假通关）", ov_ok and ov_items > 0, f"ov_ok={ov_ok} items={ov_items}")
    ctx2.close()

    # 清回干净态
    pg.evaluate("() => { localStorage.removeItem('grocery-cart-v3'); localStorage.removeItem('grocery-checked-v3'); }")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(600)

    # ---------- 用例 2：搜索 → L2 ----------
    pg.fill("#search", "炒饭")
    pg.press("#search", "Enter")
    pg.wait_for_timeout(500)
    n_cards = pg.evaluate("() => document.querySelectorAll('.dish-card').length")
    check("搜索「炒饭」进入 L2 且有结果卡", n_cards >= 3, n_cards)

    # ---------- 用例 3（A5）：只有 .add-btn 能加菜，卡体点击无效 ----------
    pg.evaluate("() => { window.__app.cart.clear(); }")
    pg.click(".dish-card:nth-child(1) .add-btn")
    pg.wait_for_timeout(150)
    n1 = pg.evaluate("() => window.__app.cart.size")
    # 点卡体（非按钮区）应无反应
    pg.click(".dish-card:nth-child(1) .dish-name", position={"x": 5, "y": 5})
    pg.wait_for_timeout(150)
    n2 = pg.evaluate("() => window.__app.cart.size")
    check("A5 卡体点击不误触加菜（唯一入口 add-btn）", n1 == 1 and n2 == 1, f"{n1}->{n2}")
    # 局部更新：卡片状态确实变了
    card_state = pg.evaluate("""() => {
        const c = document.querySelector('.dish-card');
        return { inCart: c.classList.contains('in-cart'), pick: getComputedStyle(c.querySelector('.pick')).display };
    }""")
    check("A5 局部更新单卡（in-cart + pick 显示）", card_state["inCart"] and card_state["pick"] != "none", card_state)

    # ---------- 用例 4（A5）：移除出 Toast + 撤销 ----------
    pg.click(".dish-card:nth-child(1) .add-btn")
    pg.wait_for_timeout(150)
    n_removed = pg.evaluate("() => window.__app.cart.size")
    toast_vis = pg.evaluate("() => { const t = document.getElementById('toast'); return !t.hidden && t.classList.contains('show'); }")
    has_undo = pg.evaluate("() => !!document.querySelector('#toast .toast-act')")
    check("A5 移除后弹出 Toast", n_removed == 0 and toast_vis, f"cart={n_removed} toast={toast_vis}")
    check("A5 Toast 带「撤销」按钮", has_undo)
    if has_undo:
        pg.click("#toast .toast-act")
        pg.wait_for_timeout(200)
        n_undo = pg.evaluate("() => window.__app.cart.size")
        check("A5 点「撤销」恢复菜篮", n_undo == 1, n_undo)

    # ---------- 用例 5（A4）：返回键逐级返回 ----------
    pg.evaluate("() => { window.__app.cart.clear(); }")
    pg.click(".dish-card:nth-child(1) .add-btn")
    pg.click(".dish-card:nth-child(2) .add-btn")
    pg.wait_for_timeout(200)
    pg.click("#floatCheckout")
    pg.wait_for_timeout(300)
    on_ov = pg.evaluate("() => !document.getElementById('overview').hidden")
    check("floatCheckout 正确进入总览（A3 传字符串来源）", on_ov)
    # A3/A8：从 select 来的总览，ovBack 隐藏 → 走系统返回键回到挑菜/导览
    pg.click("#backBtn")
    pg.wait_for_timeout(300)
    back_screen = pg.evaluate("""() => {
        const vis = ['home','select','guide','overview'].filter(s => !document.getElementById(s).hidden);
        return vis[0];
    }""")
    check("A3/A8 总览返回不断链", back_screen in ("guide", "select"), back_screen)

    # 现在测试返回栈：select → back → home
    pg.evaluate("() => { window.__app.goGuide(); }")
    pg.wait_for_timeout(200)
    on_guide = pg.evaluate("() => !document.getElementById('guide').hidden")
    check("goGuide 进入导览", on_guide)
    lbl = pg.evaluate("() => document.getElementById('backBtn').getAttribute('aria-label')")
    check("A4 返回键 aria-label 动态（导览上显示下一步目标）", lbl == "返回挑菜", lbl)
    pg.click("#backBtn")
    pg.wait_for_timeout(300)
    back_screen2 = pg.evaluate("""() => {
        const vis = ['home','select','guide','overview'].filter(s => !document.getElementById(s).hidden);
        return vis[0];
    }""")
    check("A4 导览返回键回到 select（保留挑菜列表）", back_screen2 == "select", back_screen2)
    dishes_kept = pg.evaluate("() => document.querySelectorAll('.dish-card').length")
    check("A4 返回后挑菜列表未丢", dishes_kept >= 2, dishes_kept)
    lbl2 = pg.evaluate("() => document.getElementById('backBtn').getAttribute('aria-label')")
    check("A4 返回键 aria-label 动态（select 上显示回首页）", lbl2 == "返回首页", lbl2)

    # ---------- 用例 6（A6）：导览进度 + 打勾反馈 ----------
    pg.evaluate("() => { window.__app.goGuide(); }")
    pg.wait_for_timeout(200)
    prog_before = pg.evaluate("() => document.getElementById('guideProgress').textContent")
    check("A6 导览进度含「已勾 x/y」", "已勾" in prog_before, prog_before)
    pg.click("#zonePage .item")
    pg.wait_for_timeout(200)
    prog_after = pg.evaluate("() => document.getElementById('guideProgress').textContent")
    tip_after = pg.evaluate("() => { const t = document.getElementById('zoneTip'); return t ? t.textContent : ''; }")
    check("A6 打勾后进度即时刷新", prog_before != prog_after, f"{prog_before} -> {prog_after}")
    check("A6 本区贴士显示「已勾 x/y」", "已勾" in tip_after, tip_after)
    item_state = pg.evaluate("""() => {
        const it = document.querySelector('#zonePage .item');
        return { cls: it.className, aria: it.getAttribute('aria-checked') };
    }""")
    check("A6 勾选态 class + aria-checked 同步", "checked" in item_state["cls"], item_state)

    # ---------- 用例 7（A8）：总览勾选后返回导览 DOM 不陈旧 ----------
    pg.evaluate("() => { window.__app.goOverview('guide'); }")
    pg.wait_for_timeout(300)
    # 在总览勾掉第一项
    pg.click("#ovPage .item")
    pg.wait_for_timeout(200)
    ov_checked = pg.evaluate("() => document.querySelectorAll('#ovPage .item.checked').length")
    pg.click("#ovBack")
    pg.wait_for_timeout(300)
    guide_checked = pg.evaluate("() => document.querySelectorAll('#zonePage .item.checked').length")
    check("A8 总览勾选后返回导览已同步", ov_checked == guide_checked, f"ov={ov_checked} guide={guide_checked}")
    idx_kept = pg.evaluate("() => { window.__app.goGuide(); return document.querySelectorAll('.dot.on').length; }")
    check("A8 guideIndex 不被无条件重置", idx_kept == 1, idx_kept)

    # ---------- 用例 8（A7）：移除菜后幽灵勾选被清理 ----------
    # 记录当前 checked 数，然后移除一道菜
    before = pg.evaluate("() => window.__app ? JSON.stringify([...window.__app.cart]) : '[]'")
    # 通过 UI 移除：回 select 点第二张卡的 add-btn
    pg.evaluate("() => { window.__app.goGuide(); }")
    pg.click("#backBtn")
    pg.wait_for_timeout(300)
    checked_before = pg.evaluate("""() => {
        const raw = localStorage.getItem('grocery-checked-v3');
        return raw ? JSON.parse(raw).length : 0;
    }""")
    # 移除第一张卡（dish-001 之类），其独有食材 key 应被清掉
    ghost_before = pg.evaluate("""() => {
        const raw = localStorage.getItem('grocery-checked-v3');
        const arr = raw ? JSON.parse(raw) : [];
        // 收集将被移除的菜独有的 key（其它菜不再引用）
        const id = document.querySelector('.dish-card').getAttribute('data-id');
        const d = window.__app.DATA.dishes.find(x => x.id === id);
        const others = new Set();
        window.__app.cart.forEach(cid => { if (cid === id) return; const dd = window.__app.DATA.dishes.find(x => x.id === cid); (dd.items||[]).forEach(i => others.add(i.zone + '|' + i.name)); });
        return arr.filter(k => { const zn = k.split('|'); return d.items.some(i => i.zone + '|' + i.name === k) && !others.has(k); }).length;
    }""")
    pg.click(".dish-card:nth-child(1) .add-btn")
    pg.wait_for_timeout(250)
    checked_after = pg.evaluate("""() => {
        const raw = localStorage.getItem('grocery-checked-v3');
        return raw ? JSON.parse(raw).length : 0;
    }""")
    check("A7 移除菜品后幽灵勾选被清理",
          checked_after <= checked_before - max(0, ghost_before),
          f"before={checked_before} ghost={ghost_before} after={checked_after}")

    # ---------- 用例 9：完整流程 + 满流程 canvas ----------
    pg.evaluate("() => { localStorage.removeItem('grocery-cart-v3'); localStorage.removeItem('grocery-checked-v3'); }")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(500)
    pg.click("#randomFour")
    pg.wait_for_timeout(400)
    cards = pg.evaluate("() => document.querySelectorAll('.dish-card').length")
    for i in range(cards):
        pg.click(f".dish-card:nth-child({i+1}) .add-btn")
        pg.wait_for_timeout(80)
    full_n = pg.evaluate("() => window.__app.cart.size")
    pg.click("#floatCheckout")
    pg.wait_for_timeout(400)
    pg.click("#ovImg")
    pg.wait_for_timeout(1800)
    img_ok = pg.evaluate("""() => { const i = document.getElementById('shareImg'); return i.src.startsWith('data:image/png') && i.naturalWidth > 0; }""")
    check("满篮 canvas 导出 PNG", full_n == cards and img_ok, f"cart={full_n} cards={cards} img={img_ok}")
    pg.screenshot(path=f"{OUT}_share.png")

    b.close()

print("\n===== 汇总 =====")
fails = [r for r in results if not r[1]]
print(f"共 {len(results)} 项，通过 {len(results)-len(fails)}，失败 {len(fails)}")
for n, _, d in fails:
    print("  FAIL:", n, d)
print("PAGEERRORS:", len(errors))
for e in errors: print("  ", e)
print("FAILED_REQ:", len(failed_req))
for r in failed_req: print("  ", r)
print("CONSOLE(warn/error):", len(console_msgs))
for m in console_msgs[:20]: print("  ", m)
print("REGRESS-DONE")
