# 评委 9 · 数据分析与增长 评审

**项目**：像素农场 · 采购记（grocery-reminder-pixel）
**审查范围**：`analytics.js`（全文 49 行）、`app.js` 全部 `track(...)` 调用点（9 处 / 10 个事件名）、`index.html`、`DESIGN-pixel.md`
**结论一句话**：埋点代码写得"像那么回事"，但实际上**一条数据都发不出去**；同时漏斗在最关键的一步（打勾）断掉，且没有任何能给作者拿来证明作品价值的证据产物。

---

## 一、数据流核查：埋点到底能不能把数据送出去？

逐行追踪 `window.Analytics.track()` 的真实执行路径：

| 环节 | 位置 | 实际结果 |
| --- | --- | --- |
| 1. 配置注入 | `analytics.js:10-13` | `SUPABASE_URL: ''`、`SUPABASE_ANON_KEY: ''` —— **均为空字符串** |
| 2. 客户端初始化 | `analytics.js:17-23` → `:18` | `if (!CONFIG.SUPABASE_URL ...) return;` → **提前返回**，`client` 保持 `null` |
| 3. SDK 加载 | `index.html:134` | 引入了 `@supabase/supabase-js@2` CDN，但 `client` 已为 null，SDK 完全闲置 |
| 4. 事件发送 | `analytics.js:35-45` → `:36` | `if (!client) return;` → **每一个事件在此被丢弃** |
| 5. 匿名 ID | `analytics.js:26-33` | `uid()` 会写 `localStorage['gp_uid']`，但它只在 `track()` 内部被调用，`track()` 从未走到那一步 → 实际**从未执行**，是死代码 |

**结论：当前仓库状态下，9 个埋点调用点、10 个事件名的上报成功率为 0%。**

这不是"降级可用"，而是**纯摆设**：`open_app / search / random / add_to_cart / remove_from_cart / start_guide / view_overview / complete_list / generate_image` 全部落空。评审时无论评委怎么点，后台一张表都查不到。

补充：即便作者填了 Supabase 配置，`analytics.js:38` 的 `client.from('events').insert({...})` 也是**无 `await`、无 `.then()` 的 fire-and-forget**，用户在 `generate_image` 后立刻关页面（这是分享场景的典型动作）会直接丢事件；且无队列、无重试、无 `sendBeacon` 兜底。

---

## 二、现有埋点清单（逐点核对）

| 事件名 | 位置 | 携带属性 | 可用性评价 |
| --- | --- | --- | --- |
| `open_app` | `app.js:572` | 无 | 无法区分首访/回访，无来源、无屏幕、无会话标识 → **留存算不出来** |
| `search` | `app.js:161` | `q`, `results` | 有关键词与结果数，尚可；但**无结果时直接 `return`（`app.js:155-158`）不埋点** → 搜索失败率 100% 盲区 |
| `random` | `app.js:179` / `app.js:184` | `dim`, `value`, `n` | 缺 `pool` 总量；「换一批」（`app.js:537-542` 复用 `randomBy`）与首次随机**无法区分**，reroll 次数（粘性信号）测不到 |
| `add_to_cart` / `remove_from_cart` | `app.js:249` | `dish`（仅 id） | 无菜名、无 type/cuisine、无分区、无来源（search/random）、无操作后菜篮规模 → **无法回答"哪条路径加购率更高"** |
| `start_guide` | `app.js:280` | `dishes`, `zones` | 可用；但无分区构成、无菜篮明细 |
| `view_overview` | `app.js:292` | `dishes`, `mode: 'overview'` | `mode` 是**硬编码常量**，零信息量；未传 `from`（guide/home），尽管 `overviewFrom` 就在 `app.js:284/289` 现成可用 |
| `complete_list` | `app.js:373` | `dishes`, `items` | 缺勾选完成率（用户是真勾完还是直接点通关）、缺耗时 → **"完成"质量不可信** |
| `generate_image` | `app.js:489` | `dishes`, `items` | 尚可；但**下游分享动作完全无埋点** |

### 完全缺失的关键事件（漏斗断口）

| 缺失事件 | 应该在的位置 | 为什么致命 |
| --- | --- | --- |
| `check_item` / `uncheck_item` | `app.js:510-526` `bindItems()` 的 onclick | **最严重**。打勾是这个 App 的核心动作，`bindItems` 里连一次 `track` 都没有 → 采购完成率、分区难度、用户是否真在用，全部不可测 |
| `select_abandon`（进 L2 什么都没做就退） | `app.js:543-545` `backBtn.onclick` | 无法回答"用户走到哪一步流失"，L2→L3 转化率的分母缺失 |
| `guide_step`（上一区/下一区） | `app.js:557-558` | 分区闯关是逐页的，卡在第几区退出不知道 |
| `search_zero_result` | `app.js:155-158` 无结果分支 | 搜索失败率盲区，也丢了"用户想要但库里没有的菜"这一最强的**内容增长信号** |
| `share_save` / `share_native` / `share_cancel` | `app.js:493` `saveShareImage`、`app.js:499` `nativeShareImage` | 分享是本项目唯一的增长钩子，却完全无观测 → 分享转化率不可计算 |
| 会话/时长类 | 无 `visibilitychange` / `beforeunload` | 无停留时长、无会话结束，任何"使用深度"指标都算不出来 |

---

## 三、建议清单

| # | 问题（具体文件/行号/事件名） | 影响评分(1-5) | 建议 | 优先级 | 工作量 | 验收标准 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `analytics.js:10-13` 配置为空 → `:18` 提前 return → `:36` `if(!client) return`，全站 10 个事件 **0% 送达**；且 `:38` insert 无 await、无队列重试 | 5 | 改为**本地留存优先**：`track()` 无条件写入 `localStorage['gp_events']` 环形队列（上限 500 条，含 `name/payload/ts/session_id`），不再依赖 `client`；保留 Supabase 分支作为可选上报（配置非空时才发，且改用 `navigator.sendBeacon` 兜底）。暴露 `Analytics.query(filter)` 与 `Analytics.exportJSON()`。同时补 `session_id`（`sessionStorage`）与 `is_returning`（`gp_uid` 是否已存在） | **P0** | S | 断网 / 空配置下点击任意功能，`localStorage.gp_events` 均新增记录；`Analytics.ready()` 恒为 true；`Analytics.exportJSON()` 可导出全部事件 |
| 2 | `app.js:510-526` `bindItems()` 无 `check_item` 事件，核心采购行为零埋点 | 5 | 在 toggle 分支补 `track(on ? 'check_item' : 'uncheck_item', { zone, item, optional, done, total, screen })`（`done/total` 现场从 DOM 或 `checked` 集合计算） | **P0** | S | 每次勾选/取消各产生一条事件，payload 含 `done/total`；能算出单次采购的**勾选完成率**与**各分区平均勾选率** |
| 3 | 无历史落库：`complete_list`（`app.js:373`）只发事件不写记录，作者拿不出"演示期间共生成 N 份清单" | 5 | 新增 `localStorage['gp_history']`，每次 `complete_list` 追加 `{ts, dishes, items, zones, checked_ratio, shared}`；并做**「本周采购战绩」面板**（入口放首页顶部）：累计清单数 / 本周清单数 / 累计食材数 / 最常买分区 Top3 / 连续使用天数 / 最爱的菜 | **P0** | M | 完成 3 次采购后面板显示 3 份、累计食材数正确；刷新与关页后数据不丢；面板数字与 `gp_history` 完全一致（这一条同时就是埋点价值的实体证明） |
| 4 | 全流程放弃/返回无埋点：`app.js:543-545` `backBtn`、`app.js:557-558` `prevZone/nextZone`、`app.js:560` `ovBack`；`open_app`（`app.js:572`）无属性 | 4 | 在 `showScreen()`（`app.js:112`）做统一出口埋点，自动带 `from→to` 与 `dwell_ms`；补 `select_abandon`（离开 select 时 `cart` 增量为 0）、`guide_step({zone, index, total, direction})`、`overview_back`；`open_app` 补 `{is_returning, cart_size, ref, screen}` | **P0** | M | 能画出 `open_app → L2 → L3 → L3b → 通关` 五步漏斗，并给出**每一步的退出人数与平均停留时长** |
| 5 | `analytics.js:26-33` `uid()` 死代码 + `index.html:134` 无条件加载 Supabase CDN SDK（配置为空时纯浪费，且构成不必要的第三方请求/隐私面） | 4 | 去掉 `index.html:134` 的静态 `<script>`；改为仅当 `CONFIG.SUPABASE_URL` 非空时 `document.createElement('script')` 动态注入，注入完成后再 `init()`。让 `uid()` 真正随本地队列生效 | **P1** | S | Network 面板无 `cdn.jsdelivr.net/@supabase` 请求；首屏请求数与体积下降；断网启动无控制台报错 |
| 6 | `app.js:155-158` 搜索无结果分支直接 `return`，未埋 `search_zero_result` | 4 | 在该分支补 `track('search_zero_result', { q })`；战绩面板或导出里给出「最常搜但没结果的词 Top10」 | **P1** | S | 搜索一个不存在的词产生该事件；导出文件可列出缺失词 Top10（直接指导补菜谱数据） |
| 7 | `app.js:249` `add_to_cart/remove_from_cart` 仅带 `dish` id，无来源、无分类、无菜篮规模 | 4 | 补全属性：`{ dish_id, dish_name, type, cuisine, zones, source: current.mode, dim, value, cart_size, pos }` | **P1** | S | 能回答"随机 vs 搜索哪条路径加购率更高"、"哪个菜系/菜类最受欢迎"、"平均菜篮规模" |
| 8 | 分享动作零埋点：`app.js:493` `saveShareImage`、`app.js:499` `nativeShareImage`（含 `canShare` 失败的 fallback 分支）、`app.js:563-566` 按钮 | 4 | 补 `share_modal_open` / `share_save` / `share_native({ok, fallback})` / `share_cancel` | **P1** | S | 可计算 分享转化率 = (保存+分享) / 生成图；可统计 `canShare` 不可用导致的降级占比 |
| 9 | 分享图无回流钩子：`app.js:486` 页脚仅文案「由 像素农场采购记 生成 · 去任意超市都能用」，无 URL / 二维码 / 深链 | 4 | (a) 页脚改为「`域名` · 扫码复刻我的清单」，并在图上绘制二维码（编码当前菜篮的短链）；(b) 支持 URL 携带清单 `#c=<base64(dish ids)>`，启动时解析并还原菜篮（配合 `track('deep_link_open')`） | **P1** | M | 手机保存图后扫码/访问链接可回到 App 且菜篮已还原；`deep_link_open` 事件可被记录 |
| 10 | 全项目无隐私声明；若启用上报，会把用户**自由输入的搜索词** `q`（`app.js:161`）与匿名 uid 上传第三方；同时"无 Cookie"这一卖点未被声明 | 3 | 首页底部与清单图页脚各加一行：「数据只存在你自己的浏览器里 · 无 Cookie · 不上传任何个人信息」；README 增设「数据去向」章节，列明埋点字段清单与开关；若启用云端上报，搜索词做哈希/截断，并提供显式 opt-out | **P1** | S | UI 中可见该声明；README 有「数据去向 / 埋点字段」章节；开启上报时能出示 opt-out 开关截图 |

---

## 四、产品侧增长钩子（补充观察，不计入上表）

1. **回流几乎为零**：`cart` 存在 `localStorage['grocery-cart-v3']`（`app.js:34/83`），但启动时（`app.js:568-572`）从不读取提示。建议 `open_app` 时若检测到非空且超过 N 小时的菜篮，弹一句「上次还有 3 道菜没买完，继续？」——这是成本最低、最自然的次日留存钩子。
2. **"再来一单"缺失**：战绩面板应提供「按上周清单再来一单」按钮，把历史记录直接变成复购路径（配合第 3 条）。
3. **换一批无计数**：`rerollBtn`（`app.js:537-542`）复用 `randomBy`，无法区分首摇与 reroll。建议在事件里加 `is_reroll` 与 `reroll_index`，这是衡量"盲盒粘性"的核心指标，也是一个很适合写进作品介绍的细节。
4. **摇号结果可沉淀**：`random` 事件若能记录"展示但未被加入菜篮的菜"，就能做"最不受欢迎的菜"下架分析，同样是可讲的证据。

## 五、评分

| 维度 | 得分 | 说明 |
| --- | --- | --- |
| 埋点真实可用性 | 2 / 10 | 代码结构完整、注释清楚，但配置为空导致 0% 送达，当前状态等于没做 |
| 事件模型完整度 | 4 / 10 | 主流程覆盖到了，但缺 `check_item`、缺放弃/返回、缺分享动作，画不出可信漏斗 |
| 隐私与透明度 | 3 / 10 | 事实上没有 Cookie、数据也不出本机（这点很好），但全项目没有任何声明，且无条件加载第三方 SDK 制造了不必要的隐私面 |
| 作品说服力证据 | 1 / 10 | 完全无法产出"演示期间共生成 N 份清单"这类数字 |
| 增长钩子 | 3 / 10 | 分享图做得很用心（像素风 PNG 质感好），但没有 URL/二维码/深链，也无历史复用、无回流路径 |

**综合：2.6 / 10**

优先修 **#1 → #2 → #3 → #4**（4 条 P0）。其中 #1 是"有没有数据"的问题，#2/#4 是"数据能不能回答问题"的问题，#3 是"数据能不能变成作品说服力"的问题——做完这 4 条，本维度可回升到 7 分以上，且#3 的「本周采购战绩」面板本身就是评委眼前看得见的加分项。
