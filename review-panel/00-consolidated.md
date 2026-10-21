# 10 人评审团 · 合并整改总表

> 项目：grocery-reminder-pixel「像素农场 · 采购记」｜目标：WorkBuddy「1024 造物挑战」参赛投稿
> 评审团：产品 / UX / 视觉 / 工程 / 数据 / 性能 / 移动无障碍 / QA / 埋点增长 / 参赛包装（10 位，共提出 ~100 条）
> 合并规则：跨评委重复项已合并；按「参赛影响力 × 工作量」排序；P0=不修无法参赛，P1=明显加分，P2=增强，P3=锦上添花
> 工作量：S<30min｜M<2h｜L>2h

## 一、总览

| 优先级 | 条数 | 说明 |
|---|---|---|
| **P0** | 18 | 稳定性/正确性硬伤 + 参赛包装硬门槛 + 像素锐利度，全部为 S~M |
| **P1** | 17 | 体验增强与参赛加分项（首屏说服力、战绩面板、分享回流、离线） |
| **P2** | 12 | 打磨与一致性 |
| **P3** | 4 | 有余力再做 |

## 二、P0 整改清单（按执行顺序）

| ID | 问题 | 修复方案 | 位置 | 工作量 | 来源评委 |
|---|---|---|---|---|---|
| A1 | localStorage 脏值（对象/数字/布尔/字符串）导致启动白屏；无效 dish id 导致空白总览+虚假通关 | loadJSON 加 `Array.isArray` + 字符串过滤；启动时清洗失效 id | app.js:79 | S | 04#1/04#6, 08#1, 08#9 |
| A2 | saveCart/saveChecked 无 try/catch，隐私模式/配额满时 UI 静默死亡 | 包 try/catch，失败降内存态 + 一次性 Toast 提示 | app.js:83 | S | 04#1, 08#3 |
| A3 | `floatCheckout.onclick = goOverview` 把 MouseEvent 当 from 传入 → 返回路径断；backToEdit() 死代码 | 传 `'select'` 字符串；backToEdit 接到 ovBack | app.js:552 | S | 04#2, 02#2 |
| A4 | 返回键任何屏都强制回首页，闯关位置/挑菜列表丢失 | navStack 逐级返回（select→guide→overview）+ 动态 aria-label | app.js | M | 02#1 |
| A5 | 卡片整块可点易误触；toggleCart 整表重渲染丢焦点 | 只保留 .add-btn 入口 + Toast「撤销」+ 局部更新单卡 | app.js/styles.css | M | 02#3, 04#9 |
| A6 | 导览页无本区进度、打勾零反馈 | 头部「本区 已勾 x/y」+ 勾选 vibrate + 本区完成提示 | app.js | S | 02#4 |
| A7 | 移除菜品后 checked 残留"幽灵勾选" | 按差集清理仅属于被移除菜的 key | app.js:244 | S | 02#8, 04#3, 08#2 |
| A8 | 总览勾选后返回导览 DOM 陈旧；guideIndex 被无条件重置 | ovBack 重渲染；guideIndex 仅菜篮变化时重置 | app.js | S | 04#4 |
| B1 | `egg` 图标单色与纸底同色，蛋奶区"消失" | 重绘：k 描边 + c 内影 + n 高光 | icons.js:174 | S | 03#1 |
| B2 | 字号 14/16/20 非 12 倍数，像素字全站发虚 | 收敛到 12/24 两档（hero 24，其余 12） | styles.css | M | 03#3 |
| B3 | 图标 scale 20 处仅 1 处是 24，栅格宽窄不均 | scale 白名单 {12,24,36,48} | app.js | S | 03#4 |
| C1 | 61 条 item 漏写 optional（hotpot/malatang/malaxiangguo/maocai）→ 火锅一次塞 18 项必买 | 4 道自选菜显式补 optional | data-100.js | S | 05#1 |
| C2 | deriveType 正则误伤：手撕包菜/蒜蓉粉丝蒸虾/蒜蓉粉丝蒸娃娃菜/粉蒸肉被标"主食" | 显式修正 type；正则改尾字匹配 | data-100.js/app.js | S | 05#2 |
| D1 | supabase-js CDN 白下载 218KB（占传输量 42%），配置为空从未调用 | 删除 script 引用 | index.html:134 | S | 06#1, 09#5, 10#6 |
| D2 | 字体 CSS 70.9KB 阻塞渲染且无 preconnect | preconnect + 非阻塞加载 | index.html:8 | S | 06#2 |
| E1 | .item 是 div，键盘/读屏完全无法勾选（核心流程不可用） | 改 `<button role="checkbox" aria-checked>` | app.js | S | 07#1, 02#10 |
| E2 | 食材选择行打勾无确认反馈、「完成采购」无门槛且通关态不可恢复 | ovDone 门槛（0 勾禁用）+ 通关后提供「清空菜篮·新一单」 | app.js | M | 02#5 |
| F1 | **README.md 完全缺失**（评委 10 秒内看不懂作品） | 根目录 README：一句话定位+截图+演示链接+5 亮点+技术要点+运行方式 | 根目录 | S | 10#1 |
| F2 | **无在线演示链接、非 git 仓库** | git init + 发布为应用拿公网链接，写回 README/OG | 部署 | S | 10#2 |

## 三、P1 增强清单

| ID | 问题 | 修复方案 | 工作量 | 来源评委 |
|---|---|---|---|---|
| G1 | 首屏价值主张没讲清、无数据、无内容 | hero-sub 改「选菜→生成 8 大分区清单」+ 104/122/125 数据 chip + 三步引导（可关闭） | S | 01#5, 10#4, 02#7 |
| G2 | 首屏 37% 空白、零农场视觉记忆点 | CSS 像素农场场景带（地块+作物+栅栏+闪烁 sparkle） | M | 03#5 |
| G3 | 埋点 0% 送达（Supabase 配置为空）+ 核心打勾无事件 + 无历史 | 改本地环形队列（gp_events）+ check_item 事件 + gp_history 落库 | M | 09#1/09#2/09#3 |
| G4 | 零留存钩子 | 首页「本周采购战绩」面板（累计清单/食材数/连续天数/最爱菜 Top） | M | 09#3, 01#9 |
| G5 | 分享只有 PNG，缺复制文字清单；PNG 无来源、无回流 | 加「复制文字清单」+ PNG 页脚来源 + 深链 `#m=dish ids` 还原菜篮 | M | 01#7, 09#9 |
| G6 | 搜索空输入零反馈、空格无响应、noMatch 陈旧残留 | 空输入抖动+提示；noMatch 加真按钮；showScreen 清理 | S | 02#6, 08#7 |
| G7 | 色彩层级倒置：4 个黄块压过唯一主 CTA | 菜类块改纸底+分区色条，黄色收窄到骰子 | S | 03#6 |
| G8 | 桌面端 61% 空旷、"掌机"未收口 | 桌面端固定高度机身 + 四边墨框 + 实心侧影 | M | 03#7 |
| G9 | 触控目标 <44px（add-btn 38/cartPill 38/icon-btn 40） | 盒模型放大到 ≥44px | S | 07#4 |
| G10 | 分享弹层滚动穿透、无 role、Esc 不关 | 锁背景滚动 + role=dialog + Esc + 焦点陷阱 | S | 07#3 |
| G11 | 微信内保存/分享双双失效 | 「长按保存」提示 + 微信环境置灰分享按钮 | S | 07#7 |
| G12 | color-mix() 无回退，旧内核分区底色消失 | 每条 color-mix 前补实色回退 | S | 07#6 |
| G13 | 无离线可用性（无 SW/manifest） | sw.js 预缓存 + manifest + theme-color | M | 06#3, 06#6 |
| G14 | 满篮 canvas 15.5M px 逼近 iOS 上限、无 loading | 生成中态 + 面积钳制/分页降级 + getContext 判空 | M | 06#4, 04#5, 08#6 |
| G15 | 随机四道可能全荤/全素、与上批重复；无单菜替换 | 组合约束（≥1 荤 1 素、排除上批）+ noMatch 出口 | M | 01#8 |
| G16 | zones[].icon 残留 8 个 emoji 死字段；「意餐」死配置；data.js 回退路径 22 种食材无图标 | 删 emoji 字段；删意餐配置；data.js 保留但图标补齐或标注 | S | 05#10, 03#1 |
| G17 | 导出清单图失败零反馈/破图 | toDataURL try/catch + 长度校验 + 失败 Toast + generating 态 | S | 08#4 |

## 四、P2 打磨清单

| ID | 问题 | 修复方案 | 工作量 | 来源评委 |
|---|---|---|---|---|
| H1 | innerHTML 拼接无转义契约（现状不可利用但接远程数据即险） | 加 esc() 全覆盖插值点与属性点 | S | 04#7 |
| H2 | 同名食材合并"先到先得"（10 组 optional/12 组 note 冲突，换顺序文案变） | optional 取非可选优先、note 合并去重 | S | 04 附录 |
| H3 | 12px 关键信息无字号档；maximum-scale=1 禁缩放 | A-/A+ 档位 + 删 maximum-scale + 搜索框 16px | M | 07#2, 07#5 |
| H4 | 对比度不达标（eyebrow 2.14、CTA 3.63、brand 2.25） | 加深 tomato/eyebrow、add-btn 已选态换深底 | S | 07#8, 03#6 |
| H5 | 全站 0 条 :hover，桌面端死板 | hover:hover 下 5 类元素即时反馈（无柔滑 transition） | S | 03#8 |
| H6 | 半透明模糊影/单侧影/间距不成 4 栅格/悬浮按钮 2px 错位 | 实心影统一 + 4px 栅格 + 对齐 | S | 03#9 |
| H7 | 分享清单图在弹层被压成 0.45×，12px 文字变 5px | max-height 适配 + 点击全屏查看 + 关闭改图标钮 | M | 03#10 |
| H8 | 状态变化对读屏静默（cartCount/进度/noMatch/cuisineToggle） | aria-live + aria-expanded + dot aria-hidden | S | 07#9 |
| H9 | aria 焦点环被 .input:focus 覆盖；横屏空间紧张 | focus-visible 修复 + 横屏紧凑媒体查询 | S | 07#10 |
| H10 | 弹层关闭后 1.31MB dataURL 滞留；数据双文件加载 | closeShare 清 src + canvas 归零 + data.js 按需回退 | S | 04#10 |
| H11 | 数据：34 道真实主料仅 1 样；青椒炒肉/青椒肉丝 items 完全相同；豆制品 16 条全落 other；同义食材 16 组未合并 | 补配菜/删重/分区归并/ing_id 规范化（数据工程） | L | 05#3/05#4/05#5/05#6 |
| H12 | 100% 缺 servings/time/用量；desc 套路化 51.9%；tags 63.5% 冗余 | 结构化字段 + desc 模板 + tags 治理 | L | 05#7/05#8/05#9 |

## 五、P3 清单

| ID | 问题 | 修复方案 | 来源评委 |
|---|---|---|---|
| I1 | 多标签页并发购物篮互相覆盖 | storage 事件监听或 read-modify-write | 08#8 |
| I2 | CLS：字体 swap 无度量对齐 | size-adjust/ascent-override | 06#7 |
| I3 | 单文件离线参赛版（file:// 双击即用） | 构建 inline 全部资源 + base64 字体子集 | 06#10, 10#6 |
| I4 | DESIGN-pixel.md 零配图、缺 ENGINEERING.md、showcase.html、LICENSE、目录 65MB 清理 | 文档配图 + 技术深挖文 + 作品说明页 + 许可证 + .gitignore | 10#3/10#7/10#9/10#10 |

---

## 六、执行记录

| 波次 | 内容 | 状态 |
|---|---|---|
| Wave A | P0 稳定性 A1-A8（app.js 修正） | ⏳ |
| Wave B | P0 视觉 B1-B3（egg/字号/scale） | ⏳ |
| Wave C | P0 数据 C1-C2（data-100.js） | ⏳ |
| Wave D | P0 发布 D1-D2 + F1-F2（去 supabase/字体/README/部署） | ⏳ |
| Wave E | P0-P1 体验 E1-E2 + G1-G17 | ⏳ |
| Wave F | P2 打磨 H1-H12 | ⏳ |
| Wave G | P3 I1-I4 | ⏳ |
