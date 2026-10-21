/* ============================================================
 * 像素农场 · 图标引擎 icons.js
 * 12×12 ASCII 像素网格 → crispEdges SVG（横向合并 rect）
 * 调色板字符见 PALETTE；'.' = 透明
 * 浏览器：window.PXIcon.svg(name, {scale, mono, cls})
 * Node 预览：node icons.js  （校验行宽 + ASCII 预览）
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (root) { root.PXIcon = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ---------- 全局调色板 ---------- */
  var PALETTE = {
    k: '#3B2A20', // 墨色（描边/深色）
    w: '#7A4A2A', // 木深
    W: '#B07B4A', // 木
    c: '#FFF1D6', // 奶油
    C: '#EBD9B4', // 奶油深
    r: '#E0533F', // 番茄红
    R: '#B83A2B', // 红深
    p: '#F5A89B', // 浅粉
    g: '#5A8A3C', // 草绿深
    G: '#8FCB6B', // 草绿
    y: '#F2C14E', // 玉米黄
    Y: '#D69E2D', // 黄深
    o: '#E8956B', // 橙
    b: '#6BB8DE', // 天蓝
    B: '#4A90B8', // 蓝深
    u: '#9B7EDE', // 紫
    U: '#7A5FC0', // 紫深
    s: '#B8AEA2', // 灰
    S: '#8A7E72', // 灰深
    t: '#D94F3D', // 番茄
    f: '#F5D9A8', // 肉色
    n: '#EAF6FF', // 雪白
    e: '#FFF8EA'  // 蛋白
  };

  /* ---------- 图标库（12×12） ---------- */
  var ICONS = {

    /* —— 菜类 —— */
    meat: [ // 肉菜（带骨肉）
      '............',
      '...kkkk.....',
      '..kkrrkk....',
      '.krrrrrrk...',
      '.krRRRrrk...',
      'krRRRRRrrk..',
      'krrrrrrrrk..',
      'krrrrrrrrk..',
      '.krrrrrrk...',
      '..kwwwwk....',
      '...kkkk.....',
      '............'
    ],
    carrot: [ // 素菜（胡萝卜）
      '............',
      '...g....g...',
      '..gGg..gGg..',
      '..gGGggGGg..',
      '...gGGGGg...',
      '....oooo....',
      '...oooooo...',
      '..oooooooo..',
      '..oooooooo..',
      '...oooooo...',
      '....oooo....',
      '.....oo.....'
    ],
    soup: [ // 汤羹（热汤碗）
      '............',
      '....k..k....',
      '...kk..kk...',
      '....k..k....',
      '............',
      '.cccccccccc.',
      '.kkkkkkkkkk.',
      'krrrrrrrrrrk',
      'krrrrrrrrrrk',
      '.kWWWWWWWWk.',
      '..kWWWWWWk..',
      '...kkkkkk...'
    ],
    rice: [ // 主食（米饭碗）
      '............',
      '....eeee....',
      '...eeeeee...',
      '..eeeeeeee..',
      '..eeeeeeee..',
      '.kkkkkkkkkk.',
      'kWWWWWWWWWWk',
      'kWWWWWWWWWWk',
      '.kWWWWWWWWk.',
      '..kWWWWWWk..',
      '...kkkkkk...',
      '............'
    ],

    /* —— 超市分区 —— */
    leaf: [ // 蔬菜
      '............',
      '........gg..',
      '.......gGg..',
      '......gGGg..',
      '.....gGGGg..',
      '....gGGGgk..',
      '...gGGGgk...',
      '..gGGgk.....',
      '.gGgk.......',
      '.gk.........',
      '..k.........',
      '............'
    ],
    fish: [ // 水产
      '............',
      '.....kk.....',
      '...kkbbbk...',
      '..kbbbbbbk..',
      '.kbbbkbbbbk.',
      'kkbbbbbbbbk.',
      'kkbbbbbbbbk.',
      '.kbbbkbbbbk.',
      '..kbbbbbbk..',
      '...kkbbbk...',
      '.....kk.....',
      '............'
    ],
    salt: [ // 调料干货
      '............',
      '....kkkk....',
      '....kcck....',
      '...kkkkkk...',
      '...kCCCCk...',
      '...kCkkCk...',
      '...kCCCCk...',
      '...kCCCCk...',
      '...kCCCCk...',
      '...kkkkkk...',
      '............',
      '............'
    ],
    freeze: [ // 冷冻（冰块）
      '............',
      '.kkkkkkkkkk.',
      '.knnnnnnnnnk',
      '.knkknnnnnnk',
      '.knkknnnnnnk',
      '.knnnnnnnnnk',
      '.knnnnnnnnnk',
      '.knnnnkknnnk',
      '.knnnnkknnnk',
      '.knnnnnnnnnk',
      '.kkkkkkkkkk.',
      '............'
    ],
    wheat: [ // 粮油（麦穗）
      '............',
      '...y..y..y..',
      '..yy..yy..yy',
      '...y..y..y..',
      '..yy..yy..yy',
      '...y..y..y..',
      '....y..y....',
      '.....yy.....',
      '.....w......',
      '.....w......',
      '.....w......',
      '............'
    ],
    egg: [ // 蛋奶（k 描边 + n 高光 + e 蛋体 + c 内影；原版通体 e 与纸底同色会"消失"）
      '............',
      '.....kk.....',
      '....knnk....',
      '....knek....',
      '...knneek...',
      '...kneeek...',
      '..kneeeeek..',
      '..kneeeeek..',
      '..kneeecck..',
      '..keeeccck..',
      '...keecck...',
      '....kkkk....'
    ],
    box: [ // 其他（货箱）
      '............',
      '..kkkkkkkk..',
      '..kWWWWWWk..',
      'kkkWWWWWWkkk',
      'kCkWWWWWWkCk',
      'kCkWWWWWWkCk',
      'kkWWWWWWWWkk',
      '.kkWWWWWWkk.',
      '..kkWWWWkk..',
      '...kkkkkk...',
      '............',
      '............'
    ],

    /* —— 菜系 —— */
    barn: [ // 中国家常（谷仓）
      '............',
      '.....kk.....',
      '....krrk....',
      '...krrrrk...',
      '..krrrrrrk..',
      '.kkkkkkkkkk.',
      '.krrkcckrrk.',
      '.krrkcckrrk.',
      '.krrkcckrrk.',
      '.kkkkkkkkkk.',
      '............',
      '............'
    ],
    chili: [ // 川渝（辣椒）
      '............',
      '........kk..',
      '.......krk..',
      '..kkkkrrrk..',
      '.krrrrrrrk..',
      '.krrrrrrrk..',
      '..krrrrrk...',
      '...krrrk....',
      '....kkk.....',
      '............',
      '............',
      '............'
    ],
    shrimp: [ // 粤式（虾）
      '............',
      '..........k.',
      '.........kok',
      '........kokk',
      '..kkkk.koo..',
      '.kooooooook.',
      '.kooooooook.',
      '..kkkkkkk...',
      '............',
      '............',
      '............',
      '............'
    ],
    sushi: [ // 日料（寿司卷）
      '............',
      '...kkkkkk...',
      '..keeeeeek..',
      '.keeeeeeeeek',
      'keekeeeekeek',
      'keeeeeeeeeek',
      '.keeeeeeeeek',
      '..keeeeeek..',
      '...kkkkkk...',
      '............',
      '............',
      '............'
    ],
    burger: [ // 西餐（汉堡）
      '............',
      '...kkkkkk...',
      '..kyyyyyyk..',
      '.kgggggggggk',
      '.krrrrrrrrrk',
      '.kWWWWWWWWWk',
      '..kkkkkkkk..',
      '............',
      '............',
      '............',
      '............',
      '............'
    ],
    pasta: [ // 意餐（意面）
      '............',
      '..kkkkkkkk..',
      '..kyyyyyyk..',
      '.kyykyykyyk.',
      '.kyykyykyyk.',
      '.kyyyyyyyyk.',
      '..kcccccck..',
      '...kkkkkk...',
      '............',
      '............',
      '............',
      '............'
    ],

    /* —— UI 功能图标 —— */
    search: [ // 搜索
      '............',
      '...kkkkk....',
      '..kccccck...',
      '.kccccccck..',
      '.kccccccck..',
      '.kccccccck..',
      '..kccccck...',
      '...kkkkk....',
      '.....kkkk...',
      '......kkkk..',
      '.......kkk..',
      '............'
    ],
    basket: [ // 菜篮
      '............',
      '..k......k..',
      '.k.k....k.k.',
      'k..k....k..k',
      'kkkkkkkkkkkk',
      'kWWWWWWWWWWk',
      'kWwWWWWWWwWk',
      'kWWwWWWWwWWk',
      'kWWWWWWWWWWk',
      'kkkkkkkkkkkk',
      '.kkkkkkkkkk.',
      '............'
    ],
    dice: [ // 骰子
      '............',
      '.kkkkkkkkkk.',
      '.kccccccccck',
      '.kckcccckck.',
      '.kccccccccck',
      '.kccckkcccck',
      '.kccccccccck',
      '.kckcccckck.',
      '.kccccccccck',
      '.kkkkkkkkkk.',
      '............',
      '............'
    ],
    refresh: [ // 换一批（循环箭头）
      '............',
      '.........kk.',
      '...kkkkkkk..',
      '..k......kk.',
      '.k........k.',
      '.k........k.',
      'k..........k',
      'k..........k',
      '.k........k.',
      '.k.......kk.',
      '..k.....kk..',
      '...kkkkkk...'
    ],
    check: [ // 勾选
      '............',
      '..........k.',
      '.........kgk',
      '........kgk.',
      '.......kgk..',
      'k.....kgk...',
      'kk...kgk....',
      '.kk.kgk.....',
      '..kkgggk....',
      '...kgggk....',
      '....kgk.....',
      '............'
    ],
    plus: [ // 加号
      '............',
      '............',
      '....kkkk....',
      '....kkkk....',
      '....kkkk....',
      'kkkkkkkkkkkk',
      'kkkkkkkkkkkk',
      '....kkkk....',
      '....kkkk....',
      '....kkkk....',
      '............',
      '............'
    ],
    arrowL: [ // 左箭头
      '............',
      '............',
      '....kk......',
      '...kkk......',
      '..kkkk......',
      '.kkkkk......',
      '..kkkk......',
      '...kkk......',
      '....kk......',
      '............',
      '............',
      '............'
    ],
    arrowR: [ // 右箭头
      '............',
      '............',
      '......kk....',
      '......kkk...',
      '......kkkk..',
      '......kkkkk.',
      '......kkkk..',
      '......kkk...',
      '......kk....',
      '............',
      '............',
      '............'
    ],
    close: [ // 关闭
      '............',
      '.kk......kk.',
      '.kkk....kkk.',
      '..kkk..kkk..',
      '...kkkkkk...',
      '....kkkk....',
      '...kkkkkk...',
      '..kkk..kkk..',
      '.kkk....kkk.',
      '.kk......kk.',
      '............',
      '............'
    ],
    sparkle: [ // 星星闪光
      '............',
      '.....yy.....',
      '.....yy.....',
      '....yyyy....',
      '.yyyyyyyyyy.',
      'yyyyyyyyyyyy',
      '.yyyyyyyyyy.',
      '....yyyy....',
      '.....yy.....',
      '.....yy.....',
      '............',
      '............'
    ],
    coin: [ // 金币
      '............',
      '...kkkkkk...',
      '..kYYYYYYk..',
      '.kYYYYYYYYk.',
      'kYYYkYYkYYYk',
      'kYYYYkkYYYYk',
      'kYYYYkkYYYYk',
      'kYYYkYYkYYYk',
      '.kYYYYYYYYk.',
      '..kYYYYYYk..',
      '...kkkkkk...',
      '............'
    ],
    flag: [ // 关卡旗帜
      '............',
      '..kkkkkk....',
      '..krrrrrk...',
      '..krrrrrrk..',
      '..krrrrrrk..',
      '..krrrrrk...',
      '..kkkkkk....',
      '..kk........',
      '..kk........',
      '..kk........',
      '..kkkkkkkk..',
      '............'
    ],
    clipboard: [ // 清单
      '............',
      '....kkkk....',
      '....kcck....',
      '.kkkkkkkkkk.',
      '.kccccccccck',
      '.kckkcckkck.',
      '.kccccccccck',
      '.kckkcckkck.',
      '.kccccccccck',
      '.kkkkkkkkkk.',
      '............',
      '............'
    ],
    share: [ // 分享（上传）
      '............',
      '.....kk.....',
      '....kggk....',
      '...kggggk...',
      '..kggggggk..',
      '.kkkkkkkkkk.',
      '.k........k.',
      '.kggggggggk.',
      '.k........k.',
      '.kggggggggk.',
      '.kkkkkkkkkk.',
      '............'
    ],
    trophy: [ // 奖杯
      '............',
      '.kkkkkkkkkk.',
      '.kyyyyyyyyk.',
      '.kykyyyykyk.',
      '.kyyyyyyyyk.',
      '..kyyyyyyk..',
      '...kyyyyk...',
      '....kyyk....',
      '.....kk.....',
      '.kkkkkkkkkk.',
      '.kYYYYYYYYk.',
      '.kkkkkkkkkk.'
    ],
    globe: [ // 地球（菜系）
      '............',
      '...kkkkkk...',
      '..kbbbbbbk..',
      '.kbbbkbbbbk.',
      'kbbbbkbbbbbk',
      'kbbbbkbbbbbk',
      '.kbbbkbbbbk.',
      '..kbbbbbbk..',
      '...kkkkkk...',
      '............',
      '............',
      '............'
    ]
  };

  /* ---------- 渲染：ASCII → SVG（合并横向连续同色格） ---------- */
  function svg(name, opts) {
    opts = opts || {};
    var rows = ICONS[name];
    if (!rows) return '';
    var mono = opts.mono || null;
    var scale = opts.scale || 24;
    var rects = [];
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y];
      var x = 0;
      while (x < row.length) {
        var ch = row.charAt(x);
        if (ch === '.') { x++; continue; }
        var run = 1;
        while (x + run < row.length && row.charAt(x + run) === ch) run++;
        var color = mono || PALETTE[ch] || '#000000';
        rects.push('<rect x="' + x + '" y="' + y + '" width="' + run + '" height="1" fill="' + color + '"/>');
        x += run;
      }
    }
    var cls = 'px-ico' + (opts.cls ? ' ' + opts.cls : '');
    return '<svg class="' + cls + '" viewBox="0 0 ' + rows[0].length + ' ' + rows.length +
      '" width="' + scale + '" height="' + scale + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' +
      rects.join('') + '</svg>';
  }

  /* ---------- Node：校验 + ASCII 预览 ---------- */
  function preview() {
    var names = Object.keys(ICONS);
    var bad = 0;
    names.forEach(function (n) {
      ICONS[n].forEach(function (row, i) {
        if (row.length !== 12) { bad++; console.log('[行宽错误] ' + n + ' 第' + i + '行长度=' + row.length + ' => "' + row + '"'); }
      });
      if (ICONS[n].length !== 12) { bad++; console.log('[行数错误] ' + n + ' 共' + ICONS[n].length + '行'); }
    });
    if (bad) { console.log('共 ' + bad + ' 处错误'); process.exit(1); }
    console.log('✓ ' + names.length + ' 个图标全部通过行宽校验\n');
    names.forEach(function (n) {
      console.log('▌' + n);
      ICONS[n].forEach(function (row) {
        var out = '';
        for (var i = 0; i < row.length; i++) { var c = row.charAt(i); out += (c === '.') ? '  ' : (c + c); }
        console.log('  ' + out);
      });
      console.log('');
    });
  }
  if (typeof process !== 'undefined' && process.argv && process.argv[1] && /icons\.js$/.test(process.argv[1])) {
    preview();
  }

  return { svg: svg, PALETTE: PALETTE, ICONS: ICONS };
});
