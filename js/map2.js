// ============================================================
//  地圖格子 第 2 版（2026-10-10）
//  每塊板塊用 0.25 格的小方格描述「哪個小方格屬於哪一格（空間）」，
//  格子的形狀可以不規則（依白線、黃線、牆畫出來）。
//  板塊資料：TILE_GRID（data/tilegrid.js）；沒有資料的板塊用舊的 TILE_INFO 自動換算。
//
//  相鄰種類：
//    open  相通（白色實線、黃色實線、開口）：可移動、範圍可算過去
//    imp   不可通過的邊界（白色虛線、黃色虛線、窗戶、柵欄）：不能移動、範圍可算過去、火可越過
//    door  門：可移動、範圍可以算過去（隔著門可以遠程攻擊）
//    wall  牆：都不行（但規則上仍算「相鄰」，例如放火）
// ============================================================
(function () {
  const Q = 4;   // 每 1 單位切成 4 個小方格
  const RANK = { open: 4, door: 3, imp: 2, wall: 1 };
  const specCache = {};

  // ---------- 舊資料（TILE_INFO）換算成小方格 ----------
  function legacySpec(model, shape) {
    const info = MAP.TILE_INFO[model] || {};
    const [tw, th] = info.size || (shape === 1 ? [2, 1] : [2, 2]);
    const cols = tw * Q, rows = th * Q;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    const keys = {}, names = {}, rooms = {}, anchor = {}, links = {};
    const rects = info.cells ? info.cells.map(L => ({ k: L.x + ',' + L.y, x: L.x, y: L.y, hx: L.hx, hy: L.hy, room: L.room || 'A' }))
      : (shape === 1 && !info.size ? [[-0.5, 0], [0.5, 0]] : [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]]).map(([x, y]) => ({ k: x + ',' + y, x, y, hx: 0.5, hy: 0.5, room: (info.rooms || {})[x + ',' + y] || 'A' }));
    const fill = (R, k) => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const cx = -tw / 2 + (c + 0.5) / Q, cy = th / 2 - (r + 0.5) / Q; if (Math.abs(cx - R.x) < R.hx && Math.abs(cy - R.y) < R.hy) grid[r][c] = k; } };
    for (const R of rects) { fill(R, R.k); rooms[R.k] = R.room; names[R.k] = (info.names || {})[R.room] || ''; anchor[R.k] = (info.anchor || {})[R.k] || [R.x, R.y]; }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const sp = (info.inner || []).find(([p, q]) => (p === a.k && q === b.k) || (p === b.k && q === a.k));
      links[a.k + '|' + b.k] = links[b.k + '|' + a.k] = sp ? { type: sp[2], diag: true } : { type: a.room === b.room ? 'open' : 'wall' };
    }
    (info.bld || []).forEach((B, k) => {
      const key = 'bld' + k; fill(B, key);
      rooms[key] = 'BLD' + k; names[key] = B.name || (info.names || {})['BLD' + k] || ''; anchor[key] = [B.x, B.y];
      for (const R of rects) links[key + '|' + R.k] = links[R.k + '|' + key] = { type: 'wall' };
      for (const E of B.doors) links[key + '|' + E.to] = links[E.to + '|' + key] = { type: 'door', gate: [E.x, E.y] };
    });
    return { q: Q, tw, th, cols, rows, grid, names, rooms, anchor, links };
  }
  // ---------- 新資料（TILE_GRID）----------
  // g：字串陣列（由上到下），每個字元是一個 0.25 小方格；'#' 或 '.' ＝牆／不屬於任何格
  // names：{ A: '閣樓' }，rooms：{ A: '房間代號' }（同一個房間的不同格可以共用），
  // links：[['A','B','open'], ['A','C','door',{gate:[x,y]}]]，anchor：{ A: [x, y] }
  // poly：每一格用多邊形描述（照板塊上印的線，斜線就是真正的斜線），局部座標，size：[寬, 高]
  //   內部轉成 1/16 單位的小方格來計算
  const inPoly = (x, y, P) => { let o = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) o = !o; } return o; };
  function newSpec(S) {
    let q = Q, rows, cols, tw, th, grid;
    if (S.poly) {
      q = 16; [tw, th] = S.size; cols = tw * q; rows = th * q;
      grid = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => { const x = -tw / 2 + (c + 0.5) / q, y = th / 2 - (r + 0.5) / q; for (const [k, P] of Object.entries(S.poly)) if (inPoly(x, y, P)) return k; return null; }));
    } else {
      rows = S.g.length; cols = S.g[0].length; tw = cols / Q; th = rows / Q;
      grid = S.g.map(row => [...row].map(ch => (ch === '#' || ch === '.') ? null : ch));
    }
    const links = {};
    for (const [a, b, type, opt] of S.links || []) { const v = Object.assign({ type }, opt || {}); links[a + '|' + b] = links[b + '|' + a] = v; }
    const rooms = Object.assign({}, S.rooms || {}), names = Object.assign({}, S.names || {});
    for (const row of grid) for (const k of row) if (k && !rooms[k]) rooms[k] = k;
    return { q, poly: S.poly || null, tw, th, cols, rows, grid, names, rooms, anchor: S.anchor || {}, links, bld: S.bld || [] };
  }
  MAP.spec = function (model, shape) {
    const ck = model + '#' + shape;
    if (!specCache[ck]) specCache[ck] = (typeof TILE_GRID !== 'undefined' && TILE_GRID[model]) ? newSpec(TILE_GRID[model]) : legacySpec(model, shape);
    return specCache[ck];
  };
  MAP.clearSpec = () => { for (const k in specCache) delete specCache[k]; MAP._sig = null; };
  MAP.size = function (t) { const s = MAP.spec(t.model, t.shape); return [s.tw, s.th]; };

  // 局部座標 → 小方格
  const sqAt = (S, lx, ly) => { const c = Math.floor((lx + S.tw / 2) * S.q), r = Math.floor((S.th / 2 - ly) * S.q); return (c >= 0 && c < S.cols && r >= 0 && r < S.rows) ? [r, c] : null; };
  const sqCenter = (S, r, c) => [-S.tw / 2 + (c + 0.5) / S.q, S.th / 2 - (r + 0.5) / S.q];
  const toLocal = (t, x, y) => MAP.rot(x - t.x, y - t.y, -t.rot);
  const toWorld = (t, lx, ly) => { const [dx, dy] = MAP.rot(lx, ly, t.rot); return [t.x + dx, t.y + dy]; };

  // 板塊邊緣某一點是：door / open / imp / wall（依 TILE_EDGES，量的是寬 2、高 E.h）
  function edgeType(t, S, lx, ly) {
    const E = TILE_EDGES[t.model]; if (!E) return 'wall';
    const hw = S.tw / 2, hh = S.th / 2, eps = 0.06;
    const kx = 1 / hw, ky = (E.h / 2) / hh;
    let side = null, pos = 0;
    if (Math.abs(ly - hh) < eps) { side = 'N'; pos = lx * kx; } else if (Math.abs(ly + hh) < eps) { side = 'S'; pos = lx * kx; }
    else if (Math.abs(lx - hw) < eps) { side = 'E'; pos = ly * ky; } else if (Math.abs(lx + hw) < eps) { side = 'W'; pos = ly * ky; }
    if (!side) return 'wall';
    const inR = arr => ((arr || {})[side] || []).some(([a, b]) => pos >= a - 0.04 && pos <= b + 0.04);
    if (inR(E.door)) return 'door';
    if (inR(E.imp)) return 'imp';
    if (inR(E.open)) return 'open';
    return 'wall';
  }
  // 板塊邊緣上的門：回傳這扇門的代號和這一點離門中央多遠（一扇門只能連一對格子）
  function edgeDoor(t, S, lx, ly) {
    const E = TILE_EDGES[t.model]; if (!E) return null;
    const hw = S.tw / 2, hh = S.th / 2, eps = 0.06, kx = 1 / hw, ky = (E.h / 2) / hh;
    let side = null, pos = 0, k = 1;
    if (Math.abs(ly - hh) < eps) { side = 'N'; pos = lx * kx; k = kx; } else if (Math.abs(ly + hh) < eps) { side = 'S'; pos = lx * kx; k = kx; }
    else if (Math.abs(lx - hw) < eps) { side = 'E'; pos = ly * ky; k = ky; } else if (Math.abs(lx + hw) < eps) { side = 'W'; pos = ly * ky; k = ky; }
    if (!side) return null;
    const arr = (E.door || {})[side] || [];
    for (let q = 0; q < arr.length; q++) { const [a, b] = arr[q]; if (pos >= a - 0.04 && pos <= b + 0.04) return { key: t.id + '/' + side + q, d: Math.abs(pos - (a + b) / 2) / k }; }
    return null;
  }
  const combine = (a, b) => {
    if (a === 'wall' || b === 'wall') return 'wall';   // 一邊是門、另一邊是牆＝過不去（門要兩邊對得上）
    if (a === 'door' || b === 'door') return 'door';   // 門對門、門對開口都可以通（使用者 2026-10-11 實際玩過確認）
    if (a === 'imp' || b === 'imp') return 'imp';
    return 'open';
  };

  // 區域：同一個劇情步驟一起放出來的板塊算同一區（例如一個探索標記同時放出走廊兩塊）。
  // 不同區的板塊之間，只能經過地圖上的探索標記、門、暗門或被拿掉的牆；板塊邊緣印的門口、開口不算。
  // 2026-10-11 測試：開了會讓 13 張戶外／多區地圖斷開，先關掉（MAP.USE_REGION = true 才會用）
  MAP.USE_REGION = false;
  let regCache = null;
  MAP.sameRegion = function (a, b) {
    if (a === b) return true;
    const sc = G.scen; if (!sc) return true;
    if (!regCache || regCache.sc !== sc) {
      const pairs = new Set();
      for (const d of sc.fsms || []) for (const st of d.states || []) {
        const ts = [...new Set((st.actions || []).filter(x => x.action === 'RevealTile' && x.Tile && x.Tile.go).map(x => x.Tile.go))];
        for (const x of ts) for (const y of ts) if (x !== y) pairs.add(x + '|' + y);
      }
      regCache = { sc, pairs };
    }
    return regCache.pairs.has(a + '|' + b);
  };
  MAP.build = function () {
    const tiles = Object.values(G.tiles || {}).filter(t => t.revealed);
    const rev = (G.vars && G.vars.__rev) || {};
    // 地圖上的牆、門、探索標記（出現過的也算：探索過、拿掉的牆＝打開了）
    const feat = Object.values(G.nodes || {}).filter(n => (n.visible || rev[n.id]) && !n.virtual && (/Wall|Door|Secret/.test(n.sprite || '') || /^(EXPLORE|REDIRECT)/i.test(n.id) || /Feature_Explore/.test(n.sprite || '')));
    const sig = tiles.map(t => t.id + '@' + t.x + ',' + t.y + ',' + t.rot).join('|') + '#' + feat.map(n => n.id + (n.visible ? '+' : '-')).join('|') + '#' + Object.keys(rev).length;
    if (MAP._sig === sig && MAP._g) return MAP._g;
    const cells = [], byTileKey = {}, TS = {};
    for (const t of tiles) {
      const S = MAP.spec(t.model, t.shape); TS[t.id] = S;
      const sq = {};
      S.grid.forEach((row, r) => row.forEach((k, c) => { if (k) (sq[k] = sq[k] || []).push([r, c]); }));
      for (const [k, list] of Object.entries(sq)) {
        const pts = list.map(([r, c]) => sqCenter(S, r, c));
        let ax, ay;
        if (S.anchor[k]) [ax, ay] = S.anchor[k];
        else {
          const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
          // 白點放在離這格邊界最遠的地方（斜切、長條形的格子也放在明顯的位置）；一樣遠就選靠近中心的
          const own = new Set(list.map(([r, c]) => r * 1000 + c)), dist = new Map(), qu = [];
          for (const [r, c] of list) if ([[0, 1], [1, 0], [0, -1], [-1, 0]].some(([a, b]) => !own.has((r + a) * 1000 + c + b))) { dist.set(r * 1000 + c, 1); qu.push([r, c]); }
          for (let h = 0; h < qu.length; h++) { const [r, c] = qu[h], d = dist.get(r * 1000 + c); for (const [a, b] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const k2 = (r + a) * 1000 + c + b; if (own.has(k2) && !dist.has(k2)) { dist.set(k2, d + 1); qu.push([r + a, c + b]); } } }
          const maxD = Math.max(...list.map(([r, c]) => dist.get(r * 1000 + c) || 1));
          const best = list.filter(([r, c]) => (dist.get(r * 1000 + c) || 1) >= maxD - (S.q > 4 ? 1 : 0)).map(([r, c]) => sqCenter(S, r, c)).sort((p, q) => Math.hypot(p[0] - mx, p[1] - my) - Math.hypot(q[0] - mx, q[1] - my))[0];
          // 中心點附近的 2×2 小方格都屬於同一格：放在小方格交界，比較好看
          [ax, ay] = best;
        }
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const hq = 0.5 / S.q, bx0 = Math.min(...xs) - hq, bx1 = Math.max(...xs) + hq, by0 = Math.min(...ys) - hq, by1 = Math.max(...ys) + hq;
        const [wx, wy] = toWorld(t, ax, ay), [rx, ry] = toWorld(t, (bx0 + bx1) / 2, (by0 + by1) / 2);
        const sw = Math.abs(Math.round(t.rot / 90)) % 2 === 1;
        const c = { id: cells.length, tile: t.id, model: t.model, map: t.map, lk: k, room: t.id + ':' + (S.rooms[k] || k), name: S.names[k] || S.names[S.rooms[k]] || '', x: wx, y: wy, rx, ry, hx: sw ? (by1 - by0) / 2 : (bx1 - bx0) / 2, hy: sw ? (bx1 - bx0) / 2 : (by1 - by0) / 2, n: list.length, bld: /^bld/.test(k) || (S.bld || []).includes(k) };
        cells.push(c); byTileKey[t.id + '|' + k] = c;
      }
    }
    const adj = cells.map(() => []), nbr = cells.map(() => []);
    const link = (i, j) => { if (i === j) return; if (!nbr[i].includes(j)) nbr[i].push(j); if (!nbr[j].includes(i)) nbr[j].push(i); };
    const pairs = {};   // "i|j" → 收集到的邊
    const addSeg = (a, b, type, wx, wy, horiz, gate) => {
      const i = Math.min(a.id, b.id), j = Math.max(a.id, b.id), key = i + '|' + j;
      (pairs[key] = pairs[key] || []).push({ type, wx, wy, horiz, gate });
    };
    // 找世界座標上某一點在哪塊板塊的哪一格
    const keyAt = (x, y, map) => {
      for (const t of tiles) { if ((t.map || null) !== (map || null)) continue; const S = TS[t.id], [lx, ly] = toLocal(t, x, y); if (Math.abs(lx) > S.tw / 2 || Math.abs(ly) > S.th / 2) continue; const q = sqAt(S, lx, ly); if (!q) continue; const k = S.grid[q[0]][q[1]]; return { t, S, k, lx, ly }; }
      return null;
    };
    tiles.forEach((t, ti) => {
      const S = TS[t.id];
      for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) {
        const k = S.grid[r][c]; if (!k) continue;
        const a = byTileKey[t.id + '|' + k];
        const [cx, cy] = sqCenter(S, r, c);
        for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          const ex = cx + dc * 0.5 / S.q, ey = cy - dr * 0.5 / S.q;   // 邊的中點（局部）
          const [wx, wy] = toWorld(t, ex, ey);
          const horizLocal = dr !== 0;   // 局部的上下邊＝水平線
          const [hx2, hy2] = MAP.rot(horizLocal ? 1 : 0, horizLocal ? 0 : 1, t.rot), horiz = Math.abs(hx2) > Math.abs(hy2);
          if (r2 >= 0 && r2 < S.rows && c2 >= 0 && c2 < S.cols) {
            if (dr < 0 || dc < 0) continue;   // 每條內部邊只算一次
            const k2 = S.grid[r2][c2]; if (!k2 || k2 === k) continue;
            const b = byTileKey[t.id + '|' + k2], L = S.links[k + '|' + k2];
            addSeg(a, b, L ? L.type : 'wall', wx, wy, horiz, L && L.gate ? { t, p: L.gate } : null);
          } else {
            // 板塊邊緣：看對面是不是別的板塊
            const [ox, oy] = toWorld(t, cx + dc / S.q, cy - dr / S.q);
            const o = keyAt(ox, oy, t.map); if (!o || o.t === t || !o.k) continue;
            if (tiles.indexOf(o.t) < ti) continue;   // 兩塊板塊之間的邊只算一次
            const b = byTileKey[o.t.id + '|' + o.k];
            const [elx, ely] = toLocal(o.t, wx, wy);
            addSeg(a, b, (a.bld || b.bld) ? 'wall' : combine(edgeType(t, S, ex, ey), edgeType(o.t, o.S, elx, ely)), wx, wy, horiz, null); { const sg = pairs[Math.min(a.id, b.id) + '|' + Math.max(a.id, b.id)].slice(-1)[0]; if (sg.type === 'door') { sg.dks = [edgeDoor(t, S, ex, ey), edgeDoor(o.t, o.S, elx, ely)].filter(Boolean); } } if (MAP._dbg) pairs[Math.min(a.id, b.id) + '|' + Math.max(a.id, b.id)].slice(-1)[0].why = edgeType(t, S, ex, ey) + '+' + edgeType(o.t, o.S, elx, ely);
          }
        }
      }
    });
    // 一扇門只連一對格子：門跨在兩格交界時，只留最靠近門中央的那一對（其他的算牆）
    { const win = {};
      for (const [key, segs] of Object.entries(pairs)) for (const s of segs) for (const D of s.dks || []) if (!win[D.key] || D.d < win[D.key].d) win[D.key] = { d: D.d, key };
      for (const [key, segs] of Object.entries(pairs)) for (const s of segs) if ((s.dks || []).some(D => win[D.key].key !== key)) s.type = 'wall'; }
    // 地圖上的牆、門、探索標記：改變它附近那段邊
    const near = (n, s, along, perp) => { const dx = n.x - s.wx, dy = n.y - s.wy; return s.horiz ? (Math.abs(dx) <= along && Math.abs(dy) <= perp) : (Math.abs(dy) <= along && Math.abs(dx) <= perp); };
    const walls = feat.filter(n => n.visible && /Wall/.test(n.sprite || ''));
    const doors = feat.filter(n => (/Door|Secret/.test(n.sprite || '') && !/TrapDoor/.test(n.sprite || '')) || (!n.visible && /Wall/.test(n.sprite || '')));   // 地板上的暗道（TrapDoor）不是牆上的門   // 牆被拿掉＝打開的通道
    const explores = feat.filter(n => !/Wall|Door|Secret/.test(n.sprite || ''));
    // 地圖上的門、探索標記：只作用在離它最近的那一對格子
    const nodePair = {};
    for (const n of doors.concat(explores)) { let bd = 9; for (const [key, segs] of Object.entries(pairs)) for (const s of segs) { if (s.gate || !near(n, s, 0.3, 0.2)) continue; const d = Math.hypot(n.x - s.wx, n.y - s.wy) + ((s.type === 'open' || s.type === 'imp') ? 1 : 0); if (d < bd) { bd = d; nodePair[n.id] = key; } } }
    for (const [key, segs] of Object.entries(pairs)) {
      const [i, j] = key.split('|').map(Number);
      let best = null, gate = null, nodeDoor = null, viaMarker = false;
      for (const s of segs) {
        let ty = s.type;
        if (s.gate) {
          gate = s.gate;
          const [gx, gy] = toWorld(s.gate.t, s.gate.p[0], s.gate.p[1]);
          const gs = Object.values(G.nodes).filter(n => !n.virtual && (n.map == null || s.gate.t.map == null || n.map === s.gate.t.map) && /EXPLORE|DOOR/i.test(n.id + ' ' + (n.sprite || '')) && !/Wall/.test(n.sprite || '') && Math.hypot(n.x - gx, n.y - gy) < 0.3);
          // 門上有探索標記＝還關著。標記從來沒放出來（例如從暗道進到小屋，兩邊都已經探索）＝普通的門
          const shut = gs.some(n => n.visible);
          if (shut) { cells[i].shut = cells[i].shut || cells[i].bld; cells[j].shut = cells[j].shut || cells[j].bld; ty = 'wall'; } else ty = 'door';
          s.wx = gx; s.wy = gy;
        } else {
          if (walls.some(n => near(n, s, 0.5, 0.18))) ty = 'wall';
          if (doors.some(n => nodePair[n.id] === key && near(n, s, 0.3, 0.18))) { ty = 'door'; nodeDoor = nodeDoor || { mx: s.wx, my: s.wy }; }
          else if (explores.some(n => n.visible && near(n, s, 0.3, 0.2))) ty = 'wall';   // 探索標記還沒點開＝門還關著，過不去
          else if (ty === 'wall' && explores.some(n => nodePair[n.id] === key && near(n, s, 0.3, 0.2))) { ty = 'door'; nodeDoor = nodeDoor || { mx: s.wx, my: s.wy }; }
          if (explores.some(n => !n.visible && nodePair[n.id] === key && near(n, s, 0.3, 0.2))) viaMarker = true;
        }
        if (!best || RANK[ty] > RANK[best.type]) best = { type: ty, mx: s.wx, my: s.wy };
      }
      if (nodeDoor) best = { type: 'door', mx: nodeDoor.mx, my: nodeDoor.my };   // 地圖上放了門：這兩格之間就是門
      else if (MAP.USE_REGION && !gate && !viaMarker && cells[i].tile !== cells[j].tile && best.type !== 'wall' && !MAP.sameRegion(cells[i].tile, cells[j].tile)) best = { type: 'wall', mx: best.mx, my: best.my };   // 不同區：沒有標記就不能過
      link(i, j);
      if (best.type !== 'wall') { adj[i].push({ to: j, type: best.type, mx: best.mx, my: best.my }); adj[j].push({ to: i, type: best.type, mx: best.mx, my: best.my }); }
    }
    // 舊資料的「斜角相連」（沒有共用邊，但指定相通，例如溫室的木平台）
    const seen = new Set(Object.keys(pairs));
    for (const t of tiles) {
      const S = TS[t.id];
      for (const [p, v] of Object.entries(S.links)) {
        if (!v.diag || v.type === 'wall') continue;
        const [k1, k2] = p.split('|'); const a = byTileKey[t.id + '|' + k1], b = byTileKey[t.id + '|' + k2]; if (!a || !b || a.id > b.id) continue;
        const key = a.id + '|' + b.id; if (seen.has(key)) continue; seen.add(key);
        link(a.id, b.id); adj[a.id].push({ to: b.id, type: v.type }); adj[b.id].push({ to: a.id, type: v.type });
      }
    }
    MAP._sig = sig; MAP._g = { cells, adj, nbr, TS }; if (MAP._dbg) { MAP._g.pairs = pairs; MAP._g.nodePair = nodePair; }
    return MAP._g;
  };

  MAP.cellAt = function (x, y) {
    const g = MAP.build();
    const tiles = Object.values(G.tiles || {}).filter(t => t.revealed);
    for (const t of tiles) {
      const S = g.TS[t.id] || MAP.spec(t.model, t.shape); const [lx, ly] = toLocal(t, x, y);
      if (Math.abs(lx) > S.tw / 2 + 0.02 || Math.abs(ly) > S.th / 2 + 0.02) continue;
      const q = sqAt(S, Math.max(-S.tw / 2 + 0.001, Math.min(S.tw / 2 - 0.001, lx)), Math.max(-S.th / 2 + 0.001, Math.min(S.th / 2 - 0.001, ly))); if (!q) continue;
      let k = S.grid[q[0]][q[1]];
      if (!k) {   // 站在牆上：找最近的小方格
        let bd = 9;
        S.grid.forEach((row, r) => row.forEach((kk, c) => { if (!kk) return; const [cx, cy] = sqCenter(S, r, c), d = Math.hypot(cx - lx, cy - ly); if (d < bd) { bd = d; k = kk; } }));
      }
      const c = g.cells.find(cc => cc.tile === t.id && cc.lk === k);
      if (c) return c;
    }
    return null;
  };
})();
