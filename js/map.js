// ============================================================
//  第 5 階段：地圖格子（範圍計算）
//  每塊板塊切成 1×1 的格子（大板塊 4 格、小板塊 2 格）
//  格子之間：open 相通 / door 門 / wall 牆 / imp 不可通過的邊界（範圍可穿過、不能移動）
// ============================================================
const MAP = {
  // 板塊內的房間與特殊邊（依板塊圖判讀，玩家可核對）
  // cells：局部座標格子中心 → 房間代號；inner：特殊的格子間邊
  TILE_INFO: {
    // 餐廳／廚房：左邊是黃色實線（可通過、不同房間），右邊是黃色虛線（不可通過，範圍可穿過）
    TILE_DINING_ROOM_MAD20: { rooms: { '-0.5,0.5': 'A', '0.5,0.5': 'A', '-0.5,-0.5': 'B', '0.5,-0.5': 'B' }, inner: [['-0.5,0.5', '-0.5,-0.5', 'open'], ['0.5,0.5', '0.5,-0.5', 'imp']], names: { A: '餐廳', B: '廚房' } },
    // 閣樓：右下是樓梯間（和左下之間是黃色實線，和右上之間是牆）
    TILE_ATTIC_MAD20: { rooms: { '0.5,-0.5': 'B' }, inner: [['0.5,0.5', '0.5,-0.5', 'wall'], ['-0.5,-0.5', '0.5,-0.5', 'open']], names: { A: '閣樓', B: '樓梯間' } },
    // 溫室：右上是溫室，和右下花園之間是黃色虛線；門在左下角的木平台（通往左上、左下花園）
    TILE_CONSERVATORY_MAD20: { rooms: { '0.5,0.5': 'IN' }, inner: [['0.5,0.5', '-0.5,0.5', 'door'], ['0.5,0.5', '0.5,-0.5', 'imp'], ['0.5,0.5', '-0.5,-0.5', 'door']], names: { IN: '溫室', A: '花園' } },
    TILE_BATHROOM_MAD20: { rooms: { '-0.5,0': 'A', '0.5,0': 'B' }, inner: [['-0.5,0', '0.5,0', 'door']], names: { A: '走廊', B: '浴室' } },
    // ---- 二版基礎（2026-10-10 加入，依板塊圖判讀）----
    // 地下室：右下是地下室樓梯（黃色實線，可通過、不同房間）
    TILE_BASEMENT_MAD20: { rooms: { '0.5,-0.5': 'B' }, inner: [['0.5,-0.5', '-0.5,-0.5', 'open'], ['0.5,-0.5', '0.5,0.5', 'open']], names: { A: '地下室', B: '地下室樓梯' } },
    // 店面：上半是店面，下半是前街；中間是牆，右邊有一扇門
    TILE_STOREFRONT_MAD20: { rooms: { '-0.5,-0.5': 'B', '0.5,-0.5': 'B' }, inner: [['0.5,0.5', '0.5,-0.5', 'door']], names: { A: '店面', B: '前街' } },
    // 地窖：上半是地窖，下半是庭院；右邊有木板斜坡相通
    TILE_ROOT_CELLAR_MAD20: { rooms: { '-0.5,-0.5': 'B', '0.5,-0.5': 'B' }, inner: [['0.5,0.5', '0.5,-0.5', 'open']], names: { A: '地窖', B: '庭院' } },
    // ---- 大板塊（3×2）：一個格子可以佔兩小格（hx、hy＝半寬、半高）----
    // 小餐館：上排左邊兩小格是一格、右邊整欄是一格（白線分開，同一房間）；左下兩小格是廚房
    //   廚房和上排之間：左邊黃色實線（可通過）、右邊黃色虛線（不可通過，範圍可穿過）→ 算可通過；廚房和右欄之間是門
    TILE_DINER_MAD25: { size: [3, 2], cells: [{ x: -0.5, y: 0.5, hx: 1, hy: 0.5, room: 'A' }, { x: 1, y: 0, hx: 0.5, hy: 1, room: 'A' }, { x: -0.5, y: -0.5, hx: 1, hy: 0.5, room: 'B' }],
      inner: [['-0.5,0.5', '1,0', 'open'], ['-0.5,0.5', '-0.5,-0.5', 'open'], ['1,0', '-0.5,-0.5', 'door']], names: { A: '小餐館', B: '廚房' } },
    // 展廳入口：白線把它分成左、中、右三格（每格都是上下兩小格）
    TILE_EXHIBIT_ENTRANCE_MAD25: { size: [3, 2], cells: [{ x: -1, y: 0, hx: 0.5, hy: 1 }, { x: 0, y: 0, hx: 0.5, hy: 1 }, { x: 1, y: 0, hx: 0.5, hy: 1 }], names: { A: '展廳入口' } }
  },
  // 板塊大小（格）：小板塊 2×1、中板塊 2×2、大板塊 3×2
  size(t) { const i = MAP.TILE_INFO[t.model]; return (i && i.size) || (t.shape === 1 ? [2, 1] : [2, 2]); },
  key(x, y) { return (Math.round(x * 2) / 2) + ',' + (Math.round(y * 2) / 2); },
  rot(x, y, deg) { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [x * c - y * s, x * s + y * c]; },
  // 建立目前已揭示板塊的格子圖
  build() {
    const tiles = Object.values(G.tiles || {}).filter(t => t.revealed);
    const sig = tiles.map(t => t.id).join('|') + '#' + Object.values(G.nodes).filter(n => n.visible && (/Wall|Door/.test(n.sprite || '') || /EXPLORE|DOOR/i.test(n.id))).map(n => n.id).join('|');
    if (MAP._sig === sig && MAP._g) return MAP._g;
    const cells = [];
    for (const t of tiles) {
      const info = MAP.TILE_INFO[t.model] || {};
      const locs = info.cells || (t.shape === 1 ? [[-0.5, 0], [0.5, 0]] : [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]]).map(([x, y]) => ({ x, y, hx: 0.5, hy: 0.5 }));
      const sw = Math.abs(t.rot % 180) === 90;
      for (const L of locs) {
        const lx = L.x, ly = L.y;
        const [dx, dy] = MAP.rot(lx, ly, t.rot);
        const lk = lx + ',' + ly;
        // anchor：格子中心被建築蓋住時，棋子改放在這一點（局部座標）
        const an = (info.anchor || {})[lk];
        const [ax, ay] = an ? MAP.rot(an[0], an[1], t.rot) : [dx, dy];
        cells.push({ id: cells.length, tile: t.id, model: t.model, map: t.map, lx, ly, x: t.x + ax, y: t.y + ay, rx: t.x + dx, ry: t.y + dy, hx: sw ? L.hy : L.hx, hy: sw ? L.hx : L.hy, room: t.id + ':' + (L.room || (info.rooms || {})[lk] || 'A'), lk });
      }
      // 建築（小屋、船艙…）：獨立的一格，只從入口進出
      (info.bld || []).forEach((B, k) => {
        const [dx, dy] = MAP.rot(B.x, B.y, t.rot);
        cells.push({ id: cells.length, tile: t.id, model: t.model, map: t.map, lx: B.x, ly: B.y, x: t.x + dx, y: t.y + dy, rx: t.x + dx, ry: t.y + dy, hx: sw ? B.hy : B.hx, hy: sw ? B.hx : B.hy, room: t.id + ':BLD' + k, lk: 'bld' + k, bld: B, name: B.name });
      });
    }
    for (const c of cells) { if (c.rx == null) { c.rx = c.x; c.ry = c.y; } }
    const walls = Object.values(G.nodes).filter(n => n.visible && /Wall/.test(n.sprite || ''));
    const doors = Object.values(G.nodes).filter(n => n.visible && /Door|Secret/.test(n.sprite || ''));
    const adj = cells.map(() => []);
    // nbr：規則上的「相鄰」＝有共用邊的格子，隔著牆、門、不可通過的邊界也算（放火等用）
    const nbr = cells.map(() => []);
    const link = (i, j) => { if (!nbr[i].includes(j)) nbr[i].push(j); if (!nbr[j].includes(i)) nbr[j].push(i); };
    // 局部座標中，某格子朝某方向的邊在板塊邊緣上的位置
    const edgeAt = (c, wx, wy) => {
      const t = G.tiles[c.tile];
      const [lx, ly] = MAP.rot(wx - t.x, wy - t.y, -t.rot);
      const E = TILE_EDGES[c.model]; if (!E) return null;
      const [tw, th] = MAP.size(t), hw = tw / 2, hh = th / 2, eps = 0.15;
      // 邊界資料是用「寬 2、高 E.h」量的；大板塊要換算回去
      const kx = 1 / hw, ky = (E.h / 2) / hh;
      let side = null, pos = 0;
      if (Math.abs(ly - hh) < eps) { side = 'N'; pos = lx * kx; } else if (Math.abs(ly + hh) < eps) { side = 'S'; pos = lx * kx; }
      else if (Math.abs(lx - hw) < eps) { side = 'E'; pos = ly * ky; } else if (Math.abs(lx + hw) < eps) { side = 'W'; pos = ly * ky; }
      if (!side) return 'inner';
      const inR = arr => (arr[side] || []).some(([a, b]) => pos >= a - 0.08 && pos <= b + 0.08);
      if (inR(E.door)) return 'door';
      if (inR(E.open)) return 'open';
      return 'wall';
    };
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j];
      if (a.bld || b.bld) continue;
      const d = Math.hypot(a.rx - b.rx, a.ry - b.ry);
      const diagSpec = a.tile === b.tile && Math.abs(d - Math.SQRT2) < 0.15 && ((MAP.TILE_INFO[a.model] || {}).inner || []).find(([p, q]) => (p === a.lk && q === b.lk) || (p === b.lk && q === a.lk));
      if (diagSpec) { if (diagSpec[2] !== 'wall') { link(i, j); adj[i].push({ to: j, type: diagSpec[2] }); adj[j].push({ to: i, type: diagSpec[2] }); } continue; }
      // 兩格相鄰＝兩個方塊有一條共用的邊（大板塊的格子可能佔兩小格）
      const ddx = b.rx - a.rx, ddy = b.ry - a.ry;
      const gx = Math.abs(ddx) - (a.hx + b.hx), gy = Math.abs(ddy) - (a.hy + b.hy);
      const ox = (a.hx + b.hx) - Math.abs(ddx), oy = (a.hy + b.hy) - Math.abs(ddy);
      let mx, my;
      if (Math.abs(gx) < 0.15 && oy > 0.3) { mx = a.rx + Math.sign(ddx) * a.hx; my = (Math.max(a.ry - a.hy, b.ry - b.hy) + Math.min(a.ry + a.hy, b.ry + b.hy)) / 2; }
      else if (Math.abs(gy) < 0.15 && ox > 0.3) { my = a.ry + Math.sign(ddy) * a.hy; mx = (Math.max(a.rx - a.hx, b.rx - b.hx) + Math.min(a.rx + a.hx, b.rx + b.hx)) / 2; }
      else continue;
      link(i, j);
      let type;
      if (a.tile === b.tile) {
        const info = MAP.TILE_INFO[a.model] || {};
        const sp = (info.inner || []).find(([p, q]) => (p === a.lk && q === b.lk) || (p === b.lk && q === a.lk));
        type = sp ? sp[2] : (a.room === b.room ? 'open' : 'wall');
      } else {
        const ea = edgeAt(a, mx, my), eb = edgeAt(b, mx, my);
        if (ea === 'open' && eb === 'open') type = 'open';
        else if (ea === 'door' || eb === 'door') type = 'door';
        else type = 'wall';
      }
      if (walls.some(n => Math.hypot(n.x - mx, n.y - my) < 0.3)) type = 'wall';
      if (type !== 'wall' && doors.some(n => Math.hypot(n.x - mx, n.y - my) < 0.3)) type = 'door';
      if (type === 'wall') continue;
      adj[i].push({ to: j, type }); adj[j].push({ to: i, type });
    }
    // 建築的入口：探索標記或門還在（或還沒出現）＝關著；處理掉之後＝門（可以移動通過）
    const rev = (G.vars && G.vars.__rev) || {};
    for (const c of cells.filter(x => x.bld)) {
      const t = G.tiles[c.tile];
      for (const lk of cells.filter(x => x.tile === c.tile && !x.bld)) {
        const ov = Math.min(c.rx + c.hx, lk.rx + lk.hx) - Math.max(c.rx - c.hx, lk.rx - lk.hx) > 0.05 && Math.min(c.ry + c.hy, lk.ry + lk.hy) - Math.max(c.ry - c.hy, lk.ry - lk.hy) > 0.05;
        if (ov) link(c.id, lk.id);
      }
      for (const E of c.bld.doors) {
        const o = cells.find(x => x.tile === c.tile && x.lk === E.to); if (!o) continue;
        const [ex, ey] = MAP.rot(E.x, E.y, t.rot), wx = t.x + ex, wy = t.y + ey;
        const gate = Object.values(G.nodes).filter(n => !n.virtual && (n.map == null || t.map == null || n.map === t.map) && /EXPLORE|DOOR/i.test(n.id + ' ' + (n.sprite || '')) && !/Wall/.test(n.sprite || '') && Math.hypot(n.x - wx, n.y - wy) < 0.3);
        const shut = gate.some(n => n.visible || !rev[n.id]);
        c.shut = c.shut || shut;
        link(c.id, o.id);
        if (!shut) { adj[c.id].push({ to: o.id, type: 'door', mx: wx, my: wy }); adj[o.id].push({ to: c.id, type: 'door', mx: wx, my: wy }); }
      }
    }
    MAP._sig = sig; MAP._g = { cells, adj, nbr };
    return MAP._g;
  },
  cellAt(x, y) {
    const g = MAP.build();
    let best = null, bd = 9;
    for (const c of g.cells) if (c.bld && Math.abs(c.rx - x) <= c.hx && Math.abs(c.ry - y) <= c.hy) return c;   // 在建築裡面
    for (const c of g.cells) { if (c.bld) continue; const d = Math.max(Math.abs(c.rx - x) / (2 * (c.hx || 0.5)), Math.abs(c.ry - y) / (2 * (c.hy || 0.5))); if (d < bd) { bd = d; best = c; } }
    return bd <= 0.6 ? best : null;
  },
  // 範圍：最多 3 格，不能穿過牆；可以穿過門、不可通過的邊界（虛線）
  rangeDist(fromId) {
    const g = MAP.build(), dist = { [fromId]: 0 }, q = [fromId];
    while (q.length) { const c = q.shift(); if (dist[c] >= 3) continue; for (const e of g.adj[c]) if ((e.type === 'open' || e.type === 'imp' || e.type === 'door') && dist[e.to] == null) { dist[e.to] = dist[c] + 1; q.push(e.to); } }
    return dist;
  },
  // 移動距離（門可以通過）
  moveAdj(id) { return MAP.build().adj[id].filter(e => e.type === 'open' || e.type === 'door').map(e => e.to); },
  // 規則上的相鄰（隔著牆、門、不可通過的邊界也算）
  touchAdj(id) { return (MAP.build().nbr[id] || []).slice(); },
  inRange(a, b) { if (!a || !b) return false; const d = MAP.rangeDist(a.id); return d[b.id] != null; },
  same(a, b) { return a && b && a.id === b.id; },
  adjacentOrSame(a, b) { return a && b && (a.id === b.id || MAP.moveAdj(a.id).includes(b.id)); },
  posCell(o) { return o ? MAP.cellAt(o.x, o.y) : null; },
  // 拖曳放下時貼齊格子中央
  snap(o, others) {
    const c = MAP.cellAt(o.x, o.y); if (!c) return;
    const here = others.filter(p => p !== o && MAP.cellAt(p.x, p.y) === c).length;
    const ring = [[0, 0], [0.22, 0.18], [-0.22, 0.18], [0.22, -0.18], [-0.22, -0.18], [0, 0.3], [0, -0.3]];
    const [ox, oy] = ring[here % ring.length];
    o.x = c.x + ox; o.y = c.y + oy;
  }
};
