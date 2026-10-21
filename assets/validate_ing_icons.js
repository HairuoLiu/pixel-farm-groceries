/* 校验：ingredient-icons.js 行宽 + 122 种食材全覆盖 + 图标 key 存在性 */
global.window = {};
require('../icons.js');
require('../ingredient-icons.js');
require('../data.js');
require('../data-100.js');
const P = window.PXIcon;
let bad = 0;

// 1) 行宽/行数校验（含新增食材图标）
Object.keys(P.ICONS).forEach(n => {
  const g = P.ICONS[n];
  if (g.length !== 12) { bad++; console.log('[行数错误]', n, g.length); }
  g.forEach((row, i) => { if (row.length !== 12) { bad++; console.log('[行宽错误]', n, '第' + i + '行 len=' + row.length, JSON.stringify(row)); } });
});

// 2) 数据食材全覆盖
const d = window.DISHES_100 || window.DISHES;
const names = new Set();
d.dishes.forEach(dish => (dish.items || []).forEach(it => names.add(it.name)));
const map = P.ING_ICON || {};
const missing = [...names].filter(n => !map[n]);
const stale = Object.keys(map).filter(n => !names.has(n));
const badKey = Object.keys(map).filter(n => !P.ICONS[map[n]]);

console.log('图标总数:', Object.keys(P.ICONS).length, '（含食材', Object.keys(map).length, '种映射）');
console.log('数据集食材数:', names.size);
console.log('未映射食材:', missing.length ? missing : '无');
console.log('映射中数据里不存在的名称:', stale.length ? stale : '无');
console.log('映射到不存在图标的 key:', badKey.length ? badKey : '无');
if (bad || missing.length || stale.length || badKey.length) { console.log('FAIL'); process.exit(1); }
console.log('\n✓ 全部通过');
