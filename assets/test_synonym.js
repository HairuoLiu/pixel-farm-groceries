/* H11d 同义合并实测：从 app.js 原文提取 ING_SYNONYM / canonIng / buildGuideZones
 * 在 Node 中执行，验证：
 *   1. 同义写法合并为单行（土豆片→土豆、鲜虾/虾仁→虾、卷心菜→包菜、黑胡椒→胡椒粉）
 *   2. 行名一律为规范名，且 ING_ICON 有图标
 *   3. pruneChecked 的 keep-set（raw name + canonIng）与导览行键完全一致（无幽灵勾选）
 * 用法：node assets/test_synonym.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = {};
require(path.join(ROOT, 'icons.js'));
require(path.join(ROOT, 'ingredient-icons.js'));
const ING_ICON = global.window.PXIcon.ING_ICON;
const obj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-100.js'), 'utf8')
  .match(/^window\.DISHES_100\s*=\s*([\s\S]*?);\s*$/)[1]);
global.window.DISHES_100 = obj;

const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const seg = src.match(/ {2}var ING_SYNONYM = \{[\s\S]*?\r?\n {2}\}\r?\n\r?\n {2}\/\* ---------- L3 市集导览/);
if (!seg) { console.error('✗ 未能从 app.js 提取 ING_SYNONYM/buildGuideZones 段'); process.exit(1); }
const factory = new Function('cart', 'dishById', 'ZONES',
  seg[0].replace(/\r?\n {2}\/\* ---------- L3 市集导览$/, '') + '\n  return { ING_SYNONYM: ING_SYNONYM, canonIng: canonIng, buildGuideZones: buildGuideZones };');
const DISHES = obj.dishes;
const dishById = (id) => DISHES.find((d) => d.id === id);
const api = factory(new Set(), dishById, obj.zones);

let fail = 0;
function check(cond, msg) { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; }

/* ---- 用例 1：土豆家族（火锅 土豆片 / 酸辣土豆丝 土豆）---- */
console.log('用例1 土豆片+土豆 → 单行「土豆」');
api.buildGuideZones.call ? null : null;
const run = (ids) => {
  const cart = new Set(ids);
  return factory(cart, dishById, obj.zones).buildGuideZones();
};
let gz = run(['hotpot', 'spicy_potato']);
let veg = gz.find((z) => z.zone.id === 'vegetable');
let names = veg.items.map((i) => i.name);
check(names.indexOf('土豆') > -1 && names.indexOf('土豆片') === -1, '土豆片已并入土豆（行名集合：' + names.join('、') + '）');
const potatoRow = veg.items.find((i) => i.name === '土豆');
check(potatoRow.from.length === 2, 'from 记录 2 道来源菜：' + potatoRow.from.join('、'));

/* ---- 用例 2：虾家族（火锅 鲜虾 / 虾仁炒蛋 虾仁 / 白灼虾 虾）---- */
console.log('用例2 鲜虾+虾仁+虾 → 单行「虾」');
gz = run(['hotpot', 'shrimp_egg', 'boiled_shrimp']);
let sea = gz.find((z) => z.zone.id === 'seafood');
names = sea.items.map((i) => i.name);
check(names.indexOf('虾') > -1 && names.indexOf('鲜虾') === -1 && names.indexOf('虾仁') === -1,
  '鲜虾/虾仁已并入虾（行名集合：' + names.join('、') + '）');
const shrimpRow = sea.items.find((i) => i.name === '虾');
check(shrimpRow.from.length === 3, 'from 记录 3 道来源菜：' + shrimpRow.from.join('、'));

/* ---- 用例 3：卷心菜 / 包菜 ---- */
console.log('用例3 卷心菜+包菜 → 单行「包菜」');
gz = run(['bacon_cabbage', 'hand_torn_cabbage']);
veg = gz.find((z) => z.zone.id === 'vegetable');
names = veg.items.map((i) => i.name);
check(names.indexOf('包菜') > -1 && names.indexOf('卷心菜') === -1, '卷心菜已并入包菜（' + names.join('、') + '）');

/* ---- 用例 4：黑胡椒 / 胡椒粉 ---- */
console.log('用例4 黑胡椒+胡椒粉 → 单行「胡椒粉」');
gz = run(['black_pepper_beef', 'hot_sour_soup']);
let sea2 = gz.find((z) => z.zone.id === 'seasoning');
names = sea2.items.map((i) => i.name);
check(names.indexOf('胡椒粉') > -1 && names.indexOf('黑胡椒') === -1, '黑胡椒已并入胡椒粉（' + names.join('、') + '）');

/* ---- 用例 5：不同产品不得误并（鱼丸/虾丸、火锅底料/冒菜底料）---- */
console.log('用例5 不同产品保持独立');
gz = run(['hotpot', 'malatang', 'maocai']);
let sfz = gz.find((z) => z.zone.id === 'seafood');
names = sfz.items.map((i) => i.name);
check(names.indexOf('鱼丸') > -1 && names.indexOf('虾丸') > -1, '鱼丸/虾丸 未被误并（' + names.join('、') + '）');
let sz5 = gz.find((z) => z.zone.id === 'seasoning');
names = sz5.items.map((i) => i.name);
check(names.indexOf('火锅底料') > -1 && names.indexOf('冒菜底料') > -1, '火锅底料/冒菜底料 未被误并（' + names.filter((n) => /底料/.test(n)).join('、') + '）');

/* ---- 用例 6：勾选键一致性（导览行键 vs pruneChecked keep-set）---- */
console.log('用例6 勾选键一致性（防止幽灵勾选）');
gz = run(['hotpot', 'spicy_potato', 'shrimp_egg', 'bacon_cabbage', 'hand_torn_cabbage', 'black_pepper_beef', 'hot_sour_soup']);
const rowKeys = {};
gz.forEach((z) => z.items.forEach((i) => { rowKeys[z.zone.id + '|' + i.name] = 1; }));
const keep = {};
['hotpot', 'spicy_potato', 'shrimp_egg', 'bacon_cabbage', 'hand_torn_cabbage', 'black_pepper_beef', 'hot_sour_soup']
  .forEach((id) => dishById(id).items.forEach((it) => { keep[it.zone + '|' + api.canonIng(it.name)] = 1; }));
const rowKeyList = Object.keys(rowKeys), keepList = Object.keys(keep);
const missing = rowKeyList.filter((k) => !keep[k]);
const extra = keepList.filter((k) => !rowKeys[k]);
check(missing.length === 0 && extra.length === 0,
  '两侧键集合一致' + (missing.length ? '（导览有keep无：' + missing.join('、') + '）' : '') + (extra.length ? '（keep有导览无：' + extra.join('、') + '）' : ''));

/* ---- 用例 7：全量菜篮下所有规范行名都有图标 ---- */
console.log('用例7 全量规范名图标覆盖');
gz = run(DISHES.map((d) => d.id));
const allNames = [];
gz.forEach((z) => z.items.forEach((i) => allNames.push(i.name)));
const noIcon = allNames.filter((n) => !ING_ICON[n]);
check(noIcon.length === 0, '104 道菜全选时 ' + allNames.length + ' 个规范行名全部有图标' + (noIcon.length ? '，缺失：' + noIcon.join('、') : ''));
const variants = allNames.filter((n) => api.ING_SYNONYM[n]);
check(variants.length === 0, '导览行名中不存在任何同义变体（' + (variants.join('、') || '无') + '）');

console.log(fail === 0 ? '\n全部通过' : '\n' + fail + ' 项失败');
process.exit(fail ? 1 : 0);
