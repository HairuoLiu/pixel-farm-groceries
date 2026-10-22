# 致谢与授权声明（CREDITS）

## 代码

本项目全部源代码采用 [MIT License](../LICENSE) 授权，© 2026 刘海若 (hairuoliu)。
包含自研的 12×12 像素图标引擎（`icons.js` / `ingredient-icons.js`）、应用逻辑（`app.js`）、
设计系统（`styles.css` / `DESIGN-pixel.md`）与 104 道菜的数据集（`data-100.js`，人工整理）。

## 字体

[Fusion Pixel 12px Proportional Simplified Chinese](https://github.com/TakWolf/fusion-pixel-font)
（缝合像素字体 · 简体中文字形集），通过 `@vp-tw/cjk-web-fonts-fusion-pixel-font` CDN 按
unicode-range 子集懒加载。

- 授权：**SIL Open Font License 1.1**（OFL）
- 使用方式：网页字体（woff2），未对字体文件本身做任何修改
- 离线单文件版（`grocery-reminder-offline.html`）内联了该字体的 26 个 woff2 子集副本，
  同样遵循 OFL 授权；字体不可用时自动回退系统字体，功能不受影响

## 像素图标

应用内的 **125 个 12×12 像素图标（33 个界面图标 + 92 个食材图标）全部为本项目原创手绘**，
以 ASCII 字符网格形式存于源码，运行时生成 SVG——**不使用任何第三方图标素材**。

## 图片

当前版本（v3 起）的界面与导出的清单图**不加载任何照片**：菜品预览为纯文字卡片，
食材展示为原创像素图标，分享图为 canvas 现场绘制。

历史版本曾使用一批经像素化再创作的菜品参考图（源自 Wikimedia Commons，遵循 CC BY-SA /
CC0 等许可，逐图声明见 `assets/CREDITS.md`）。该图片管线已退役，相关文件不再被应用加载，
保留仅为可复现性与授权追溯。

## 数据

104 道菜 / 8 个超市分区 / 122 种食材 / 739 条「菜 → 食材」关联，为人工整理编写的结构化数据，
无外部数据源依赖；菜名与分区划分为常见中餐做法的通识归纳。
