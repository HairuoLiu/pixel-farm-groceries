# 像素农场 · 采购记 — ENGINEERING.md

> 面向工程师的技术深挖：这个 16-bit 农场风采购小助手是怎么做出来的、有哪些可复用的套路。
> 在线阅读：[部署版](https://pixel-farm-groceries.app.workbuddy.host/)｜离线单文件：`grocery-reminder-offline.html`（file:// 双击即用）

## 0. 三十秒概览

| 项 | 值 |
|---|---|
| 形态 | 纯静态站点（HTML + CSS +  vanilla JS），**零运行时依赖、零构建步骤、零后端** |
| 代码量 | 约 9.9k 行（app.js 1222 / styles.css 647 / data-100.js 5483 / ingredient-icons.js 1377 / icons.js 570 …） |
| 数据 | 104 道菜 · 8 个超市分区 · 122 种食材 · 739 条菜→食材关联（83 条必买 + 656 条可选） |
| 图标 | 125 个 12×12 像素图标（33 UI + 92 食材），ASCII 网格手绘 → 运行时生成 SVG |
| 外部请求 | 仅字体 CDN（78 个 woff2 子集按 unicode-range 按需加载）；离线版内联后 **0 请求** |
| 测试 | 3 套 Playwright 行为回归（24 + 20 + 15 项）+ 4 个 Node 数据/逻辑校验脚本 |
| 体积 | 线上版资源 ~275 KB（不含字体）；离线单文件 ~1.0 MB（含 26 个精选字体子集） |

## 1. 架构：一个 IIFE 撑起的五屏应用

没有框架、没有打包器、没有 virtual DOM。整个应用是一个 IIFE，内部按关注点分区：

```
app.js 结构
├── 数据归一化     deriveType / deriveCuisine / 复合调料名拆解（G16）
├── 像素图标映射   TYPE_ICON / ZONE_ICON / ING_ICON（食材名 → 图标 key）
├── 状态层         cart / checked（Set）+ localStorage 防脏值读写 + 多标签同步（I1）
├── 导航层         navStack 返回栈（截断语义）+ showScreen（aria-label 先入栈再计算）
├── 渲染层         buildHome / renderDishes / renderGuide / renderOverview（字符串模板 + esc()）
├── 聚合层         buildGuideZones（菜篮 → 分区，确定性合并规则 + ING_SYNONYM 同义归一）
├── 导出层         canvas 清单图（面积钳制 + 失败降级）+ 文字清单 + 深链分享
└── 横切           esc() 转义契约 / toast() / track() 埋点 / 字号档 / 弹层焦点管理
```

**为什么敢用字符串模板拼 innerHTML？** 因为有一条铁律：**所有插值点必须过 `esc()`**（含 `data-key` 属性值），QA 里有专项断言。数据全部来自本地 data-100.js（不可信输入只有 localStorage 与 URL hash，两者都有清洗）。

## 2. 像素图标引擎：ASCII 网格 → crispEdges SVG

图标不是图片文件，而是 12×12 的字符网格（`icons.js` / `ingredient-icons.js`）：

```js
'barn': [
  '.....kk.....',   // k = 墨色描边，w = 木，c = 奶油，g = 草绿…
  '....kwwwk....',
  ...
]
```

渲染时做三件事：

1. **横向合并相邻同色 rect**——一行里连续相同的字符合并成一个 `<rect>`，SVG 节点数下降一个量级（12 行最多 144 rect，典型图标合并后 20-40 个）。
2. **`shape-rendering: crispEdges`**——零抗锯齿，任意整数倍缩放都是硬边像素。
3. **scale 白名单 {12,24,36,48}**——12 的整数倍，非栅格缩放会让像素发虚（B3 整改）。

Node 直跑 `node icons.js` 可以 ASCII 预览全部图标并校验行宽，新增图标先过校验再进仓库。食材图标（`ING_ICON`）覆盖全部 122 种食材名，未命中退化为分区图标——保证永不出现「破图」。

## 3. 数据层：104 道菜是怎么「归一」的

`data-100.js` 是唯一数据源（117KB JSON）。启动时 `app.js` 做三层归一：

1. **type/cuisine 推导**：缺字段的菜按规则推导。主食判定踩过坑——原来 `/饭|面|粥|粉|饼|包|饺/` 任意位置命中，把「粉蒸肉」「蒜蓉粉丝蒸虾」「手撕包菜」全错标成主食；改成**尾字锚定** `/(饭|面|粥|粉|饼|饺|凉皮|米线|意面|披萨|粽子|馒头|包子|炒粉|炒面)$/` 后精准命中（C2）。
2. **复合调料名拆解**：老数据把「葱、姜、蒜」写成一个食材名，导致没有专属图标、购物时只能整组打勾。按顿号/逗号拆成独立条目（G16）。
3. **同义食材归一**（`ING_SYNONYM`）：土豆片→土豆、鲜虾/虾仁→虾、大葱→葱、五花肉片→五花肉、蒜薹→蒜苗、火锅面→方便面、卷心菜→包菜、黑胡椒→胡椒粉。超市里这是同一件货，购物车里两道菜各写各的会裂成两行、勾选互相看不见。**只合并真同义**——鱼丸/虾丸、火锅底料/冒菜底料是不同产品，不能按图标 key 粗暴合并（`assets/test_synonym.js` 12 项断言守着这条线）。

## 4. 状态层：脏值防御与多标签同步

**localStorage 是不可信输入。** 读：必须是数组且元素为字符串，脏值（对象/数字/布尔）一律回退默认，失效 dish id 启动时清洗（否则会出现「空白总览 + 虚假通关」）。写：隐私模式/配额满时 `setItem` 会抛异常，降级为内存态 + 一次性 Toast，绝不让 UI 静默死亡（A1）。

**多标签互相覆盖**（I1）是个隐蔽的坑：两个标签各开一份页面，A 标签加菜只写了 localStorage，B 标签内存里的 Set 不会变；之后 B 任何一次保存都会用旧值整体覆盖 A 的菜篮。解法是监听 `storage` 事件（同标签写入不触发，天然无回声环），把变化同步进内存（**原地 clear+add，不重新赋值**——Set 被大量闭包引用）并重渲染当前屏，120ms 防抖合并批量写入。

## 5. 导航层：返回栈的「截断语义」

五屏（home / select / guide / overview / shareModal）用手维护一个 `navStack`。关键设计是入栈时的**截断语义**：目标屏已在栈中则截断到该层，否则入栈。没有这条规则时，guide→overview→guide→overview 会让栈里堆满重复层，返回键一路跑错屏（A7 踩过）。返回键的 `aria-label` 描述「再按一次会去哪」，必须先入栈再计算 label（差一错误曾让它显示「返回首页」而非「返回挑菜」，A4）。

## 6. 聚合层：菜篮 → 购物清单的确定性规则

`buildGuideZones()` 把菜篮里的菜拆成食材、按超市分区聚合。同名食材合并规则经过一次整改（H2）：

- **optional**：任一道菜标「必买」就必买（保守，避免漏买）——原来是「先到先得」，换一批菜顺序文案就变；
- **note**：所有备注去重后 `；` 合并，信息不丢；
- **from**：保持加入顺序，清单行显示「用于：红烧肉、土豆炖牛肉」。

勾选键是 `zone|canonicalName`（规范名），导览、总览、导出、`pruneChecked` 幽灵清理**共用同一个 `canonIng()`**——任何一侧用原始名都会造成「勾了却被自动取消」。

## 7. 导出层：canvas 清单图与三道降级

分享的像素清单图是 canvas 现场画的（分区色条 + 像素勾选框 + 分区图标）。三条防线：

1. **面积钳制** `CANVAS_MAX_PX = 16_700_000`——超过就降 1x 导出。iOS Safari 的 canvas 面积上限约 16.7M px，超了 `toDataURL` 直接抛或返回空（G14/G17）；
2. **`toDataURL` try/catch + 长度校验**，失败 Toast 提示改走「复制文字清单」；
3. **弹层资产管理**：关闭时清 `img.src`、canvas 缩到 1×1，释放 dataURL 占用的内存（H10）。

导出按钮点击后立即进入「生成中」态，防止连点。

## 8. 离线与性能

- **Service Worker**（sw.js）：本地资源 cache-first、字体 CDN network-first、导航失败回退外壳。`file://` 协议自动跳过注册。
- **单文件离线版**（`assets/build_offline.js`）：把全部资源内联成一个 HTML。字体策略是**按 unicode-range 精选子集**——先统计应用实际渲染的 1085 个码位（数据 + UI 文案超集），78 个 CDN 子集里只内联覆盖到的 26 个（558KB），体积从「全量数 MB」压到 1.0MB，file:// 双击即用、零网络请求（Playwright 断言 `http 请求 = 0`）。
- **字体度量对齐**（I2）：webfont 是 `font-display: swap`，首屏先用回退字体绘制。实测（canvas TextMetrics）webfont 行框 133% em、系统回退 132% em，字体到达瞬间行框重算产生 CLS。用 `@font-face` 的 `ascent-override: 108% / descent-override: 25% / line-gap-override: 0%` 把回退字体对齐到 webfont 度量，不支持的旧内核整条丢弃、行为退回今天，零风险。
- **删掉的东西也是性能**：原版接了 Supabase SDK（218KB CDN 白下载）只为了存一份本地就够用的购物车——移除后埋点改成本地环形队列（`gp_events` 200 条上限 + `gp_history` 战绩聚合），控制台可直接导出（Wave D）。

## 9. 质量保障：回归测试矩阵

| 套件 | 覆盖 | 项数 |
|---|---|---|
| `assets/qa_regress.py` | 脏 localStorage / 返回栈 / 卡片唯一入口 + 撤销 / 导览进度 / 幽灵勾选 / 满篮导出 | 24 |
| `assets/qa_regress_e.py` | 键盘可操作 / 空态出口 / 随机约束（≥1 荤 1 素）/ 深链还原 / 弹层无障碍 / SW + manifest | 20 |
| `assets/qa_multitab.py` | 双标签增删勾双向同步 / select 卡片态 / 总览刷新 | 15 |
| `assets/test_synonym.js` | 同义合并 / 不误并 / 勾选键一致 / 全量图标覆盖 | 12 |
| `assets/validate_ing_icons.js` | 122 食材图标映射无缺无孤儿 | — |

判据不只是「能跑」：每套都断言 **0 pageerror / 0 console error / 0 failed request**。所有脚本在 `python -m http.server 8901` 起本地服务后运行。

## 10. 可复用的套路清单

1. **ASCII 像素图标引擎**——12×12 网格 + 横向合并 rect + crispEdges，比维护 PNG 雪碧图轻一个数量级，还能 Node 预览校验。
2. **截断语义返回栈**——手写导航栈时，入栈先查重在截断，否则多屏互跳必然堆重复层。
3. **localStorage 不可信**——读必校验类型、写必 try/catch、脏值启动清洗。
4. **同名合并用确定性规则**——「先到先得」在数据顺序变化时会产生隐性 bug。
5. **同义归一要显式白名单**——按图标/分类 key 自动合并会把不同产品混成一团。
6. **canvas 导出三道降级**——面积钳制 + 异常捕获 + 失败出口，移动端 Safari 必踩。
7. **度量对齐消 CLS**——`ascent/descent/line-gap-override` 让回退字体穿上 webfont 的「鞋子」。
8. **离线版按字符集精选字体子集**——全量内联 vs 零内联之间还有第三条路。
