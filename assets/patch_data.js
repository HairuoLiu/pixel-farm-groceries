/* Wave C 数据修补脚本：C1 自选菜 optional + C2 type 修正
 * 用法：node assets/patch_data.js [--dry]
 * 说明：data-100.js 本身是 JSON.stringify(obj, null, 2) 的产物，
 *       这里做「解析 → 修补 → 原样序列化写回」，除修补点外不产生格式漂移。
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data-100.js');
const DRY = process.argv.includes('--dry');

const raw = fs.readFileSync(FILE, 'utf8');
const m = raw.match(/^window\.DISHES_100\s*=\s*([\s\S]*?);\s*$/);
if (!m) { console.error('无法解析 data-100.js 结构'); process.exit(1); }
const obj = JSON.parse(m[1]);
const before = JSON.stringify(obj);

/* ---------- C1：自选菜（火锅/麻辣烫/冒菜/麻辣香锅）补 optional ----------
 * 规则：底料与调味料（seasoning）为必买；荤料/海鲜/蔬菜/豆制品/主食一律自选。
 * 修复前火锅一次塞 18 项必买，修复后仅 6 项必买。 */
const SELF_SELECT = ['hotpot', 'malatang', 'maocai', 'malaxiangguo'];
const KEEP_REQUIRED_ZONES = { seasoning: true };
let c1Fixed = 0, c1Touched = [];
obj.dishes.forEach(d => {
  if (SELF_SELECT.indexOf(d.id) === -1) return;
  let n = 0;
  (d.items || []).forEach(it => {
    if (KEEP_REQUIRED_ZONES[it.zone]) return;      // 底料/调料保持必买
    if (it.optional === true) return;              // 已是可选
    it.optional = true;
    n++;
  });
  if (n) { c1Fixed += n; c1Touched.push(d.name + ' +' + n); }
});

/* ---------- C2：deriveType 正则误伤的 4 道菜显式修正 type ----------
 * 「粉蒸肉 / 蒜蓉粉丝蒸虾 / 蒜蓉粉丝蒸娃娃菜」被 /粉/ 命中，「手撕包菜」被 /包/ 命中，
 * 全被错标成「主食」。这里直接写死正确类型。 */
const TYPE_FIX = {
  fen_zheng_rou: '肉菜',                 // 粉蒸肉：米粉蒸肉
  garlic_shrimp_vermicelli: '肉菜',      // 蒜蓉粉丝蒸虾：主料是虾
  garlic_baby_cabbage: '素菜',           // 蒜蓉粉丝蒸娃娃菜：蒸蔬菜
  hand_torn_cabbage: '素菜'              // 手撕包菜：炒蔬菜
};
let c2Fixed = [];
obj.dishes.forEach(d => {
  const want = TYPE_FIX[d.id];
  if (!want) return;
  if (d.type !== want) { c2Fixed.push(d.name + ': ' + d.type + ' → ' + want); d.type = want; }
});

const after = JSON.stringify(obj);
console.log('C1 自选菜 optional 补齐：', c1Fixed, '项 →', c1Touched.join(' / ') || '（无需修改）');
console.log('C2 type 修正：', c2Fixed.join('；') || '（无需修改）');

if (before === after) { console.log('无变化，跳过写入'); process.exit(0); }
if (DRY) { console.log('--dry 模式，不写回'); process.exit(0); }

fs.writeFileSync(FILE, 'window.DISHES_100 = ' + JSON.stringify(obj, null, 2) + ';\n', 'utf8');
console.log('已写回', FILE);
