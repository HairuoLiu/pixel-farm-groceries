# 评委 3 · 视觉 / 像素艺术总监 评审意见

**项目**：像素农场 · 采购记（16-bit 农场复古像素风 / 星露谷 UI 语言）
**评审对象**：`styles.css`、`index.html`、`icons.js`、`ingredient-icons.js`、`app.js`（渲染层）、`DESIGN-pixel.md`
**实测方式**：本地 `http://127.0.0.1:8901/index.html` + Playwright（Chromium，DPR 2/3）
视口：390×844（主力手机）、320×568、1440×900（桌面）、阻断 CDN（字体降级）
截图证据：`review-panel/shots03/visual/`（`_rev3_01_home.png` … `_rev3_11_font_fallback.png`、`_rev3_zoom_type.png`、`_rev3_iconsheet.png`）

## 实测截图清单

| 编号 | 场景 | 结论 |
|---|---|---|
| 01 | 首页 390×844 | 内容底 y≈530，视口 844 → **底部空 314px（37%）** |
| 02 / 03 | L2 挑菜（未选 / 已选 2 道） | 已选态（绿底+勾+绿按钮）状态识别清晰，是全场最好的一屏 |
| 04 / 05 / 06 | 导览 / 总览（全页） | `.ing-ico` 30px 图块成立；**蛋奶区「鸡蛋」图标整块消失** |
| 08 | 分享清单图 800×N 原始 PNG | 「鸡蛋」图标消失；分区色条 8 色过于接近 |
| 09 / 10 | 桌面 1440×900 | `.app` 内容下留 **550px 空白（61%）**，无收口 |
| 11 | 阻断 jsdelivr | 全站退回系统字体，**像素风完全消失** |

## 结论表

| # | 问题（具体选择器/规则/图标名） | 影响评分(1-5) | 建议 | 优先级(P0/P1/P2/P3) | 工作量(S<30min/M<2h/L>2h) | 验收标准 |
|---|---|---|---|---|---|---|
| 1 | **`egg` 图标与底色同色，完全不可见**。`icons.js:174-187` 的 `egg` 只有一种字符 `e`，而 `e` = `#FFF8EA`（`icons.js:39`）= `--c-paper`（`styles.css:15`）；`.ing-ico` 背景正是 `var(--c-paper)`（`styles.css:309`），快照图 canvas 底色也是 `#FFF8EA`（`app.js:445`）。实测有效像素仅 **6.3%**，蛋奶区唯一图标在屏幕端与分享图里**双双消失**，只剩一个空框。同一病的还有 `freeze`（`n`=#EAF6FF，1.04:1）、`salt`/`dice`/`sushi`/`clipboard`/`barn` 门（`c`=#FFF1D6，1.06:1）、全部肉色系 `f`=#F5D9A8（1.29:1）——`ing_pork` 21.7%、`ing_chickenwing` 18.2%、`ing_dumpling` 22.5% 都接近"空心轮廓" | 5 | ① `egg` 重绘：外圈 `k` 描边 + `c` 内影 + 左上 1 格 `n` 高光，蛋白改 `#F3E6CC`（对纸底 1.35:1 以上）② 建立**「纸底可见性」调色板约束**：写进 `DESIGN-pixel.md` —— 任何用于"填充主体"的色对 `#FFF8EA` 必须 ≥1.5:1；`e/n/c/p` 降级为**高光专用**（单格点缀），不得做主体填充 ③ `f` 肉色整体调深到 `#EBC79A`，并给所有肉类图标加 1px `k` 内描边形成体积 ④ 给 `.ing-ico` 换底 `#F6EAD2`（比 `.item` 白底略深），让淡色图标有托底 | P0 | S | 蛋奶区「鸡蛋」图标在 `overview` 与分享图里清晰可辨；125 个图标按"对纸底可见像素率"复测全部 ≥35%；`egg` 不再是单色网格 |
| 2 | **字体单点依赖 jsdelivr + `font-display: swap`，首屏先渲染系统字**。`index.html:8` 只挂了一个 CDN 的 87 片 woff2 索引 CSS，`@font-face` 内部是 `font-display: swap`；降级链是 `"Microsoft YaHei","PingFang SC"`（`styles.css:33`）。实测阻断 CDN 后（截图 11）整站变成常规黑体，**16-bit 像素风当场归零，只剩图标在撑**。国内网络访问 jsdelivr 抖动是常态，评委手机开屏 0.5-3s 内看到的很可能就是"一个描边很粗的普通网页"。另注：`-webkit-font-smoothing: none`（`styles.css:63`）在 Chrome / Android WebView 上**不生效**，无法兜底 | 5 | ① 用 `_subsets_home.txt` 里已算好的首屏字符集，本地打包成 **1 个 woff2**（约 20-40KB）自托管，`@font-face` 用 `font-display: block`（≤100ms 阻塞，宁短暂留白也不要闪雅黑）② 首屏那张用 `<link rel="preload" as="font" crossorigin>` 提前拉 ③ CDN 只作为后续生僻字的增量兜底，`unicode-range` 分层 ④ 删掉无效的 `-webkit-font-smoothing: none`，改为在整数倍字号上换 `text-rendering: geometricPrecision` | P0 | M | 断网/CDN 失败时首页标题与正文仍为像素字体；`document.fonts.check()` 在首帧后即 true；首屏无"雅黑闪一下"的 FOUT |
| 3 | **字号 14 / 16 / 20px 全部落在像素字体的非整数倍，全站文字发虚**。`--fs-nano:12 / --fs-body:14 / --fs-btn:16 / --fs-title:20 / --fs-hero:24`（`styles.css:36-40`）。Fusion Pixel 是 12px 网格字体，只有 **12/24/36** 能得到干净方块；14px=1.167×、16px=1.333×、20px=1.667× 会产生亚像素插值。实测放大（`_rev3_zoom_type.png`）：24px 的 `.hero` 笔画结实，14px 的 `.hero-sub`「搜菜名，或者让农场帮你摇几道～」**边缘带灰雾、笔画粗细不匀**，`.high-contrast` 不再成立——这是"看起来不专业"最直接的一眼来源，比任何配色问题都更伤像素风 | 5 | 把字号体系**收敛到 12 / 24 两档**（必要时加 36 给 hero）：`--fs-nano` 12、`--fs-body` 12、`--fs-btn` 12（按钮内用 `letter-spacing:1px` + 加高盒模型撑气口）、`--fs-title`/`--fs-hero` 24。需要"中间档"时禁止用小数倍，改 `transform: scale(1)` + 调整字重/间距来区分层级。同步把 `.dish-name`、`.input`、`#novelMatch` 等直接写死的字号一并替换 | P0 | M | 全站 `font-size` 取值集合 ⊆ {12, 24, 36}；365% 放大截图中每个汉字笔画为整数像素、无灰阶过渡；`.hero-sub` 与 `.hero` 观感锐度一致 |
| 4 | **像素图标 scale 几乎全部不是 12 的倍数，像素栅格宽窄不均**。`app.js` 实测取值：`13`×5、`15`×1、`18`×2、`22`×3、`26`×2、`28`、`52`，以及 `injectStaticIcons`（`app.js:97-104`）里的 `20/22/18`——**约 20 处里只有 1 处是 24**。22px 时每个格子在 DPR3 下是 5.5 物理像素（一半 5 一半 6），`shape-rendering="crispEdges"` 只能保证不混色、**保证不了等宽**。实测对比：`meat` 在 22px 下红色块 1095 物理像素、24px 下 1296，即栅格周期不整除；放大图里「肉菜」图标的红色块上下行厚薄明显不一致 | 4 | 建立 **scale 白名单 {12, 24, 36, 48}**，全部改写：`22→24`、`20→24`、`18→24`、`28→24 或 36`、`52→48`、`13/15→12`（勾选图标用 12 即可，因为 `check` 网格本身只有 12 格）。`.check` 20px 内放 12px 更透气 | P1 | S | `grep "scale:" app.js index.html` 结果 ⊆ {12,24,36,48}；任一图标在 DPR2/3 下每行像素高度完全相等（用截图逐行像素统计验证） |
| 5 | **首屏下方 314px（37%）纯色空白，零视觉记忆点**。`#home` 内容到 `.cuisine-toggle`（y 482+48=530）就结束，844 视口余下全是 `--c-cream`。评委手机打开「1024 造物挑战」的 3 秒里，看到的只有：一条木纹顶栏 + 一行标题 + 一个输入框 + 4 个黄块 + 2 个按钮，**没有任何"像素农场"的场景证据**——没有作物、没有栅栏、没有角色、没有地块。这 37% 的空白本该是全场最贵的一块广告位 | 5 | 在 `.cuisine-wrap` 之后（或吸底）加一条**像素农场场景带**（纯 CSS + 现有图标即可，无需新素材）：`repeating-linear-gradient` 做 3 层地块 + `PXIcon.svg('wheat'/'carrot'/'ing_tomato')` 排一排作物 + `arrowL` 拼栅栏 + `sparkle` 做 2 帧 `steps()` 闪烁。高度 `flex:1` 吸收剩余空间，`min-height: 180px`。成本很低但首屏记忆点直接翻倍 | P1 | M | 390×844 首屏底部空白 <80px；截图中可见至少一种农场元素（地块/作物/栅栏）；该区块在 `prefers-reduced-motion` 下静止 |
| 6 | **色彩层级倒置：4 个菜类黄块压过唯一主 CTA**。`.rgrid .rbtn`（`styles.css:190-191`）用 `--c-corn #F2C14E` 满涂，4 块 174×60 = **41,760px²**；`.rbtn.primary`（`styles.css:182`）番茄红 358×48 = **17,184px²**。黄色高饱和大面积是第一视觉落点，而"掷骰子·随便来四个"才是产品主路径。同时 `.eyebrow`（`styles.css:129-131`）`#D69E2D` on `#FFF1D6` 仅 **2.14:1**，首屏第一行文字几乎读不出（对比度细节见 07-mobile-a11y.md #8，此处只谈层级） | 4 | ① 菜类 4 块去饱和：底色改 `--c-paper`，只保留 3px 墨框 + **左侧 4px 分区色条**（`inset 4px 0 0 var(--c-grass)` 之类），把黄色收回到"图标底色" ② `--c-corn` 只给 `.rbtn.rand` 的骰子做局部强调 ③ `.eyebrow` 改 `--c-ink-soft`（5.07:1）或直接 `--c-ink` | P1 | S | 首页灰度化后，红色 CTA 是唯一最深/最重的块；`.eyebrow` 对比度 ≥4.5:1；4 个菜类块不再占据首屏最大色域 |
| 7 | **桌面端 61% 空旷，且"掌机"设定没做收口**。`.app`（`styles.css:72-80`）`min-height:100dvh` + 640px 居中，但内容只有 350px 高；`@media (min-width:680px)` 里只加了左右 3px 描边和两侧 `10px` 半透明影（`styles.css:84-86`），**没有上边框、没有下边框、没有机身**。1440×900 下就是一根 640×900 的奶油色长条插在亮绿草地上，既不像手机也不像掌机，显得"页面没做完"。另外 `box-shadow` 用的是半透明 rgba，与全站实心墨影不是一个语言 | 4 | ① 桌面端把 `.app` 改成**固定高度的掌机机身**：`height: calc(100dvh - 48px); min-height: auto; max-height: 880px;` 加 `border: 3px solid var(--c-ink)`（四边），底部加 12px 草绿/木色"机身边"（`::after`）② 壳内 `overflow:auto`，内容短时用 #5 的农场场景带自然填满 ③ 两侧投影换成实心 `8px 0 0 rgba(59,42,32,.18)` 与 `--sh-card` 同族的深墨色 ④ ≥1024px 时壳外加一圈 `repeating-linear-gradient` 木栅栏装饰 | P1 | M | 1440×900 下 `.app` 四边都有 3px 墨框、内容区域空白 <15%；截图看起来像"一台设备"而不是"一条竖条"；两侧影为纯色非模糊渐变 |
| 8 | **全站 0 条 `:hover`，桌面端所有可点元素零悬停反馈**。`grep -c ":hover" styles.css` = **0**。`.rbtn` / `.dish-card` / `.item` / `.icon-btn` / `.cart-pill` 都只有 `:active`（`styles.css:107,122,169,181,230,258,302`）。鼠标移到卡片上光标变了但画面毫无反应，配合笨重的 3px 描边，桌面端观感"死"。次要问题：`.dish-name` 恒定 `padding-right: 26px`（`styles.css:233`）给只在选中态出现的 `.pick` 让位，未选中的卡右侧白白空 26px | 3 | ① 加 `@media (hover:hover) and (pointer:fine)` 下的 hover：`.rbtn:hover{background:#FFFDF7}`、`.rbtn.primary:hover{background:#EA6250}`、`.dish-card:hover{transform:translate(-1px,-1px); box-shadow:5px 5px 0 var(--c-ink)}`、`.item:hover{background:#FFFDF7}`、`.icon-btn:hover{background:#FFF8EA}` ② 所有 hover 用 `steps` 或瞬时切换，**不要加 `transition: background .2s` 的柔滑**（会破坏硬切感）③ `.dish-name{padding-right:0}`，改成 `.dish-card.in-cart .dish-name{padding-right:26px}` | P2 | S | 桌面端鼠标划过 5 类元素都有可见、非渐变的即时变化；`.dish-card` hover 时 `transform` 为负偏移（"抬起"而非"压下"）；未选中卡片菜名可用满整行宽 |
| 9 | **像素风一致性破口：半透明模糊影 + 单侧影 + 间距不成 4 栅格**。① `.px-notch`（`styles.css:217`）用 `filter: drop-shadow(5px 5px 0 rgba(59,42,32,.22))`——半透明、5px，而全站卡片是 `--sh-card: 4px 4px 0 var(--c-ink)` 实心（`styles.css:44`），同一个页面里并存两种投影语言，导览页分区盒子因此"发灰" ② `.share-sheet`（`styles.css:387`）`box-shadow: 0 -4px 0 ... , 8px 0 0 rgba(.25)`——**只有上和右、且半透明**，左侧完全没有分离，弹层看起来"漏边" ③ 间距取值 16 种（1/2/4/5/6/7/8/9/10/11/12/14/16/18/20/22/24/26/30/42），只有 4/8/12/16/20/24 在 4px 栅格上，`6/7/9/10/11/14/18/22/26` 破坏节奏 ④ `.float-checkout`（`styles.css:361`）`width: calc(100% - 36px)` vs 卡片 `100% - 32px` → 手机端比内容**窄 2px/侧**；桌面 `max-width:608px` vs 可用 602px → 又**宽 3px/侧**，两边都不对齐 | 3 | ① `.px-notch` 换实心：`box-shadow: 5px 5px 0 var(--c-ink-soft)`（或去掉 `filter`，用四向 inset 变成 6px 粗描边），与 `--sh-card` 同族 ② `.share-sheet` 改 `box-shadow: 0 -4px 0 var(--c-ink)` 四向 + 加 `border: 3px solid` 三层（左右也描边） ③ 间距统一到 **4px 栅格**：6→8、7→8、9→8、10→12、11→12、14→16、18→16 或 20、22→24、26→24 ④ `.float-checkout` 改 `width: calc(100% - 32px); max-width: 602px`，与卡片同轴 | P2 | S | 全站 box-shadow 只出现纯色（无 rgba 影）；`.px-notch` 与 `.dish-card` 投影同为实心且偏移量差 ≤1px；间距取值全部 % 4 == 0；悬浮按钮左右边缘与 `.item` 卡片像素级对齐 |
| 10 | **分享清单图在弹层里被缩成 12px→6.7px，且三个全宽按钮吃掉了弹层 40%**。`drawListImage`（`app.js:438`）画 800px 宽的 PNG，`.share-img` 是 `width:100%`（`styles.css:397`），在 390 机型 `.share-sheet` 内宽约 358 → 缩放 **0.45×**，图里 12px 的「用于 2 道菜」「（可选）」全部变成 5-6px 的墨点，用户以为"图糊了"；同时 `.share-actions`（`styles.css:405`）三个 `rbtn-block` 各占 48px + 10px 间距 ≈ 164px，约占弹层 40%。附带细节：`app.js:471` 的 `fillText(..., W - pad - 10, y + 12)` 与分区头 `W - pad - 12`（`app.js:461`）右对齐差 2px；`app.js:464` 图标绘制在 `y+5`、文字基线 `y+8`，24px 图标中心比 16px 文字中心低 4px，视觉略坠 | 3 | ① `.share-img` 改为 `max-height: 46vh; width:auto; margin:0 auto`，让图按高度适配、不强行压窄 ② 加"点击图片全屏查看"（`<button>` 触发 `position:fixed; inset:0; object-fit:contain`）③ 「关闭」从左下全宽按钮改成弹层右上角 26×26 像素 `close` 图标按钮，只留「保存图片」「分享到手机」两个主按钮 ④ 右对齐统一到 `W - pad - 12`；图标 y 改 `y+3` 使中心与文字对齐 | P2 | M | 弹层里清单图缩放后 12px 文字有效高度 ≥10px，或提供点击放大；弹层按钮区高度 ≤弹层 25%；清单图内右对齐元素 x 坐标一致、图标与文字中心偏差 ≤1px |

## 附：像素风"红线"合规快查

| 检查项 | 结果 | 证据 |
|---|---|---|
| 圆角 | ✅ 全 `border-radius: 0` | `styles.css` 8 处，无例外 |
| 模糊 / backdrop-filter | ✅ 无 | — |
| 半透明阴影 | ❌ 3 处 | `styles.css:217` `.px-notch`、`:387` `.share-sheet`、`:86` 桌面两侧影 |
| 渐变 | ⚠️ 仅木纹（可接受） | `styles.css:95-97` `repeating-linear-gradient` 需保证 2px 条纹在 DPR1 下不糊，建议 2→3px |
| 抗锯齿 | ⚠️ 图标 `crispEdges` 已开，但 scale 非 12 倍数使栅格不整除 | 见 #4 |
| emoji 残留 | ✅ **未渲染**。`data-100.js:5-45` 与 `data.js:4-12` 的 `zones[].icon` 仍是 `🥬🥩🐟🧂🧊🍚🥚🛒`，但 `app.js:19` 用 `ZONE_ICON` 映射表整体覆盖，全库 `grep` 无 emoji 输出点；唯一"emoji 味"命名是 `.done-emoji`/`.fc-emoji` 类名，内容已是 `trophy`/`basket` SVG | 实测 8 屏截图无一个 emoji |
| 字体锐度 | ❌ 14/16/20px 非整数倍 | 见 #3 |
| 图标锐度 | ❌ 20 处 scale 仅 1 处合规 | 见 #4 |
| 图标可见度 | ❌ 5 个调色板字符对纸底 <1.35:1 | 见 #1 |
| 悬停态 | ❌ 0 条 `:hover` | 见 #8 |
| 间距栅格 | ⚠️ 16 种取值，仅 6 种合规 | 见 #9 |

## 评分倾向

- **像素语言纯度**：7 / 10 —— 描边、硬影、按压位移三件套做得非常正统（`:active` 的 2px 位移 + 阴影 3→1px 抵平是全站最讲究的细节），但字号与图标 scale 两个"整数栅格"没守住，等于像素画最核心的纪律没执行到位。
- **首屏冲击力**：5 / 10 —— 37% 空白 + 无场景，手机上第一眼只是"一个描边很重的表单"。
- **信息层级**：6 / 10 —— 黄块压主 CTA，`.eyebrow` 2.14:1 几乎不可读。
- **完成度细节**：7 / 10 —— 已选态、勾选态、分享图导出都想到了，但 `egg` 图标消失、悬浮按钮错位、分享图右对齐 2px 这类"最后一公里"漏了。

**一句话**：这套设计系统的"骨架"是对的，失分全在**整数栅格纪律**（字号 12 倍数、图标 scale 12 倍数、间距 4 倍数）和**首屏那块 37% 的空白**——前者 2 小时能修完且收益最大，后者是唯一能让评委"记住"的地方。
