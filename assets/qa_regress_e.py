# -*- coding: utf-8 -*-
"""Wave E 回归 QA：E1-E2 + G1-G17 体验增强的行为断言"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8901/index.html"
OUT = "assets/qa_regress_e"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS  " if cond else "FAIL  ") + name + (("  -> " + str(detail)) if detail and not cond else ""))


errors, console_msgs = [], []

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_timeout(900)
    pg.evaluate("() => localStorage.clear()")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(900)

    # ---------- G1：首屏价值主张 / 数据 chip / 三步引导 ----------
    chips = pg.evaluate("() => [...document.querySelectorAll('.data-chips .chip')].map(c => c.textContent)")
    check("G1 数据 chip 展示 104/122/125", any('104' in c for c in chips) and any('122' in c for c in chips) and any('125' in c for c in chips), chips)
    steps_vis = pg.evaluate("() => !document.getElementById('steps').hidden")
    check("G1 三步引导默认展示", steps_vis)
    pg.click("#stepsClose")
    pg.wait_for_timeout(150)
    steps_hidden = pg.evaluate("() => document.getElementById('steps').hidden")
    persisted = pg.evaluate("() => localStorage.getItem('gp_steps_dismissed')")
    check("G1 三步引导可关闭且记住", steps_hidden and persisted == "1")
    pg.evaluate("() => localStorage.removeItem('gp_steps_dismissed')")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(700)

    # ---------- G2：农场场景带 ----------
    fb = pg.evaluate("() => { const b = document.getElementById('farmBand'); return { items: b.querySelectorAll('.fb-item').length, sparks: b.querySelectorAll('.fb-spark').length }; }")
    check("G2 农场场景带渲染（物件 + 闪烁光点）", fb["items"] >= 8 and fb["sparks"] >= 4, fb)
    pg.screenshot(path=f"{OUT}_home.png", full_page=True)

    # ---------- G6：空输入抖动 + Toast ----------
    pg.fill("#search", "   ")
    pg.press("#search", "Enter")
    pg.wait_for_timeout(250)
    shake = pg.evaluate("() => document.getElementById('search').classList.contains('shake')")
    toast_on = pg.evaluate("() => !document.getElementById('toast').hidden")
    check("G6 空输入抖动 + Toast 提示", shake and toast_on, f"shake={shake} toast={toast_on}")

    # ---------- G6：无匹配给真出口 ----------
    pg.fill("#search", "不存在的菜xyz")
    pg.press("#search", "Enter")
    pg.wait_for_timeout(400)
    nm_btns = pg.evaluate("() => document.querySelectorAll('#noMatch button').length")
    check("G6 无匹配时有可点出口按钮", nm_btns >= 2, nm_btns)
    pg.click("#nmRandom")
    pg.wait_for_timeout(400)
    on_select = pg.evaluate("() => !document.getElementById('select').hidden")
    check("G6 无匹配点「随便来四个」能跳出", on_select)
    # G15：随机组合约束（至少 1 荤 1 素）
    for _ in range(6):
        pg.evaluate("() => { document.getElementById('rerollBtn').click(); }")
        pg.wait_for_timeout(250)
        mix = pg.evaluate("""() => {
            const cs = [...document.querySelectorAll('.dish-card')];
            const veg = cs.filter(c => (c.querySelector('.dish-meta i') || {}).textContent === '素菜').length;
            return { n: cs.length, veg: veg, meat: cs.length - veg };
        }""")
        if mix["n"] >= 2 and mix["veg"] == 0 or mix["n"] >= 2 and mix["meat"] == 0:
            check("G15 随机至少 1 荤 1 素", False, mix)
            break
    else:
        check("G15 随机至少 1 荤 1 素（6 轮抽样）", True)

    # ---------- 进总览，测 E1/E2/G5/G10 ----------
    pg.evaluate("() => { window.__app.cart.clear(); }")
    cards = pg.evaluate("() => document.querySelectorAll('.dish-card').length")
    for i in range(cards):
        pg.click(f".dish-card:nth-child({i+1}) .add-btn")
        pg.wait_for_timeout(60)
    pg.click("#floatCheckout")
    pg.wait_for_timeout(500)

    # E1：button + role=checkbox + 键盘可操作
    item_info = pg.evaluate("""() => {
        const it = document.querySelector('#ovPage .item');
        return { tag: it.tagName, role: it.getAttribute('role'), aria: it.getAttribute('aria-checked') };
    }""")
    check("E1 .item 是 button + role=checkbox", item_info["tag"] == "BUTTON" and item_info["role"] == "checkbox", item_info)
    pg.focus("#ovPage .item")
    pg.keyboard.press("Space")
    pg.wait_for_timeout(200)
    kb = pg.evaluate("""() => {
        const it = document.querySelector('#ovPage .item');
        return { cls: it.className, aria: it.getAttribute('aria-checked') };
    }""")
    check("E1 空格键可勾选（键盘可用）", "checked" in kb["cls"] and kb["aria"] == "true", kb)

    # E2：有勾选后 ovDone 才可用
    done_enabled = pg.evaluate("() => !document.getElementById('ovDone').disabled")
    check("E2 有勾选后「完成采购」可用", done_enabled)

    # G5：复制文字清单 / 分享链接按钮存在
    btns = pg.evaluate("() => ['ovCopy','ovLink','shareCopy','shareLink'].filter(id => document.getElementById(id)).length")
    check("G5 复制文字清单 / 分享链接按钮齐全", btns == 4, btns)

    # 深链还原
    deep = pg.evaluate("() => { const ids = [...window.__app.cart].slice(0,2).join(','); location.hash = 'm=' + ids; return ids; }")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(900)
    restored = pg.evaluate("() => window.__app.cart.size")
    on_ov = pg.evaluate("() => !document.getElementById('overview').hidden")
    check("G5 深链 #m= 还原菜篮并直达总览", restored >= 2 and on_ov, f"restored={restored} ov={on_ov}")
    pg.evaluate("() => { history.replaceState(null, '', location.pathname); }")

    # G10：分享弹层
    pg.evaluate("() => window.__app.generateListImage()")
    pg.wait_for_timeout(2200)
    modal = pg.evaluate("""() => {
        const m = document.getElementById('shareModal');
        const sheet = m.querySelector('.share-sheet');
        return {
            open: !m.hidden,
            role: sheet.getAttribute('role'),
            modal: sheet.getAttribute('aria-modal'),
            noscroll: document.body.classList.contains('no-scroll')
        };
    }""")
    check("G10 弹层 role=dialog + aria-modal + 锁背景滚动",
          modal["open"] and modal["role"] == "dialog" and modal["modal"] == "true" and modal["noscroll"], modal)
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    closed = pg.evaluate("() => document.getElementById('shareModal').hidden")
    check("G10 Esc 关闭弹层", closed)
    # H10：关闭后 dataURL 释放
    src_cleared = pg.evaluate("() => document.getElementById('shareImg').getAttribute('src')")
    check("H10 关闭后释放 dataURL", src_cleared is None, src_cleared)

    # E2：通关 → 新一单
    pg.evaluate("() => { document.getElementById('ovDone').click(); }")
    pg.wait_for_timeout(400)
    has_new = pg.evaluate("() => !!document.getElementById('doneNew')")
    check("E2 通关态提供「清空菜篮·新一单」", has_new)
    pg.click("#doneNew")
    pg.wait_for_timeout(400)
    cleared = pg.evaluate("() => window.__app.cart.size")
    home_vis = pg.evaluate("() => !document.getElementById('home').hidden")
    check("E2 新一单清空菜篮并回首页", cleared == 0 and home_vis, f"cart={cleared} home={home_vis}")

    # G13：manifest / SW / icon
    man = pg.evaluate("""async () => {
        const r = await fetch('manifest.webmanifest');
        const j = await r.json();
        return { ok: r.ok, name: j.name, icons: (j.icons || []).length };
    }""")
    check("G13 manifest 可访问且含图标", man["ok"] and man["icons"] >= 1, man)
    sw = pg.evaluate("""async () => {
        if (!('serviceWorker' in navigator)) return 'unsupported';
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.length;
    }""")
    check("G13 Service Worker 已注册", sw == 1, sw)

    b.close()

print("\n===== 汇总 =====")
fails = [r for r in results if not r[1]]
print(f"共 {len(results)} 项，通过 {len(results)-len(fails)}，失败 {len(fails)}")
for n, _, d in fails:
    print("  FAIL:", n, d)
print("PAGEERRORS:", len(errors))
for e in errors: print("  ", e)
print("CONSOLE(warn/error):", len(console_msgs))
for m in console_msgs[:20]: print("  ", m)
print("REGRESS-E-DONE")
