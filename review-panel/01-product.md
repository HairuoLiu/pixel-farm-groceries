# 评委 1 · 产品经理 评审意见 ——「像素农场 · 采购记」

> 评审视角：WorkBuddy「1024 造物挑战」应用创作大赛。评委/观众在**手机上打开链接，看 30 秒～2 分钟**就决定给不给好评。
> 已实际阅读：`index.html`、`app.js`、`styles.css`、`data-100.js`（抽样+脚本统计）、`data.js`、`icons.js`、`ingredient-icons.js`、`analytics.js`、`DESIGN-pixel.md`。
> 数据实测：104 道菜、739 条食材项，其中 **471 条是 optional（63.7%）**，平均每道菜 7.1 项（最多 20 项）。

总体判断：**视觉包装已完成度很高（像素语言统一、8 分区色系统完整、92 个食材图标是真工作量），但"产品叙事"落后于"视觉叙事"**——
用户在前 30 秒看到的是"随机菜名"，而不是本作唯一值钱的差异点："选菜 → 自动生成按超市分区的采购清单"。
同时闭环有两个硬伤：**主 CTA 直接跳过核心玩法（分区闯关）**、**菜篮无法清空导致二次访问进入死状态**。这两条会直接吃掉好评分。

---

## 评审表

| # | 问题（具体，指出文件/函数/选择器/行号） | 影响评分(1-5) | 建议（可落地的具体做法） | 优先级 | 工作量 | 验收标准（可验证） |
|---|---|---|---|---|---|---|
| 1 | **核心价值被藏在三级页面后面**：`app.js:206-232` `renderDishes()` 生成的 `.dish-card` 只有 菜名/简介/类型chip/分区签/加入菜篮按钮，**用户在点"加入菜篮"前完全看不到"这道菜要买什么"**。真正的分区食材清单要到 L3 `renderGuide()`（`app.js:295-323`）才出现。观众 30 秒里只看到"随机菜名"，与市面上一堆"今天吃什么"转盘完全同质感。 | 5 | ① 卡片加一行食材预览 `.dish-ing`（新样式，styles.css 加 ~6 行）：`必买 2 样 · 番茄 鸡蛋 (+4 常备)`，用现成的 `icons.js` 的 `basket`；② 点**菜名**展开食材 chip（复用 `app.js:229` 的 `e.stopPropagation()` 模式，避免与整卡加购冲突）；③ `select-hint`（`app.js:162/178/188`）统一补一句"挑 2-3 道 → 自动生成 8 大超市分区清单，照着勾就能买完"。 | P0 | M(<2h) | 随机四道后，不点任何按钮即可在卡片上读到每道菜的必买食材；5 名未看过介绍的测试者中 ≥4 人能复述"它把菜变成超市分区购物清单"。 |
| 2 | **闭环断裂①：主入口绕过核心玩法**。`app.js:552` `floatCheckout.onclick = goOverview` —— L2 悬浮「去市集采购」直接跳到 L3b 总览，`goGuide()`（`app.js:274`）的"关卡 1/8 逐区闯关"默认永远走不到；最高频按钮把最贵的玩法架空了。 | 5 | 改为 `floatCheckout.onclick = goGuide`（先闯关），总览降级为次按钮：保留 `index.html:79` `#viewOverview`，并在 select 页 `#selectFoot`（`index.html:65-69`）加一个 ghost 按钮"跳过闯关 · 直接看清单"。72px 主按钮与次按钮间距 ≥10px，遵循 `.rbtn-block` 的 margin-top:12px。 | P0 | S(<30min) | 首次走完一遍的路径固定为 home → select → guide（左上角出现"关卡 1/N"）→ overview；Analytics 的 `start_guide` 事件数 ≈ `open_app` 的 30%+（需先启用埋点）。 |
| 3 | **闭环断裂②：菜篮无法清空 → 二次访问死状态**。全文件无 `clearCart`/`localStorage.removeItem`（已 grep 确认）。`completeList()`（`app.js:354-374`）无条件通关，且**不清 `cart`/`checked`**，`doneHome`（`app.js:372`）只 `showScreen('home')`。后果：老评委/观众第二次打开链接，看到的是上次那份"全部已勾完"的陈旧清单，体验直接崩。另：从菜篮移除某菜后，`checked` 里该菜的食材键残留，重新加入时会显示为"已勾选"。 | 5 | ① 新增 `clearCart(cb)`：`cart.clear(); checked.clear(); saveCart(); saveChecked();`；② 入口放在总览 head 右上 + 通关卡片（`#ovDone` 旁）ghost 按钮"清空菜篮 · 开启新一轮"，二次确认用现有 `.share-modal` 结构复用；③ `#ovDone`（`app.js:561`）加门槛：`doneTotal===0` 时禁用并提示"至少勾一样再通关"；勾选未满时文案改"结束采购"；④ 通关动线改成 结算 → "开启新一轮" → 回干净首页。 | P0 | M(<2h) | 走完一轮后点"开启新一轮"，`cart.size===0`、`localStorage['grocery-cart-v3']` 与 `['grocery-checked-v3']` 均为 `[]`；重新打开页面为干净首页（无 `#cartPill`、无 `#floatCheckout`）。 |
| 4 | **清单信噪比极低：63.7% 是可选调料**。实测 739 项中 471 项 `optional`；`buildGuideZones()`（`app.js:253-270`）把必买与可选**混排**，番茄炒蛋在"调料干货区"会列出 葱/盐/糖/食用油 4 项而"蔬菜区"只有 1 项。用户拿到清单的第一反应是"这单子比我头脑记的还长"，核心价值（精准、少走冤枉路）被稀释。 | 4 | ① 排序：必买优先，再排可选（`gz.items.sort((a,b)=> (a.optional?1:0)-(b.optional?1:0))`）；② 默认折叠可选：分区底部渲染 `常备调料 · 展开(4)`（新 key `grocery-show-opt` 存 localStorage，默认 false）；③ 首页加总开关"我调料齐全"，关掉后 `buildGuideZones` 直接过滤 `it.optional && it.note==='调味'`。 | P1 | S(<30min) | 任意 3 道菜组合，每个分区首屏必买项占比 ≥60%；打开开关后生成图清单行数减少 ≥35%。 |
| 5 | **首屏价值主张没讲清 + 零内容**。`index.html:28-30`：hero「今天想吃点啥？」+ sub「搜菜名，或者让农场帮你摇几道～」只传达"推荐菜名"，没提产物；`index.html:27-56` 首屏（手机未滚动）除搜索框和按钮外**没有任何菜品/清单实体**，用户必须点一下才知道这是啥。 | 4 | ① hero-sub 改成：**"选几道菜 → 自动生成超市 8 大分区采购清单，照着勾就买完"**（一句话说清输入和输出）；② hero 下加一行 stats chip：`104 道菜 · 122 种食材 · 8 大分区 · 3 分钟通关`；③ hero 下放一条横滚"今日值班"6 张菜品卡（按日期 seed 从 `DISHES` 取，复用 `renderDishes()` 的卡片 DOM，`.marquee` 容器 + `overflow-x:auto`）。 | P1 | S(<30min) | 手机首屏截屏（iPhone 尺寸未滚动）同时可见：价值主张句 + 数字 + ≥4 张像素菜品卡；陌生人 10 秒内能复述产品干什么。 |
| 6 | **分享/传播环节两处漏风**。① `index.html` 无 `meta description` / `og:title` / `og:image` / `theme-color` / favicon —— 链接丢进微信群是一张灰卡，直接影响打开率；② `index.html:134` 同步加载 Supabase UMD CDN，但 `analytics.js:10-13` 的 `SUPABASE_URL/ANON_KEY` 为空 → SDK 白下 ~150KB 且阻塞 `app.js` 首屏执行；字体 CSS（`index.html:8`）无 preconnect。 | 4 | ① 补 `<meta name="theme-color" content="#A9724A">`、description、og/twitter 三件套 + favicon；OG 图用现有 `drawListImage()` 逻辑离线生成一张 1200×630 `assets/og.png`（钉住 3 道示范菜）。② **删掉 `index.html:134` 的 supabase script 或改 `defer`**（埋点未启用时 `Analytics.track` 本就空转，`app.js:74`）。③ 字体 link 前加 `preconnect` + `crossorigin`。 | P1 | S(<30min) | 用任意分享调试器抓取链接，显示标题/描述/大图；Network 面板无 supabase 请求；4G 模拟下首屏可交互 <2s。 |
| 7 | **分享钩子只有 PNG，缺最低摩擦路径**。`app.js:491-508` 只提供「保存图片」和 `navigator.share({files})`（iOS Safari 外多数环境不支持），国内微信/群聊最常用的是**复制文字**；生成的 PNG（`drawListImage`, `app.js:413-490`）上也**没有来源标识/二维码**，图传出去不带任何回流。也没有"把这份菜单发给朋友"的能力。 | 4 | ① `.share-actions` 增加「复制文字清单」：`【今日菜单】番茄炒蛋、红烧肉\n🥬 蔬菜区：番茄、土豆…`（`navigator.clipboard.writeText`，回退 `textarea+execCommand`），成功后按钮文案变"已复制 ✓" 1.5s；② 菜单 URL 分享：`location.hash = 'm=' + Array.from(cart).join(',')`，启动时（`app.js:568-572`）解析 hash 恢复菜篮并直接 `goOverview()`；③ PNG 页脚（`app.js:485-486`）换成"打开链接，复现这份菜单 + <演示域名>"，右下角画一个静态二维码矩阵（一次性生成常量，零依赖）。 | P1 | M(<2h) | 点「复制文字」后粘贴到备忘录格式完整无误；带 `#m=` 的链接发给他人打开，直接还原同一份菜单；导出的 PNG 上有可识别的来源信息。 |
| 8 | **「随机四道」之后没有惊喜 + 存在死胡同**。`randomFour()`（`app.js:182-190`）纯随机：可能 4 道全肉/全主食，且与上一批重复（`pickRandom` `app.js:166-173` 无去重）；select 页只有整批「换一批」，**没有针对某一道菜的替换**；搜索无匹配时 `#noMatch`（`index.html:38-40`）文案里写着"随便来四个"但**不是按钮**，用户到此卡死；空搜索（`app.js:149-150`）直接 `return`，点了"搜一搜"毫无反馈。 | 3 | ① `pickRandom` 加组合约束：至少 1 荤 + 1 素，且至少 1 道汤羹/主食，排除上一次的 id 集合；② L2 顶部加"今日菜单卡"（`.combo-card`，用 `icons.js` 的 `sparkle`）：`荤素 2:2 · 预计 35 分钟 · 需买 18 样` + 随机彩蛋文案数组；③ `#noMatch` 里补两个真按钮（`<button id="nmRandom">` 掷骰子 / `<button id="nmClear">` 清空重搜）；④ 空 query 时 `$('search').focus()` 并给输入框加 `shake` keyframes（steps 帧感，符合 DESIGN §7 Do's 7）。 | P1 | M(<2h) | 连点 10 次「换一批」，无重复批次、无"全素/全肉"批次；搜索乱码后有可点出口且不死屏。 |
| 9 | **零留存钩子**：全站只有 `CART_KEY`/`CHECK_KEY` 两个 localStorage 键（`app.js:34-35`），没有历史、收藏、连续打卡；`analytics.js` 未启用 → 无任何行为数据。用户"用一次就走"，评委找不到"值得反复使用"的证据。 | 4 | 加第三个键 `grocery-stats`：`{unlocked:[dishId], trips:n, lastDate, streak, topIng:{}}`，在 `completeList()`（`app.js:373`）累加。落地两处可见钩子：① 首页一行"农场手册"条（`⛳ 已解锁 4/104 道菜 · 连续采购 2 天`，用 `flag`/`trophy` 图标）；② 成就进度："再点亮 6 道素菜 → 蔬菜达人"，数据纯本地，零后端。 | P2 | M(<2h) | 完成一轮后首页显示"已解锁 N/104 · 连续 1 天"；次日再完成变"连续 2 天"；关浏览器重开数据保留。 |
| 10 | **游戏化只停在文案层**：有"关卡 1/8""采购通关"的说法，但没有实质反馈。`bindItems()`（`app.js:510-526`）勾选只换底色；`renderGuide()`（`app.js:295-323`）**不显示本区勾选进度**，最后一区 `#nextZone` 直接 disabled（`app.js:322`），没有"本区完成→自动下一区"；无开场、无音效/震动。首屏也没有 1 个让人截图发圈的"哇"瞬间。 | 3 | ① 区域进度：`prog` 追加 `本区 3/7`，本区全勾 → 0.6s 内 `-1px steps()` 飘一个 `+1` / `sparkle` 像素粒子 + `navigator.vibrate?.(12)`，然后自动 `guideIndex++`；最后一区勾完自动触发 `completeList()`；② 加 1.2s 像素开场（作物从土里长出 + `像素农场` logo，`steps(6)`，任意点击跳过，仅首次会话显示，标记写 localStorage）；③ 通关卡（`app.js:360`）追加统计：`本次走了 5 个区 · 买了 18 样 · 用时 2 分 14 秒`（用 `Date.now()` 差值）。 | P2 | M(<2h) | 完整走一遍时出现 ≥3 次明确的正反馈（开场、I勾粒子、结算数据）；全部勾完无需点按钮自动进入通关卡片。 |

---

### 加分的小补充（不构成独立条目，建议顺手做）

- **`index.html:5` 的 `maximum-scale=1` 建议删除**：锁死缩放对低视力不友好，且部分评审会用桌面缩略预览； producto 无障碍是多数大赛评分表里的隐含项。
- **`index.html` 缺 `<noscript>` 与 `#127` `<main>` 之外的 skip-link**：静态站点低成本补齐。
- **清单行语义化**：`.item`（`app.js:313/341`）建议加 `role="checkbox" aria-checked`，加入菜篮时用一个 `aria-live="polite"` 的空 span 播报"已加入菜篮，共 3 道"（同时惠及依赖读屏的用户）。
- **`data-100.js` 里 zone 的 `icon` 字段是 emoji**（🥬🥩🐟…，`data-100.js:8-72`），与 DESIGN §7 Don'ts 2「禁止 emoji」冲突，虽然渲染层已用 `ZONE_ICON` 覆盖不显示，但代码审查会被扣分，建议清掉或换为空串。

### 一句话总结

> 视觉已经是一等奖水准，产品还差"三件事"：**把值钱的东西放进前 30 秒（L2 卡片显示食材 + 首屏价值句）、把主通道接回被架空的核心玩法（悬浮按钮→闯关，通关后可清空重开）、给清单减肥并补上可复制可回流的分享方式。** 做完 #1–#7，评委从"挺好看"变成"这个我会真的用"。
