/* Wave F 数据工程修补：H11（同义菜/分区归并）+ H12a（tags 去冗余）
 * 用法：node assets/patch_data_f.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data-100.js');
const DRY = process.argv.includes('--dry');

const raw = fs.readFileSync(FILE, 'utf8');
const m = raw.match(/^window\.DISHES_100\s*=\s*([\s\S]*?);\s*$/);
if (!m) { console.error('无法解析 data-100.js'); process.exit(1); }
const obj = JSON.parse(m[1]);
const before = JSON.stringify(obj);
const log = [];

/* ---------- H11b：青椒炒肉 / 青椒肉丝 食材清单完全相同 ----------
 * 原两份清单逐条相同且都用泛化的「猪肉」。两道菜其实是两种切法与配料：
 * 炒肉用五花肉+蒜，肉丝用里脊肉+姜。其余配料（料酒等）原样保留。 */
const DIFF = {
  green_pepper_pork: [
    { zone: 'vegetable', name: '青椒' },
    { zone: 'meat', name: '五花肉' },
    { zone: 'seasoning', name: '蒜', optional: true, note: '底料配料' },
    { zone: 'seasoning', name: '生抽', optional: true, note: '调味' },
    { zone: 'seasoning', name: '料酒', optional: true, note: '去腥' },
    { zone: 'seasoning', name: '盐', optional: true, note: '调味' },
    { zone: 'seasoning', name: '食用油', optional: true, note: '炒菜用油' }
  ],
  green_pepper_pork_strip: [
    { zone: 'vegetable', name: '青椒' },
    { zone: 'meat', name: '里脊肉' },
    { zone: 'seasoning', name: '姜', optional: true, note: '底料配料' },
    { zone: 'seasoning', name: '生抽', optional: true, note: '调味' },
    { zone: 'seasoning', name: '料酒', optional: true, note: '去腥' },
    { zone: 'seasoning', name: '盐', optional: true, note: '调味' },
    { zone: 'seasoning', name: '食用油', optional: true, note: '炒菜用油' }
  ]
};
obj.dishes.forEach(d => {
  if (!DIFF[d.id]) return;
  d.items = DIFF[d.id];
  log.push('H11b ' + d.name + ' 清单差异化');
});

/* ---------- H11c：分区归并 ----------
 * 皮蛋/咸鸭蛋 是蛋制品 → 蛋奶区；冻豆腐 → 冷冻区；
 * 豆腐/豆皮/腐竹/香干 是豆制品，超市冷柜紧邻蔬菜 → 蔬菜区。 */
const REZONE = {
  '皮蛋': 'dairy', '咸鸭蛋': 'dairy',
  '冻豆腐': 'frozen',
  '豆腐': 'vegetable', '豆皮': 'vegetable', '腐竹': 'vegetable', '香干': 'vegetable'
};
let rezoneN = 0;
obj.dishes.forEach(d => (d.items || []).forEach(it => {
  if (REZONE[it.name] && it.zone !== REZONE[it.name]) { it.zone = REZONE[it.name]; rezoneN++; }
}));
log.push('H11c 分区归并 ' + rezoneN + ' 条（皮蛋/咸鸭蛋→蛋奶，冻豆腐→冷冻，豆制品→蔬菜）');

/* ---------- H12a：tags 去冗余 ----------
 * 与 type / cuisine 完全同名的 tag 是纯冗余——类型和菜系已经有专属 chip 展示。
 * 原 222 条 tag 里 73 条属于这类。 */
let tagN = 0;
obj.dishes.forEach(d => {
  if (!d.tags || !d.tags.length) return;
  const kept = d.tags.filter(t => t !== d.type && t !== d.cuisine);
  tagN += d.tags.length - kept.length;
  if (kept.length) d.tags = kept; else delete d.tags;
});
log.push('H12a 删除与 type/cuisine 同名的冗余 tag ' + tagN + ' 条');

const after = JSON.stringify(obj);
console.log(log.join('\n'));
if (before === after) { console.log('无变化'); process.exit(0); }
if (DRY) { console.log('--dry，不写回'); process.exit(0); }
fs.writeFileSync(FILE, 'window.DISHES_100 = ' + JSON.stringify(obj, null, 2) + ';\n', 'utf8');
console.log('已写回', FILE);
