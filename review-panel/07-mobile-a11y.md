# 评委 7 · 移动端与无障碍专家评审 —「像素农场 · 采购记」

- 评审对象：`grocery-reminder-pixel`（index.html / styles.css / app.js）
- 核查方式：通读源码 + Playwright 实测 `http://127.0.0.1:8901/index.html`
- 视口：320×568、390×844、768×1024、844×390（横屏），截图存于 `review-panel/shots/`，测量数据存于 `_07_probe.json`
- 环境假设：iPhone/安卓真机、微信内置浏览器、可能横屏

## 实测截图结论

| 视口 | 结论 |
|---|---|
| 320×568 | 无横向溢出（`scrollWidth==clientWidth==320`）；搜索行 200+80px 排布正常；`.dish-grid` 两列卡片可读。顶栏品牌名未溢出。整体未崩。 |
| 390×844 | 主力机型表现良好；`.item` 行高 81px、点按区域充足；`#floatCheckout` 56px 高、距底 16px（+`env(safe-area-inset-bottom)`，iPhone 上会自动抬到 ~50px，这点做得对）。 |
| 768×1024 | 640px 居中「掌机」布局正常，4 列菜类网格成立，悬浮按钮 608px 与栏宽对齐。 |
| 844×390 横屏 | **布局不崩**：app 居中 640px，恰好在刘海左右安全区（~44px）之内，悬浮按钮未被刘海遮挡。但顶栏(≈64px)+悬浮按钮(56px)吃掉 390px 高度的 ~31%，可视内容区偏小；建议横屏做紧凑化（P3，见 #10）。 |
| 分享弹层 | 清单图 PNG 实测正常渲染（1600×2092，390 视口下高 458px）；弹层 `overflow:auto` 可滚。**但实测滚动穿透**：弹层打开时滚轮使 `document.scrollingElement.scrollTop` 0→170（320 视口）、0→400（横屏）；Esc 无法关闭（`closedByEsc=false`）；`#shareModal` 无 `role`/`aria-modal`（实测均为 null）。 |
| 字体 | Fusion Pixel 12px 字体在三个视口均加载成功（`document.fonts.check`=true），像素网格清晰；问题在于**关键信息大量落在 12px 档**（`.dish-desc`/`.zone-page-tip`/`.opt`/`.note`/`.from`/`#noMatch` 实测均 12px）。 |

正面项（不占建议名额）：图标 SVG 已带 `aria-hidden="true" focusable="false"`（icons.js:539）；`:focus-visible` 有全局焦点环；`prefers-reduced-motion` 已处理；`100vh→100dvh` 有降级；`.item` 整行点按无内部嵌套可点元素，误触风险低；返回/菜篮按钮有 `aria-label`。

## 评审建议（10 条）

| # | 问题（具体选择器/视口/文件） | 影响评分(1-5) | 建议 | 优先级 | 工作量 | 验收标准 |
|---|---|---|---|---|---|---|
| 1 | 食材勾选行完全不可键盘操作：`.item` 是 `<div>`（app.js:313/341 渲染，styles.css:294），实测 `tabindex=null`、`role=null`、`aria-checked=null`，`zonePage` 内可聚焦元素数为 **0**，派发 Enter 事件无任何反应。同样 `.dish-card`（app.js:211）整卡 `onclick` 仅靠内部 `.add-btn` 兜底。键盘用户与读屏用户无法勾选任何食材——核心流程对无障碍用户整体不可用 | 5 | `.item` 改为 `<button type="button" class="item" role="checkbox" aria-checked="true/false">`（或 `role="button"` + `aria-pressed`），勾选态同步进 aria；保留整行点按样式（button 重置 `font/text-align/width:100%`）。`.dish-card` 加 `aria-label="把{菜名}加入菜篮"` 或整体改 button | P0 | S/M | Tab 可逐行聚焦 `.item`；Enter/Space 切换勾选；`aria-checked` 随状态翻转；VoiceOver/TalkBack 播报「已勾选/未勾选，{食材名}」 |
| 2 | viewport `maximum-scale=1`（index.html:5）禁用页面缩放，违反 WCAG 1.4.4；且搜索框字号实测 **14px**（styles.css `--fs-body`），iOS Safari 聚焦文本框 <16px 会触发自动放大、失焦后不还原（iOS 10+ 对 pinch 虽无视该 meta，但微信安卓 XWEB/部分国产内核会严格执行禁缩放），用户被困在小字里 | 4 | 删掉 `maximum-scale=1`；`#search` 字号提到 16px（可加 `enterkeyhint="search"`、`input[type=search]{-webkit-appearance:none}` 抹平 iOS 原生圆角/清除钮样式） | P1 | S | meta 仅保留 `width=device-width, initial-scale=1, viewport-fit=cover`；iOS 真机聚焦搜索框页面不自动放大；可正常双指缩放 |
| 3 | 分享弹层三连问题（index.html:116-127, styles.css:380-405, app.js:491-492）：① 弹层打开时**背景滚动穿透**（实测 scrollTop 0→170/0→400）；② 无 `role="dialog"`/`aria-modal`/`aria-labelledby`；③ Esc 不关闭、打开后焦点仍留在触发按钮上可 Tab 进背景、关闭后焦点不归还 | 4 | 打开时锁定 body 滚动（`overflow:hidden`+记录滚动位置，或 `position:fixed` 法）并给 `.share-sheet` 加 `overscroll-behavior:contain`；`#shareModal` 加 `role="dialog" aria-modal="true" aria-labelledby="..."`；打开时聚焦 `#shareSave`、监听 Esc 与 Tab 循环（简单焦点陷阱）、关闭时还原焦点 | P1 | S | 弹层打开时滚动背景页面纹丝不动；Esc 可关闭；Tab 只在弹层内循环；关闭后焦点回到「生成清单图」按钮 |
| 4 | 触控目标 <44×44px：实测 `.add-btn` 高 **38px**（主要转化按钮！）、`#cartPill` 高 **38px**、`.icon-btn`(返回键) **40×40**（styles.css:104,251,119）。iOS HIG / Android Material / WCAG 2.5.8 均要求 ≥44px，拇指误触率高 | 4 | `.add-btn`：`padding:8px→12px 8px` 或 `min-height:44px`；`.icon-btn` 40→44px；`.cart-pill` `padding:6px→10px 12px`。像素风不变，只放大盒模型 | P1 | S | Playwright 实测三者在 320/390 视口下 bounding box 高度均 ≥44px |
| 5 | 12px 像素字承载关键信息且无字号档位：`.dish-desc`（菜谱简介）、`.zone-page-tip`、`.from`（"用于：XX、XX"）、`.opt`/`.note`（可选/备注标签）、`#noMatch` 提示实测全部 12px；320px 小屏与中老年用户真机阅读吃力，且 pixel 字体 12px 网格不允许浏览器平滑放大 | 4 | 保留像素审美，提供字号档位：右上角「A-/A+」切换，`html[data-fs]` 映射 `--fs-nano:12/14px、--fs-body:14/16px…` 存 localStorage；至少先把 `--fs-nano` 全局提到 13px、`.dish-desc` 用 `--fs-body(14px)` | P1 | M | 提供可见的字号切换且档位持久化；12px 文本仅剩纯装饰；320 视口下 `.from` 行不溢出 |
| 6 | 微信内置浏览器兼容：`color-mix(in srgb,…)` 无回退（styles.css:274,288,340 及 app.js:216 内联样式）——微信安卓 XWEB 旧内核与 iOS<16.2 不支持，整条 background 声明被丢弃，分区色底/徽章底直接消失（`100dvh` 倒是有 `100vh` 兜底，写得对） | 3 | 每个 `color-mix` 声明前补一行同义回退：`background: var(--c-cream);`（或 JS 里用 `mix()` 已有函数预计算色值再内联） | P1 | S | 在 Chrome 86 模拟（或 caniuse 低版本内核）下分区面板/徽章仍有底色；无裸透明块 |
| 7 | 微信里「保存图片/分享到手机」双双失效：app.js:494 `a.download` 在 iOS Safari/微信 WebView 不生效；app.js:504 `navigator.share` 在微信内不可用（静默 fallback 到同样无效的 download）。用户点完两个按钮都拿不到图 | 4 | 弹层内加一行像素字提示「微信内：长按图片保存到相册」；检测 `navigator.userAgent` 微信环境时隐藏/置灰「分享到手机」；非微信再走 share/download | P1 | S | 微信真机上按提示长按可存图；非微信环境 download/share 正常；不再出现点了没反应 |
| 8 | 对比度不达标（实测 WCAG 计算）：`.eyebrow`（#D69E2D on #FFF1D6）**2.14:1**；顶栏 `.brand-name`（#FFF1D6 on 木纹渐变顶端 #C89B6A）**2.25:1**；主 CTA 文字（#FFF8EA on #E0533F，16px 非大字）**3.63:1**（`float-checkout`/`search-go`/`rbtn.primary` 同源）；`.add-btn` 已选态 12px 文字 on `--c-grass-d` 3.87:1 | 3 | `.eyebrow` 改 `--c-ink-soft` 或直接 `--c-ink`；`--c-tomato` 加深到 `#C94534`（实测 4.53:1）或按钮文字加 1px 深色描边像素阴影；`.add-btn` 已选态文字改用 16px 或底色换 `#4E7A34`（4.78:1）；brand-name 把 text-shadow 提到 1px 全描边并加深木纹顶部 | P2 | S | 关键文字组合对比度 ≥4.5:1（用 axe/对比度工具复测通过） |
| 9 | 状态变化对读屏静默：菜篮数量（`#cartCount`/`#floatCount`，app.js:246-248）、勾选进度「已勾 x/y」（app.js:522）、`#noMatch` 出现（app.js:156）均无 `aria-live`；`#cuisineToggle`（app.js:553）无 `aria-expanded`；导览进度点 `.dot` 纯装饰却可被读屏读出 | 3 | 给 `#noMatch` 加 `role="alert"`；`#cartCount` 外层加 `aria-live="polite"`（或给 cart-pill 的 aria-label 动态含数量）；进度 `.gp-num` 加 `aria-live="polite"`、`.dot` 加 `aria-hidden="true"`；cuisineToggle 补 `aria-expanded` | P2 | S | 勾选/加篮后 VoiceOver 播报新数值；搜索无结果时读屏播报提示；折叠钮播报展开状态 |
| 10 | 焦点环被覆盖 + 横屏空间紧张：`.input:focus{outline:none}`（styles.css:162）特异性(0,2,0)压过全局 `:focus-visible`(0,1,0)，搜索框键盘聚焦时无可见焦点环（仅边框变色 #3B2A20→#B83A2B，过弱）；横屏(844×390)下 sticky 顶栏 64px + 悬浮按钮 56px 占视口高度 ~31% | 2 | 改为 `.input:focus{outline:none} .input:focus-visible{outline:3px solid var(--c-corn-d); outline-offset:2px}`；横屏加 `@media (orientation:landscape) and (max-height:480px)`：顶栏 padding 8px、float-checkout `padding:10px`、`.screen` padding 12px 16px | P2 | S | 键盘 Tab 到搜索框有 3px 黄色焦点环；横屏 iPhone 上首屏可见两行卡片 + 顶栏 ≤100px |

## 总评

移动端基本功中上：`viewport-fit=cover` + `env(safe-area-inset-bottom)`、`100dvh` 降级、reduced-motion、图标 aria-hidden、320px 无溢出、横屏不崩，都是实打实做对的地方。主要失分在**无障碍语义层几乎缺席**（核心勾选流程键盘/读屏完全不可用，P0）与**真机细节**（弹层滚动穿透、微信保存失效、38px 触控目标、14px 输入框触发 iOS 缩放）。上述 10 条中 1/3/4/7 均为小工作量高收益修复，建议赛前优先处理。

*（截图证据：`review-panel/shots/` 共 24 张；测量原始数据：`_07_probe.json`；对比度计算：`_07_contrast.py`）*
