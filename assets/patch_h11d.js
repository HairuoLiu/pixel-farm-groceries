/* Wave F H11d：大葱归区 —— 为 ING_SYNONYM 同义合并做准备
 * 数据集中「葱」45 次全部在 seasoning 区，「大葱」1 次孤悬 vegetable 区。
 * 两者是同一食材（同义合并见 app.js buildGuideZones 的 ING_SYNONYM），
 * 先把孤例归位，保证合并后行落在唯一确定的分区。
 * 用法：node assets/patch_h11d.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data-100.js');
const DRY = process.argv.includes('--dry');

const raw = fs.readFileSync(FILE, 'utf8');
const m = raw.match(/^window\.DISHES_100\s*=\s*([\s\S]*?);\s*$/);
if (!m) { console.error('无法解析 data-100.js'); process.exit(1); }
const obj = JSON.parse(m[1]);

let n = 0;
obj.dishes.forEach(d => (d.items || []).forEach(it => {
  if (it.name === '大葱' && it.zone !== 'seasoning') { it.zone = 'seasoning'; n++; }
}));
console.log('H11d 大葱归区 seasoning：' + n + ' 条');
if (!n) { console.log('无变化'); process.exit(0); }
if (DRY) { console.log('--dry，不写回'); process.exit(0); }
fs.writeFileSync(FILE, 'window.DISHES_100 = ' + JSON.stringify(obj, null, 2) + ';\n', 'utf8');
console.log('已写回', FILE);
