# 像素农场 · 采购记

> 选几道想吃的菜 → 自动按超市分区生成采购清单 → 导出像素风清单图。
> 一个 16-bit 农场游戏外壳里的「今晚吃什么」决策工具。

**在线演示**：<https://pixel-farm-groceries.app.workbuddy.host/?sharecode=7TXN4ZUHNR>
**离线单文件版**：双击 `grocery-reminder-offline.html` 即可运行（无需服务器、无需网络）

---

## 一句话定位

把「今晚吃什么」这个日常决策，包装成一台掌机里的农场任务：**搜菜 / 摇菜 → 挑菜进菜篮 → 按 8 大超市分区闯关采购 → 导出可分享的像素清单图**。

## 为什么做这个

每天都要面对三个连环问题：吃什么、买什么、买了多少。现有工具要么是菜谱 App（重、慢、要登录），
要么是手写清单（没有分区，到了超市反复折返）。这个应用只做一件事：
**把「想吃的菜」直接翻译成「按货架顺序排好的采购清单」**，并且让这个过程有游戏感。

## 三个核心亮点

| # | 亮点 | 说明 |
|---|---|---|
| 1 | **自研 12×12 像素图标引擎** | 不依赖任何图片资源：ASCII 网格 → 合并 rect 的 crispEdges SVG。125 个图标全部手绘，含 **92 个食材专属图标**（蔬菜 31 / 肉禽 14 / 水产 4 / 调料 25 / 粮油 6 / 冷冻 1 / 其他 11） |
| 2 | **成品菜与食材的视觉分层** | 菜品卡是**纯文字**（菜名/简介/类型/菜系/分区签），食材行是 **30px 带框像素小图块**——三层界面（挑菜 / 导览 / 总览）与导出的 PNG 清单图完全一致，绝不会看混 |
| 3 | **超市分区闯关** | 104 道菜自动聚合成 8 大分区（蔬菜/肉禽/水产/调料/冷冻/粮油/蛋奶/其他），逐区打勾、实时进度、震动反馈；同区同名食材自动合并，跨菜共用食材标注「用于 N 道菜」 |

## 界面流程

```
L1 首页          搜索 / 按菜类摇 4 道 / 按菜系摇 4 道 / 掷骰子随便来四个
      ↓
L2 挑菜          纯文字菜品卡 → 加入菜篮（可撤销）
      ↓
L3 市集导览      逐区闯关：本区进度「已勾 x/y」+ 打勾震动 + 逐级返回
      ↓
L3b 全部清单     一屏看全部分区 → 生成像素风 PNG 清单图（可保存 / 分享）
```

## 技术要点

- **零依赖、零构建**：纯 HTML + CSS + 原生 JS，`file://` 双击即可运行（也可以直接丢到任意静态托管）
- **自研图标引擎** `icons.js`：12×12 ASCII 网格 → 横向合并 rect 的 SVG（`shape-rendering: crispEdges`），
  Node 下可直接跑校验（行宽 / 覆盖 / 失效 key）
- **12px 像素栅格**：全站字号只用 12 / 24 两档，图标 scale 只用 {12, 24, 36, 48}——
  非整数倍缩放会让点阵字体发虚，这是像素风界面最容易被忽视的细节
- **数据驱动**：104 道菜 / 122 种唯一食材 / 8 个分区，全部结构化在 `data-100.js`
- **本地优先**：菜篮与勾选态存 `localStorage`（脏值校验 + 失效 id 清洗 + 写失败降级提示）；
  埋点走本地环形队列（`gp_events` / `gp_history`），不依赖任何后端
- **无障碍**：`.item` 为 `<button role="checkbox">` 可键盘操作、`aria-checked` 同步、
  返回键 `aria-label` 动态、Toast 为 `role="status" aria-live`
- **画布导出**：`imageSmoothingEnabled = false` + `document.fonts.load` 竞速 2s，
  保证 PNG 里的像素图标和文字都是硬的

## 运行方式

```bash
# 方式一：直接双击 index.html（无需任何工具）

# 方式二：起个本地服务（推荐，字体 CDN 行为更稳定）
python -m http.server 8901
# 打开 http://127.0.0.1:8901/index.html
```

## 目录结构

```
grocery-reminder-pixel/
├── index.html              # 单页应用外壳（五屏：home/select/guide/overview/shareModal）
├── styles.css              # 16-bit 农场设计系统（硬描边 / 偏移硬阴影 / 缺角面板 / 木纹顶栏）
├── app.js                  # 全部交互逻辑（约 1200 行，原生 JS，无框架）
├── icons.js                # 自研像素图标引擎 + 33 个界面图标
├── ingredient-icons.js     # 92 个食材像素图标 + 122 种食材映射表
├── data-100.js             # 104 道菜 / 122 种食材 / 8 个分区（主数据集）
├── data.js                 # 22 道菜的回退数据集
├── analytics.js            # 本地环形队列埋点（gp_events / gp_history）
├── sw.js                   # Service Worker（cache-first 本地资源 / 离线可用）
├── manifest.webmanifest    # PWA 清单（可添加到主屏）
├── grocery-reminder-offline.html  # 单文件离线版（file:// 双击即用，零网络请求，1.0MB）
├── showcase.html           # 参赛作品说明页（配图 + 亮点 + 技术一览）
├── assets/
│   ├── ing_icon_sheet.html/.png   # 92 个食材图标总拼图（目检用）
│   ├── validate_ing_icons.js      # 图标三重校验（行宽/覆盖/失效 key）
│   ├── test_synonym.js            # 同义合并 12 项断言（含勾选键一致性）
│   ├── build_offline.js           # 单文件离线版构建器（按字符集精选字体子集）
│   ├── qa_regress.py              # 24 项行为回归（稳定性/视觉/数据）
│   ├── qa_regress_e.py            # 20 项回归（无障碍/空态/深链/弹层/SW）
│   ├── qa_multitab.py             # 15 项多标签购物篮同步回归
│   ├── qa_cls.py / measure_font_metrics.py  # 字体 CLS 度量实测
│   ├── shots_docs.py              # 文档配图截图采集
│   └── patch_data*.js             # 数据修补脚本（自选菜 optional / type / 同义归一）
├── docs/shots/             # 文档配图（DESIGN-pixel.md 与 showcase.html 引用）
├── review-panel/           # 10 人评审团报告 + 合并整改总表
├── DESIGN-pixel.md          # 设计文档（组件规范 / 图标系统 / 配图实录）
├── ENGINEERING.md           # 技术深挖（架构 / 图标引擎 / 状态层 / 离线策略）
├── showcase.html            # 参赛说明页
└── LICENSE                  # MIT
```

## 性能与体积

| 项 | 数值 |
|---|---|
| 本地资源合计 | **274 KB**（未压缩，无框架无依赖；首屏关键路径更小） |
| 单文件离线版 | **1.0 MB**（含 26 个精选字体子集 base64，`file://` 零请求） |
| 已移除的浪费 | supabase-js CDN **218 KB**（原占传输量 42%，从未被调用） |
| 字体 | 中文像素字体按 `unicode-range` 分子集懒加载；CSS 已改非阻塞；回退字体度量对齐消 CLS |
| 首屏 | 无渲染阻塞的外链脚本；`file://` 可直接运行 |

## 兼容性

- 现代桌面/移动浏览器（Chrome / Safari / Firefox / Edge 近两年版本）
- 已处理：`color-mix()` 旧内核回退（分区底色改 JS 预混实色）、iOS 输入框聚焦缩放（表单控件 16px）、
  隐私模式 localStorage 写失败降级
- 触控目标 ≥ 44px；支持双指缩放（未锁 `maximum-scale`）

## 致谢

- 字体：[Fusion Pixel 12px Proportional Simplified Chinese](https://github.com/TakWolf/fusion-pixel-font)（缝合像素字体，SIL OFL）
- 灵感：星露谷语言 / 16-bit 农场游戏的界面节奏

## License & Credits

- **代码**：MIT（见 [LICENSE](LICENSE)）
- **字体**：Fusion Pixel 12px Proportional SC（SIL OFL 1.1，CDN 子集懒加载）
- **像素图标**：125 个全部为本项目原创手绘 ASCII 网格，无第三方素材
- 完整声明见 [CREDITS.md](CREDITS.md)
