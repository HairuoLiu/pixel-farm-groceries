/* 评委5 · 数据质量负责人 —— 数据统计分析脚本
 * 用法： node review-panel/05-data-analysis.js
 * 纯 Node，无第三方依赖。只读，不修改任何数据文件。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 加载 window.* 数据文件 ---------- */
const sandbox = { window: {}, console };
vm.createContext(sandbox);
['icons.js', 'ingredient-icons.js', 'data.js', 'data-100.js'].forEach((f) => {
  vm.runInContext(read(f), sandbox, { filename: f });
});
const W = sandbox.window;
const D100 = W.DISHES_100 || { zones: [], dishes: [] };
const DOLD = W.DISHES || { zones: [], dishes: [] };
const ING_ICON = (W.PXIcon && W.PXIcon.ING_ICON) || {};
const ICON_NAMES = new Set(Object.keys(((W.PXIcon || {}).ICONS) || {}));

const dishes = D100.dishes;
const zones = D100.zones;
const ZONE_NAME = {};
zones.forEach((z) => (ZONE_NAME[z.id] = z.name));

/* ---------- 工具 ---------- */
const out = [];
const log = (s) => { out.push(s); console.log(s); };
const H = (t) => log('\n' + '='.repeat(72) + '\n' + t + '\n' + '='.repeat(72));
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2700}-\u{27bf}]/u;
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + '%' : '0%');

/* app.js 中的派生逻辑（原样复刻，用于校验 type/cuisine 一致性） */
function deriveType(d) {
  const name = d.name, tags = d.tags || [], items = d.items || [];
  const hasMeat = items.some((i) => (i.zone === 'meat' || i.zone === 'seafood') && !i.optional);
  if (/汤|羹/.test(name) || tags.indexOf('汤') > -1) return '汤羹';
  if (/饭|面|粥|粉|饼|包|饺|意面|披萨|凉皮|米线/.test(name) || tags.indexOf('主食') > -1) return '主食';
  if (hasMeat) return '肉菜';
  return '素菜';
}
function deriveCuisine(d) {
  const t = (d.tags || []).join(' ') + ' ' + d.name;
  if (/意面|披萨|千层面|pasta|mac/i.test(t)) return '意餐';
  if (/寿司|刺身|味增|味噌|寿喜|天妇罗|饭团|玉子|照烧|咖喱|亲子|乌冬/.test(t)) return '日料';
  if (/炸鸡|汉堡|牛排|薯条|沙拉|三明治|芝士|焗/.test(t)) return '西餐';
  if (/麻辣|水煮|麻婆|回锅|宫保|辣|川/.test(t)) return '川渝';
  if (/白灼|清蒸|老火|煲汤|虾饺|肠粉/.test(t)) return '粤式';
  return '中国家常';
}

/* ============================================================
 * 1. 规模与 id 规范性
 * ============================================================ */
H('1. 规模与 id 规范');
log(`dishes 总数 = ${dishes.length}   （zones = ${zones.length}，data.js 旧集 = ${DOLD.dishes.length}）`);
const SNAKE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const badId = dishes.filter((d) => !SNAKE.test(d.id || ''));
log(`id 不符合 snake_case 的条目：${badId.length} 个` + (badId.length ? ' -> ' + badId.map((d) => `${d.id}(${d.name})`).join(', ') : ''));
const idDup = {};
dishes.forEach((d) => (idDup[d.id] = (idDup[d.id] || 0) + 1));
const dupIds = Object.keys(idDup).filter((k) => idDup[k] > 1);
log(`重复 id：${dupIds.length} 个` + (dupIds.length ? ' -> ' + dupIds.join(', ') : ''));
const idLen = dishes.map((d) => (d.id || '').length);
log(`id 长度 min/avg/max = ${Math.min(...idLen)} / ${(idLen.reduce((a, b) => a + b, 0) / idLen.length).toFixed(1)} / ${Math.max(...idLen)}`);
// id 与 name 是否有对应关系（英文 id 大致对应中文名）
log(`示例 id：${dishes.slice(0, 5).map((d) => d.id + '=' + d.name).join(', ')}`);
log(`末 8 条 id：${dishes.slice(-8).map((d) => d.id + '=' + d.name).join(', ')}`);

/* ============================================================
 * 2. items 数量分布
 * ============================================================ */
H('2. items 数量分布');
const perDish = dishes.map((d) => ({
  id: d.id, name: d.name,
  total: (d.items || []).length,
  core: (d.items || []).filter((i) => !i.optional).length,
  opt: (d.items || []).filter((i) => i.optional).length,
}));
const totals = perDish.map((x) => x.total).sort((a, b) => a - b);
const cores = perDish.map((x) => x.core).sort((a, b) => a - b);
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
log(`items 总数 min/avg/max = ${totals[0]} / ${avg(totals)} / ${totals[totals.length - 1]}`);
log(`非 optional（主料）min/avg/max = ${cores[0]} / ${avg(cores)} / ${cores[cores.length - 1]}`);
const hist = {};
totals.forEach((n) => (hist[n] = (hist[n] || 0) + 1));
log('直方图（items 数: 菜数）：' + Object.keys(hist).sort((a, b) => a - b).map((k) => `${k}:${hist[k]}`).join('  '));

const lt3 = perDish.filter((x) => x.total < 3);
const core0 = perDish.filter((x) => x.core === 0);
const core1 = perDish.filter((x) => x.core <= 1);
log(`\n【items < 3 的菜】${lt3.length} 道：`);
lt3.forEach((x) => log(`   - ${x.id} | ${x.name} | items=${x.total} (主料${x.core}/可选${x.opt})`));
log(`\n【主料 = 0（全部食材都标 optional）】${core0.length} 道：` + (core0.length ? '' : ' 无'));
core0.forEach((x) => log(`   - ${x.id} | ${x.name}`));
log(`【主料 <= 1】${core1.length} 道 (${pct(core1.length, dishes.length)})` +
  (core1.length ? ' -> ' + core1.map((x) => `${x.name}(${x.core})`).join(', ') : ''));

/* ============================================================
 * 3. 食材频次 / 只出现一次的食材
 * ============================================================ */
H('3. 食材频次统计');
const freq = new Map();          // name -> count(出现菜数)
const freqZones = new Map();     // name -> Set(zone)
const freqDishes = new Map();    // name -> [dish names]
dishes.forEach((d) => {
  const seen = new Set();
  (d.items || []).forEach((i) => {
    if (seen.has(i.name)) return;
    seen.add(i.name);
    freq.set(i.name, (freq.get(i.name) || 0) + 1);
    if (!freqZones.has(i.name)) freqZones.set(i.name, new Set());
    freqZones.get(i.name).add(i.zone);
    if (!freqDishes.has(i.name)) freqDishes.set(i.name, []);
    freqDishes.get(i.name).push(d.name);
  });
});
const uniqIng = freq.size;
log(`去重后食材种类 = ${uniqIng}，食材出现总次数 = ${[...freq.values()].reduce((a, b) => a + b, 0)}`);
const once = [...freq.entries()].filter(([, c]) => c === 1);
log(`\n【只出现 1 次的食材】${once.length} 种 / ${uniqIng} 种 = ${pct(once.length, uniqIng)}`);
log('   ' + once.map(([n]) => n).join('、'));
const twice = [...freq.entries()].filter(([, c]) => c === 2).length;
log(`\n只出现 2 次的食材 = ${twice} 种；出现 <=2 次合计 ${once.length + twice} 种 = ${pct(once.length + twice, uniqIng)}`);
log('\n【TOP 20 高频食材】');
[...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  .forEach(([n, c]) => log(`   ${String(c).padStart(3)} 次  ${n}`));

/* ============================================================
 * 4. 分区一致性：同名食材落到不同分区
 * ============================================================ */
H('4. 分区一致性（同一食材名落在多个分区）');
const conflict = [...freqZones.entries()].filter(([, s]) => s.size > 1);
log(`冲突食材 = ${conflict.length} 种`);
conflict.sort((a, b) => freq.get(b[0]) - freq.get(a[0])).forEach(([n, s]) => {
  log(`   - 「${n}」出现 ${freq.get(n)} 次，分区：${[...s].map((z) => z + '/' + ZONE_NAME[z]).join(' , ')}`);
});

/* 分区总体分布 */
const zoneCnt = {}, zoneItemCnt = {};
dishes.forEach((d) => (d.items || []).forEach((i) => {
  zoneCnt[i.zone] = (zoneCnt[i.zone] || 0) + 1;
  if (!zoneItemCnt[i.zone]) zoneItemCnt[i.zone] = new Set();
  zoneItemCnt[i.zone].add(i.name);
}));
log('\n【分区分布（出现次数 / 去重食材数）】');
zones.forEach((z) => log(`   ${z.order}. ${z.name}(${z.id})  ${String(zoneCnt[z.id] || 0).padStart(4)} 次 / ${(zoneItemCnt[z.id] ? zoneItemCnt[z.id].size : 0)} 种`));
const invalidZone = [];
dishes.forEach((d) => (d.items || []).forEach((i) => { if (!ZONE_NAME[i.zone]) invalidZone.push(`${d.id}:${i.name}:${i.zone}`); }));
log(`\n不存在的 zone id：${invalidZone.length}` + (invalidZone.length ? ' -> ' + invalidZone.join(', ') : ''));
log(`「其他」分区占比：${pct(zoneCnt.other || 0, [...freq.values()].reduce((a, b) => a + b, 0))}（${zoneCnt.other || 0} 次）`);

/* 分区归属可疑：把生鲜/蔬菜放进了 调料干货/其他，或把干货调料放进了蔬菜 */
const SHOULD_BE_VEG = ['番茄','黄瓜','青椒','土豆','胡萝卜','洋葱','白菜','菠菜','生菜','油麦菜','芹菜','韭菜','茄子','豆角','四季豆','西兰花','花菜','南瓜','冬瓜','丝瓜','莴笋','莲藕','山药','芋头','香菇','金针菇','杏鲍菇','平菇','蟹味菇','白玉菇','豆芽','蒜苗','蒜薹','香菜','玉米','豌豆','毛豆','白萝卜','苋菜','空心菜','茼蒿','芥蓝','菜心','秋葵','芦笋','荷兰豆','苦瓜','西葫芦','青蒜','彩椒','尖椒','西芹','包菜','圆白菜','娃娃菜','莲白','藕','番茄酱'];
const SHOULD_BE_SEASONING = ['盐','糖','生抽','老抽','酱油','醋','料酒','蚝油','食用油','香油','花椒','八角','桂皮','香叶','干辣椒','豆瓣酱','淀粉','五香粉','孜然','黑胡椒','白胡椒','辣椒面','花椒粉','鸡精','味精','芝麻','番茄沙司','沙拉酱','咖喱粉','蒜蓉酱','柱侯酱','沙茶酱','剁椒','火锅底料'];
const misVeg = [], misSea = [];
dishes.forEach((d) => (d.items || []).forEach((i) => {
  if (SHOULD_BE_SEASONING.includes(i.name) && i.zone === 'vegetable') misSea.push(`${d.id}|${d.name}|${i.name}|${i.zone}`);
  if (SHOULD_BE_VEG.includes(i.name) && (i.zone === 'seasoning' || i.zone === 'other')) misVeg.push(`${d.id}|${d.name}|${i.name}|${i.zone}`);
}));
log(`\n【疑似分区错配】调味料被放进蔬菜区：${misSea.length} 处` + (misSea.length ? '\n   ' + misSea.join('\n   ') : ''));
log(`【疑似分区错配】蔬菜被放进调料/其他区：${misVeg.length} 处` + (misVeg.length ? '\n   ' + misVeg.join('\n   ') : ''));

/* ============================================================
 * 5. 同一食材的不同写法
 * ============================================================ */
H('5. 同一食材的不同写法（别名/切法变体）');
const ALIAS = [
  { core: '葱', forms: ['葱', '大葱', '小葱', '香葱', '葱花', '葱段', '葱白', '京葱', '葱丝', '葱姜蒜'] },
  { core: '蒜', forms: ['蒜', '大蒜', '蒜瓣', '蒜末', '蒜蓉', '蒜泥', '蒜片', '蒜蓉酱'] },
  { core: '姜', forms: ['姜', '生姜', '姜片', '姜丝', '姜末'] },
  { core: '辣椒', forms: ['辣椒', '干辣椒', '小米辣', '尖椒', '青红椒', '辣椒面', '小米椒'] },
  { core: '土豆', forms: ['土豆', '土豆片', '土豆丝', '土豆块', '马铃薯'] },
  { core: '猪肉', forms: ['猪肉', '猪肉末', '五花肉', '五花肉片', '里脊肉', '瘦肉', '肉末', '肉丝', '肉片'] },
  { core: '牛肉', forms: ['牛肉', '牛肉片', '牛柳', '牛腩'] },
  { core: '鸡肉', forms: ['鸡肉', '鸡腿肉', '鸡翅', '鸡块', '鸡胸肉'] },
  { core: '豆腐', forms: ['豆腐', '冻豆腐', '嫩豆腐', '老豆腐', '豆腐皮'] },
  { core: '虾', forms: ['虾', '鲜虾', '虾仁', '基围虾', '大虾'] },
  { core: '鱼', forms: ['鱼', '鱼片', '带鱼', '草鱼', '鲈鱼'] },
  { core: '米', forms: ['大米', '米饭'] },
  { core: '面', forms: ['面条', '方便面', '火锅面', '意面'] },
  { core: '粉', forms: ['粉丝', '粉条', '宽粉', '红薯粉'] },
];
let aliasHit = 0;
ALIAS.forEach((g) => {
  const present = g.forms.filter((f) => freq.has(f));
  if (present.length > 1) {
    aliasHit++;
    log(`   - [${g.core}] 数据中存在 ${present.length} 种写法：${present.map((f) => `${f}(${freq.get(f)})`).join('、')}`);
    const keys = new Set(present.map((f) => ING_ICON[f]).filter(Boolean));
    if (present.some((f) => !ING_ICON[f])) log(`     ! 有写法缺少图标映射：${present.filter((f) => !ING_ICON[f]).join('、')}`);
    else if (keys.size > 1) log(`     ! 映射到了不同图标：${[...keys].join(' vs ')}`);
  }
});
log(`\n共 ${aliasHit} 组食材存在多种写法`);
// 后缀变体检测
const suffixes = ['末', '片', '丝', '丁', '块', '条', '段', '瓣', '粒', '仁', '卷'];
const suffixVar = [];
[...freq.keys()].forEach((n) => {
  suffixes.forEach((s) => {
    if (n.length > 1 && n.endsWith(s)) {
      const base = n.slice(0, -1);
      if (freq.has(base)) suffixVar.push(`${base} / ${n}`);
    }
  });
});
log(`后缀变体（如 土豆/土豆片）共 ${suffixVar.length} 组：` + (suffixVar.length ? suffixVar.join('、') : ' 无'));

/* ============================================================
 * 6. optional / note 标注质量
 * ============================================================ */
H('6. optional / note 标注质量');
let optCount = 0, itemTotal = 0, noteCount = 0;
dishes.forEach((d) => (d.items || []).forEach((i) => {
  itemTotal++;
  if (i.optional) optCount++;
  if (i.note) noteCount++;
}));
log(`食材条目总数 ${itemTotal}；optional=true 共 ${optCount} (${pct(optCount, itemTotal)})；带 note 共 ${noteCount} (${pct(noteCount, itemTotal)})`);
// 主料却被标 optional 的可疑项（肉/水产/主食类非可选才合理）
const suspiciousOpt = [];
dishes.forEach((d) => (d.items || []).forEach((i) => {
  if (i.optional && (i.zone === 'meat' || i.zone === 'seafood') && !/^葱|姜|蒜|料酒|淀粉|盐|糖|胡椒/.test(i.name))
    suspiciousOpt.push(`${d.id}|${d.name}|${i.name}`);
}));
log(`\n【optional=true 但看起来是主料的肉/水产】${suspiciousOpt.length} 处：`);
suspiciousOpt.forEach((s) => log('   ' + s));
// note 内容分布
const noteFreq = {};
dishes.forEach((d) => (d.items || []).forEach((i) => { if (i.note) noteFreq[i.note] = (noteFreq[i.note] || 0) + 1; }));
log('\n【note 文案 TOP 15】');
Object.entries(noteFreq).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([n, c]) => log(`   ${String(c).padStart(3)}  ${n}`));
const emptyNote = [];
dishes.forEach((d) => (d.items || []).forEach((i) => {
  if (i.optional && !i.note) emptyNote.push(`${d.id}|${i.name}`);
}));
log(`\noptional=true 但无 note 说明的条目：${emptyNote.length} 处` + (emptyNote.length ? '，示例：' + emptyNote.slice(0, 10).join(', ') : ''));
// 「葱、姜、蒜」这类合并条目
const combined = [];
dishes.forEach((d) => (d.items || []).forEach((i) => { if (/[、,，\/]/.test(i.name)) combined.push(`${d.id}|${d.name}|${i.name}`); }));
log(`\n【一条里塞了多种食材（含顿号/逗号）】${combined.length} 处：`);
combined.slice(0, 30).forEach((s) => log('   ' + s));

/* ============================================================
 * 7. type / cuisine 分布与一致性
 * ============================================================ */
H('7. type / cuisine 分布与一致性');
const cnt = (key) => { const m = {}; dishes.forEach((d) => (m[d[key]] = (m[d[key]] || 0) + 1)); return m; };
const typeCnt = cnt('type'), cuiCnt = cnt('cuisine');
log('【type 分布】');
Object.entries(typeCnt).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => log(`   ${k}: ${v} 道 (${pct(v, dishes.length)})`));
log('\n【cuisine 分布】');
Object.entries(cuiCnt).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => log(`   ${k}: ${v} 道 (${pct(v, dishes.length)})`));
const CUISINE_ICON = ['中国家常', '川渝', '粤式', '日料', '西餐', '意餐'];
log('\n首页 cuisineGrid 会渲染的菜系（CUISINE_ICON 键）：' + CUISINE_ICON.join('、'));
log('其中数据量为 0（首页按钮会消失）：' + (CUISINE_ICON.filter((c) => !cuiCnt[c]).join('、') || ' 无'));
const TYPE_ICON = ['肉菜', '素菜', '汤羹', '主食'];
log('数据量最小的菜类：' + TYPE_ICON.map((t) => `${t}=${typeCnt[t] || 0}`).join('，'));

const noType = dishes.filter((d) => !d.type), noCui = dishes.filter((d) => !d.cuisine);
log(`\n缺失 type 的条目：${noType.length}；缺失 cuisine 的条目：${noCui.length}`);
const mismType = [], mismCui = [];
dishes.forEach((d) => {
  if (d.type && d.type !== deriveType(d)) mismType.push(`${d.id}|${d.name}|声明=${d.type}|派生=${deriveType(d)}`);
  if (d.cuisine && d.cuisine !== deriveCuisine(d)) mismCui.push(`${d.id}|${d.name}|声明=${d.cuisine}|派生=${deriveCuisine(d)}`);
});
log(`\n【声明 type 与 deriveType 不一致】${mismType.length} 道：`);
mismType.forEach((s) => log('   ' + s));
log(`\n【声明 cuisine 与 deriveCuisine 不一致】${mismCui.length} 道：`);
mismCui.slice(0, 40).forEach((s) => log('   ' + s));

/* ============================================================
 * 8. 重复 / 相似菜名
 * ============================================================ */
H('8. 重复 / 相似菜名');
const nameCnt = {};
dishes.forEach((d) => (nameCnt[d.name] = (nameCnt[d.name] || 0) + 1));
const dupName = Object.entries(nameCnt).filter(([, c]) => c > 1);
log(`完全同名：${dupName.length} 组` + (dupName.length ? ' -> ' + dupName.map(([n, c]) => `${n}×${c}`).join(', ') : ''));

function bigrams(s) { const a = []; for (let i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2)); return a; }
function jac(a, b) {
  const A = new Set(bigrams(a)), B = new Set(bigrams(b));
  let inter = 0; A.forEach((x) => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter || 1);
}
const pairs = [];
for (let i = 0; i < dishes.length; i++) {
  for (let j = i + 1; j < dishes.length; j++) {
    const s = jac(dishes[i].name, dishes[j].name);
    if (s >= 0.5) pairs.push({ a: dishes[i].name, b: dishes[j].name, s: +s.toFixed(2) });
  }
}
pairs.sort((x, y) => y.s - x.s);
log(`\n菜名 bigram 相似度 >= 0.5 的配对：${pairs.length} 组，TOP 25：`);
pairs.slice(0, 25).forEach((p) => log(`   ${p.s}  ${p.a}  <->  ${p.b}`));
// 同一主食材 + 同一做法模板的重复感
const pattern = {};
dishes.forEach((d) => { const m = d.name.match(/.{2}(炒|烧|炖|蒸|煮|拌|焖|煎|炸|汤)$/); if (m) pattern[m[0]] = (pattern[m[0]] || 0) + 1; });
log('\n高频「XX+做法」组合：' + Object.entries(pattern).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k}×${c}`).join('，'));

/* ============================================================
 * 9. 是否混入了非「家常菜」
 * ============================================================ */
H('9. 非家常菜 / 餐厅菜 嫌疑条目');
const NON_HOME = /披萨|意面|千层面|寿司|刺身|牛排|汉堡|薯条|沙拉|三明治|焗|天妇罗|寿喜|冬阴功|咖喱|塔可|墨西哥|泰式|韩式炸鸡|意式/;
const nonHome = dishes.filter((d) => NON_HOME.test(d.name) || NON_HOME.test((d.tags || []).join('')));
log(`命中「非家常菜」关键词：${nonHome.length} 道 (${pct(nonHome.length, dishes.length)})：`);
nonHome.forEach((d) => log(`   - ${d.id} | ${d.name} | ${d.tags.join('/')} | ${d.cuisine}`));
const HARD = /佛跳墙|满汉|鲍鱼|鱼翅|燕窝|龙虾|鹅肝|松露|和牛|帝王蟹/;
const hard = dishes.filter((d) => HARD.test(d.name) || (d.items || []).some((i) => HARD.test(i.name)));
log(`\n含高档/宴席食材：${hard.length} 道` + (hard.length ? ' -> ' + hard.map((d) => d.name).join('、') : ''));

/* ============================================================
 * 10. tags 质量
 * ============================================================ */
H('10. tags 质量');
const tagCnt = {}, tagPer = [];
dishes.forEach((d) => { tagPer.push((d.tags || []).length); (d.tags || []).forEach((t) => (tagCnt[t] = (tagCnt[t] || 0) + 1)); });
log(`每道菜 tags 数 min/avg/max = ${Math.min(...tagPer)} / ${avg(tagPer)} / ${Math.max(...tagPer)}`);
log(`去重后 tag 种类 = ${Object.keys(tagCnt).length}`);
const tagOnce = Object.entries(tagCnt).filter(([, c]) => c === 1);
log(`只被 1 道菜使用的 tag：${tagOnce.length} 个 = ${pct(tagOnce.length, Object.keys(tagCnt).length)}`);
log('   ' + tagOnce.map(([t]) => t).join('、'));
log('\n【TOP 20 tags】');
Object.entries(tagCnt).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([t, c]) => log(`   ${String(c).padStart(3)}  ${t}`));
const noTag = dishes.filter((d) => !d.tags || d.tags.length === 0);
log(`\n无 tags 的菜：${noTag.length} 道` + (noTag.length ? ' -> ' + noTag.map((d) => d.id).join(', ') : ''));
const vague = ['好吃', '美味', '家常', '简单', '经典', '招牌'];
log('泛化/无检索价值 tag 命中：' + vague.filter((v) => tagCnt[v]).map((v) => `${v}(${tagCnt[v]})`).join('，'));

/* ============================================================
 * 11. emoji 残留 & 全字段扫描
 * ============================================================ */
H('11. emoji 残留扫描');
const emojiFields = [];
zones.forEach((z) => Object.entries(z).forEach(([k, v]) => { if (typeof v === 'string' && EMOJI_RE.test(v)) emojiFields.push(`zones[${z.id}].${k} = "${v}"`); }));
dishes.forEach((d) => Object.entries(d).forEach(([k, v]) => {
  if (typeof v === 'string' && EMOJI_RE.test(v)) emojiFields.push(`dishes[${d.id}].${k} = "${v}"`);
  if (k === 'items') (v || []).forEach((i) => Object.entries(i).forEach(([ik, iv]) => {
    if (typeof iv === 'string' && EMOJI_RE.test(iv)) emojiFields.push(`dishes[${d.id}].items[${i.name}].${ik} = "${iv}"`);
  }));
  if (k === 'tags') (v || []).forEach((t) => { if (EMOJI_RE.test(t)) emojiFields.push(`dishes[${d.id}].tags = "${t}"`); });
}));
log(`含 emoji 的字段共 ${emojiFields.length} 处：`);
emojiFields.forEach((s) => log('   ' + s));

/* ============================================================
 * 12. desc 质量
 * ============================================================ */
H('12. desc 质量');
const descLen = dishes.map((d) => (d.desc || '').length);
log(`desc 长度 min/avg/max = ${Math.min(...descLen)} / ${avg(descLen)} / ${Math.max(...descLen)}`);
const longDesc = dishes.filter((d) => (d.desc || '').length > 20).sort((a, b) => b.desc.length - a.desc.length);
log(`\n超过 20 字的 desc：${longDesc.length} 道，最长 10 条：`);
longDesc.slice(0, 10).forEach((d) => log(`   (${d.desc.length}) ${d.name}：${d.desc}`));
const MARKETING = /最|超|绝|必吃|神器|零失败|巨|爆款|一口|神仙|秒杀|灵魂|天花板|无敌|完美|极致|惊艳|yyds/i;
const mk = dishes.filter((d) => MARKETING.test(d.desc || ''));
log(`\n疑似营销腔 desc（含 最/超/绝/零失败/神器…）：${mk.length} 道 (${pct(mk.length, dishes.length)})，示例：`);
mk.slice(0, 15).forEach((d) => log(`   ${d.name}：${d.desc}`));
const dupDesc = Object.entries(dishes.reduce((m, d) => ((m[d.desc] = (m[d.desc] || 0) + 1), m), {})).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
log(`\n完全重复的 desc：${dupDesc.length} 组，TOP 8：`);
dupDesc.slice(0, 8).forEach(([t, c]) => log(`   ×${c}  "${t}"`));
const emptyDesc = dishes.filter((d) => !d.desc || !d.desc.trim());
log(`\n缺失 desc：${emptyDesc.length} 道` + (emptyDesc.length ? ' -> ' + emptyDesc.map((d) => d.id).join(', ') : ''));

/* ============================================================
 * 13. 图标覆盖率
 * ============================================================ */
H('13. 食材 → 像素图标 覆盖率');
log(`ING_ICON 映射条目 = ${Object.keys(ING_ICON).length}；图标字形总数 = ${ICON_NAMES.size}`);
const missIcon = [...freq.keys()].filter((n) => !ING_ICON[n]).sort((a, b) => freq.get(b) - freq.get(a));
log(`\n【无专属图标、会回落到分区图标的食材】${missIcon.length} 种 / ${uniqIng} 种 = ${pct(missIcon.length, uniqIng)}`);
log('   （按出现次数降序）' + missIcon.map((n) => `${n}(${freq.get(n)})`).join('、'));
const badMap = Object.entries(ING_ICON).filter(([, v]) => !ICON_NAMES.has(v));
log(`\n映射指向了不存在的图标：${badMap.length} 个` + (badMap.length ? ' -> ' + badMap.map(([k, v]) => `${k}=>${v}`).join(', ') : ''));
const unusedMap = Object.keys(ING_ICON).filter((k) => !freq.has(k));
log(`映射中存在、但数据里没用到的食材名：${unusedMap.length} 个 -> ${unusedMap.join('、')}`);
// 有专属图标的食材覆盖了多少次出现
const covered = [...freq.entries()].filter(([n]) => ING_ICON[n]).reduce((a, [, c]) => a + c, 0);
const allOcc = [...freq.values()].reduce((a, b) => a + b, 0);
log(`\n按「出现次数」加权，图标覆盖率 = ${covered}/${allOcc} = ${pct(covered, allOcc)}`);

/* ============================================================
 * 14. 分量 / 人数 等实用信息
 * ============================================================ */
H('14. 分量 / 人数 / 用量 信息缺失情况');
const QTY = /\d+\s*(克|g|G|ml|毫升|斤|两|个|根|只|片|勺|匙|勺|茶匙|汤匙|瓣)/;
const hasQtyItem = dishes.filter((d) => (d.items || []).some((i) => QTY.test(i.name) || QTY.test(i.note || '')));
log(`任一食材带具体用量（如 200克/2勺）的菜：${hasQtyItem.length} 道 = ${pct(hasQtyItem.length, dishes.length)}`);
const servingKeys = ['servings', 'serves', ' portions', 'yield', '份量', '人数', '分量'];
log(`是否存在 servings/人数 字段：${servingKeys.filter((k) => dishes.some((d) => k in d)).join(',') || ' 完全没有'}`);
const noteVague = ['适量', '少许', '若干', '若干'];
let vagueCnt = 0;
dishes.forEach((d) => (d.items || []).forEach((i) => { if (noteVague.some((v) => (i.note || '').includes(v))) vagueCnt++; }));
log(`note 里出现「适量/少许」等模糊用量的条目：${vagueCnt} 处`);

/* ============================================================
 * 15. 分区闯关体验：每道菜横跨几个分区
 * ============================================================ */
H('15. 分区覆盖（逛超市动线）');
const zonePer = dishes.map((d) => ({ name: d.name, n: new Set((d.items || []).map((i) => i.zone)).size, zones: [...new Set((d.items || []).map((i) => i.zone))] }));
const zn = zonePer.map((x) => x.n).sort((a, b) => a - b);
log(`每道菜横跨分区数 min/avg/max = ${zn[0]} / ${avg(zn)} / ${zn[zn.length - 1]}`);
const zh = {};
zn.forEach((n) => (zh[n] = (zh[n] || 0) + 1));
log('直方图（分区数: 菜数）：' + Object.keys(zh).sort((a, b) => a - b).map((k) => `${k}:${zh[k]}`).join('  '));
const only1 = zonePer.filter((x) => x.n === 1);
log(`\n只落在 1 个分区的菜：${only1.length} 道 -> ${only1.map((x) => x.name + '(' + x.zones[0] + ')').join('、')}`);

/* ============================================================
 * 16. 关键原料遗漏抽查（基于常识白名单）
 * ============================================================ */
H('16. 关键原料疑似遗漏抽查');
// 常见家常菜的「灵魂」食材白名单：菜名包含关键词 -> 期望出现的食材关键词
const EXPECT = [
  { key: '番茄炒蛋', must: ['番茄', '鸡蛋'] },
  { key: '红烧肉', must: ['五花肉'] },
  { key: '宫保鸡丁', must: ['鸡', '花生'] },
  { key: '麻婆豆腐', must: ['豆腐', '豆瓣酱'] },
  { key: '鱼香肉丝', must: ['猪肉', '木耳'] },
  { key: '水煮牛肉', must: ['牛肉'] },
  { key: '回锅肉', must: ['五花肉'] },
  { key: '可乐鸡翅', must: ['鸡翅', '可乐'] },
  { key: '糖醋', must: ['醋', '糖'] },
  { key: '蒜蓉', must: ['蒜'] },
  { key: '清蒸', must: [] },
  { key: '蛋炒饭', must: ['米饭', '鸡蛋'] },
  { key: '饺子', must: [] },
  { key: '排骨', must: ['排骨'] },
  { key: '酸菜鱼', must: ['鱼', '酸菜'] },
  { key: '小龙虾', must: ['小龙虾'] },
  { key: '咖喱', must: ['咖喱'] },
  { key: '火锅', must: ['火锅底料'] },
  { key: '寿司', must: ['米饭', '紫菜'] },
  { key: '意面', must: ['意面'] },
  { key: '披萨', must: ['芝士'] },
];
let missingHit = 0;
EXPECT.forEach((e) => {
  dishes.filter((d) => d.name.includes(e.key)).forEach((d) => {
    const names = (d.items || []).map((i) => i.name);
    e.must.forEach((m) => {
      if (!names.some((n) => n.includes(m) || m.includes(n))) {
        missingHit++;
        log(`   ! ${d.id} | ${d.name}：疑似缺少「${m}」  现有：${names.join('、')}`);
      }
    });
  });
});
log(`\n疑似缺料命中 ${missingHit} 处`);

/* ============================================================
 * 17. 无调料（只有主料）的菜
 * ============================================================ */
H('17. 完全没有调料/配料标注的菜');
const noSeason = dishes.filter((d) => !(d.items || []).some((i) => i.zone === 'seasoning'));
log(`items 中没有任何 seasoning 分区食材的菜：${noSeason.length} 道`);
noSeason.forEach((d) => log(`   - ${d.id} | ${d.name} | ${(d.items || []).map((i) => i.name).join('、')}`));

/* ============================================================
 * 18. 跨数据集一致性（data.js vs data-100.js）
 * ============================================================ */
H('18. 与旧数据集 data.js 的一致性');
const oldIds = new Set(DOLD.dishes.map((d) => d.id));
const newIds = new Set(dishes.map((d) => d.id));
const onlyOld = [...oldIds].filter((i) => !newIds.has(i));
log(`data.js 独有 id：${onlyOld.length} 个 -> ${onlyOld.join(', ')}`);
const oldZones = JSON.stringify(DOLD.zones), newZones = JSON.stringify(zones);
log(`zones 定义是否与 data.js 完全一致：${oldZones === newZones}`);

/* ============================================================
 * 19. 极简条目：主料 1 样 + 调料 <= 2 样（信息量最低）
 * ============================================================ */
H('19. 信息量最低的条目（主料<=1 且 调料<=2）');
const thin = dishes.map((d) => {
  const its = d.items || [];
  return { id: d.id, name: d.name, core: its.filter((i) => !i.optional).length, sea: its.filter((i) => i.zone === 'seasoning').length, all: its.map((i) => i.name) };
}).filter((x) => x.core <= 1 && x.sea <= 2);
log(`命中 ${thin.length} 道：`);
thin.forEach((x) => log(`   - ${x.id} | ${x.name} | 主料${x.core} 调料${x.sea} | ${x.all.join('、')}`));

/* ============================================================
 * 20. 「其他」「冷冻」两个异常分区的内容
 * ============================================================ */
H('20. 「其他」与「冷冻」分区内容审计');
['other', 'frozen', 'dairy', 'grain'].forEach((z) => {
  log(`\n[${z} / ${ZONE_NAME[z]}] 共 ${[...(zoneItemCnt[z] || [])].length} 种：`);
  const list = [...(zoneItemCnt[z] || [])].sort((a, b) => freq.get(b) - freq.get(a));
  log('   ' + list.map((n) => `${n}(${freq.get(n)})`).join('、'));
});

/* ============================================================
 * 21. desc 套话模式
 * ============================================================ */
H('21. desc 套话 / 信息量分析');
const patterns = { '含「家常」': /家常/, '含「下饭」': /下饭/, '含「快手」': /快手/, '含「清爽」': /清爽/, '含「鲜」': /鲜/, '含「香」': /香/, '含「简单」': /简单|简易/, '含「经典」': /经典/ };
Object.entries(patterns).forEach(([k, re]) => {
  const n = dishes.filter((d) => re.test(d.desc || '')).length;
  log(`   ${k}: ${n} 道 (${pct(n, dishes.length)})`);
});
const descContainsName = dishes.filter((d) => (d.desc || '').includes(d.name));
log(`\ndesc 中直接复述菜名（信息冗余）：${descContainsName.length} 道` + (descContainsName.length ? '，示例：' + descContainsName.slice(0, 6).map((d) => `${d.name}->${d.desc}`).join('；') : ''));
log('\n全部 104 条 desc 抽样（每 8 条取 1）：');
dishes.filter((_, i) => i % 8 === 0).forEach((d) => log(`   ${d.name}：${d.desc}`));

/* ============================================================
 * 22. tags 与 type/cuisine 字段的重合度
 * ============================================================ */
H('22. tags 与 type / cuisine 字段重合度');
const REDUNDANT = ['肉菜', '素菜', '主食', '汤', '汤羹', '川渝', '川菜', '粤式', '日料', '西餐', '意餐', '中国家常'];
let redunHit = 0;
dishes.forEach((d) => (d.tags || []).forEach((t) => { if (REDUNDANT.includes(t)) redunHit++; }));
log(`tags 中命中「结构化字段同义词」的总次数 = ${redunHit} / tag 总数 ${[...tagPer].reduce((a, b) => a + b, 0)} = ${pct(redunHit, [...tagPer].reduce((a, b) => a + b, 0))}`);
REDUNDANT.forEach((t) => { if (tagCnt[t]) log(`   ${t}: ${tagCnt[t]} 次`); });
const purelyRedundant = dishes.filter((d) => (d.tags || []).every((t) => REDUNDANT.includes(t)));
log(`\ntags 全部是冗余字段（无增量信息）的菜：${purelyRedundant.length} 道` + (purelyRedundant.length ? '，示例：' + purelyRedundant.slice(0, 12).map((d) => `${d.name}[${d.tags}]`).join('、') : ''));

/* ============================================================
 * 23. 半成品 / 工业品条目（非生鲜食材）
 * ============================================================ */
H('23. 半成品 / 工业加工品 条目');
const PROCESSED = ['可乐', '老干妈', '火锅底料', '冒菜底料', '香锅底料', '咖喱块', '方便面', '火锅面', '速冻水饺', '冷冻丸子', '鱼丸', '虾丸', '午餐肉', '培根', '火腿', '蒸肉粉', '番茄酱'];
const procDishes = {};
dishes.forEach((d) => (d.items || []).forEach((i) => { if (PROCESSED.includes(i.name)) (procDishes[i.name] = procDishes[i.name] || []).push(d.name); }));
Object.entries(procDishes).sort((a, b) => b[1].length - a[1].length).forEach(([n, ds]) => log(`   ${n}：${ds.length} 道 -> ${ds.join('、')}`));

/* ============================================================
 * 24. 单菜内重复食材 & 模糊表述
 * ============================================================ */
H('24. 单菜内重复 / 模糊表述');
const innerDup = [];
dishes.forEach((d) => {
  const seen = {}, it = d.items || [];
  it.forEach((i) => (seen[i.name] = (seen[i.name] || 0) + 1));
  Object.entries(seen).filter(([, c]) => c > 1).forEach(([n]) => innerDup.push(`${d.id}|${d.name}|${n}`));
});
log(`同一道菜里重复列出同一食材：${innerDup.length} 处` + (innerDup.length ? ' -> ' + innerDup.join(', ') : ''));
const vagueName = [];
dishes.forEach((d) => (d.items || []).forEach((i) => { if (/或|适量|少许|若干|可选|根据/.test(i.name)) vagueName.push(`${d.id}|${d.name}|${i.name}`); }));
log(`食材名含「或/适量/少许」等模糊词：${vagueName.length} 处` + (vagueName.length ? '\n   ' + vagueName.join('\n   ') : ''));
const vagueDishName = dishes.filter((d) => /时蔬|杂|什锦|拼盘|大杂烩/.test(d.name));
log(`\n菜名含「时蔬/杂/什锦」的抽象条目：${vagueDishName.length} 道 -> ${vagueDishName.map((d) => `${d.name}(items:${(d.items || []).map((i) => i.name).join('+')})`).join('；')}`);

/* ============================================================
 * 25. 图标有效性（映射目标是否真实存在）
 * ============================================================ */
H('25. 图标字形有效性');
log(`icons.js 中图标字形总数 = ${ICON_NAMES.size}`);
const sample = [...ICON_NAMES].slice(0, 12);
log('字形名示例：' + sample.join(', '));
const ingGlyphs = [...ICON_NAMES].filter((n) => /^ing_/.test(n)).length;
log(`其中 ing_ 前缀（食材专用）字形 = ${ingGlyphs}`);
const dupTargets = {};
Object.values(ING_ICON).forEach((v) => (dupTargets[v] = (dupTargets[v] || 0) + 1));
const shared = Object.entries(dupTargets).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
log(`\n被多个食材名共用的图标（共 ${shared.length} 个），TOP 10：`);
shared.slice(0, 10).forEach(([k, c]) => log(`   ${k}: ${c} 个食材名 -> ${Object.entries(ING_ICON).filter(([, v]) => v === k).map(([n]) => n).join('、')}`));

/* ---------- 落盘原始结论 ---------- */
const json = {
  total: dishes.length, zones: zones.length, uniqueIngredients: uniqIng,
  itemsAvg: +avg(totals), itemsMin: totals[0], itemsMax: totals[totals.length - 1],
  coreAvg: +avg(cores), coreMin: cores[0],
  lt3: lt3.map((x) => x.id), core0: core0.map((x) => x.id),
  onceCount: once.length, onceRatio: pct(once.length, uniqIng),
  zoneConflict: conflict.map(([n, s]) => ({ name: n, zones: [...s] })),
  typeCnt, cuiCnt, missIcon, unusedMap, aliasGroups: aliasHit,
  emojiFields, noSeason: noSeason.map((d) => d.id), nonHome: nonHome.map((d) => d.id),
};
fs.writeFileSync(path.join(__dirname, '05-data-stats.json'), JSON.stringify(json, null, 2), 'utf8');
log('\n\n>>> 原始统计已写入 review-panel/05-data-stats.json');
