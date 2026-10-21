/* I3：单文件离线参赛版构建器
 * 把 grocery-reminder-pixel 的全部资源（HTML/CSS/JS/数据/图标引擎/字体子集）
 * 内联成 grocery-reminder-offline.html —— file:// 双击即用，零网络请求。
 *
 * 字体策略：Fusion Pixel CDN 有 78 个 unicode-range 子集，全量 base64 内联会到数 MB。
 * 先统计应用实际渲染的字符集（数据 + UI 文案 + 源码字符串，取超集），
 * 只内联覆盖到这些字符的子集（保留 local() 优先，本机装有字体时零开销）。
 *
 * 用法：node assets/build_offline.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'grocery-reminder-offline.html');
const FONT_CSS_URL = 'https://cdn.jsdelivr.net/npm/@vp-tw/cjk-web-fonts-fusion-pixel-font@0.0.1/dist/12px/proportional/zh_hans/Fusion-Pixel-12px-Proportional-Simplified-Chinese.css';
const FONT_BASE = 'https://cdn.jsdelivr.net/npm/@vp-tw/cjk-web-fonts-fusion-pixel-font@0.0.1/dist/12px/proportional/zh_hans/';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 1. 渲染字符集（超集，宁多勿漏） ---------- */
let allText = '';
['index.html', 'app.js', 'styles.css', 'analytics.js', 'ingredient-icons.js', 'data-100.js', 'data.js'].forEach((f) => {
  try { allText += read(f); } catch (e) { /* 文件可缺失 */ }
});
const used = new Set();
for (const ch of allText) {
  const cp = ch.codePointAt(0);
  if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0xf900 && cp <= 0xfaff)
    || (cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xff00 && cp <= 0xffef) || (cp >= 0x2010 && cp <= 0x2027)
    || (cp >= 0x20 && cp <= 0x7e) || [0xb7, 0x2190, 0x2192, 0x2713, 0x2717, 0x25cf, 0x25b2, 0x25bc, 0x2605, 0x2606].includes(cp)) {
    used.add(cp);
  }
}
console.log('渲染字符集：' + used.size + ' 个码位');

/* ---------- 2. 解析 CDN 字体 CSS，按 unicode-range 精选子集 ---------- */
function parseRanges(s) {
  // "U+20-7E, U+A1-AC, U+AE-FF" -> [[0x20,0x7e],...]
  return s.split(',').map((r) => r.trim().replace(/^U\+/i, '')).map((r) => {
    const m = /^([0-9a-f]+)(?:-([0-9a-f]+))?$/i.exec(r);
    if (!m) return null;
    return [parseInt(m[1], 16), m[2] ? parseInt(m[2], 16) : parseInt(m[1], 16)];
  }).filter(Boolean);
}
function coversAny(ranges) {
  for (const cp of used) {
    for (const [lo, hi] of ranges) if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

(async () => {
  const cssRes = await fetch(FONT_CSS_URL);
  if (!cssRes.ok) throw new Error('字体 CSS 拉取失败：' + cssRes.status);
  const fontCss = await cssRes.text();
  const blocks = [];
  const re = /@font-face\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(fontCss))) {
    const body = m[1];
    const url = /url\(([^)]+)\)/.exec(body);
    const ur = /unicode-range:\s*([^;]+);/.exec(body);
    if (!url || !ur) continue;
    const ranges = parseRanges(ur[1]);
    if (!coversAny(ranges)) continue;
    blocks.push({ url: url[1], ranges: ur[1].trim(), body });
  }
  console.log('需内联子集：' + blocks.length + ' / 78');

  /* ---------- 3. 下载 + base64 ---------- */
  let fontBytes = 0;
  const outBlocks = [];
  for (const b of blocks) {
    const r = await fetch(FONT_BASE + b.url);
    if (!r.ok) throw new Error('字体文件下载失败：' + b.url + ' ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    fontBytes += buf.length;
    const dataUri = 'data:font/woff2;base64,' + buf.toString('base64');
    // 保留 local() 优先 + data: 兜底；unicode-range 原样保留
    const newBody = b.body.replace(/url\([^)]+\)/, 'url(' + dataUri + ')');
    outBlocks.push('@font-face {' + newBody + '}');
  }
  console.log('字体子集合计：' + (fontBytes / 1024).toFixed(0) + ' KB（base64 后约 ' + (fontBytes * 4 / 3 / 1024).toFixed(0) + ' KB）');

  /* ---------- 4. 组装单文件 ---------- */
  let html = read('index.html');
  const origLen = html.length;

  // 4a. 移除两个 CDN 字体 <link>（preload + media=print 懒加载）、preconnect 与 manifest
  html = html.replace(/\s*<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net"[^>]*>/g, '');
  html = html.replace(/\s*<link rel="preload" as="style" href="https:\/\/cdn\.jsdelivr\.net[^>]*>/g, '');
  html = html.replace(/\s*<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net[^>]*>/g, '');
  html = html.replace(/\s*<link rel="manifest"[^>]*>/g, '');

  // 4b. 内联样式表：把 <link rel="stylesheet" href="styles.css"> 换成 <style>
  html = html.replace(/<link rel="stylesheet" href="styles\.css"\s*\/?>/, () => {
    return '<style>\n' + read('styles.css') + '\n</style>';
  });

  // 4c. 内联字体 @font-face（插在第一个 <style> 里，保证优先注册）
  html = html.replace(/<style>/, () => '<style>\n/* ==== 内联字体子集（构建器精选，file:// 零请求）==== */\n' + outBlocks.join('\n') + '\n');

  // 4d. 内联全部脚本（顺序保持：icons → ingredient-icons → data → data-100 → analytics → app）
  const scripts = ['icons.js', 'ingredient-icons.js', 'data.js', 'data-100.js', 'analytics.js', 'app.js'];
  scripts.forEach((f) => {
    const tag = new RegExp('<script src="' + f.replace('.', '\\.') + '"><\\/script>');
    if (!tag.test(html)) throw new Error('未找到脚本标签：' + f);
    html = html.replace(tag, () => '<script>\n' + read(f) + '\n</script>');
  });

  // 4e. file:// 下移除 SW 注册提示注释块由 app.js 的 protocol 守卫处理，无需改动
  fs.writeFileSync(OUT, html, 'utf8');
  const size = fs.statSync(OUT).size;
  console.log('已生成 ' + path.relative(ROOT, OUT) + '：' + (size / 1024).toFixed(0) + ' KB（原 HTML ' + (origLen / 1024).toFixed(0) + ' KB）');
  console.log('残留外链引用：' + (html.match(/https?:\/\/[^"'\s)]+/g) || []).length + ' 处');
})().catch((e) => { console.error('构建失败：', e.message); process.exit(1); });
