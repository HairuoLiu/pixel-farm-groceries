# 04 · 前端架构评审 · 评委 4（前端架构师）

> 审查对象：`grocery-reminder-pixel`（index.html 138 行 / app.js 576 行 / analytics.js 49 行 / icons.js / ingredient-icons.js / data.js + data-100.js 共 104 道菜）
> 审查方式：全文走查 + `node --check` 全量语法检查 + Node 独立逻辑探针（`review-panel/_04_engineering_probe.js`，vm 沙箱加载真实数据文件复刻 `buildGuideZones/loadJSON/drawListImage` 关键逻辑）
> 结论先行：**语法全部通过**；实证确认 **2 个 P0、4 个 P1、4 个 P2**；同时**证伪 4 个常见怀疑点**（滚动丢失 / guideZones 过期 / 监听器泄漏 / bindItems 判断错误），**证实 1 个**（backToEdit 死代码）。前两个 P0 合计工作量约 1 小时，可消除全部「用户可感知且当前可复现」的故障。

---

## 一、问题清单

| # | 问题（函数/行号） | 影响评分(1-5) | 建议 | 优先级 | 工作量 | 验收标准 |
|---|---|:--:|---|:--:|:--:|---|
| 1 | **`saveCart/saveChecked` 无 try/catch**（app.js:83-84；调用点 toggleCart:243、bindItems:515）。Safari 隐私模式 / iOS 锁定模式 / 配额写满时 `localStorage.setItem` 抛 `QuotaExceededError`。代码顺序为 `cart.add → saveCart() → renderDishes()`，saveCart 抛错后 renderDishes 与计数更新**全部被跳过**：cart 内存已 +1，但卡片不标记、cartPill/floatCheckout 不出现、计数仍为 0，用户零反馈且异常沿 onclick 逃逸成未捕获错误。刷新后操作丢失。注：`loadJSON`（:82）有 try/catch，读写保护不对称 | 5 | `saveCart/saveChecked` 包 try/catch，失败置 `storageOK=false` 降级为纯内存态并给一次轻提示；与 loadJSON 复用同一开关 | **P0** | **S** | 在 `setItem` 恒抛错的注入条件下：① console 无未捕获异常；② 点击后卡片立即变「已在菜篮」、计数与悬浮按钮正确更新；③ 功能降级为不持久化但可用 |
| 2 | **`floatCheckout.onclick = goOverview` 把 MouseEvent 当 `from` 传入**（app.js:552 → goOverview 285-290）。点击时实参为 PointerEvent（truthy），`overviewFrom = from \|\| 'home'` 被塞成事件对象 → `ovBack.hidden = true`。后果：① 从**挑菜页**点「去市集采购」进总览后「返回导览」被隐藏，只能顶栏返回→**直接回首页，挑菜列表与改单路径断掉**（与 :546 注释「改单路径不断」的意图相反）；② 事件对象及其 target 子树被模块作用域长期持有。另：`backToEdit()`（:528-532）正是为此场景写的恢复逻辑，却**从未被绑定**（定义 1 处、调用 0 处、index.html 无引用 → 死代码，已证实） | 3 | `floatCheckout.onclick = function () { goOverview('select'); };`；`goOverview` 支持 `'select'` 分支（ovBack 显示并回挑菜页）；`backToEdit` 接上 ovBack 或删除，不留死代码 | **P0** | **S** | ① `overviewFrom` 只可能是 `'home'/'guide'/'select'` 字符串；② 挑菜页→去采购→总览→返回，回到挑菜页而非首页；③ `backToEdit` 有绑定或被删除 |
| 3 | **移除菜后 `checked` 脏数据残留 → 幽灵勾选**（toggleCart :240-250 不动 checked；buildGuideZones :253-270）。Node 探针实证：番茄炒蛋 6 项食材全勾 → 移除该菜 → `grocery-checked-v3` **6/6 键全部残留** → 重新加回同一道菜 → **6/6 全部显示为已勾**。用户视角：「我没勾过却全是勾」+ 进度虚高 | 4 | 移除时按差集清理：移除前 guideZones 键集 − 移除后键集，把只属于被删菜的 `zone\|name` 从 checked 删除；多菜共用食材只要仍被任一在篮菜需要就不清 | **P1** | **S** | ① 移除后 CHECK_KEY 不含与当前菜篮无关的键；② 加回同一道菜勾选为空；③ 共用食材在其他菜仍在篮时不被误清 |
| 4 | **导览↔总览勾选态不同步 + 闯关进度被重置**（ovBack.onclick :560 只 `showScreen('guide')` 不重渲染；goGuide :277 无条件 `guideIndex = 0`）。在总览勾选后返回导览，导览 DOM 仍是进入前的旧勾选态（stale DOM）；在「关卡 k/n」经菜篮图标往返一次后回到「关卡 1/n」 | 4 | ① ovBack 分支改 `showScreen('guide'); renderGuide();`；② `goGuide` 仅在首次进入或 cart 内容变化时归零 guideIndex；③ 勾选写回后同步另一侧 DOM，或统一「单一数据源 + 渲染函数」 | **P1** | **S** | ① 总览勾 N 项 → 返回导览，同区 item 勾选态一致；② 导览第 k 区 → 总览 → 返回导览，仍停在第 k 区；③ 两侧对同一 `zone\|name` 的显示永不分歧 |
| 5 | **清单图 canvas 无尺寸上限保护**（drawListImage :413-490，H 计算 :417-418）。探针实测全选 104 道菜：122 项去重食材 → CSS 高 4856 → canvas **1600×9712 = 15,539,200 px**，达 iOS Safari 16.7M 面积上限的 **92.6%**，位图内存 ≈59MB。面积上限约在 **115~120 道菜**时触发（单边 32767 上限反而需 ≈394 道菜，先撞到的是面积上限）。且 `getContext('2d')` 失败返回 null 时 `c.scale()` 直接抛错，无降级路径 | 3（现状）→4（数据增长后） | 加护栏：① 面积/单边上限钳制（如 `W*S*H*S > 16e6` 时降 S=1 或分页导出）；② `var c = cv.getContext('2d'); if (!c) { 提示并 return; }`；③ 超长清单分页为多张图 | **P1** | **M** | ① 任意菜篮规模下 getContext 为空时不抛错、有降级提示；② 全选 104 道仍能出图；③ 模拟 200 道菜走分页/降采样而非空白图；④ 移动端出图内存峰值可控 |
| 6 | **`loadJSON` 无类型校验 → `new Set()` 崩溃**（app.js:79-82）。探针实证：localStorage 被污染为 `{}` / `5` / `true` 时 `new Set()` 抛 "not iterable" → **IIFE 初始化中断、整页白屏**；`"abc"` / `[1,2]` 则静默变成字符集合/非字符串元素 → cart.size 虚高且 dishById 全部失配（菜篮计数与分区内容脱节）。旧版本残留、手改、其他脚本写入均可触发 | 3 | `loadJSON` 增加 `Array.isArray` 校验并过滤非字符串元素；同时清理已不存在的 dishId（数据版本迭代后 cart 里的死 id 只撑计数不产出分区） | **P1** | **S** | ① 把 `grocery-cart-v3` 手工改成 `{}`/`"abc"`/`5` 后页面仍正常启动（空菜篮）；② 非字符串元素与失效 dishId 被过滤；③ 污染值不会进入运行时状态 |
| 7 | **innerHTML 拼接无转义契约**（插值点：selectTitle :199、zone-mini :216、卡片 :220-228、zoneBadge :301、item :311-316/:341-344、done-card :358-367）。菜名/desc/note/搜索词全部裸拼 HTML；`data-key` 属性同样裸拼（:313/:341），食材名含双引号会截断属性。**实证：当前不可利用**——104 道菜含 `<>"'&` 的字段数为 0；3 组 XSS payload（`<img onerror>` / `番茄<script>` / `<svg onload>`）实测 matches=0，全部落入 noMatch 的 `textContent` 分支。属「靠数据干净而安全」，不是「靠代码而安全」 | 2（现状）→5（接远程/UGC 数据后） | 加 `esc(s)`（转义 `&<>"'`）并对全部插值点与属性点套用；模糊搜索、远程数据源上线前必须完成 | **P2** | **S** | ① 所有动态文本走 `esc()`；② 注入一条 name/note 含 `<script>`/`"` 的测试数据，渲染为纯文本且 data-key 属性完整；③ 搜索词路径同样安全 |
| 8 | **`completeList()` 后状态不自洽**（app.js:354-374）。通关后 ovProgress 清空、ovDone 禁用、ovBack 隐藏，但「生成清单图」按钮仍可见可点、cart 未清空、**未落盘任何状态**（localStorage 仅 cart/checked 两键）→ 刷新即回到未通关；且再次进入总览时 renderOverview :351 把 `ovDone.disabled` 静默复位为 false，通关态被抹掉 | 2 | 明确定义通关态：新增 `grocery-done-v3` 时间戳持久化，或 completeList 时清空 cart/checked 并提示「已归档」；通关卡出现时统一按钮显隐（ovImg 一并禁用） | **P2** | **S** | ① 通关态刷新后仍一致（持久化或明确清空）；② 通关卡出现时页面无语义冲突按钮；③ 重复进入总览不静默复位通关态 |
| 9 | **`toggleCart` 触发整表重渲染**（app.js:244 `renderDishes()` 重建 `#dishGrid` 全部子节点）。71 张卡片的搜索结果下，单次点击销毁并重建 71 卡片 / 142 个 SVG（既有 Chromium 实测 ≈6.0ms/次），**焦点从按钮掉回 BODY**（键盘/读屏用户丢失位置），外部持有的 DOM 引用全部失效。*滚动位置实测未丢失（scrollY 5000→5000，delta=0）——「丢滚动」怀疑证伪，真问题是焦点与全量重建* | 3 | 改局部更新：只改目标卡片的 class 与按钮文案（约 10 行）；或 `#dishGrid` 事件委托。至少保证 DOM 节点不被替换 | **P1** | **M** | ① 点击后 `document.activeElement` 仍为该按钮；② 同一卡片节点引用不变（`===`）；③ 单次点击仅 1 个卡片节点变更；④ 71 卡片下点击耗时 ≤2ms |
| 10 | **对象滞留 + 启动链路冗余**（closeShare :492 不清 src；index.html:132-134 双数据文件 + supabase CDN 同步加载）。关闭弹层后 1.31MB dataURL 仍驻留 `shareImg.src`（实测堆不回落）；`analytics.js` 的 SUPABASE_URL/KEY 为空 → supabase-js 纯浪费加载且**阻塞首屏渲染**（离线/弱网时）；`data.js`（8KB）在 `data-100.js` 存在时被完全覆盖，仍双加载。监听器方面实测**无泄漏**（全 app 仅 :535 一处 addEventListener，其余均为 onclick 幂等赋值，60 次重渲染后计数恒为 1） | 2 | ① `closeShare` 中 `$('shareImg').src = ''`，canvas 用后 `cv.width = cv.height = 0`；② 删除 supabase `<script>` 或改 `async`；③ `data.js` 改为动态回退加载 | **P2** | **S** | ① 关闭弹层后 `shareImg.src === ''`；② 连续生成/关闭 5 次堆内存不单调增长；③ 断网下首屏不被 CDN 脚本阻塞；④ 只加载一份菜品数据 |

---

## 二、实证数据附录

### A. 环境与方法
- `node --check`：app.js / analytics.js / icons.js / ingredient-icons.js / data.js / data-100.js **全部通过**（Node v22.22.2）。
- Node 探针 `review-panel/_04_engineering_probe.js`：vm 沙箱加载真实数据文件，复刻 `deriveType / buildGuideZones / loadJSON / canvas 尺寸公式`，逐项复现 bug。
- 数据规模：104 道菜、无重名、无缺失 id、**无空 items 的菜**、无未知分区；原始食材 739 项 → 跨菜去重后 122 项（去重率 83%，同名食材合并是核心逻辑，也是 #3/顺带发现的根因土壤）。

### B. 关键实测结果

| 用例 | 实测结果 |
|---|---|
| T1 checked 脏数据 | 番茄炒蛋 6 项全勾 → 移除 → localStorage **6/6 残留** → 加回 → **6/6 幽灵勾选** |
| T2 floatCheckout 传参 | 逻辑模拟：`goOverview(PointerEvent)` → `overviewFrom = {type:'click',…}`（object），`ovBack.hidden = true`；对照 `goOverview('guide')` → ovBack 正常显示 |
| T3 canvas 上限 | 全选 104 道 → 1600×9712 = **15,539,200 px** = iOS 16.7M 上限的 **92.6%**；触界需 ≈134 项食材 ≈ **115~120 道菜**；单边 32767 需 ≈462 项（≈394 道菜） |
| T4 loadJSON 脏值 | `{}`/`5`/`true` → **抛错（白屏）**；`"abc"` → Set(3) 字符集；`[1,2]` → 非字符串元素 → dishById 失配 |
| T5 注入可达性 | 3 组 payload matches=0 → 全部落入 `#noMatch`（textContent，安全）；数据含 `<>"'&` 字段数 **0** |
| T6 同名食材合并 | ≥2 菜共用的食材 73 组：**optional 冲突 10 组、note 冲突 12 组**（如「鸡蛋」备注 `裹糊`/`粘合`/`""`）→ 显示取决于 Set 加入顺序 |
| T7 死代码 | `backToEdit` 定义 1 处（:528）、调用 0 处、HTML 无绑定 → **证实死代码** |
| T8 guideZones 路径 | goGuide(:276)/goOverview(:287) 均重建；renderOverview/completeList/generateListImage 的 `guideZones.length ? … : 重建` 兜底均发生在 overview 屏（cart 不可变）→ **缓存不过期，怀疑证伪** |
| T9 数据健康 | 无重名 / 无空 items / 无未知 zone / 随机分类池非空（素菜 30、肉菜 47、汤羹 11、主食 16）→ 无「空池死路」 |

### C. 顺带发现（未列入表内，供参考）
1. **同名食材合并「先到先得」**（buildGuideZones :260）：`optional/note` 只在首次见到 `zone|name` 时写入，10 组 optional、12 组 note 冲突 → **同一份菜篮换个加入顺序，清单文案可能不同**。建议 `optional` 取「非可选优先」（任一菜必需即不标可选），`note` 合并去重。P2 / S。
2. **`showScreen` 强制 `window.scrollTo(0,0)`**（:121）：导览↔总览往返也重置滚动，与 #4 一并修更自然。
3. **埋点当前全空转**：analytics.js `CONFIG` 两键为空 → `client === null` → track() 直接 return；上线前需填配置，且 `uid()` 每次 track 读一次 localStorage，可缓存到内存；`insert()` 未做异步错误处理。P3。
4. **`.item` 勾选行是 div + onclick**（:313/:341）：无键盘焦点、无 role，读屏不可达——属 a11y 域（评委 7 范畴），架构上建议统一改 `button` 或加 `tabindex/role`。

---

## 三、已排除的怀疑（避免误判）

- **「toggleCart 后整表重渲染会丢滚动位置」→ 证伪**。窗口级滚动 scrollY 5000→5000（delta=0）：innerHTML 清空与重建发生在同一段同步 JS 内，浏览器无中间布局，文档总高不变。真问题是**焦点丢失 + 71 节点全量重建**（#9）。
- **「goOverview/goGuide 的 guideZones 缓存在菜篮变化后过期」→ 证伪**。cart 只能在 select 屏经 toggleCart 改变，而进入 guide/overview 的两条路径（goGuide :276、goOverview :287）都**无条件重建** guideZones；三处兜底调用（renderOverview/completeList/generateListImage）均发生在 overview 屏，此时 cart 不可变。真问题是 **guideIndex 被无条件重置 + ovBack 不重渲染**（#4）。
- **「bindItems 里 current.screen 判断错误」→ 证伪**。guide 屏点击跳过 ovProgress 更新（导览本无全局进度条）、overview 屏点击更新——分支正确，非 bug。
- **「事件监听泄漏」→ 证伪**。全 app 仅 searchForm 一处 addEventListener，其余均为 onclick 赋值（幂等，旧节点随 innerHTML 替换被 GC）。真正需要处理的只是 #10 的两处对象滞留。
- **「innerHTML 拼接注入」→ 现状不可利用**（数据 0 特殊字符、搜索 payload 全落 textContent），属模式性风险（P2 加固），非现存漏洞。
- **「canvas 32767 单边高度上限」→ 当前数据不触及**（全选 104 道仅 9712px，需 ≈394 道菜）；真正先撞上的是 **iOS 面积上限**（≈115 道菜），护栏应按面积设计（#5）。

---

## 四、修复顺序建议

1. **P0（约 1 小时，先做）**：#1 存储容错 → #2 floatCheckout 传参 + backToEdit 归位
2. **P1（半天内）**：#3 checked 清理 → #4 导览/总览同步 → #6 loadJSON 校验（以上均为 S）→ #5 canvas 护栏 / #9 局部渲染（M）
3. **P2（酌情）**：#7 esc → #10 释放引用与启动链路 → #8 通关态

架构总评：IIFE + 双 Set 状态机的选型对「无框架单页 + 104 道菜」的规模是恰当的，数据归一化、随机算法（Fisher-Yates）、图标引擎复用均无硬伤；问题集中在**边界条件（存储/脏数据/尺寸上限）与屏幕间状态同步**，而非核心算法。修完 2 个 P0 + 4 个 P1 后，这份代码的工程质量对参赛作品是溢出的。
