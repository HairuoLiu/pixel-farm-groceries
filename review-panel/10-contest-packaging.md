# 评委 10 · 参赛策略与包装（作品集/开源呈现）

> 审查对象：`grocery-reminder-pixel`（像素农场 · 采购记）
> 审查视角：该作品提交 WorkBuddy「1024 造物挑战」应用创作大赛时，**在评审页面 / 演示链接上是否讲得清、传得动、记得住**
> 已实测：DESIGN-pixel.md（261 行 / 9 章 + 2 附录）、index.html 首屏结构、app.js 启动流程、`assets/` 全部 407 个文件、根目录清单

---

## 〇、现状速查（实测结论）

| 检查项 | 现状 | 判定 |
|--------|------|------|
| README.md | **根目录不存在** | ❌ 致命 |
| LICENSE | **不存在** | ❌ 缺失 |
| .gitignore | **不存在** | ❌ 缺失 |
| 在线演示链接 | **无任何部署痕迹**（非 git 仓库、无 CI、无 Pages 配置） | ❌ 致命 |
| 作品说明页 showcase.html | **不存在** | ❌ 缺失 |
| favicon / apple-touch-icon | **index.html 零引用**（grep `favicon|og:|twitter:card|apple-touch` = 0） | ❌ 缺失 |
| OG 分享图 / meta description / theme-color | **全部缺失** | ❌ 缺失 |
| 单文件离线版 | **不存在**（运行需 6 文件 + 2 个 CDN） | ❌ 缺失 |
| 演示截图 | **有但深埋**：`assets/qa_final_{home,pick,search_friedrice,guide,overview,share}.png`（6 张 390×844@2x 真机截图）+ `assets/ing_icon_sheet.png`（125 图标总览，215KB）+ `assets/contact_sheet.png`（62 菜品像素图，302KB），**无任何文档引用** | ⚠️ 埋没 |
| 图片来源声明 | `assets/CREDITS.md` 存在且完整（70 行、含许可证与 Wikimedia 链接） | ✅ 但位置太深 |
| 设计文档 | DESIGN-pixel.md 内容扎实（色板表 / 组件规范 / Do&Don't / 断点表 / 两个附录） | ✅ 但**纯文字零配图** |
| 数据量（实测） | 104 道菜、8 分区、**122 种食材**、739 条食材行、**125 个 12×12 图标**（33 UI + 92 食材） | ✅ 硬指标很能打 |
| 目录洁净度 | 项目总计 **65MB**，其中 `assets/` 独占 65MB：`review/` 45MB（250 张候选 JPG）、`src/` 14MB（63 张原图）、`review_sheets/` 4.4MB、`src_sheets/` 1.2MB | ❌ 脏 |

**一句话总诊断：产品完成度（视觉 + 数据 + 技术记忆点）已到 85 分，但"包装与传播"接近 0 分——评委打开仓库链接的前 10 秒，看不到一句话定位、看不到截图、点不进在线演示，作品的全部优势都被 65MB 的管线中间产物盖住了。**

---

## 一、建议清单

| # | 问题（当前缺什么 / 哪里不足） | 影响评分 | 建议（具体到文件内容与放置位置） | 优先级 | 工作量 | 验收标准 |
|---|------------------------------|:--------:|----------------------------------|:------:|:------:|----------|
| 1 | **README.md 完全缺失**。仓库第一屏是 6 个裸 JS + 1 个 HTML，评委无法在 10 秒内知道这是什么、点哪里能玩 | 5 | 新建**根目录 `README.md`**（≤200 行），按序包含：<br>① 顶部标题 + **一句话定位**：「把『今天吃什么』和『买菜清单』做成一场 16-bit 像素农场冒险——选 4 道菜，闯 8 个市集分区，导出一张可分享的像素清单图」；<br>② **3 张首屏截图**（`docs/screenshots/01-home.png` `02-guide.png` `03-share.png`，横排，用 HTML `<img width=260>` 三连，避免纯 md 图片在评审页错位）；<br>③ **在线演示** 一行大按钮式链接（GitHub Pages / 已发布链接），并注明「无需登录、无需后端，打开即玩」；<br>④ **亮点 5 条**：104 道菜 / 122 种食材 / 125 个手绘 12×12 像素图标 / 8 关市集闯关 / Canvas 像素清单图导出（零依赖、零框架）；<br>⑤ **技术要点**：12×12 ASCII 网格 → `shape-rendering:crispEdges` SVG 的图标引擎、Fusion Pixel 字体 CDN 子集、清单图 canvas（`S=2` 缩放 + `imageSmoothingEnabled=false` + `font.load` 预载）、纯前端零后端；<br>⑥ **数据说明**：104 道菜/122 种食材/8 分区的来源与人工整理方式，链接到 `assets/CREDITS.md`；<br>⑦ **本地运行**：`npx serve .` 或 `python -m http.server 8000` 打开 `http://127.0.0.1:8000/index.html`，并注明「也可直接下载 `dist/pixel-farm-offline.html` 双击打开」；<br>⑧ **目录说明**（一行一个：哪些是应用、哪些是资产管线、哪些可删）；<br>⑨ 底部 License / Credits 指向 | **P0** | **S**（2h） | 评委只看 README 就能复述出「一句话定位 + 5 个亮点 + 演示链接」；README 内 4 个链接（演示 / 截图 / CREDITS / LICENSE）全部可达 |
| 2 | **没有任何在线演示链接**。比赛评审页的核心动作是"点开链接看一眼"，静态站却未部署，等于把最强证据（视觉完成度）藏起来 | 5 | ① 先 `git init` + 提交（当前**根本不是 git 仓库**，连提交历史都没有）；<br>② 把 `.gitignore` 之外的 6 个应用文件推到 GitHub，开启 **GitHub Pages（main 分支根目录）**，得到 `https://<user>.github.io/grocery-reminder-pixel/`；<br>③ 或用 WorkBuddy「发布为应用」（本环境自带 `workbuddy_sites_deploy` 能力）发布静态站，拿到短链；<br>④ README 顶部与 `index.html` 的 `<title>`/OG 里统一写同一条链接 | **P0** | **S**（1h） | 有一条公网可访问、首屏 3 秒内加载完成的链接；在微信/推特/Twitter 卡片中粘贴能正常渲染首屏 |
| 3 | **缺一份"图文并茂讲清作品"的作品说明页**。README 会写的人很多，但一个自带像素风排版、能直接当"作品主页"的页面，在评审页里是降维打击 | 4 | 新建**根目录 `showcase.html`**（样式复用 `styles.css` 的像素组件，不新造轮子），结构：<br>① Hero：品牌名 + 一句话定位 + 104/122/125 三个数据徽章 + 「立即体验 →」按钮（跳 `index.html`）；<br>② 全流程 5 图横滑/纵排（`docs/screenshots/` 5 张），每张配 1 句说明（搜索 → 挑菜 → 市集闯关 → 全部清单 → 导出清单图）；<br>③ **技术记忆点专区**：嵌入 `assets/ing_icon_sheet.png` 的裁切版，配文「125 个手绘 12×12 像素图标，全部由 ASCII 网格生成，零图片依赖」；贴出 12×12 网格源码片段（`.###.` 之类）→ SVG 的代码示例，让评委一眼看到"自研引擎"；<br>④ 数据区：104 道菜/8 分区表格 + 链接 CREDITS；<br>⑤ 页脚：License + 在线演示 + 本地运行方式<br>并在 README 顶部与 `index.html` 首屏各放一条 `<a href="showcase.html">作品说明</a>` 入口 | **P0** | **M**（1d） | 单独打开 `showcase.html`，30 秒内能让人说出"它解决什么、怎么玩、技术上哪里牛"；页面本身在 390px 与 1440px 下均不横向溢出（跑 `browser-layout-overflow-qa` 思路自查） |
| 4 | **首屏 30 秒说服力不足**：打开 `index.html` 直接是「今天想吃点啥？」+ 搜索框 + 4 个菜类按钮。评委不知道自己能玩到什么、不知道最终能导出清单图，桌面端（≥680px）只有田地绿底＋墨框，**空旷、无装饰、无引导** | 4 | 在 `index.html` 的 `#home` 内、`<p class="eyebrow">` **之前**插入一个可折叠引导卡：<br>`<section id="heroIntro" class="hero-intro px-notch">` 内容 =<br>① 一句话价值主张（16px）：「选 4 道菜 → 闯 8 个市集分区 → 导出一张像素清单图」；<br>② 数据三连（12px chip）：`104 道菜` · `122 种食材` · `125 个手绘像素图标`；<br>③ 「3 步上手」折叠块：1 搜菜名或掷骰子 → 2 加进菜篮 → 3 去市集逐区打勾 + 生成清单图；<br>④ 右下角内嵌 `docs/screenshots/03-share.png` 的 120px 缩略，暗示"最终产物"<br>行为：`localStorage['pf-onboarded']` 为假时展开，点击「知道了」或首次加入菜篮后收起（收起态保留一行价值主张，不占版面）。<br>另：≥680px 时在 `.app` 两侧田地加纯 CSS 像素装饰（栅栏 + 向日葵 8×8 方块，`styles.css` 内用 `conic`/`linear-gradient` 拼，不新增图片） | **P1** | **M**（0.5d） | 新访客首屏 3 秒内看到"价值主张 + 数据 + 3 步"；首屏无需滚动即可看到完整引导卡（`390×844` 视口实测）；老用户再次进入不再弹出；桌面端两侧不再空白 |
| 5 | **分享与品牌资产为零**：无 favicon、无 apple-touch-icon、无 OG 图、无 `meta description`、无 `theme-color`。链接发到微信/Twitter 是一块灰白占位 | 4 | 在 `index.html` `<head>` 内补齐：<br>`<link rel="icon" href="favicon.png" sizes="32x32">`（用 32×32 像素谷仓/番茄图标，直接取 `icons.js` 的 `barn` 在 32px 下截图，`image-rendering:pixelated`）<br>`<link rel="apple-touch-icon" href="apple-touch-icon.png">`（180×180）<br>`<meta name="description" content="104 道菜、122 种食材、125 个手绘像素图标——把今天吃什么和买菜清单做成 16-bit 像素农场冒险，零依赖纯前端">`<br>`<meta name="theme-color" content="#A9724A">`<br>`<meta property="og:title" content="像素农场 · 采购记">`<br>`<meta property="og:description" content="...同上">`<br>`<meta property="og:image" content="https://<host>/og-image.png">`（1200×630，内容 = 品牌名 + 一句话定位 + 右侧 3 个食材像素图标放大 4 倍 + 底部 104/122/125 数据条，**必须由 Canvas 清单图同款引擎生成，保持像素锐利**）<br>`<meta name="twitter:card" content="summary_large_image">`<br>素材放**根目录 `assets/og/`** 或直接根目录 | **P1** | **S**（3h） | 把演示链接粘进微信/Twitter/飞书，能显示 1200×630 像素封面图与中文描述；浏览器标签页显示谷仓图标；`theme-color` 在移动端地址栏生效 |
| 6 | **没有单文件离线版，且 `index.html` 白加载 Supabase SDK**。目前运行需 6 个文件 + 字体 CDN + Supabase CDN；而 `analytics.js` 的 `SUPABASE_URL/ANON_KEY` 是**空串**，`init()` 直接 `return`（`analytics.js:18`），SDK 每次访问白下载约 100KB+ 却从不使用，还会给评委"外挂后端/埋隐私"的负面印象 | 4 | ① 新建 `tools/build-single.js`（Node 脚本）：把 `styles.css` + `icons.js` + `ingredient-icons.js` + `data.js` + `data-100.js` + `app.js` 内联进一份 HTML 模板，输出 **根目录 `dist/pixel-farm-offline.html`**（预期 ~230KB，字模走 CDN 保留，字体加载失败自动 fallback 雅黑，仍可玩）；<br>② **从 `index.html` 与离线版中移除 Supabase CDN `<script>` 与 `analytics.js` 引入**（埋点本就空转），若要保留则改为 `defer` + 注释说明"未配置密钥时不加载"；<br>③ README 加一行：「**离线单文件版**：下载 `dist/pixel-farm-offline.html`，双击即可打开，断网可用（仅像素字体会退化为系统字体）」 | **P1** | **S**（3h） | `dist/pixel-farm-offline.html` 断网双击可完整走通"搜菜 → 加菜篮 → 闯关 → 导出 PNG"；`index.html` 网络面板不再出现 `supabase` 请求；离线版与在线版功能一致 |
| 7 | **`assets/` 65MB 全是管线中间产物，目录观感极差**。`review/` 250 张候选 JPG（45MB）、`src/` 63 张原图（14MB）、`review_sheets/`、`src_sheets/`、`contact_sheet.png`、`dishes.json`、`approve.json`、`*.py` 混在一起；而其中 62 张菜品 PNG 所服务的图片预览**已于 2026-10-19 退役**（DESIGN-pixel.md:248 明确记录 manifest 不再加载） | 4 | ① 根部新建 `.gitignore`，忽略 `assets/review/`、`assets/src/`、`assets/review_sheets/`、`assets/src_sheets/`、`assets/contact_sheet.png`、`credits.json`、`__pycache__/`；<br>② 把 4 个 Python 工具 + `dishes.json` + `approve.json` + `validate_ing_icons.js` 移入 **`tools/pipeline/`**，README 里说明"菜品图资产管线（已退役，保留可复现）"；<br>③ `assets/` 只保留：`dishes/`（62 张像素图 + manifest.js，作为可复现资产）+ `CREDITS.md` + `ing_icon_sheet.png`；<br>④ 清理后 `assets/` 应 ≤1MB，整个仓库 ≤1.5MB | **P1** | **S**（1.5h） | `git status` 干净、克隆耗时 <3 秒、仓库根目录一眼可分"应用 / 素材 / 工具"三层；评委打开 GitHub 文件列表不再被 `.jpg` 淹没 |
| 8 | **6 张真机演示截图被埋在 `assets/` 里，无任何文档引用**。这些是本次参赛最硬的"真实演示素材"（390×844@2x、含导览/总览/导出图三个关键帧），现在只能靠评委翻目录偶然发现 | 3 | ① 新建 **`docs/screenshots/`**，把 6 张 QA 图按流程重命名移入：`01-home.png`（←qa_final_home）、`02-pick.png`（←qa_final_pick）、`03-search.png`（←qa_final_search_friedrice）、`04-guide.png`（←qa_final_guide）、`05-overview.png`（←qa_final_overview）、`06-share.png`（←qa_final_share）；<br>② **补 2 张缺失关键帧**：`07-desktop.png`（1440×900 下掌机柱 + 两侧田地，证明桌面端包装）、`08-icon-sheet.png`（←`assets/ing_icon_sheet.png` 裁切，证明 125 图标）；<br>③ README 与 `showcase.html` 全部改为引用 `docs/screenshots/` 路径（相对路径，GitHub 与本地都能渲染） | **P1** | **S**（1.5h） | 8 张截图命名有序、覆盖全流程 + 桌面端 + 图标总览；README 与 showcase 图片在本地与 GitHub 两处均能显示 |
| 9 | **缺 LICENSE，图片许可证声明位置太深**。开源呈现的硬门槛：评委/CI 会看有没有 LICENSE；`CREDITS.md` 藏在 `assets/` 里，且只声明了那 62 张（已退役的）菜品图，**对 125 个像素图标与 Fusion Pixel 字体的授权只字未提** | 3 | ① 根目录新建 **`LICENSE`**（代码 MIT，与"零依赖、可自由复用"定位一致）；<br>② 根目录新建 **`CREDITS.md`**（或从 `assets/CREDITS.md` 上提），三段式：<br>· **代码**：MIT © 作者；<br>· **字体**：Fusion Pixel 12px Proportional SC（缝合像素字体，通过 cjk-web-fonts CDN 加载），注明其授权；<br>· **图片**：62 张菜品像素图的 Wikimedia Commons 来源与许可证表（引用 `assets/CREDITS.md` 内容，注明源自 CC BY-SA / CC0 等，并说明"再创作产物，原图许可证见下表"）；<br>· **说明**：像素图标为本项目原创手绘 12×12 网格，不使用第三方素材；<br>③ README 底部设 `## License & Credits` 段落指向这两个文件 | **P2** | **S**（1h） | 根目录存在 LICENSE 且 GitHub 能识别；CREDITS.md 覆盖字体 + 图片 + 原创图标三类；评委问"图哪来的"可 1 秒指到文件 |
| 10 | **DESIGN-pixel.md 只讲规范不展示成品，设计功力被埋没**。261 行全是表格与代码，**零配图**：色板没有色块预览、125 个图标没有总览图、没有一张成品截图、没有流程动图；评委扫一眼会当成"配置清单"而不是"设计系统"。另缺一份技术深挖文档承载记忆点 | 3 | ① 在 DESIGN-pixel.md 第 2 章色板表后**补一张色板图**（`docs/screenshots/09-palette.png`，用 Canvas 或纯 HTML 色块生成，8 个分区色 + 6 个功能色横条 + 数值标注）；<br>② 第 4 章与附录 B 处内嵌 `assets/ing_icon_sheet.png`（125 图标总览），让"手绘 12×12 图标"直接可见；<br>③ 文档开头加 **1 张成品首屏图 + 1 张清单图导出样例**，让规范与成品对上号；<br>④ 新建 **`ENGINEERING.md`**（根目录）：把技术记忆点单独成文——12×12 ASCII 网格 → crispEdges SVG 的图标引擎（含 1 段源码 + 1 张 ASCII 网格示意）、清单图 canvas 导出管线（`S=2` + 关平滑 + `document.fonts.load` 预载 + `toDataURL`）、零依赖零框架决策理由、104×122 数据模型、性能数据（首屏请求数 / 总体积）；README 链接过去 | **P2** | **M**（0.5d） | DESIGN-pixel.md 前三屏内至少出现 3 张配图（色板 / 图标总览 / 成品）；ENGINEERING.md 存在且能让非前端评委看懂"自研图标引擎"是什么；两文档在 README 中互链 |

---

## 二、建议执行顺序（按"先能参赛、再能获奖"排）

| 阶段 | 动作 | 产出 |
|------|------|------|
| **第 1 天（必须先做完，否则等于裸交）** | #1 README → #2 部署 + git init → #8 截图整理 → #7 目录清理 → #9 LICENSE/CREDITS | 一个"能看、能点、能读"的仓库 + 一条在线演示链接 |
| **第 2 天（提分）** | #5 OG/favicon → #4 首屏引导 → #6 单文件离线版 + 去 Supabase | 链接分享有封面、打开有引导、断网能玩 |
| **第 3 天（冲高）** | #3 showcase.html → #10 DESIGN 配图 + ENGINEERING.md | 从"完成度高的小应用"变成"有方法论、有作品集完整度的参赛作品" |

---

## 三、一句话定位（建议 README / OG / 演示页三处统一使用）

> **把「今天吃什么」和「买菜清单」做成一场 16-bit 像素农场冒险——选 4 道菜，闯 8 个市集分区，导出一张能直接发给家人的像素清单图。**
> 零框架、零后端、零图片依赖：104 道菜、122 种食材、125 个手绘 12×12 像素图标。

## 四、可直接用于申报表的技术记忆点（三选一主打）

1. **自研 12×12 像素图标引擎**：手绘 ASCII 网格（如 `.###.`）→ `shape-rendering:crispEdges` 的 SVG，125 个图标共 0 张位图，任意缩放不失真，且同一套数据直接复用于 Canvas 清单图导出（屏幕端与导出图共用同一渲染源）。
2. **全流程纯前端**：无框架、无构建、无后端（原 Supabase 埋点未启用），6 个文件 215KB 跑完 104 道菜 × 739 条食材行的分区聚合。
3. **可复现的资产管线**（已退役但保留）：Wikimedia Commons 照片 → 48×48 降采样 → 28 色 MEDIANCUT 量化 → 96×96 像素图，`CREDITS.md` 逐图标注许可证——证明工程化与合规意识。

---

*评委 10 · 参赛策略与包装 | 审查日期 2026-10-21 | 实测环境：Node 22 / 仓库非 git*
