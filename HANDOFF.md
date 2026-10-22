# HANDOFF — 项目交接说明（给下一位 Agent）

> 最后更新：2026-10-22 ｜ 交接人：Wave A-G 整改执行 Agent
> 一句话：**整改已全部完成、测试全绿、代码已提交；剩余工作只有「重新部署上线」和「大赛页提交」两件需要真人的事。**

## 1. 这个项目是什么

「像素农场 · 采购记」——把「今天吃什么 → 去超市买什么」做成一场 16-bit 农场冒险的采购小助手。
纯静态网页（HTML + CSS + 原生 JS，零框架零后端零构建），104 道菜 / 8 大超市分区 / 122 种食材 /
125 个手绘 12×12 像素图标（自研 ASCII 图标引擎），canvas 导出像素清单图，支持离线。

- 在线演示：https://pixel-farm-groceries.app.workbuddy.host/
- 离线单文件：`node assets/build_offline.js` 生成 `grocery-reminder-offline.html`（file:// 双击即用，零网络请求；构建产物，已 gitignore）
- 参赛：WorkBuddy「1024 造物挑战」应用创作大赛

## 2. 当前状态（全部 ✅）

| 项 | 状态 | 证据 |
|---|---|---|
| 10 人评审团整改（Wave A-G，51 条建议） | ✅ 全部完成 | `review-panel/00-consolidated.md` 执行记录表 |
| 自动化测试 | ✅ 71 项全绿 | `assets/qa_regress.py`(24) + `qa_regress_e.py`(20) + `qa_multitab.py`(15) + `test_synonym.js`(12)，均 0 pageerror / 0 console error |
| 数据工程 | ✅ | 青椒炒肉/肉丝差异化、20 条分区归并、ING_SYNONYM 同义归一、删 73 条冗余 tag |
| 参赛包装 | ✅ | README / LICENSE / CREDITS / ENGINEERING.md / DESIGN-pixel.md（含 8 张配图）/ showcase.html / OG 图 / favicon / manifest / SW |
| git 提交 | ✅ 4 个 commit | `fc27e45` → `756de63` → `708820b` → `9c465f2` |

## 3. 剩余工作（按优先级）

1. **【需要真人同意】重新部署**：线上版停留在较早版本，OG 图 / favicon / 分享 meta 要重新发布才生效。
   部署工具：`workbuddy_sites_deploy`（directory 指向本目录，language=static）。
2. **【需要真人操作】大赛提交**：大赛页是 WorkBuddy 站内 SPA，Agent 无法代填。
   提交文案已备好在 `showcase.html` 与本交接文档第 5 节。
3. **【可选】功能演进**：评审团 P3 以下未排期的想法（见各评审报告「建议清单」中未执行的行），
   例如更细的食材别名、更多菜系数据。注意：改动后必须重跑三套回归 + 重建离线版
   （`node assets/build_offline.js`）+ 重新部署（需真人同意）。

## 4. 给下一位 Agent 的工程须知

**运行与测试**
```bash
python -m http.server 8901          # 本地服务（回归脚本硬编码 8901）
node assets/validate_ing_icons.js   # 图标三重校验
node assets/test_synonym.js         # 同义合并 12 项断言
python assets/qa_regress.py         # 24 项行为回归
python assets/qa_regress_e.py       # 20 项（无障碍/空态/深链/弹层/SW）
python assets/qa_multitab.py        # 15 项多标签同步
node assets/build_offline.js        # 改 index.html 后必须重建离线版
```

**踩过的坑（改代码前必读）**
- `data-100.js` / `app.js` 是 **CRLF 行尾**：Node 正则提取代码段要兼容 `\r\n`。
- `PXIcon.svg()` 的 `scale` 参数是**输出像素值**（默认 24），不是倍数。
- 勾选键 = `zone|canonicalName`，导览 / 总览 / 导出 / `pruneChecked` 必须共用 `canonIng()`，
  任何一侧用原始食材名都会造成幽灵勾选。
- 新增同义食材只加进 `app.js` 的 `ING_SYNONYM`（白名单），**不要**按图标 key 自动合并
  （鱼丸/虾丸、火锅底料/冒菜底料是不同产品，`test_synonym.js` 有用例守着）。
- 内联 `data-key` 等属性也必须过 `esc()`（H1 契约）。
- Bash 工具里 `(cmd &)` 的后台进程会随会话回收；长跑服务用 `run_in_background=true`。
- 本机 git 无身份配置，提交时用 `git -c user.name="hairuoliu" -c user.email="hairuoliu@users.noreply.github.com"`。
- **GitHub 推送**：本机 git 凭据（`~/.workbuddy/git-creds/.git-credentials` 的 PAT）曾过期；
  MCP 连接器（身份 HairuoLiu）可读写已有仓库但**不能建库**（403）。可用路径：
  ① 用户提供新 PAT → `git config --global url.https://git:<PAT>@github.com/.insteadOf https://github.com/`
     （同时 unset credential.helper）→ 后台 push（`run_in_background` + 放行网络）→ **必须 `git ls-remote` 反查**；
  ② MCP `push_files` 只适合小仓库（本仓库 2.8MB 含 32 个 PNG，内联推送 token 成本不可行）。

**目录速览**：`index.html`（外壳）/ `styles.css`（设计系统）/ `app.js`（全部逻辑，约 1200 行）/
`icons.js` + `ingredient-icons.js`（图标引擎）/ `data-100.js`（主数据集）/ `analytics.js`（本地埋点）/
`sw.js` + `manifest.webmanifest`（PWA）/ `docs/shots/`（文档配图）/ `review-panel/`（评审报告）/
`assets/`（脚本与资产，`.gitignore` 已排除 65MB 退役照片管线）。

## 5. 大赛提交文案（可直接粘贴）

- **作品名**：像素农场 · 采购记
- **一句话简介**：把「今天吃什么」变成一场 16-bit 农场冒险——选几道菜，闯 8 个市集分区，导出一张能直接发给家人的像素清单图。零框架 · 零后端 · 离线可玩。
- **作品链接**：https://pixel-farm-groceries.app.workbuddy.host/
- **技术记忆点**（三选一主打）：
  1. 自研 12×12 ASCII 像素图标引擎：125 个图标零位图，屏幕端与 canvas 导出共用同一渲染源；
  2. 全流程纯前端零后端：6 个文件跑完 104 菜 × 739 条食材的分区聚合；
  3. 单文件离线构建：按字符集精选 26/78 个字体子集内联，1MB 零网络请求。
