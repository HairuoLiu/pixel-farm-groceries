# 评委 8 · QA 与健壮性测试评审 —「像素农场 · 采购记」

- **评审人**：评委 8（QA 与健壮性测试负责人）
- **评审对象**：`grocery-reminder-pixel`（原生 JS 单页 App，104 道菜 / 122 种食材，流程 L1→L2→L3→L3b，canvas 导出清单图 PNG）
- **测试环境**：Chromium 156.0.8078.4（Playwright 1.64.0），视口 390×844（移动端优先），站点 `http://127.0.0.1:8901/index.html`，CDN（jsDelivr 字体 / Supabase）全程断网隔离
- **测试方法**：通读 `app.js` 全文标注风险点 → Python Playwright 脚本真实点击/输入/刷新/多标签实测（探针 `_08_probe_a.py`、`_08_probe_b.py`，结果 `_08_results_a.json`、`_08_results_b.json`，截图 `shots08/`）
- **总结论**：核心流程（满篮、导览闯关、刷新恢复、连击、分享兜底）健壮性**良好**；主要失分点在**状态持久化层无任何输入校验**（脏数据可致启动即死）、**移除菜品不清理勾选状态**（幽灵勾选误导采购）、**localStorage 写失败时 UI 静默死亡**、**导出失败零反馈**。以下 9 条建议全部基于实测现象。

---

## 一、8 项必验场景实测结果总览

| # | 必验场景 | 实测结果 | 判定 |
|---|---|---|---|
| 1 | 菜篮加满 104 道后总览/清单图 | 总览 8 区 122 项渲染正常；导览 8 关翻页正常（122 项累计）；清单图 1600×9712px、dataURL 1.75MB、下载文件名 `采购清单_2026-10-21.png` 正常 | ✅ 通过 |
| 2 | 加菜→打勾→移除→checked 残留 | **复现脏数据**：移除后 `grocery-checked-v3` 残留 `dairy\|鸡蛋`；换含同食材的菜（蛋炒饭）加入后显示"已勾"，进度"已勾 1/6"被污染 | ❌ 失败（建议 #2） |
| 3 | localStorage 被禁用 | **不白屏**（`loadJSON` 有 try/catch，首页正常渲染）；但加菜/打勾**全部静默失败**：按钮文字不变、pill 不出现、卡片无样式变化，刷新后数据全丢 | ⚠️ 部分失败（建议 #3） |
| 4 | 搜索超长串/特殊字符/空格/emoji | 无崩溃、**XSS 不可触发**（`__xss1/2/3` 均 undefined）；但 **10 万字符使整页 scrollWidth 爆炸到 663,344px**；纯空格搜索**零反馈**；"没找到"提示陈旧残留 | ⚠️ 部分失败（建议 #5、#7） |
| 5 | 连续快速点击"换一批"/"加入菜篮" | 换一批 ×30（同帧 13.2ms）最终 4 卡一致；同卡加入 ×21（奇数次）最终 1 项、UI 与内存一致；菜篮 pill ×12 乒乓切换 overview/guide 无异常；清单图连点 ×5 各 ~135ms 无泄漏 | ✅ 通过 |
| 6 | 刷新后状态恢复 | cart/checked/勾选状态/进度**完全一致恢复**；刷新回首页（符合预期）；仅 guideIndex 重置 | ✅ 通过 |
| 7 | 食材极多时 canvas 高度 | 满篮公式核算 H=4856 → naturalHeight **9712**，与代码逐像素吻合；Chromium 上限（高 65535 / 面积 2^28）内**不越界**；但无加载态、连点叠加阻塞主线程、iOS Safari 历史 4096×4096 区域限制需真机验证 | ✅ 通过（带风险，建议 #6） |
| 8 | 分享弹层在导出失败时 | `toDataURL` 抛错 → **弹层不开、完全无反馈**（unhandled rejection）；返回空串 → **弹层打开但破图**（naturalWidth=0）；`canShare` 不存在 / fetch 失败 → 均正确回退"保存图片"并成功下载 | ❌ 失败（建议 #4） |

---

## 二、问题与建议表（按优先级排序）

| # | 问题（含复现步骤与证据） | 影响评分(1-5) | 建议 | 优先级 | 工作量 | 验收标准 |
|---|---|---|---|---|---|---|
| 1 | **localStorage 两个状态键被写入对象/数字/布尔类型值时，App 启动即崩溃（死壳白屏）**。复现：DevTools 执行 `localStorage.setItem('grocery-cart-v3','{"x":1}')` 后刷新（`'5'`、`'true'`、或 `grocery-checked-v3='{"a":1}'` 同样中招）。证据：pageerror `object is not iterable (cannot read property Symbol(Symbol.iterator))`；四个菜类按钮全部消失（`#typeGrid .rbtn`=0），随机/搜索/菜系交互全部无响应（事件绑定在崩溃行之后未执行）；截图 `shots08/B9_crash_cart_object.png`。根因：`app.js:79-80` `new Set(loadJSON(...))` 对不可迭代 JSON 值直接抛出，`loadJSON`（app.js:82）无 `Array.isArray` 校验 | 5 | `loadJSON` 增加类型与元素校验：`Array.isArray(v) ? v.filter(x => typeof x === 'string') : def`；`saveCart/saveChecked` 同样只写字符串数组。一行防御杜绝整站死亡 | P0 | S | 依次注入 9 类脏值（对象/数字/布尔/字符串/null/非法 JSON/数字数组/checked 对象/checked 字符串）后刷新，App 均正常启动：或空篮、或仅保留有效菜品；控制台无 pageerror |
| 2 | **移除菜品后 checked 残留"幽灵勾选"**。复现：搜"番茄炒蛋"→加入→菜篮→总览→勾选"鸡蛋"→返回→再点该卡移除→搜"蛋炒饭"→加入→总览：`dairy\|鸡蛋` 仍显示已勾（class `item checked`），进度"已勾 1/6"；localStorage `grocery-checked-v3` 始终残留 `dairy\|鸡蛋`。证据：`shots08/A3_ghost_checked.png`、`_08_results_a.json:T2`。根因：`toggleCart`（app.js:240）只改 cart 不动 checked，脏 key 无限累积；线下采购时用户会误以为"这个已经买过了" | 4 | 移除菜品时按该菜食材集合清理 checked（`buildGuideZones` 已有聚合逻辑可复用，注意保留其他菜共享的食材）；或在渲染层只认当前购物篮产生的 key；另提供"清空全部勾选"入口 | P1 | S | 移除菜品后 localStorage checked 不再含其独有食材 key；共享食材被其他菜引用时保持已勾；总览"已勾 x/y"与可见项完全一致；脏 key 不随会话无限增长 |
| 3 | **localStorage 写入失败（Safari 隐私模式/配额满/存储被禁）时 UI 静默死亡，刷新后数据全丢**。复现：`Storage.prototype.setItem=()=>{throw new Error()}` 后打开站点→点"加入菜篮"：按钮文字仍是"加入菜篮"、cartPill 不出现、卡片无 in-cart 样式（内存 `cart.size=1` 界面 0），控制台 pageerror `QuotaExceededError`；刷新后购物篮为空。读取也禁用时（localStorage 访问抛错）不白屏但同样交互全死。证据：`_08_results_b.json:T3a/T3b`。根因：`saveCart/saveChecked`（app.js:83-84）无 try/catch，异常中断 `toggleCart`，`renderDishes` 不执行 | 4 | `saveCart/saveChecked` 包 try/catch：失败时内存态继续生效（当前行为）并 toast 提示"当前环境无法保存进度（可能为隐私模式），刷新后将丢失"；启动时若检测到写入不可用也可在首页横幅提示一次 | P1 | S | 模拟 setItem 抛错/配额满：点击加菜按钮有明确提示且界面状态与内存一致；不再出现静默无反馈；刷新行为符合提示预期 |
| 4 | **导出清单图失败时零反馈或破图**。复现：mock `toDataURL` 抛错→点"生成清单图"→弹层保持隐藏、页面毫无反应（unhandled rejection，`_08_results_b.json:T8`）；mock 返回 `''`→弹层打开但 `img src=''`、naturalWidth=0，显示破图（`shots08/B8_broken_share_modal.png`）。根因：`drawListImage`（app.js:488 `cv.toDataURL`）及 `generateListImage` 的 promise 链均无 catch。分享是参赛核心传播功能，失败时用户只会认为"按钮坏了" | 3 | `toDataURL` 包 try/catch；成功后校验 dataURL 长度阈值（如 >10KB）再 `showImageModal`；任一失败 toast "清单生成失败，请重试"（可附失败原因）；按钮进入 generating 态防连点 | P2 | S | mock toDataURL 抛错/返回空/返回超短串三种失败：均出现明确错误提示、不打开破图弹层、控制台无 unhandled rejection；成功路径不受影响 |
| 5 | **搜索超长字符串导致整页横向爆炸**。复现：搜索框粘贴 100,000 字符→回车→`documentElement.scrollWidth` 从 390 暴涨到 **663,344px**（`#search` scrollWidth 773,896，逐层传导至 body/.app/main/#home），移动端可把整个 UI 横向拖入虚空；无崩溃。特殊字符/emoji/引号/SQL 注入串均安全（textContent 渲染，XSS 不可触发——已实测 `__xss1/2/3` 全为 undefined）。证据：`shots08/B4_overflow_ultra_long_100k.png`、`_08_results_b.json:T4` | 3 | `<input id="search">` 加 `maxlength="50"`；`doSearch` 对超长 q 直接走"没找到"分支（已有）并截断展示；CSS 兜底 `.no-match p{overflow-wrap:anywhere}`（长 token 换行，防止 <p> 也被撑爆——本次 <p> 靠现有换行规则幸免，但属巧合） | P2 | S | 输入 10 万字符提交后 scrollWidth ≤ 视口宽 +2px；正常搜索（≤50 字符）行为不变；无 XSS |
| 6 | **满篮清单图无加载态 + 体积/平台风险**。实测（104 菜/122 食材）：canvas 1600×9712（与公式 `H=108+48+72+Σ(46+n×34+14)` 逐像素吻合），dataURL 1.75MB，单次生成 ~135ms（离线字体回退），连点 5 次无异常无内存泄漏，Chromium canvas 上限内不越界。风险：①生成期间主线程阻塞且按钮无 disabled/loading，低端机连点会叠加排队；②iOS Safari 对 2D canvas 有历史区域上限（4096×4096），本图 1600×4856=1552 万 px 已超限，**可能被裁剪**（本环境无 iOS 设备，未实测，需真机验证） | 3 | 生成期间禁用按钮 + "生成中…"态；iOS 真机验证导出完整性，若被裁剪则对超长清单降级（S 倍率 2→1.5、或按区分多张图）；`toDataURL` 前 `cv.height` 超阈值时走压缩参数 | P2 | M | 满篮生成：按钮 loading→恢复，连点不叠加；iOS Safari（iPhone）真机导出图包含全部 122 项食材且页脚完整；生成耗时 P95 < 3s（中端安卓） |
| 7 | **纯空格/空串搜索零反馈 + "没找到"陈旧残留**。复现 A：全新页面搜索框输入 3 个空格→回车→完全无反应（无提示、不跳转、输入框保留空格）。复现 B：先搜不存在的词（出现"没找到「x」"）→掷骰子→返回首页→"没找到「x」"仍残留。根因：`doSearch`（app.js:150）空 query 直接 return；`noMatch` 仅在搜索成功时被隐藏，`showScreen` 不清理。证据：`_08_results_b.json:T4` + 独立复测 | 2 | 空/纯空格 query 时 `noMatch` 显示"多少写点啥～"（textContent 赋值）；`showScreen('home')` 与 `goSelect` 时统一 `$('noMatch').hidden = true` | P3 | S | 空格/空串提交有可见反馈；从任意路径返回首页不再出现上一次的"没找到"提示 |
| 8 | **多标签页并发购物篮互相覆盖（后写覆盖）**。复现：同浏览器开两个标签都进站点；标签1 加"番茄炒蛋"，标签2 加"蛋炒饭"→标签1 刷新后购物篮只剩"蛋炒饭"（先写的菜丢失）。根因：`saveCart` 全量覆盖写，无 storage 事件监听、无 read-modify-write 合并。证据：`_08_results_a.json:T12` | 2 | 最低成本：`saveCart/saveChecked` 前重读合并（read-modify-write）；或监听 `window` 的 `storage` 事件，检测到外部变更时 toast "另一个标签页修改了菜篮，刷新同步" | P3 | S | 双标签各加一道菜后任一标签刷新，两道菜都在（或有明确合并/冲突提示）；无静默丢失 |
| 9 | **购物篮含无效 id 时进入"空白总览 + 虚假通关"死胡同**。复现：`localStorage.setItem('grocery-cart-v3','"ab"')`（或 `'[1,2,3]'`）→刷新→pill 显示 2/3、悬浮"去市集采购"可点→总览完全空白（0 区 0 项、"已勾 0/0"）→点"完成采购"→奖杯卡"共 2 道菜 · 0 样食材 已收入囊中"。`buildGuideZones`（app.js:256）对无效 id 静默跳过。证据：`shots08/B_dirty_cart_json_string_ab.png` | 2 | `goOverview/goGuide` 入口处过滤无效 id 并回写 localStorage（与建议 #1 的校验联动）；总览 gzs 为空且 cart.size>0 时显示空态"菜篮里的菜已下架，换个菜吧" | P3 | S | 注入无效 id 后进入总览：不出现空白页与虚假通关卡；无效 id 被清理且 pill 计数与实际菜品一致 |

---

## 三、复现步骤与证据索引

| 建议 # | 复现步骤（Playwright/DevTools 可 1:1 复现） | 证据文件 |
|---|---|---|
| 1 | `localStorage.setItem('grocery-cart-v3','{"x":1}')` → `location.reload()`；依次换 `'5'`、`'true'`、`grocery-checked-v3='{"a":1}'` | `shots08/B9_crash_cart_*.png`（4 张）；`_08_results_b.json → T9_dirty_localStorage` |
| 2 | 搜"番茄炒蛋"→点卡加入→点 cartPill→点 `dairy\|鸡蛋` 项→backBtn→再点同一卡（移除）→搜"蛋炒饭"→加入→cartPill 看总览 | `shots08/A3_ghost_checked.png`；`_08_results_a.json → T2_checked_residue` |
| 3 | 控制台执行 `Storage.prototype.setItem=()=>{throw new Error('x')}`→点"掷骰子"→点"加入菜篮"→刷新；（变体：`Object.defineProperty(window,'localStorage',{get(){throw 0}})` 后刷新看首页） | `_08_results_b.json → T3a/T3b` |
| 4 | 控制台 `HTMLCanvasElement.prototype.toDataURL=()=>{throw 0}`→总览→"生成清单图"；改 `=()=>''` 再试 | `shots08/B8_broken_share_modal.png`；`_08_results_b.json → T8_*` |
| 5 | 搜索框粘贴 10 万字符→回车→`document.documentElement.scrollWidth` | `shots08/B4_overflow_ultra_long_100k.png`；`_08_results_b.json → T4_search_inputs` |
| 6 | 加满 104 菜→cartPill→"完成采购"→"生成清单图"→读 `shareImg.naturalWidth/Height`；连点 5 次计时 | `shots08/A1/A2`；`_08_results_a.json → T1/T7/T5_ovImg_rapid_5x` |
| 7 | 全新页面搜"   "回车；再搜"不存在的菜xyz"→掷骰子→返回首页 | `_08_results_b.json → T4`（spaces_only / noMatch_residue_after_back） |
| 8 | 两个标签页同开站点，各加一道菜，刷新先开的标签 | `_08_results_a.json → T12_multitab` |
| 9 | `localStorage.setItem('grocery-cart-v3','"ab"')`→刷新→cartPill→总览→"完成采购" | `shots08/B_dirty_cart_json_string_ab.png`；`_08_results_b.json → T9` |

探针脚本：`review-panel/_08_probe_a.py`、`review-panel/_08_probe_b.py`（Python + Playwright，可重跑）；
原始结果：`review-panel/_08_results_a.json`、`review-panel/_08_results_b.json`。

---

## 四、实测正常项（正面清单，无需改动）

1. **满篮渲染与导出**：104 道菜/122 项食材/8 分区总览与导览闯关全部正常，canvas 尺寸与布局公式逐像素吻合，PNG 下载链路正常（文件名含日期）。
2. **刷新恢复一致性**：cart/checked/勾选态/进度刷新后完全恢复，回到首页符合预期。
3. **连击鲁棒性**：换一批 ×30、同卡加入 ×21、菜篮 pill ×12 乒乓、清单图连点 ×5，状态自洽、无异常、无内存泄漏。
4. **搜索注入面**：`<script>`/`<img onerror>`/引号/SQL 串/emoji 均无法触发 XSS（搜索词必须是菜名/tag 子串才会进入 innerHTML 路径，且无匹配时走 textContent）——注入防护实测达标。
5. **分享兜底链**：`navigator.canShare` 不存在、`fetch(dataURL)` 失败，均正确回退"保存图片"并成功下载。
6. **资源降级**：`data-100.js` 加载失败时自动回退 `data.js`（18 道菜）完整可用；`icons.js`/埋点 CDN 失败不影响功能。两个数据文件同时失败也不白屏，但会降级为空数据僵尸态（4 个菜类按钮可点、结果为空），建议顺手加"数据加载失败"提示（可并入建议 #1 的启动防御）。

---

## 五、给参赛作者的优先行动清单

1. **P0 今天做**：`loadJSON` 加 `Array.isArray` + 字符串元素过滤（建议 #1，~10 行，杜绝整站启动死亡）。
2. **P1 本次迭代**：移除菜品清理 checked（#2）；`saveCart/saveChecked` try/catch + 隐私模式提示（#3）。
3. **P2 发布前**：导出失败 toast + loading 态（#4）；搜索 `maxlength`（#5）；iOS 真机验证清单图（#6）。
4. **P3 有余力**：空格搜索反馈与 noMatch 清理（#7）；多标签合并（#8）；无效 id 过滤与空态（#9）。
