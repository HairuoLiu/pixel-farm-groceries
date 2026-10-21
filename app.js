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
  var CUISINE_ICON = { '中国家常': 'barn', '川渝': 'chili', '粤式': 'shrimp', '日料': 'sushi', '西餐': 'burger', '意餐': 'pasta' };
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
  });
  /* 分区色覆盖为农场 palette */
  ZONES.forEach(function (z) { if (ZONE_COLOR[z.id]) z.color = ZONE_COLOR[z.id]; });

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
      shareHeadIco: ['clipboard', 24]
    };
    Object.keys(slots).forEach(function (id) {
      var el = $(id); if (!el) return;
      el.innerHTML = ico(slots[id][0], { scale: slots[id][1] });
    });
  }

  /* ---------- 屏幕切换 ---------- */
  var navLock = false;
  function showScreen(name) {
    current.screen = name;
    SCREEN_NAMES.forEach(function (s) { screens[s].hidden = (s !== name); });
    backBtn.hidden = (name === 'home');
    if (!navLock) navPush(name);
    /* 必须先入栈再算 label：label 描述的是「再按一次返回会去哪」 */
    backBtn.setAttribute('aria-label', navLabel());
    var showCart = cart.size > 0;
    cartPill.hidden = !showCart;
    cartCount.textContent = cart.size;
    floatCheckout.hidden = !((name === 'home' || name === 'select') && cart.size > 0);
    floatCount.textContent = cart.size;
    window.scrollTo(0, 0);
  }

  /* ---------- L1 首页（统一按钮 + 菜系折叠）---------- */
  function buildHome() {
    var typeGrid = $('typeGrid'); typeGrid.innerHTML = '';
    ['肉菜', '素菜', '汤羹', '主食'].forEach(function (tp) {
      var b = document.createElement('button');
      b.className = 'rbtn rand';
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
  }

  /* ---------- 搜索 ---------- */
  function doSearch(q) {
    q = (q || '').trim();
    if (!q) return;
    var matches = DISHES.filter(function (d) {
      if (d.name.indexOf(q) > -1) return true;
      return (d.tags || []).some(function (t) { return t.indexOf(q) > -1; });
    });
    if (matches.length === 0) {
      $('noMatchQ').textContent = q;
      $('noMatch').hidden = false;
      return;
    }
    $('noMatch').hidden = true;
    track('search', { q: q, results: matches.length });
    goSelect({ mode: 'search', dishes: matches, label: '「' + q + '」的结果', hint: '共 ' + matches.length + ' 道，挑你想要的加入菜篮～' });
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
  function randomBy(dim, value) {
    var pool = DISHES.filter(function (d) { return d[dim] === value; });
    var chosen = pickRandom(pool, RANDOM_N);
    var label = '<span class="btn-ico">' + ico((dim === 'type' ? TYPE_ICON : CUISINE_ICON)[value], { scale: 24 }) + '</span>' + value;
    var hint = '为你随机了 ' + chosen.length + ' 道' + (pool.length < RANDOM_N ? '（该分类共 ' + pool.length + ' 道）' : '，不喜欢就换一批～');
    track('random', { dim: dim, value: value, n: chosen.length });
    goSelect({ mode: 'random', dishes: chosen, label: label, hint: hint, dim: dim, value: value });
  }
  function randomFour() {
    var chosen = pickRandom(DISHES, RANDOM_N);
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
      card.setAttribute('data-id', d.id);
      var zones = uniqueZones(d);
      /* 成品菜预览 = 纯文字：菜名 / 简介 / 类型·菜系 / 分区签；分区签仅文字+分区色 */
      var zonePills = zones.map(function (z) {
        var zz = zoneById(z);
        return '<span class="zone-mini" style="background:' + zoneTint(zz.color) + '">' +
          zz.name + '</span>';
      }).join('');
      var descLine = d.desc ? '<div class="dish-desc">' + d.desc + '</div>' : '';
      card.innerHTML =
        '<span class="pick">' + ico('check', { scale: 12, mono: '#FFF8EA' }) + '</span>' +
        '<div class="dish-name">' + d.name + '</div>' +
        descLine +
        '<div class="dish-meta"><i style="background:' + (TYPE_TINT[d.type] || '#EBD9B4') + '">' + d.type + '</i><i>' + d.cuisine + '</i></div>' +
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
    var showCart = cart.size > 0;
    cartPill.hidden = !showCart; cartCount.textContent = cart.size;
    floatCheckout.hidden = !((current.screen === 'home' || current.screen === 'select') && cart.size > 0);
    floatCount.textContent = cart.size;
    var dname = (dishById(id) || {}).name || id;
    track(adding ? 'add_to_cart' : 'remove_from_cart', { dish: id, name: dname });
    /* A5：移除后给一次「撤销」机会 */
    if (!adding) {
      toast('已移出菜篮', 3200, '撤销', function () {
        if (!cart.has(id)) toggleCart(id, card);
      });
    }
  }
  /* 只保留仍被菜篮中某道菜引用的勾选键 */
  function pruneChecked() {
    var keep = {};
    cart.forEach(function (cid) {
      var dd = dishById(cid); if (!dd) return;
      (dd.items || []).forEach(function (it) { keep[it.zone + '|' + it.name] = 1; });
    });
    var before = checked.size;
    Array.from(checked).forEach(function (k) { if (!keep[k]) checked.delete(k); });
    if (checked.size !== before) saveChecked();
  }

  /* ---------- 菜篮 → 分区聚合（供导览/总览共用）---------- */
  function buildGuideZones() {
    var byZone = {};
    cart.forEach(function (id) {
      var d = dishById(id); if (!d) return;
      (d.items || []).forEach(function (it) {
        var z = it.zone; if (!byZone[z]) byZone[z] = {};
        var key = it.name;
        if (!byZone[z][key]) byZone[z][key] = { name: it.name, optional: !!it.optional, note: it.note || '', from: [] };
        if (byZone[z][key].from.indexOf(d.name) === -1) byZone[z][key].from.push(d.name);
      });
    });
    return ZONES.slice().sort(function (a, b) { return a.order - b.order; })
      .filter(function (z) { return byZone[z.id] && Object.keys(byZone[z.id]).length; })
      .map(function (z) {
        var items = Object.keys(byZone[z.id]).map(function (k) { return byZone[z.id][k]; });
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
    for (var i = 0; i < guideZones.length; i++) dots += '<span class="dot' + (i === guideIndex ? ' on' : '') + '"></span>';
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
    if (!gz) { page.innerHTML = '<div class="zone-empty">菜篮是空的，先去挑几道菜吧～</div>'; return; }
    var z = gz.zone;
    badge.style.setProperty('--zone', z.color);
    badge.innerHTML = '<span class="zb-ico">' + zoneIcon(z.id) + '</span><span class="zb-name">' + z.name + '区</span>';
    prog.innerHTML = guideProgressHTML();

    var html = '<div class="zone-page-inner px-notch" style="--zone:' + z.color + '">';
    html += '<p class="zone-page-tip" id="zoneTip">' + zoneTipText(gz) + '</p>';
    gz.items.forEach(function (it) {
      var key = z.id + '|' + it.name;
      var on = checked.has(key);
      var tags = (it.optional ? '<span class="opt">可选</span>' : '') + (it.note ? '<span class="note">' + it.note + '</span>' : '');
      var from = it.from.length ? '<span class="from">用于：' + it.from.join('、') + '</span>' : '';
      html += '<div class="item' + (on ? ' checked' : '') + '" data-key="' + key + '">' +
        '<span class="ing-ico">' + ingIcon(it.name, z.id) + '</span>' +
        '<span class="check">' + (on ? ico('check', { scale: 12, mono: '#FFF8EA' }) : '') + '</span>' +
        '<span class="item-name">' + it.name + '</span>' + tags + from + '</div>';
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
    if (cart.size === 0) { page.innerHTML = '<div class="zone-empty">菜篮是空的，先去挑几道菜吧～</div>'; prog.innerHTML = ''; return; }
    var gzs = guideZones.length ? guideZones : buildGuideZones();
    var total = 0, done = 0;
    var html = '';
    gzs.forEach(function (gz) {
      var z = gz.zone;
      html += '<div class="ov-zone px-notch" style="--zone:' + z.color + '">';
      html += '<div class="ov-zone-head"><span class="zb-ico">' + zoneIcon(z.id) + '</span>' + z.name + '区 <span class="ov-zone-n">(' + gz.items.length + ')</span></div>';
      gz.items.forEach(function (it) {
        var key = z.id + '|' + it.name;
        var on = checked.has(key); total++; if (on) done++;
        var tags = (it.optional ? '<span class="opt">可选</span>' : '') + (it.note ? '<span class="note">' + it.note + '</span>' : '');
        var from = it.from.length ? '<span class="from">用于：' + it.from.join('、') + '</span>' : '';
        html += '<div class="item' + (on ? ' checked' : '') + '" data-key="' + key + '">' +
          '<span class="ing-ico">' + ingIcon(it.name, z.id) + '</span>' +
          '<span class="check">' + (on ? ico('check', { scale: 12, mono: '#FFF8EA' }) : '') + '</span>' +
          '<span class="item-name">' + it.name + '</span>' + tags + from + '</div>';
      });
      html += '</div>';
    });
    page.innerHTML = html;
    bindItems(page);
    prog.innerHTML = '<span class="gp-num">已勾 ' + done + '/' + total + '</span>';
    $('ovDone').disabled = false;
  }

  function completeList() {
    var gzs = guideZones.length ? guideZones : buildGuideZones();
    var total = 0; gzs.forEach(function (gz) { total += gz.items.length; });
    var page = $('ovPage');
    page.innerHTML = '<div class="done-card px-notch">' +
      '<div class="done-emoji">' + ico('trophy', { scale: 48 }) + '</div>' +
      '<div class="done-title">采购通关！</div>' +
      '<div class="done-sub">共 ' + cart.size + ' 道菜 · ' + total + ' 样食材 已收入囊中</div>' +
      '<button id="doneImg" class="rbtn primary rbtn-block" style="margin-top:12px;">' +
      '<span class="btn-ico">' + ico('share', { scale: 24 }) + '</span>生成清单图</button>' +
      '<button id="doneHome" class="rbtn ghost rbtn-block" style="margin-top:10px;">' +
      '<span class="btn-ico">' + ico('barn', { scale: 24 }) + '</span>返回农场</button>' +
      '<p class="done-tip">把清单图分享给好友，一起买菜不迷路</p>' +
      '</div>';
    $('ovProgress').innerHTML = '';
    $('ovDone').disabled = true;
    $('ovBack').hidden = true;
    $('doneImg').onclick = generateListImage;
    $('doneHome').onclick = function () { showScreen('home'); };
    track('complete_list', { dishes: cart.size, items: total });
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
  function generateListImage() {
    var gzs = guideZones.length ? guideZones : buildGuideZones();
    if (!gzs.length) return;
    var draw = function () { drawListImage(gzs); };
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
    var cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    var c = cv.getContext('2d');
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
    showImageModal(cv.toDataURL('image/png'));
    track('generate_image', { dishes: cart.size, items: total });
  }
  function showImageModal(url) { $('shareImg').src = url; $('shareModal').hidden = false; }
  function closeShare() { $('shareModal').hidden = true; }
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

  /* ---------- 事件绑定 ---------- */
  $('searchForm').addEventListener('submit', function (e) { e.preventDefault(); doSearch($('search').value); });
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
    $('cuisineToggle').classList.toggle('open', !w.hidden);
  };
  $('prevZone').onclick = function () { if (guideIndex > 0) { guideIndex--; renderGuide(); } };
  $('nextZone').onclick = function () { if (guideIndex < guideZones.length - 1) { guideIndex++; renderGuide(); } };
  $('viewOverview').onclick = function () { goOverview('guide'); };
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

  /* ---------- 启动 ---------- */
  injectStaticIcons();
  buildHome();
  showScreen('home');
  track('open_app');

  /* 暴露给控制台/调试 */
  window.__app = { DATA: DATA, cart: cart, goGuide: goGuide, goOverview: goOverview, generateListImage: generateListImage };
})();
