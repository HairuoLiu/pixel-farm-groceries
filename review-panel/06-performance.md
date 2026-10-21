# 评委 6 · 性能与可靠性工程师评审

**评审对象**：`grocery-reminder-pixel`（像素农场 · 采购记）
**评审视角**：参赛作品，评委可能弱网 / 手机打开，要求"打开即用"。
**评审日期**：2026-10-21
**实测方法**：通读 `index.html` / `app.js` / `analytics.js` / `icons.js`；`node fs.statSync` 统计体积；`curl` 实测 CDN 可用性；按 `app.js:413-420` 公式推算 canvas 最坏尺寸；按 `icons.js` `svg()` 实现统计 rect 数。

---

## 一、实测数据底账

### 1.1 本地资源体积（`node fs.statSync`）

| 文件 | 体积 | 说明 |
|---|---|---|
| index.html | 6.1 KB | 138 行 |
| styles.css | 17.0 KB | |
| app.js | 26.9 KB | |
| icons.js | 13.4 KB | 33 个 12×12 图标 |
| ingredient-icons.js | 31.9 KB | 92 个食材图标 + 122 条映射 |
| data.js | 8.0 KB | 兜底数据 |
| data-100.js | 116.2 KB | 104 道菜主数据 |
| analytics.js | 1.7 KB | |
| **本地合计** | **≈ 221 KB** | 未压缩；gzip 后约 55–60 KB |

### 1.2 外部依赖（`curl` 实测，2026-10-21）

| 资源 | 引用位置 | 实测 | 状态 |
|---|---|---|---|
| 像素字体 CSS（78 个 @font-face） | `index.html:8` | HTTP 200，**70.9 KB**，0.46s | ✅ 可用，但 render-blocking |
| 字体子集 woff2（按 unicode-range 按需） | 上述 CSS 内 | Basic-Latin 实测 2.3 KB/个 | ✅ 可用，子集化做得好 |
| **supabase-js@2** | `index.html:134` | HTTP 200，**218 KB**，0.35s | ⚠️ **白下载，完全未被使用** |

### 1.3 首屏请求链（冷启动，弱网敏感点）

```
HTML → [字体CSS 70.9KB（阻塞渲染）] → styles.css
     → icons.js + ingredient-icons.js + data.js + data-100.js + [supabase 218KB] + analytics.js + app.js
     → 首屏文字所需 CJK woff2 子集若干（每个 ~2-3KB）
```

**冷启动最坏传输量 ≈ 221 KB 本地 + 71 KB 字体 CSS + 218 KB 白下的 supabase + 字体子集 ≈ 510–530 KB**，其中 **218 KB（42%）是可以立即删除的死重量**。

### 1.4 渲染 / 内存关键数字

- **SVG DOM 规模**：`icons.js` `svg()` 对每个图标生成 **平均 22.6 个 `<rect>`（最大 38 个）**，横向合并已做。首页静态注入 17 个图标 + 4 菜类 + 6 菜系 ≈ 27 个 SVG ≈ 600+ rect。**总览页最坏情况（购物车装满 104 道菜 → 122 样食材）每行 1 个 ingIcon SVG，全页 ≈ 122 SVG × ~20 rect ≈ 2400+ rect 节点**（`app.js:326-352`）。
- **canvas 最坏尺寸**：按 `app.js:414-420` 公式，122 项食材 + 8 分区时 **canvas 达 1600×9712 = 15.5M px ≈ 59 MB RGBA**，距 iOS Safari 历史上限（约 16.7M px）仅一步之遥；`toDataURL` 生成该尺寸 PNG 在低端机上秒级阻塞。
- **数据规模**：104 道菜、单菜最多 20 样食材（火锅）、122 种唯一食材。

---

## 二、做得好的地方（先肯定）

1. **字体子集化 + `font-display: swap`**：78 个 unicode-range 子集、CDN CSS 自带 `font-display: swap`，首屏中文只下 2–3 个小子集，不是整包 5–10 MB 字体，这是中文字体方案里的正解。
2. **字体有 fallback 链**：`styles.css:33` `--font-px` 依次降级 Microsoft YaHei → PingFang SC → sans-serif，CDN 挂了中国手机也不会出现"豆腐块"。
3. **canvas 字体加载有超时兜底**：`app.js:406-411` 用 `Promise.race` 给 `document.fonts.load` 加了 2s 超时，字体 CDN 挂了也能出图（只是 PNG 内字体退化为系统字体），这个降级意识值得表扬。
4. **双数据文件回退**：`app.js:9-11` 优先 `DISHES_100`，失败回退 `DISHES`，`data.js` 作为弱网降级是合理设计。
5. **纯静态零构建**：无 npm、无打包器，任何静态托管（GitHub Pages / COS / OSS）即开即用。

---

## 三、问题与改进建议（按优先级排序）

| # | 问题（具体文件/行号/资源 URL） | 影响评分(1-5) | 建议 | 优先级 | 工作量 | 验收标准 |
|---|---|---|---|---|---|---|
| 1 | **supabase-js@2 白下载 218 KB**。`index.html:134` 引用 `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`；但 `analytics.js:10-13` 的 `SUPABASE_URL`/`SUPABASE_ANON_KEY` 均为空串，`analytics.js:18` `init()` 第一行即 `return`，SDK 从头到尾没被调用过。弱网评委手机上凭空多出 42% 传输量 + 一次额外 TLS 握手。 | 5 | 直接删掉 `index.html:134` 这一行 script。若想保留"将来可开启埋点"的能力，改为 `analytics.js` 内部在配置非空时**动态 `import()`**（按需加载），静态 HTML 中不出现该 URL。 | **P0** | S | 删行后 `curl` 资源清单中无 supabase URL；Network 面板请求数 -1、传输量 -218 KB；`window.Analytics.track()` 在无 key 时仍静默空转不报错。 |
| 2 | **字体 CSS 阻塞首屏渲染且无 preconnect**。`index.html:8` 70.9 KB CDN CSS 在 `<head>` 中同步阻塞首次渲染；无 `<link rel="preconnect">`，弱网下 DNS + TLS + RTT 叠加，首屏可能多等 0.5–2s。字体 CDN 一旦整体不可达（jsdelivr 被墙/挂），渲染同样被这张表阻塞。 | 4 | ① 加 `<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>`；② 字体 CSS 改**非阻塞加载**（`media="print" onload="this.media='all'"` 或 JS 注入 `<link>`，或直接自托管这 71 KB CSS 到仓库）；③ 自托管方案下可再加 `<link rel="preload">` 首屏必中的 1–2 个 CJK 子集。 | **P0** | S | 断网（DevTools Offline）打开页面，首屏文字仍以 fallback 字体渲染且布局不崩；弱网 3G 节流下 FCP 不因字体表阻塞超过 300ms。 |
| 3 | **离线完全不可用、无任何缓存策略**。全站无 Service Worker、无 `manifest.json`、无 `Cache-Control` 控制手段。评委在会场弱网/断网环境下二次访问仍要重新请求全部资源；首次访问若中途断网，后半资源 404 即白屏。 | 4 | 加一个约 20 行的 `sw.js`：install 时 precache 全部本地文件（8 个文件合计 221 KB）+ 字体 CSS，fetch 时 cache-first 回退网络；`app.js` 末尾 `navigator.serviceWorker?.register('sw.js')`。这同时补齐"离线可用性"评审点。 | **P1** | M | DevTools Offline 模式下刷新页面，首页/挑菜/导览/总览全部可用；Lighthouse PWA 项 ≥ 90；二次访问 Network 请求数 ≈ 0。 |
| 4 | **清单图 canvas 在长清单下有内存/性能悬崖**。`app.js:413-420`：H 随食材数线性增长，实测最坏 122 项时 canvas = 1600×9712 ≈ 59 MB RGBA，逼近 iOS Safari 历史上限（约 16.7M px，再长约 10% 即直接创建失败）；`app.js:488` `toDataURL` 对该尺寸 PNG 编码在低端机秒级卡死主线程。 | 4 | ① 高度上限保护：超过 ~80 项时自动分列/分页生成（如两栏布局或按分区拆成多张图）；② 导出尺寸 S 从 2 降为 1.5；③ 生成期间显示"生成中"遮罩，`toDataURL` 包一层 `setTimeout` 让遮罩先绘制；④ 极端长度直接拒绝并提示。 | **P1** | M | 构造 122 项购物车，点击"生成清单图"：2s 内出现 loading 反馈、5s 内出图，页面无掉帧崩溃；iPhone SE 级设备内存不爆。 |
| 5 | **SVG 图标 DOM 膨胀**。`icons.js` `svg()` 每图标平均 22.6 个 rect（`ingredient-icons.js` 另 92 个同类）；`app.js:326-352` 总览页每行一个 ingIcon，最坏 122 行 ≈ 2400+ rect 节点 + 事件绑定，低端安卓滑动/勾选会掉帧。 | 3 | ① 改为 SVG sprite：页面放一个 `<svg><symbol>` 定义块（33+92 个图标一次性注入），使用处 `<use href="#ico-xxx">`，DOM 节点从 ~2400 降到 ~130；② 或对小图标改用 `background-image: url("data:image/svg+xml,...")` 零 DOM 节点；③ 或 24px 以下图标直接换 canvas/emoji。 | **P1** | M | 总览页 DOM 节点数下降 ≥ 80%（DevTools Elements 面板统计）；122 项清单页滚动帧率 ≥ 50fps（Performance 面板）。 |
| 6 | **缺移动端 PWA 基础 meta**。`index.html` 无 `manifest.json`、无 `theme-color`、无 `apple-touch-icon`、无 favicon（浏览器还会默认请求 `/favicon.ico` 吃一个 404）。评委"添加到主屏幕"后无图标无主题色，URL 栏颜色与设计割裂。 | 3 | 加 `manifest.webmanifest`（name/short_name/display: standalone/theme_color: #7FB069/background_color: #FFF8EA + 一个 192px 和 512px PNG 图标——可用现有 `assets/` 像素图缩小）；`<head>` 补 `<meta name="theme-color">`、`<link rel="apple-touch-icon">`、favicon。 | **P1** | S | Lighthouse PWA installability 检查通过；安卓 Chrome 弹出"添加到主屏幕"；iOS 添加到主屏幕后有图标且全屏打开。 |
| 7 | **`font-display: swap` 无度量对齐，像素字体切换有 CLS**。CDN CSS 有 swap 但无 `size-adjust` / `ascent-override`，fallback（雅黑）→ 像素字体的字高/行高差异会造成可见的布局跳动，标题区尤其明显。 | 2 | 自托管字体 CSS 后，在 `@font-face` 中补 `size-adjust: ~105%; ascent-override: ...` 等 metric override，使 fallback 与像素字体度量接近；或对首屏标题用 `font-display: block` + 3s 内的 `optional` 策略组合。 | **P2** | S | DevTools Performance 记录 CLS ≤ 0.05；字体加载完成前后标题无肉眼可见跳动。 |
| 8 | **6 个脚本同步加载、`data-100.js` 116 KB 同步执行**。`index.html:130-136` 无 `defer/async`，虽然置于 body 末尾不阻塞首屏绘制，但首屏**可交互**前必须顺序解析执行 221 KB JS；`data.js`(8 KB) 与 `data-100.js`(116 KB) 同页加载，前者仅作回退却每次必下。 | 2 | ① 给全部 script 加 `defer`（保持相对顺序即可，行为等价但解析不阻塞 DOM 完成事件）；② `data.js` 改为回退按需加载：仅当 `window.DISHES_100` 不存在时才动态注入 `<script src="data.js">`，省 8 KB/请求；③ `data-100.js` 可按 zone 拆包，但 116 KB 收益有限，P3 再做。 | **P2** | S | Lighthouse TBT/TTI 指标改善；弱网下首屏可交互时间缩短；`data-100.js` 加载失败时自动回退 `data.js` 且功能正常（构造断网测试验证）。 |
| 9 | **无 `prefetch`/缓存头控制手段，静态托管商缓存策略不可知**。全站资源无版本指纹（`app.js` 无 `?v=`），迭代后评委浏览器可能命中旧缓存；assets/ 目录还带着 ~900 KB 开发用 QA 图片与 Python 脚本（`contact_sheet.png` 301 KB 等），若整目录提交会污染交付包（虽不影响运行时）。 | 2 | ① 提交前删除 `assets/` 下的 QA 截图与脚本，只留运行时必需文件；② 加 SW 后缓存以 SW 版本号控制，天然解决刷新问题；③ 或给本地资源加 `?v=20261021` 指纹。 | **P2** | S | 交付目录只含 8 个运行时文件 + sw.js + manifest + 图标；更新部署后评委刷新即拿新版本。 |
| 10 | **可做"纯离线单文件"参赛版**。当前 221 KB 本地 + 71 KB CSS + 若干子集，若评审环境是"把 HTML 拷给某人本地打开"（file:// 协议），CDN 字体同样不可用，且 file:// 下 SW 也无法注册。 | 2 | 提供一个 `single-file.html` 构建变体：inline 全部 CSS/JS + 把首屏所需 3–5 个 woff2 子集 base64 内嵌（每个 ~2-3 KB，合计 < 15 KB），单文件 < 100 KB、完全零外部请求、双击即用。作为参赛双格式之一（在线版 + 单文件版）显著提升"打开即用"评分。 | **P2** | M | `single-file.html` 在 file:// 协议 + 飞行模式下完整可用，字节数 ≤ 120 KB，功能与在线版一致。 |

---

## 四、总体评价

| 维度 | 得分(1-5) | 点评 |
|---|---|---|
| 首屏时间 | 3.5 | 静态无构建、221 KB 轻量、字体子集化是亮点；但 218 KB supabase 死重量 + 71 KB render-blocking 字体表拖后腿，删掉这两项首屏提速 40%+ |
| 外部依赖挂了会不会崩 | 4 | 字体有完整 fallback 链，canvas 出图有 2s 超时兜底，双数据文件回退——降级设计意识好；扣分在字体表本身阻塞渲染 |
| 离线可用性 | 1 | 完全空白项：无 SW、无 manifest、无缓存策略 |
| 资源体积 | 4 | 221 KB 本地 + 子集字体非常克制；删除 supabase 后更优 |
| 渲染性能 | 3.5 | 首页轻快；总览页 ~2400 rect 的 SVG DOM 与 59 MB canvas 是两处性能悬崖 |
| 字体加载失败降级 | 4 | fallback 链 + swap + canvas 超时兜底，处理到位；缺度量对齐（CLS） |
| 缓存策略 | 1 | 零缓存策略，无版本指纹 |

**综合结论**：这是一个"运行时很轻、工程闭环没做"的典型参赛作品——作者把精力花在了数据（104 道菜）和像素细节上，性能底子（221 KB、字体子集化、降级兜底）其实相当好，但**发布链路上躺着 218 KB 从来没被调用的 supabase SDK、一张 71 KB 阻塞渲染的 CDN 字体表、以及完全缺失的离线/缓存/ PWA 基建**。建议按 P0 → P1 顺序处理：**删 supabase 行（5 分钟）→ 字体表非阻塞化 + preconnect（半小时）→ 补 SW + manifest（半天）→ canvas 分页 + SVG sprite（一天）**，全部完成后这是一个可以在评委弱网手机上"秒开且断网能玩"的作品，性能评分可以从当前的中游直接拉到头部。

---

## 附：本评审的复现命令

```bash
# 体积
node -e "const fs=require('fs');['index.html','styles.css','app.js','icons.js','ingredient-icons.js','data.js','data-100.js','analytics.js'].forEach(f=>console.log(f,(fs.statSync(f).size/1024).toFixed(1)+'KB'))"

# CDN 可用性
curl -s -o /dev/null -w "%{http_code} %{size_download}B\n" "https://cdn.jsdelivr.net/npm/@vp-tw/cjk-web-fonts-fusion-pixel-font@0.0.1/dist/12px/proportional/zh_hans/Fusion-Pixel-12px-Proportional-Simplified-Chinese.css"
curl -s -o /dev/null -w "%{http_code} %{size_download}B\n" "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
```
