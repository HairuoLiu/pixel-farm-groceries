/* 像素农场 · 采购记 — app.js
 * 流程：L1 搜索/随机 → L2 挑菜(4道/搜索结果, 加入菜篮累积) → L3 市集分区闯关 → L3b 全部清单/通关
 * 风格：16-bit 农场复古像素（Fusion Pixel 字体 + 硬描边 + 偏移硬阴影）
 * 功能与原版完全一致；埋点事件名、localStorage 键名保持不变。
 */
(function () {
  'use strict';

  var DATA = (window.DISHES_100 && window.DISHES_100.dishes && window.DISHES_100.dishes.length)
    ? window.DISHES_100
    : (window.DISHES || { zones: [], dishes: [] });
  var DISHES = DATA.dishes;
  var ZONES = DATA.zones;

  /* ---------- 像素图标映射 ---------- */
  var TYPE_ICON = { '肉菜': 'meat', '素菜': 'carrot', '汤羹': 'soup', '主食': 'rice' };
  var TYPE_TINT = { '肉菜': '#F7DCCF', '素菜': '#DFEDC9', '汤羹': '#F9E4C3', '主食': '#F4E9CC' };
  /* G7：菜类块的类型色条（底色保持纸色，强色只留给主 CTA） */
  var TYPE_BAR = { '肉菜': '#E8785A', '素菜': '#8FCB6B', '汤羹': '#F2C14E', '主食': '#E8A94C' };
  var CUISINE_ICON = { '中国家常': 'barn', '川渝': 'chili', '粤式': 'shrimp', '日料': 'sushi', '西餐': 'burger' };
  var ZONE_ICON = { vegetable: 'leaf', meat: 'meat', seafood: 'fish', seasoning: 'salt', frozen: 'freeze', grain: 'wheat', dairy: 'egg', other: 'box' };
  /* 分区色覆盖为农场 palette（不动数据文件，仅渲染层覆盖） */
  var ZONE_COLOR = {
    vegetable: '#8FCB6B', meat: '#E8785A', seafood: '#6BB8DE', seasoning: '#E8A94C',
    frozen: '#9AB8F0', grain: '#F2D14E', dairy: '#D9B8F0', other: '#B8AEA2'
  };
  var RANDOM_N = 4; // 心理专家建议：每次 4 道，决策压力最小
  /* 食材名 → 固定风格化像素图标（ingredient-icons.js 生成；成品菜预览纯文字，不展示图片） */
  var ING_ICON = (window.PXIcon && window.PXIcon.ING_ICON) || {};
  function ingIconKey(name, zoneId) {
    return ING_ICON[name] || ZONE_ICON[zoneId] || 'box';
  }
  function ingIcon(name, zoneId) {
    return ico(ingIconKey(name, zoneId), { scale: 24 });
  }
  var CART_KEY = 'grocery-cart-v3';
  var CHECK_KEY = 'grocery-checked-v3';
  var PX_FONT = '"Fusion Pixel 12px Proportional Simplified Chinese", "Microsoft YaHei", sans-serif';

  function ico(name, opts) { return window.PXIcon ? window.PXIcon.svg(name, opts || {}) : ''; }
  function zoneIcon(id) { return ico(ZONE_ICON[id] || 'box', { scale: 24 }); }

  /* H1：innerHTML 拼接统一走 esc()。当前数据集 0 个特殊字符、现状不可利用，
     但这是「接远程数据即险」的契约缺口——所有插值点必须转义，不依赖数据是干净的。 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- 数据归一化：确保 type / cuisine 存在 ---------- */
  function deriveType(d) {
    var name = d.name, tags = d.tags || [], items = d.items || [];
    var hasMeat = items.some(function (i) { return (i.zone === 'meat' || i.zone === 'seafood') && !i.optional; });
    if (/汤|羹/.test(name) || tags.indexOf('汤') > -1) return '汤羹';
    /* C2：主食判定改为「尾字」匹配。
       原来是 /饭|面|粥|粉|饼|包|饺|…/ 任意位置命中，导致
       「粉蒸肉」「蒜蓉粉丝蒸虾」「蒜蓉粉丝蒸娃娃菜」（含"粉"）、「手撕包菜」（含"包"）
       全被错标成主食。主食菜名几乎都以主食词收尾，锚定 $ 即可。 */
    if (/(饭|面|粥|粉|饼|饺|凉皮|米线|意面|披萨|粽子|馒头|包子|炒粉|炒面)$/.test(name)
      || tags.indexOf('主食') > -1) return '主食';
    if (hasMeat) return '肉菜';
    return '素菜';
  }
  function deriveCuisine(d) {
    var t = (d.tags || []).join(' ') + ' ' + d.name;
    if (/意面|披萨|千层面|pasta|mac/i.test(t)) return '意餐';
    if (/寿司|刺身|味增|味噌|寿喜|天妇罗|饭团|玉子|照烧|咖喱|亲子|乌冬/.test(t)) return '日料';
    if (/炸鸡|汉堡|牛排|薯条|沙拉|三明治|芝士|焗/.test(t)) return '西餐';
    if (/麻辣|水煮|麻婆|回锅|宫保|辣|川/.test(t)) return '川渝';
    if (/白灼|清蒸|老火|煲汤|虾饺|肠粉/.test(t)) return '粤式';
    return '中国家常';
  }
  DISHES.forEach(function (d) {
    if (!d.type) d.type = deriveType(d);
    if (!d.cuisine) d.cuisine = deriveCuisine(d);
    /* G16：回退数据集 data.js 里有些条目把多种调料写成一个名字
       （如「葱、姜、蒜」「生抽、料酒」），导致 21 种食材没有专属图标、
       且购物时只能整组打勾。这里按顿号/逗号拆成独立食材，
       各自有图标、各自一行可勾选。data-100.js 无此问题（0 条复合名）。 */
    if (d.items && d.items.length) {
      var out = [];
      d.items.forEach(function (it) {
        if (it.zone === 'seasoning' && /[、,，]/.test(it.name)) {
          it.name.split(/[、,，]/).map(function (s) { return s.trim(); })
            .filter(Boolean).forEach(function (n) {
              out.push({ zone: it.zone, name: n, optional: !!it.optional, note: it.note || '' });
            });
        } else {
          out.push(it);
        }
      });
      d.items = out;
    }
  });
  /* 分区色覆盖为农场 palette */
  ZONES.forEach(function (z) { if (ZONE_COLOR[z.id]) z.color = ZONE_COLOR[z.id]; });
  /* G16：删掉 zones[].icon 的 8 个 emoji 死字段——图标一律由 app.js 的
     ZONE_ICON 映射到像素图标，emoji 从未被读取，只会让人误以为有两套图标源。 */
  ZONES.forEach(function (z) { delete z.icon; });

  function zoneById(id) {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].id === id) return ZONES[i];
    return { id: id, name: id, icon: '', color: '#B8AEA2', order: 99 };
  }
  function dishById(id) {
    for (var i = 0; i < DISHES.length; i++) if (DISHES[i].id === id) return DISHES[i];
    return null;
  }
  function track(name, payload) {
    if (window.Analytics && window.Analytics.track) window.Analytics.track(name, payload);
  }

  /* ---------- Toast（像素风轻提示，自动消失；可带一个动作按钮） ---------- */
  var toastTimer = null;
  function hideToast() {
    var el = $('toast');
    if (!el) return;
    el.classList.remove('show');
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    setTimeout(function () { if (!el.classList.contains('show')) el.hidden = true; }, 260);
  }
  function toast(msg, ms, actionLabel, action) {
    var el = $('toast');
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(document.createTextNode(msg));
    if (actionLabel && typeof action === 'function') {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-act';
      b.textContent = actionLabel;
      b.onclick = function (e) { e.stopPropagation(); action(); hideToast(); };
      el.appendChild(b);
    }
    el.hidden = false;
    el.classList.remove('show');
    /* 强制回流，保证连续两次 toast 也能重新播放动画 */
    void el.offsetHeight;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || 2400);
  }

  /* ---------- 返回栈（逐级返回，不丢挑菜列表 / 闯关位置） ---------- */
  /* 语义：navStack 是浏览历史。
     - 目标是栈顶 → 不动
     - 目标已在栈中 → 截断到那一层（等价于"回到那一屏"，如 guide→overview→guide）
     - 否则 → 入栈
     这样无论从返回键还是从菜篮图标/总览返回跳转，栈都不会出现重复层导致返回跑偏。 */
  var navStack = ['home'];
  function navPush(screen) {
    var top = navStack[navStack.length - 1];
    if (top === screen) return;
    var at = navStack.lastIndexOf(screen);
    if (at > -1) { navStack = navStack.slice(0, at + 1); return; }
    navStack.push(screen);
    if (navStack.length > 8) navStack.shift();
  }
  function navBack() {
    if (navStack.length > 1) navStack.pop();
    var target = navStack[navStack.length - 1];
    /* 回到的界面要按当前菜篮重新渲染，避免 DOM 陈旧 */
    navLock = true;
    try {
      if (target === 'select') renderDishes();
      else if (target === 'guide') { guideIndex = Math.min(guideIndex, Math.max(0, guideZones.length - 1)); renderGuide(); }
      else if (target === 'overview') renderOverview();
      showScreen(target);
    } finally { navLock = false; }
  }
  function navLabel() {
    var back = navStack[navStack.length - 2] || 'home';
    var name = { home: '返回首页', select: '返回挑菜', guide: '返回导览', overview: '返回清单' };
    return name[back] || '返回';
  }

  /* ---------- 购物车状态 ---------- */
  /* 读：必须是数组且元素为字符串；脏值（对象/数字/布尔/字符串）一律回退默认，
     失效 dish id 在启动时清洗，避免空白总览 + 虚假通关 */
  function loadJSON(k, def) {
    try {
      var raw = localStorage.getItem(k);
      if (raw === null) return def;
      var v = JSON.parse(raw);
      if (!Array.isArray(v)) return def;
      return v.filter(function (x) { return typeof x === 'string'; });
    } catch (e) { return def; }
  }
  /* 写：隐私模式 / 配额满时 localStorage.setItem 会抛异常，
     降级为内存态（本次会话仍可用）并一次性 Toast 提示，绝不让 UI 静默死亡 */
  var storageWarned = false;
  function persist(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      if (!storageWarned) {
        storageWarned = true;
        toast('当前浏览器无法保存菜篮（无痕模式或空间已满），关闭页面前请先导出清单图');
      }
      return false;
    }
  }
  var cart = new Set(loadJSON(CART_KEY, []).filter(function (id) { return !!dishById(id); }));
  var checked = new Set(loadJSON(CHECK_KEY, []));
  function saveCart() { persist(CART_KEY, Array.from(cart)); }
  function saveChecked() { persist(CHECK_KEY, Array.from(checked)); }

  /* I1：多标签页同步 —— 两个标签各开一份页面时，A 标签加菜只写了 localStorage，
     B 标签内存里的 Set 不会变；之后 B 标签任何一次保存都会用旧值整体覆盖 A 的菜篮
     （互相覆盖丢数据）。监听 storage 事件把变化同步进内存并重渲染当前屏。
     注意：storage 事件只在「其他标签写入」时触发，本标签的 persist 不触发，无回声环。 */
  var syncTimer = null;
  function setsEqual(a, arr) {
    return a.size === arr.length && arr.every(function (x) { return a.has(x); });
  }
  function syncFromStorage() {
    var newCart = loadJSON(CART_KEY, []).filter(function (id) { return !!dishById(id); });
    var newChecked = loadJSON(CHECK_KEY, []);
    if (setsEqual(cart, newCart) && setsEqual(checked, newChecked)) return;
    /* 原地更新：cart/checked 被大量闭包引用，重新赋值会让它们拿到旧对象 */
    cart.clear(); newCart.forEach(function (id) { cart.add(id); });
    checked.clear(); newChecked.forEach(function (k) { checked.add(k); });
    pruneChecked();
    rerenderAfterSync();
    toast('已同步其他标签页的菜篮', 2600);
  }
  function rerenderAfterSync() {
    renderStats();
    if (current.screen === 'select') {
      /* 局部更新每张卡，保住滚动位置 */
      var nodes = $('dishGrid').querySelectorAll('.dish-card');
      for (var i = 0; i < nodes.length; i++) {
        updateCard(nodes[i], nodes[i].getAttribute('data-id'));
      }
    } else if (current.screen === 'guide') {
      var sig = cartSignature();
      if (sig !== guideSig || guideZones.length === 0) {
        /* 菜篮构成变了：从头开始闯关，避免旧 guideIndex 指向不存在的区 */
        guideZones = buildGuideZones();
        guideIndex = 0;
        guideSig = sig;
      } else {
        guideZones = buildGuideZones();
      }
      if (guideZones.length === 0) { backToEdit(); return; }
      renderGuide();
    } else if (current.screen === 'overview') {
      if (cart.size === 0) { backToEdit(); return; }
      guideZones = buildGuideZones();
      guideSig = cartSignature();
      renderOverview();
    }
    refreshChrome();
  }
  /* 批量写入（如 A 标签连点加菜）会连发多个事件，合并成一次重渲染 */
  window.addEventListener('storage', function (e) {
    if (e.key !== CART_KEY && e.key !== CHECK_KEY) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncFromStorage, 120);
  });

  /* ---------- DOM ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var SCREEN_NAMES = ['home', 'select', 'guide', 'overview'];
  var screens = {}; SCREEN_NAMES.forEach(function (s) { screens[s] = $(s); });
  var backBtn = $('backBtn'), cartPill = $('cartPill'), cartCount = $('cartCount');
  var floatCheckout = $('floatCheckout'), floatCount = $('floatCount');

  var current = { screen: 'home', mode: null, dishes: [], label: '', dim: null, value: null };

  /* ---------- 静态图标注入 ---------- */
  /* B3：scale 只允许 {12,24,36,48}（12px 栅格整数倍），非栅格值会让像素字/图标发虚 */
  function injectStaticIcons() {
    var slots = {
      brandIco: ['barn', 24], backBtn: ['arrowL', 24], cartIco: ['basket', 24],
      searchIco: ['search', 24], diceIco: ['dice', 24], globeIco: ['globe', 24],
      refreshIco: ['refresh', 24], clipIco: ['clipboard', 24], prevIco: ['arrowL', 12],
      nextIco: ['arrowR', 12], ovIco: ['clipboard', 24], shareIco: ['share', 24],
      ovBackIco: ['arrowL', 12], flagIco: ['flag', 24], fcIco: ['basket', 24],
      shareHeadIco: ['clipboard', 24], copyIco: ['clipboard', 24], linkIco: ['share', 24],
      nmDiceIco: ['dice', 24], statIco: ['trophy', 24]
    };
    Object.keys(slots).forEach(function (id) {
      var el = $(id); if (!el) return;
      el.innerHTML = ico(slots[id][0], { scale: slots[id][1] });
    });
  }

  /* ---------- 屏幕切换 ---------- */
  var navLock = false;
  /* 顶栏/悬浮条的菜篮计数刷新——showScreen / toggleCart / 多标签同步共用 */
  function refreshChrome() {
    var showCart = cart.size > 0;
    cartPill.hidden = !showCart;
    cartCount.textContent = cart.size;
    floatCheckout.hidden = !((current.screen === 'home' || current.screen === 'select') && cart.size > 0);
    floatCount.textContent = cart.size;
  }
  function showScreen(name) {
    current.screen = name;
    SCREEN_NAMES.forEach(function (s) { screens[s].hidden = (s !== name); });
    backBtn.hidden = (name === 'home');
    if (!navLock) navPush(name);
    /* 必须先入栈再算 label：label 描述的是「再按一次返回会去哪」 */
    backBtn.setAttribute('aria-label', navLabel());
    refreshChrome();
    /* 切屏回顶：桌面端 .main 是滚动容器（G8），移动端是 window，两个都要归位 */
    var main = document.querySelector('.main');
    if (main && main.scrollTop) main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ---------- L1 首页（统一按钮 + 菜系折叠）---------- */
  function buildHome() {
    var typeGrid = $('typeGrid'); typeGrid.innerHTML = '';
    ['肉菜', '素菜', '汤羹', '主食'].forEach(function (tp) {
      var b = document.createElement('button');
      b.className = 'rbtn rand';
      /* G7：菜类块从「4 个黄块」改为纸底 + 类型色条，把唯一的强色让给主 CTA */
      b.style.setProperty('--bar', TYPE_BAR[tp] || '#B8AEA2');
      b.innerHTML = '<span class="btn-ico">' + ico(TYPE_ICON[tp], { scale: 24 }) + '</span>' + tp;
      b.onclick = function () { randomBy('type', tp); };
      typeGrid.appendChild(b);
    });
    var cuisineGrid = $('cuisineGrid'); cuisineGrid.innerHTML = '';
    var counts = {};
    DISHES.forEach(function (d) { counts[d.cuisine] = (counts[d.cuisine] || 0) + 1; });
    Object.keys(CUISINE_ICON).forEach(function (cu) {
      if (!counts[cu]) return; // 数据中无该菜系则省略（如意餐=0）
      var b = document.createElement('button');
      b.className = 'rbtn rand';
      b.innerHTML = '<span class="btn-ico">' + ico(CUISINE_ICON[cu], { scale: 24 }) + '</span>' + cu;
      b.onclick = function () { randomBy('cuisine', cu); };
      cuisineGrid.appendChild(b);
    });
    buildFarmBand();
    initSteps();
    renderStats();
  }

  /* G2：首屏像素农场场景带 —— 复用图标引擎摆一排农场物件，纯 DOM + CSS 动画 */
  function buildFarmBand() {
    var band = $('farmBand');
    if (!band || band.dataset.built) return;
    band.dataset.built = '1';
    var props = [
      ['barn', 4, 40, 48], ['wheat', 17, 46, 24], ['carrot', 25, 44, 24],
      ['leaf', 33, 46, 24], ['meat', 41, 42, 24], ['fish', 49, 38, 24],
      ['egg', 57, 44, 24], ['shrimp', 65, 40, 24], ['salt', 73, 44, 24],
      ['freeze', 81, 40, 24], ['rice', 89, 46, 24]
    ];
    props.forEach(function (p) {
      var s = document.createElement('span');
      s.className = 'fb-item';
      s.style.left = p[1] + '%';
      s.style.bottom = p[2] + 'px';
      s.innerHTML = ico(p[0], { scale: p[3] });
      band.appendChild(s);
    });
    for (var i = 0; i < 6; i++) {
      var sp = document.createElement('span');
      sp.className = 'fb-spark';
      sp.style.left = (8 + i * 16) + '%';
      sp.style.top = (10 + (i % 3) * 12) + 'px';
      sp.style.animationDelay = (i * .35) + 's';
      sp.innerHTML = ico('sparkle', { scale: 12 });
      band.appendChild(sp);
    }
  }

  /* G1：三步引导，可关闭且记住选择 */
  function initSteps() {
    var steps = $('steps');
    if (!steps) return;
    var dismissed = false;
    try { dismissed = localStorage.getItem('gp_steps_dismissed') === '1'; } catch (e) { }
    steps.hidden = dismissed;
    $('stepsClose').onclick = function () {
      steps.hidden = true;
      try { localStorage.setItem('gp_steps_dismissed', '1'); } catch (e) { }
      track('dismiss_steps', {});
    };
  }

  /* G4：首页「本周采购战绩」面板 —— 数据来自 analytics.js 的 gp_history */
  function renderStats() {
    var panel = $('statsPanel');
    if (!panel) return;
    var h = (window.Analytics && window.Analytics.history) ? window.Analytics.history() : null;
    if (!h || (!h.lists && !h.checks)) { panel.hidden = true; return; }
    panel.hidden = false;
    $('spLists').textContent = h.lists || 0;
    $('spItems').textContent = h.items || 0;
    $('spDays').textContent = (h.days || []).length;
    $('spChecks').textContent = h.checks || 0;
    var ids = Object.keys(h.dishes || {});
    if (ids.length) {
      var top = ids.sort(function (a, b) { return h.dishes[b] - h.dishes[a]; })[0];
      var d = dishById(top);
      $('spFav').hidden = false;
      $('spFav').querySelector('b').textContent = (d ? d.name : top) + ' ×' + h.dishes[top];
    } else {
      $('spFav').hidden = true;
    }
  }

  /* ---------- 搜索 ---------- */
  function doSearch(q) {
    q = (q || '').trim();
    var input = $('search');
    /* G6：空输入原来零反馈（点了「搜一搜」什么都没发生）→ 抖动 + Toast + 聚焦 */
    if (!q) {
      input.classList.remove('shake');
      void input.offsetWidth;   // 强制回流，保证连续两次也能重放动画
      input.classList.add('shake');
      toast('先输入想吃的菜名，或者让农场帮你摇几道～');
      input.focus();
      return;
    }
    var matches = DISHES.filter(function (d) {
      if (d.name.indexOf(q) > -1) return true;
      return (d.tags || []).some(function (t) { return t.indexOf(q) > -1; });
    });
    if (matches.length === 0) {
      $('noMatchQ').textContent = q;
      $('noMatch').hidden = false;
      return;
    }
    /* G6：离开首页时清掉陈旧的「没找到」 */
    $('noMatch').hidden = true;
    track('search', { q: q, results: matches.length });
    goSelect({ mode: 'search', dishes: matches, label: '「' + esc(q) + '」的结果', hint: '共 ' + matches.length + ' 道，挑你想要的加入菜篮～' });
  }

  /* ---------- 随机 ---------- */
  function pickRandom(list, n) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr.slice(0, Math.min(n, arr.length));
  }
  /* G15：随机四道原来是纯随机，可能全荤或全素（下厨体验差），也可能和上一批重复。
     约束：至少 1 荤 + 1 素；排除上一批（不够再放宽）。 */
  var lastRandomIds = [];
  function pickRandomConstrained(pool, n) {
    var cand = pool.filter(function (d) { return lastRandomIds.indexOf(d.id) === -1; });
    if (cand.length < n) cand = pool.slice();
    var meat = cand.filter(function (d) { return d.type !== '素菜'; });
    var veg = cand.filter(function (d) { return d.type === '素菜'; });
    /* 池子本身单一类型（如用户点了「素菜」）时放弃约束 */
    if (!meat.length || !veg.length) return pickRandom(cand, n);
    var out = [pickRandom(meat, 1)[0], pickRandom(veg, 1)[0]];
    var rest = cand.filter(function (d) { return out.indexOf(d) === -1; });
    out = out.concat(pickRandom(rest, Math.max(0, n - 2)));
    /* 打乱，避免固定的「肉-素-…」顺序 */
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out.filter(Boolean).slice(0, n);
  }
  function randomBy(dim, value) {
    var pool = DISHES.filter(function (d) { return d[dim] === value; });
    var chosen = pickRandomConstrained(pool, RANDOM_N);
    lastRandomIds = chosen.map(function (d) { return d.id; });
    var label = '<span class="btn-ico">' + ico((dim === 'type' ? TYPE_ICON : CUISINE_ICON)[value], { scale: 24 }) + '</span>' + esc(value);
    var hint = '为你随机了 ' + chosen.length + ' 道' + (pool.length < RANDOM_N ? '（该分类共 ' + pool.length + ' 道）' : '，不喜欢就换一批～');
    track('random', { dim: dim, value: value, n: chosen.length });
    goSelect({ mode: 'random', dishes: chosen, label: label, hint: hint, dim: dim, value: value });
  }
  function randomFour() {
    var chosen = pickRandomConstrained(DISHES, RANDOM_N);
    lastRandomIds = chosen.map(function (d) { return d.id; });
    track('random', { dim: 'all', value: 'all', n: chosen.length });
    goSelect({
      mode: 'random', dishes: chosen,
      label: '<span class="btn-ico">' + ico('dice', { scale: 24 }) + '</span>随便来四个',
      hint: '盲盒已开，挑挑看～不喜欢点「换一批」', dim: null, value: null
    });
  }

  /* ---------- L2 挑菜 ---------- */
  function goSelect(state) {
    current.mode = state.mode;
    current.dishes = state.dishes;
    current.label = state.label;
    current.dim = state.dim;
    current.value = state.value;
    $('selectTitle').innerHTML = state.label;
    $('selectHint').textContent = state.hint || '';
    $('rerollBtn').hidden = (state.mode !== 'random');
    renderDishes();
    showScreen('select');
  }

  function renderDishes() {
    var grid = $('dishGrid'); grid.innerHTML = '';
    current.dishes.forEach(function (d) {
      var card = document.createElement('div');
      card.className = 'dish-card' + (cart.has(d.id) ? ' in-cart' : '');
      card.setAttribute('data-id', esc(d.id));
      var zones = uniqueZones(d);
      /* 成品菜预览 = 纯文字：菜名 / 简介 / 类型·菜系 / 分区签；分区签仅文字+分区色 */
      var zonePills = zones.map(function (z) {
        var zz = zoneById(z);
        return '<span class="zone-mini" style="background:' + zoneTint(zz.color) + '">' +
          esc(zz.name) + '</span>';
      }).join('');
      var descLine = d.desc ? '<div class="dish-desc">' + esc(d.desc) + '</div>' : '';
      card.innerHTML =
        '<span class="pick">' + ico('check', { scale: 12, mono: '#FFF8EA' }) + '</span>' +
        '<div class="dish-name">' + esc(d.name) + '</div>' +
        descLine +
        '<div class="dish-meta"><i style="background:' + (TYPE_TINT[d.type] || '#EBD9B4') + '">' + esc(d.type) + '</i><i>' + esc(d.cuisine) + '</i></div>' +
        '<div class="dish-zones">' + zonePills + '</div>' +
        '<button class="add-btn" type="button">' +
        (cart.has(d.id) ? ico('check', { scale: 12, mono: '#FFF8EA' }) + '已在菜篮' : ico('plus', { scale: 12 }) + '加入菜篮') +
        '</button>';
      /* A5：整卡不再可点（易误触），唯一入口是 .add-btn */
      card.querySelector('.add-btn').onclick = function (e) {
        e.stopPropagation();
        toggleCart(d.id, card);
      };
      grid.appendChild(card);
    });
  }
  /* 局部更新单卡：不整表重渲染，保住滚动位置与焦点 */
  function updateCard(card, id) {
    if (!card) return;
    var inCart = cart.has(id);
    card.classList.toggle('in-cart', inCart);
    var btn = card.querySelector('.add-btn');
    if (btn) {
      btn.innerHTML = inCart
        ? ico('check', { scale: 12, mono: '#FFF8EA' }) + '已在菜篮'
        : ico('plus', { scale: 12 }) + '加入菜篮';
    }
  }
  function uniqueZones(d) {
    var s = {}; (d.items || []).forEach(function (i) { s[i.zone] = 1; });
    return ZONES.filter(function (z) { return s[z.id]; }).map(function (z) { return z.id; })
      .concat(Object.keys(s).filter(function (z) { return !ZONES.some(function (zz) { return zz.id === z; }); }));
  }

  function toggleCart(id, cardEl) {
    var adding = !cart.has(id);
    if (adding) cart.add(id); else cart.delete(id);
    saveCart();
    /* A7：移除菜品时，按差集清理"仅属于被移除菜"的 checked key，杜绝幽灵勾选 */
    if (!adding) pruneChecked();
    /* A5：局部更新单卡，不整表重渲染（保滚动 / 保焦点） */
    var card = cardEl || null;
    if (!card) {
      var nodes = $('dishGrid').querySelectorAll('.dish-card');
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute('data-id') === id) { card = nodes[i]; break; }
      }
    }
    updateCard(card, id);
    refreshChrome();
    var dname = (dishById(id) || {}).name || id;
    track(adding ? 'add_to_cart' : 'remove_from_cart', { dish: id, name: dname });
    /* A5：移除后给一次「撤销」机会 */
    if (!adding) {
      toast('已移出菜篮', 3200, '撤销', function () {
        if (!cart.has(id)) toggleCart(id, card);
      });
    }
  }
  /* 只保留仍被菜篮中某道菜引用的勾选键（键名与导览/总览共用 canonIng 归一，避免幽灵勾选） */
  function pruneChecked() {
    var keep = {};
    cart.forEach(function (cid) {
      var dd = dishById(cid); if (!dd) return;
      (dd.items || []).forEach(function (it) { keep[it.zone + '|' + canonIng(it.name)] = 1; });
    });
    var before = checked.size;
    Array.from(checked).forEach(function (k) { if (!keep[k]) checked.delete(k); });
    if (checked.size !== before) saveChecked();
  }

  /* ---------- 菜篮 → 分区聚合（供导览/总览共用）---------- */
  /* H11d：同义食材归一 —— 同一食材的不同写法（土豆片/土豆、鲜虾/虾仁…）在超市是同一件货，
     两道菜各写各的会裂成两行、勾选也会互相看不见。这里显式列出真同义组。
     注意不按图标 key 粗暴合并：鱼丸/虾丸、火锅底料/冒菜底料 是不同产品，不能混。
     规范名一律选数据集中高频、且 ING_ICON 有映射的那个。 */
  var ING_SYNONYM = {
    '土豆片': '土豆', '鲜虾': '虾', '虾仁': '虾', '大葱': '葱',
    '五花肉片': '五花肉', '蒜薹': '蒜苗', '火锅面': '方便面',
    '卷心菜': '包菜', '黑胡椒': '胡椒粉'
  };
  function canonIng(name) { return ING_SYNONYM[name] || name; }

  /* H2：同名食材合并原来是「先到先得」——10 组 optional、12 组 note 会互相覆盖，
     换一批菜的顺序文案就变了。现在改成确定性规则：
       optional：任一道菜标了「必买」就必买（保守，避免漏买）
       note   ：所有 note 去重后合并（信息不丢）
       from   ：保持加入顺序 */
  function buildGuideZones() {
    var byZone = {};
    cart.forEach(function (id) {
      var d = dishById(id); if (!d) return;
      (d.items || []).forEach(function (it) {
        var z = it.zone; if (!byZone[z]) byZone[z] = {};
        var key = canonIng(it.name);
        var cur = byZone[z][key];
        if (!cur) {
          byZone[z][key] = {
            name: key, optional: !!it.optional,
            notes: it.note ? [it.note] : [], from: []
          };
          cur = byZone[z][key];
        } else {
          /* optional：有任一道菜认为是必买，就按必买算 */
          if (!it.optional) cur.optional = false;
          /* note：去重合并 */
          if (it.note && cur.notes.indexOf(it.note) === -1) cur.notes.push(it.note);
        }
        if (cur.from.indexOf(d.name) === -1) cur.from.push(d.name);
      });
    });
    return ZONES.slice().sort(function (a, b) { return a.order - b.order; })
      .filter(function (z) { return byZone[z.id] && Object.keys(byZone[z.id]).length; })
      .map(function (z) {
        var items = Object.keys(byZone[z.id]).map(function (k) {
          var e = byZone[z.id][k];
          return { name: e.name, optional: e.optional, note: e.notes.join('；'), from: e.from };
        });
        return { zone: z, items: items };
      });
  }

  /* ---------- L3 市集导览（逐区闯关）---------- */
  var guideZones = []; var guideIndex = 0; var guideSig = '';
  function cartSignature() { return Array.from(cart).sort().join(','); }
  function goGuide() {
    if (cart.size === 0) return;
    /* A8：仅当菜篮内容变化时才重置闯关位置，翻页回来不丢进度 */
    var sig = cartSignature();
    if (sig !== guideSig || guideZones.length === 0) {
      guideZones = buildGuideZones();
      guideIndex = 0;
      guideSig = sig;
    }
    renderGuide();
    showScreen('guide');
    track('start_guide', { dishes: cart.size, zones: guideZones.length });
  }

  /* 总览 = 默认完成界面：一屏看全部分区，可导出清单图，不强制翻页 */
  var overviewFrom = 'home';
  function goOverview(from) {
    if (cart.size === 0) return;
    guideZones = buildGuideZones();
    guideSig = cartSignature();
    renderOverview();
    overviewFrom = from || 'home';
    $('ovBack').hidden = (overviewFrom === 'guide') ? false : true;
    showScreen('overview');
    track('view_overview', { dishes: cart.size, mode: 'overview' });
  }

  /* 导览进度条：第 x/y 区 + 全局已勾 a/b */
  function guideProgressHTML() {
    var doneAll = 0, totalAll = 0;
    guideZones.forEach(function (g) {
      totalAll += g.items.length;
      g.items.forEach(function (it) { if (checked.has(g.zone.id + '|' + it.name)) doneAll++; });
    });
    var dots = '';
    for (var i = 0; i < guideZones.length; i++) dots += '<span class="dot' + (i === guideIndex ? ' on' : '') + '" aria-hidden="true"></span>';
    return dots + '<span class="gp-num">第 ' + (guideIndex + 1) + '/' + guideZones.length + ' 区 · 已勾 ' + doneAll + '/' + totalAll + '</span>';
  }
  /* 本区小贴士：本区共 n 样 · 已勾 x/y */
  function zoneTipText(gz) {
    var zdone = 0;
    gz.items.forEach(function (it) { if (checked.has(gz.zone.id + '|' + it.name)) zdone++; });
    return '本区共 ' + gz.items.length + ' 样 · 已勾 ' + zdone + '/' + gz.items.length +
      ' · 在 ' + gz.zone.name + '区找齐后打勾 ✓';
  }

  function renderGuide() {
    var gz = guideZones[guideIndex];
    var badge = $('zoneBadge'), prog = $('guideProgress'), page = $('zonePage');
    /* H8：进度变化对读屏播报 */
    if (!prog.getAttribute('aria-live')) prog.setAttribute('aria-live', 'polite');
    if (!gz) { page.innerHTML = '<div class="zone-empty">菜篮是空的，先去挑几道菜吧～</div>'; return; }
    var z = gz.zone;
    badge.style.setProperty('--zone', z.color);
    /* G12：分区底色预混成实色写进 --zone-tint，替代 color-mix()（旧内核无该函数会整块丢底色） */
    badge.style.setProperty('--zone-tint', zoneTint(z.color, .42));
    badge.innerHTML = '<span class="zb-ico">' + zoneIcon(z.id) + '</span><span class="zb-name">' + esc(z.name) + '区</span>';
    prog.innerHTML = guideProgressHTML();

    var html = '<div class="zone-page-inner px-notch" style="--zone:' + z.color +
      ';--zone-tint:' + zoneTint(z.color, .14) + '">';
    html += '<p class="zone-page-tip" id="zoneTip">' + zoneTipText(gz) + '</p>';
    gz.items.forEach(function (it) {
      var key = z.id + '|' + it.name;
      var on = checked.has(key);
      var tags = (it.optional ? '<span class="opt">可选</span>' : '') + (it.note ? '<span class="note">' + esc(it.note) + '</span>' : '');
      var from = it.from.length ? '<span class="from">用于：' + esc(it.from.join('、')) + '</span>' : '';
      /* E1：必须是 button 才能被键盘/读屏操作（原来是 div，核心流程对键盘用户完全不可用） */
      html += '<button type="button" class="item' + (on ? ' checked' : '') + '" role="checkbox" aria-checked="' +
        (on ? 'true' : 'false') + '" data-key="' + esc(key) + '">' +
        '<span class="ing-ico">' + ingIcon(it.name, z.id) + '</span>' +
        '<span class="check">' + (on ? ico('check', { scale: 12, mono: '#FFF8EA' }) : '') + '</span>' +
        '<span class="item-name">' + esc(it.name) + '</span>' + tags + from + '</button>';
    });
    html += '</div>';
    page.innerHTML = html;
    bindItems(page);
    $('prevZone').classList.toggle('is-disabled', guideIndex === 0);
    $('nextZone').classList.toggle('is-disabled', guideIndex === guideZones.length - 1);
  }

  /* ---------- L3b 全部清单 / 通关态 ---------- */
  function renderOverview() {
    var page = $('ovPage'), prog = $('ovProgress');
    if (!prog.getAttribute('aria-live')) prog.setAttribute('aria-live', 'polite');
    if (cart.size === 0) { page.innerHTML = '<div class="zone-empty">菜篮是空的，先去挑几道菜吧～</div>'; prog.innerHTML = ''; return; }
    var gzs = guideZones.length ? guideZones : buildGuideZones();
    var total = 0, done = 0;
    var html = '';
    gzs.forEach(function (gz) {
      var z = gz.zone;
      html += '<div class="ov-zone px-notch" style="--zone:' + z.color +
        ';--zone-tint:' + zoneTint(z.color, .14) + '">';
      html += '<div class="ov-zone-head"><span class="zb-ico">' + zoneIcon(z.id) + '</span>' + esc(z.name) + '区 <span class="ov-zone-n">(' + gz.items.length + ')</span></div>';
      gz.items.forEach(function (it) {
        var key = z.id + '|' + it.name;
        var on = checked.has(key); total++; if (on) done++;
        var tags = (it.optional ? '<span class="opt">可选</span>' : '') + (it.note ? '<span class="note">' + esc(it.note) + '</span>' : '');
        var from = it.from.length ? '<span class="from">用于：' + esc(it.from.join('、')) + '</span>' : '';
        /* E1：button + role=checkbox + aria-checked，键盘可聚焦、空格可勾选、读屏可播报 */
        html += '<button type="button" class="item' + (on ? ' checked' : '') + '" role="checkbox" aria-checked="' +
          (on ? 'true' : 'false') + '" data-key="' + esc(key) + '">' +
          '<span class="ing-ico">' + ingIcon(it.name, z.id) + '</span>' +
          '<span class="check">' + (on ? ico('check', { scale: 12, mono: '#FFF8EA' }) : '') + '</span>' +
          '<span class="item-name">' + esc(it.name) + '</span>' + tags + from + '</button>';
      });
      html += '</div>';
    });
    page.innerHTML = html;
    bindItems(page);
    prog.innerHTML = '<span class="gp-num">已勾 ' + done + '/' + total + '</span>';
    /* E2：「完成采购」加门槛——一项都没勾时禁用，避免误触直接通关 */
    $('ovDone').disabled = (done === 0);
    $('ovDone').setAttribute('aria-disabled', done === 0 ? 'true' : 'false');
    $('ovDone').title = done === 0 ? '先在清单里勾选至少一样食材' : '';
  }

  /* E2：打勾过程中同步刷新「完成采购」的可用状态 */
  function refreshDoneBtn(page) {
    if (current.screen !== 'overview') return;
    var done = page.querySelectorAll('.item.checked').length;
    $('ovDone').disabled = (done === 0);
    $('ovDone').setAttribute('aria-disabled', done === 0 ? 'true' : 'false');
    $('ovDone').title = done === 0 ? '先在清单里勾选至少一样食材' : '';
  }

  function completeList() {
    var gzs = guideZones.length ? guideZones : buildGuideZones();
    var total = 0; gzs.forEach(function (gz) { total += gz.items.length; });
    var done = 0; gzs.forEach(function (gz) {
      gz.items.forEach(function (it) { if (checked.has(gz.zone.id + '|' + it.name)) done++; });
    });
    var page = $('ovPage');
    page.innerHTML = '<div class="done-card px-notch">' +
      '<div class="done-emoji">' + ico('trophy', { scale: 48 }) + '</div>' +
      '<div class="done-title">采购通关！</div>' +
      '<div class="done-sub">共 ' + cart.size + ' 道菜 · ' + total + ' 样食材 已收入囊中</div>' +
      '<div class="done-stat">本次勾选 ' + done + '/' + total + ' 样</div>' +
      '<button id="doneImg" class="rbtn primary rbtn-block" style="margin-top:12px;">' +
      '<span class="btn-ico">' + ico('share', { scale: 24 }) + '</span>生成清单图</button>' +
      '<button id="doneNew" class="rbtn ghost rbtn-block" style="margin-top:10px;">' +
      '<span class="btn-ico">' + ico('barn', { scale: 24 }) + '</span>清空菜篮 · 新一单</button>' +
      '<p class="done-tip">把清单图分享给好友，一起买菜不迷路</p>' +
      '</div>';
    $('ovProgress').innerHTML = '';
    $('ovDone').disabled = true;
    $('ovDone').setAttribute('aria-disabled', 'true');
    $('ovBack').hidden = true;
    $('doneImg').onclick = generateListImage;
    /* E2：通关态可恢复——提供「清空菜篮·新一单」出口 */
    $('doneNew').onclick = function () {
      cart.clear(); saveCart();
      pruneChecked();
      guideZones = []; guideIndex = 0; guideSig = '';
      showScreen('home');
      toast('已清空菜篮，开始新的一单吧');
      track('new_order', {});
    };
    track('complete_list', { dishes: cart.size, items: total, checked: done });
  }

  /* ---------- 生成清单图（像素风 PNG 导出）---------- */
  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (x) { return x + x; }).join('');
    return { r: parseInt(h.substr(0, 2), 16), g: parseInt(h.substr(2, 2), 16), b: parseInt(h.substr(4, 2), 16) };
  }
  function mix(hex1, hex2, pct) { // pct = hex1 占比
    var a = hexToRgb(hex1), b = hexToRgb(hex2);
    var r = Math.round(a.r * pct + b.r * (1 - pct));
    var g = Math.round(a.g * pct + b.g * (1 - pct));
    var bl = Math.round(a.b * pct + b.b * (1 - pct));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  /* 分区底色：JS 预混实色，替代 color-mix()（旧内核无该函数时底色会整块消失，见 G12） */
  function zoneTint(color, pct) {
    return mix(color || '#B8AEA2', '#FFF1D6', pct === undefined ? .42 : pct);
  }
  function drawPxIcon(ctx, name, x, y, px, mono) {
    if (!window.PXIcon) return;
    var rows = window.PXIcon.ICONS[name], pal = window.PXIcon.PALETTE;
    if (!rows) return;
    for (var r = 0; r < rows.length; r++) {
      for (var c = 0; c < rows[r].length; c++) {
        var ch = rows[r].charAt(c);
        if (ch === '.') continue;
        ctx.fillStyle = mono || pal[ch] || '#000000';
        ctx.fillRect(x + c * px, y + r * px, px, px);
      }
    }
  }
  /* G14：iOS Safari 的 canvas 面积上限约 16.7M px，超过会静默返回空白画布。
     满篮 104 道 ≈ 1600×9712 = 15.5M px，已贴近上限，必须做护栏。 */
  var CANVAS_MAX_PX = 16700000;
  function generateListImage() {
    var gzs = guideZones.length ? guideZones : buildGuideZones();
    if (!gzs.length) { toast('菜篮是空的，先去挑几道菜吧'); return; }
    /* G14/G17：生成期间给按钮上「生成中…」态，避免重复点击 */
    var btn = $('ovImg');
    var label = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-ico">' + ico('refresh', { scale: 24 }) + '</span>生成中…';
    }
    var restore = function () { if (btn) { btn.disabled = false; btn.innerHTML = label; } };
    var draw = function () {
      try { drawListImage(gzs); }
      catch (e) { toast('清单图生成失败，请重试或直接截图保存'); }
      finally { restore(); }
    };
    if (document.fonts && document.fonts.load) {
      var f = document.fonts.load('24px ' + PX_FONT)
        .then(function () { return document.fonts.load('16px ' + PX_FONT); })
        .then(function () { return document.fonts.load('12px ' + PX_FONT); });
      Promise.race([f, new Promise(function (res) { setTimeout(res, 2000); })]).then(draw, draw);
    } else { draw(); }
  }
  function drawListImage(gzs) {
    var S = 2, W = 800, pad = 36;
    var lineH = 34, zoneHeadH = 46, zoneGap = 14, headerH = 108, footerH = 48;
    var total = 0; gzs.forEach(function (gz) { total += gz.items.length; });
    var H = headerH + footerH + pad * 2;
    gzs.forEach(function (gz) { H += zoneHeadH + gz.items.length * lineH + zoneGap; });
    /* G14：面积超限时降到 1x（面积降 75%），保证一定能出图而不是空白 */
    if (W * S * H * S > CANVAS_MAX_PX) S = 1;
    var cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    var c = cv.getContext('2d');
    if (!c) { toast('当前浏览器不支持画布导出，请直接截图保存'); return; }
    c.scale(S, S);
    c.imageSmoothingEnabled = false;

    /* 底：纸色 + 细棋盘 */
    c.fillStyle = '#FFF8EA'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(59,42,32,.035)';
    for (var y0 = 0; y0 < H; y0 += 16) {
      for (var x0 = (y0 / 16) % 2 ? 8 : 0; x0 < W; x0 += 16) c.fillRect(x0, y0, 8, 8);
    }

    /* 头部 */
    c.textBaseline = 'top';
    drawPxIcon(c, 'barn', pad, 26, 3);
    c.fillStyle = '#3B2A20'; c.font = '24px ' + PX_FONT;
    c.fillText('像素农场采购记', pad + 44, 30);
    c.fillStyle = '#7A6255'; c.font = '12px ' + PX_FONT;
    c.fillText(new Date().toLocaleDateString('zh-CN') + ' · 今日采购清单', pad + 44, 64);
    c.textAlign = 'right';
    c.fillStyle = '#B83A2B'; c.font = '12px ' + PX_FONT;
    c.fillText(cart.size + ' 道菜 · ' + total + ' 样食材', W - pad, 30);
    c.textAlign = 'left';
    c.fillStyle = '#3B2A20';
    c.fillRect(pad, 92, W - pad * 2, 3);

    /* 分区 */
    var y = headerH;
    gzs.forEach(function (gz) {
      var z = gz.zone;
      /* 分区头：色条 + 2px 墨框 */
      c.fillStyle = mix(z.color, '#FFF1D6', .5);
      c.fillRect(pad, y, W - pad * 2, zoneHeadH - 6);
      c.strokeStyle = '#3B2A20'; c.lineWidth = 2;
      c.strokeRect(pad + 1, y + 1, W - pad * 2 - 2, zoneHeadH - 8);
      drawPxIcon(c, ZONE_ICON[z.id] || 'box', pad + 12, y + 10, 2);
      c.fillStyle = '#3B2A20'; c.font = '16px ' + PX_FONT;
      c.fillText(z.name + '区', pad + 44, y + 12);
      c.textAlign = 'right'; c.fillStyle = '#7A6255'; c.font = '12px ' + PX_FONT;
      c.fillText(gz.items.length + ' 样', W - pad - 12, y + 16);
      c.textAlign = 'left';
      y += zoneHeadH;
      gz.items.forEach(function (it) {
        var key = z.id + '|' + it.name; var on = checked.has(key);
        /* 像素复选框 */
        c.strokeStyle = '#3B2A20'; c.lineWidth = 2;
        c.strokeRect(pad + 10, y + 9, 16, 16);
        if (on) { c.fillStyle = '#5A8A3C'; c.fillRect(pad + 11, y + 10, 14, 14); drawPxIcon(c, 'check', pad + 12, y + 11, 1, '#FFF8EA'); }
        /* 食材像素小图标（12×12 @2px = 24px，与屏幕端 .ing-ico 同款） */
        drawPxIcon(c, ingIconKey(it.name, z.id), pad + 34, y + 5, 2);
        var nm = it.name + (it.optional ? '（可选）' : '');
        c.fillStyle = on ? '#7A6255' : '#3B2A20';
        c.font = '16px ' + PX_FONT;
        c.fillText(nm, pad + 66, y + 8);
        if (it.from.length > 1) {
          c.textAlign = 'right'; c.fillStyle = '#7A6255'; c.font = '12px ' + PX_FONT;
          c.fillText('用于 ' + it.from.length + ' 道菜', W - pad - 10, y + 12);
          c.textAlign = 'left';
        }
        y += lineH;
      });
      y += zoneGap;
    });

    /* 页脚 */
    c.textAlign = 'center'; c.fillStyle = '#7A6255'; c.font = '12px ' + PX_FONT;
    c.fillText('由 像素农场采购记 生成 · 去任意超市都能用', W / 2, H - footerH / 2 + 4);
    c.textAlign = 'left';
    /* G17：toDataURL 可能抛异常或返回空串（隐私模式 / 内存不足）——
       原来会直接弹出一张破图且零反馈，现在校验长度并 Toast 告知 */
    var url = '';
    try { url = cv.toDataURL('image/png'); } catch (e) { url = ''; }
    if (!url || url.length < 5000) {
      toast('清单图生成失败，请重试或直接截图保存');
      return;
    }
    showImageModal(url);
    /* H10：画布归零，尽快释放这块可能上千万像素的内存 */
    cv.width = cv.height = 1;
    track('generate_image', { dishes: cart.size, items: total });
  }
  /* G10/G11/H10：分享弹层 —— 锁背景滚动、role=dialog、Esc 关闭、焦点陷阱、
     微信内置浏览器降级提示、关闭后立刻释放 dataURL */
  var lastFocus = null;
  function showImageModal(url) {
    lastFocus = document.activeElement;
    var img = $('shareImg');
    img.src = url;
    /* H7：弹层里长图被限高，点一下可全屏看原图 */
    img.onclick = function () {
      var w = window.open('', '_blank');
      if (w) { w.document.write('<title>采购清单图</title><body style="margin:0;background:#3B2A20"><img src="' + url + '" style="display:block;width:100%;image-rendering:pixelated"></body>'); w.document.close(); }
    };
    $('shareModal').hidden = false;
    document.body.classList.add('no-scroll');
    var isWeChat = /MicroMessenger/i.test(navigator.userAgent);
    $('wechatHint').hidden = !isWeChat;
    var nat = $('shareNative');
    if (nat) {
      nat.disabled = isWeChat;
      nat.textContent = isWeChat ? '分享到手机（请用浏览器打开）' : '分享到手机';
    }
    var x = $('shareCloseX');
    if (x) x.focus();
  }
  function closeShare() {
    $('shareModal').hidden = true;
    document.body.classList.remove('no-scroll');
    /* H10：弹层一关就释放 1.3MB 的 dataURL，不让它滞留在内存里 */
    $('shareImg').removeAttribute('src');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }
  /* G10：Esc 关闭 + Tab 焦点陷阱 */
  document.addEventListener('keydown', function (e) {
    var modal = $('shareModal');
    if (!modal || modal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeShare(); return; }
    if (e.key === 'Tab') {
      var f = modal.querySelectorAll('button:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  function saveShareImage() {
    var a = document.createElement('a');
    a.href = $('shareImg').src;
    a.download = '采购清单_' + new Date().toISOString().slice(0, 10) + '.png';
    a.click();
  }
  function nativeShareImage() {
    try {
      fetch($('shareImg').src).then(function (r) { return r.blob(); }).then(function (blob) {
        var file = new File([blob], '采购清单.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: '我的采购清单', text: '今晚买这些～' });
        } else { saveShareImage(); }
      }).catch(function () { saveShareImage(); });
    } catch (e) { saveShareImage(); }
  }

  /* 统一刷新进度：导览 → 「第 x/y 区 · 已勾 a/b」+ 本区贴士；总览 → 「已勾 a/b」 */
  function refreshProgress(page) {
    var total = page.querySelectorAll('.item').length;
    var done = page.querySelectorAll('.item.checked').length;
    if (current.screen === 'overview') {
      $('ovProgress').innerHTML = '<span class="gp-num">已勾 ' + done + '/' + total + '</span>';
      refreshDoneBtn(page);
    } else if (current.screen === 'guide') {
      $('guideProgress').innerHTML = guideProgressHTML();
      var gz = guideZones[guideIndex];
      var tip = $('zoneTip');
      if (gz && tip) tip.textContent = zoneTipText(gz);
    }
  }

  function bindItems(page) {
    Array.prototype.forEach.call(page.querySelectorAll('.item'), function (el) {
      el.onclick = function () {
        var key = el.getAttribute('data-key');
        var on = !checked.has(key);
        if (on) checked.add(key); else checked.delete(key);
        saveChecked();
        el.className = 'item' + (on ? ' checked' : '');
        el.setAttribute('aria-checked', on ? 'true' : 'false');
        el.querySelector('.check').innerHTML = on ? ico('check', { scale: 12, mono: '#FFF8EA' }) : '';
        /* A6：打勾即反馈——轻震动 + 进度数字即时刷新 */
        if (on && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { } }
        refreshProgress(page);
        /* G3：核心打勾行为补埋点（旧版因 supabase 配置为空，送达率 0%） */
        if (on) track('check_item', { key: key });
      };
    });
  }

  /* A3/A8：从总览返回——来自导览则重渲染导览（DOM 不再陈旧）；否则回到挑菜页 */
  function backToEdit() {
    if (overviewFrom === 'guide' || current.dishes && current.dishes.length) {
      if (guideZones.length === 0) guideZones = buildGuideZones();
      guideIndex = Math.min(guideIndex, Math.max(0, guideZones.length - 1));
      renderGuide();
      showScreen('guide');
    } else {
      showScreen('home');
    }
  }

  /* ---------- H3：字号档位（标准 12px / 大字 16px），记住选择 ---------- */
  (function initFontSize() {
    var root = document.documentElement;
    var btn = $('fsToggle');
    var apply = function (mode) {
      if (mode === 'lg') { root.setAttribute('data-fs', 'lg'); btn.textContent = 'A+'; btn.setAttribute('aria-label', '当前大字，点击切回标准字号'); }
      else { root.removeAttribute('data-fs'); btn.textContent = 'A'; btn.setAttribute('aria-label', '当前标准字号，点击切换大字'); }
    };
    var saved = null;
    try { saved = localStorage.getItem('gp_fs'); } catch (e) { }
    apply(saved === 'lg' ? 'lg' : 'std');
    btn.onclick = function () {
      var next = root.getAttribute('data-fs') === 'lg' ? 'std' : 'lg';
      apply(next);
      try { localStorage.setItem('gp_fs', next); } catch (e) { }
      track('toggle_font_size', { mode: next });
    };
  })();

  /* ---------- 事件绑定 ---------- */
  $('searchForm').addEventListener('submit', function (e) { e.preventDefault(); doSearch($('search').value); });
  /* G6：搜索无结果时给两个真出口 */
  $('nmRandom').onclick = function () { $('noMatch').hidden = true; randomFour(); };
  $('nmClear').onclick = function () {
    $('noMatch').hidden = true;
    $('search').value = '';
    $('search').focus();
  };
  $('randomFour').onclick = randomFour;
  $('rerollBtn').onclick = function () {
    if (current.mode === 'random') {
      if (current.dim) randomBy(current.dim, current.value);
      else randomFour();
    }
  };
  backBtn.onclick = function () {
    navBack();
  };
  // 菜篮图标：导览中→总览；总览中→逐区闯关；首页/挑菜→总览（改单路径不断）
  cartPill.onclick = function () {
    if (current.screen === 'guide') { goOverview('guide'); }
    else if (current.screen === 'overview') { goGuide(); }
    else { goOverview('home'); }
  };
  /* A3：必须传字符串来源，不能把 MouseEvent 当 from 传（否则返回路径断） */
  floatCheckout.onclick = function () { goOverview('select'); };
  $('cuisineToggle').onclick = function () {
    var w = $('cuisineWrap'); w.hidden = !w.hidden;
    var open = !w.hidden;
    $('cuisineToggle').classList.toggle('open', open);
    /* H8：折叠状态对读屏可见 */
    $('cuisineToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  $('prevZone').onclick = function () { if (guideIndex > 0) { guideIndex--; renderGuide(); } };
  $('nextZone').onclick = function () { if (guideIndex < guideZones.length - 1) { guideIndex++; renderGuide(); } };
  $('viewOverview').onclick = function () { goOverview('guide'); };
  /* G5：复制文字清单 / 复制分享链接 */
  $('ovCopy').onclick = copyTextList;
  $('ovLink').onclick = copyShareLink;
  /* A8：总览里勾选后返回导览，必须重渲染，否则导览 DOM 是旧的 */
  $('ovBack').onclick = function () {
    if (overviewFrom === 'guide') {
      if (guideZones.length === 0) guideZones = buildGuideZones();
      guideIndex = Math.min(guideIndex, Math.max(0, guideZones.length - 1));
      renderGuide();
      showScreen('guide');
    } else {
      backToEdit();
    }
  };
  $('ovDone').onclick = completeList;
  $('ovImg').onclick = generateListImage;
  $('shareClose').onclick = closeShare;
  $('shareBackdrop').onclick = closeShare;
  $('shareSave').onclick = saveShareImage;
  $('shareNative').onclick = nativeShareImage;
  $('shareCopy').onclick = copyTextList;
  $('shareLink').onclick = copyShareLink;

  /* ---------- 启动 ---------- */
  injectStaticIcons();
  buildHome();
  showScreen('home');
  /* G5：深链还原菜篮（#m=dish_id1,dish_id2）——放在 showScreen('home') 之后，
     这样 navStack 是 ['home','overview']，返回键能正确回首页 */
  restoreFromHash();
  track('open_app');

  /* G13：注册 Service Worker，之后完全离线可用。
     file:// 协议下注册会抛错，用 protocol 判断跳过。 */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 静默：不支持就算了 */ });
    });
  }

  /* G5：深链还原 —— 分享链接带 #m=菜id，打开即是挑好的清单 */
  function restoreFromHash() {
    var m = /[#&]m=([A-Za-z0-9_,]+)/.exec(location.hash || '');
    if (!m) return;
    var ids = m[1].split(',').filter(function (id) { return !!dishById(id); });
    if (!ids.length) return;
    cart.clear();
    ids.forEach(function (id) { cart.add(id); });
    saveCart();
    guideZones = []; guideIndex = 0; guideSig = '';   // 强制重建导览
    track('restore_from_link', { n: ids.length });
    if (cart.size > 0) {
      goOverview('home');
      toast('已从分享链接还原 ' + cart.size + ' 道菜');
    }
  }

  /* G5：文字清单（微信等场景发图不便，文字更好粘贴） */
  function buildTextList() {
    var gzs = guideZones.length ? guideZones : buildGuideZones();
    var lines = ['【像素农场采购记】' + cart.size + ' 道菜 · ' + new Date().toLocaleDateString('zh-CN')];
    gzs.forEach(function (gz) {
      lines.push('');
      lines.push('— ' + gz.zone.name + '区（' + gz.items.length + ' 样）—');
      gz.items.forEach(function (it) {
        lines.push((checked.has(gz.zone.id + '|' + it.name) ? '[x] ' : '[ ] ') +
          it.name + (it.optional ? '（可选）' : ''));
      });
    });
    lines.push('');
    lines.push('由 像素农场采购记 生成');
    return lines.join('\n');
  }
  function fallbackCopy(text, cb) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) cb(); else toast('复制失败，请手动选择文字');
    } catch (e) { toast('复制失败，请手动选择文字'); }
  }
  function copyText(text, okMsg) {
    var ok = function () { toast(okMsg || '已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text, ok); });
    } else { fallbackCopy(text, ok); }
  }
  function copyTextList() {
    if (cart.size === 0) { toast('菜篮是空的，先挑几道菜'); return; }
    copyText(buildTextList(), '文字清单已复制，可直接粘贴到微信');
    track('copy_text_list', { dishes: cart.size });
  }
  /* G5：复制带菜篮的分享链接 */
  function copyShareLink() {
    if (cart.size === 0) { toast('菜篮是空的，先挑几道菜'); return; }
    var base = location.origin + location.pathname;
    var url = base + '#m=' + Array.from(cart).join(',');
    copyText(url, '分享链接已复制，好友打开就是这份清单');
    track('copy_share_link', { dishes: cart.size });
  }

  /* 暴露给控制台/调试 */
  window.__app = { DATA: DATA, cart: cart, goGuide: goGuide, goOverview: goOverview, generateListImage: generateListImage };
})();
