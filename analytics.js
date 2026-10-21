/* 像素农场 · 采购记 — 轻量埋点（本地环形队列版）
 *
 * 背景（D1 / G3）：
 *   旧版把事件发往 Supabase，但 SUPABASE_URL / ANON_KEY 从未填写，
 *   于是 218KB 的 supabase-js 被白下载（占整站传输量 42%），埋点送达率 0%。
 *   现在改为「本地环形队列」：事件先落 localStorage，控制台可随时导出，
 *   将来要接后端只需在 flush() 里加一段上传逻辑，调用点不用动。
 *
 * 存储：
 *   gp_events  最近 200 条事件（环形队列，超出丢最旧）
 *   gp_history 聚合战绩（累计清单数 / 累计食材数 / 活跃日期集合 / 最爱菜 Top）
 *
 * 用法：window.Analytics.track('event_name', { payload })
 */
(function () {
  'use strict';

  var EVENTS_KEY = 'gp_events';
  var HISTORY_KEY = 'gp_history';
  var MAX_EVENTS = 200;
  var MAX_DAYS = 400; // 活跃日期集合上限

  function readJSON(k, def) {
    try {
      var raw = localStorage.getItem(k);
      if (raw === null) return def;
      var v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : def;
    } catch (e) { return def; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }

  /* ---------- 匿名稳定 ID（无需登录即可做留存/回访统计） ---------- */
  function uid() {
    try {
      var k = 'gp_uid';
      var v = localStorage.getItem(k);
      if (!v) { v = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return 'anon'; }
  }

  /* ---------- 环形事件队列 ---------- */
  var queue = readJSON(EVENTS_KEY, []);
  if (!Array.isArray(queue)) queue = [];

  function track(name, payload) {
    var ev = {
      e: name,
      p: payload || {},
      u: uid(),
      t: new Date().toISOString()
    };
    queue.push(ev);
    if (queue.length > MAX_EVENTS) queue = queue.slice(queue.length - MAX_EVENTS);
    writeJSON(EVENTS_KEY, queue);
    /* 控制台可见，方便赛后导出 / 调试 */
    if (window.console && window.console.debug) {
      try { window.console.debug('[track]', name, payload || {}); } catch (e) { }
    }
  }

  /* ---------- 聚合战绩（首页「本周采购战绩」面板的数据源） ---------- */
  function today() {
    var d = new Date();
    var m = '' + (d.getMonth() + 1), day = '' + d.getDate();
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }
  function bumpHistory(name, payload) {
    var h = readJSON(HISTORY_KEY, null) || {
      lists: 0,        // 生成过几次清单
      items: 0,        // 累计食材条目数
      days: [],        // 有产出的日期
      dishes: {},      // 菜名 → 加入次数
      checks: 0        // 累计打勾次数
    };
    if (name === 'generate_image' || name === 'complete_list') {
      h.lists += 1;
      h.items += (payload && payload.items) || 0;
    }
    if (name === 'add_to_cart' && payload && payload.dish) {
      h.dishes[payload.dish] = (h.dishes[payload.dish] || 0) + 1;
    }
    if (name === 'check_item') h.checks += 1;
    var t = today();
    if (h.days.indexOf(t) === -1) {
      h.days.push(t);
      if (h.days.length > MAX_DAYS) h.days = h.days.slice(h.days.length - MAX_DAYS);
    }
    writeJSON(HISTORY_KEY, h);
  }
  function history() { return readJSON(HISTORY_KEY, null); }

  /* 预留：将来接后端时在这里把 queue 上传并清空 */
  function flush() { return queue.slice(); }
  function clear() { queue = []; writeJSON(EVENTS_KEY, queue); }

  /* ---------- 对外 ---------- */
  var _track = track;
  track = function (name, payload) {
    _track(name, payload);
    try { bumpHistory(name, payload); } catch (e) { }
  };

  window.Analytics = {
    track: track,
    history: history,
    flush: flush,
    clear: clear,
    ready: function () { return true; }
  };
})();
