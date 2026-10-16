// ============================================================
//  詭鎮街道：疊塔謎題（官方規則）＋ 3×2／4×2 圖片拼圖
//  疊塔：三根柱子，每一步把任一柱最上面那塊移到另一根柱子最上面；
//        全部疊在同一根柱子、順序正確（大的在下）就完成。
// ============================================================
(function () {
  // ---------------- 圖片拼圖：支援 3×3、3×2、4×2 ----------------
  const origSlide = Puzzles.slide;
  Puzzles.slide = function (a, f) {
    const size = a.Size || 0;
    if (!size) return origSlide.apply(Puzzles, arguments);
    const C = size === 2 ? 4 : 3, R = 2;
    return new Promise(res => {
      let st = PZ.saved(f);
      if (!st) {
        const lo = a.DifficultyMin || 3, hi = a.DifficultyMax || lo, want = lo + rnd(hi - lo + 1);
        const pool = PUZZLES.slide.filter(p => p.size === size);
        const near = pool.slice().sort((x, y) => Math.abs(x.d - want) - Math.abs(y.d - want));
        st = { L: pick(near.filter(p => p.d === near[0].d)).L.slice(), total: 0 };
        PZ.save(f, st);
      }
      const img = 'img/misc/' + ((a.Image && a.Image.ref) || 'artTheUsualSuspects_4x2') + '.png';
      const T_ = 135, gap = 6;
      const XS = [...Array(C)].map((_, i) => (i - (C - 1) / 2) * (T_ + gap)), YS = [(T_ + gap) / 2, -(T_ + gap) / 2];
      let moves = 0, sel = null, finished = false;
      const L = OFF.open(`<div class="pzView" id="pzv">
        <div class="abs" style="${OFF.at(0, 0, 776, 582)};background:url(img/misc/PicturePuzzleBG.png) center/100% 100%;filter:brightness(.7)"></div>
        <div id="tiles"></div>
        ${PZ.bottomBar(a, st, [{ x: -80 - 42, y: -261, key: 'UI_PUZZLE_SKILL', img: PZ.skillIcon(a.AbilityType) }, { x: 60 - 45, y: -261, key: 'UI_PUZZLE_MOVES', id: 'mv', val: 0 }, { x: 254 - 72, y: -261, key: 'UI_PUZZLE_TOTAL_MOVES', id: 'tm', val: st.total }])}
        ${PZ.closeBtn(-282, -263)}
      </div>`);
      const view = L.querySelector('#pzv'), box = L.querySelector('#tiles');
      const adj = (p, q) => { const r1 = Math.floor(p / C), c1 = p % C, r2 = Math.floor(q / C), c2 = q % C; return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; };
      const draw = () => {
        box.innerHTML = st.L.map((piece, pos) => {
          const x = XS[pos % C], y = YS[Math.floor(pos / C)];
          const px = (piece % C) * T_, py = Math.floor(piece / C) * T_;
          return `<div class="pzTile ${sel === pos ? 'sel' : ''}" data-p="${pos}" style="${OFF.at(x, y, T_, T_)};background-image:url(${img});background-size:${T_ * C * OFF.u}px ${T_ * R * OFF.u}px;background-position:${-px * OFF.u}px ${-py * OFF.u}px"></div>`;
        }).join('');
        L.querySelector('#mv').textContent = moves; L.querySelector('#tm').textContent = st.total;
        box.querySelectorAll('.pzTile').forEach(el => {
          el.onclick = () => click(+el.dataset.p);
          el.onmouseenter = () => { if (sel != null && adj(sel, +el.dataset.p)) el.classList.add('drop'); };
          el.onmouseleave = () => el.classList.remove('drop');
        });
      };
      const click = async p => {
        if (finished) return;
        if (sel == null || sel === p || !adj(sel, p)) { sel = sel === p ? null : p; draw(); return; }
        [st.L[sel], st.L[p]] = [st.L[p], st.L[sel]]; sel = null; moves++; st.total++;
        draw();
        if (st.L.every((v, i) => v === i)) {
          finished = true; PZ.clear(f);
          box.innerHTML = `<div class="abs" style="${OFF.at(0, 0, C * T_ + (C - 1) * gap, R * T_ + gap)};background:url(${img}) center/100% 100%;box-shadow:0 0 ${20 * OFF.u}px #000"></div>`;
          await PZ.finish(view, true); res(true);
        }
      };
      L.querySelector('#pzClose').onclick = async () => { if (finished) return; await PZ.finish(view, false); res(false); };
      draw();
    });
  };

  // ---------------- 疊塔謎題 ----------------
  // 狀態：三根柱子，每根由下往上列出塊的編號（0 = 最上面那塊、n-1 = 最下面那塊）
  const key = s => s.map(c => c.join(',')).join('|');
  // 從三種完成狀態往回走，找出最少步數剛好在難度範圍內的起始排列
  Puzzles.towerScramble = function (n, lo, hi) {
    const goal = [...Array(n).keys()].reverse();
    const starts = [[goal, [], []], [[], goal, []], [[], [], goal]];
    const dist = new Map(); let q = [];
    for (const s of starts) { dist.set(key(s), 0); q.push(s); }
    const byD = {};
    for (let d = 0; d < hi && q.length; d++) {
      const nq = [];
      for (const s of q) for (let i = 0; i < 3; i++) if (s[i].length) for (let j = 0; j < 3; j++) if (j !== i) {
        const t = s.map(c => c.slice()); t[j].push(t[i].pop());
        const k = key(t); if (dist.has(k)) continue;
        dist.set(k, d + 1); nq.push(t); (byD[d + 1] = byD[d + 1] || []).push(t);
      }
      q = nq;
    }
    for (let d = hi; d >= 1; d--) {
      const pool = [];
      for (let e = lo; e <= hi; e++) if (byD[e]) pool.push(...byD[e]);
      if (pool.length) return pick(pool);
      lo = Math.max(1, lo - 1);
    }
    return starts[1];
  };
  Puzzles.tower = function (a, f) {
    return new Promise(res => {
      const n = [4, 5, 6][a.Size || 0] || 5;
      let st = PZ.saved(f);
      if (!st) { st = { cols: Puzzles.towerScramble(n, a.DifficultyMin || 3, a.DifficultyMax || a.DifficultyMin || 5), total: 0 }; PZ.save(f, st); }
      const uniq = !!a.UseUniqueImage && a.Image && a.Image.ref;
      const img = uniq ? 'img/misc/' + a.Image.ref + '.png' : null;
      const COLX = [-235, 0, 235], BASE = -170, H = Math.min(64, 330 / n), W = 210;
      let moves = 0, sel = null, finished = false;
      const L = OFF.open(`<div class="pzView" id="pzv">
        <div class="abs" style="${OFF.at(0, 0, 844, 638)};background:url(img/misc/PuzzleBG.png) center/100% 100%;filter:sepia(.4) brightness(.45)"></div>
        <div id="tiles"></div>
        ${PZ.bottomBar(a, st, [{ x: -80 - 42, y: -264, key: 'UI_PUZZLE_SKILL', img: PZ.skillIcon(a.AbilityType) }, { x: 60 - 45, y: -264, key: 'UI_PUZZLE_MOVES', id: 'mv', val: 0 }, { x: 254 - 72, y: -264, key: 'UI_PUZZLE_TOTAL_MOVES', id: 'tm', val: st.total }])}
        ${PZ.closeBtn(-282, -263)}
        <div class="pzLbl" style="left:${-330 * OFF.u}px;top:${-285 * OFF.u}px;font-size:${16 * OFF.u}px">點一根柱子拿起最上面那塊，再點另一根柱子放上去</div>
      </div>`);
      const view = L.querySelector('#pzv'), box = L.querySelector('#tiles');
      const pieceStyle = p => {
        if (uniq) return `background-image:url(${img});background-size:${W * OFF.u}px ${H * n * OFF.u}px;background-position:0 ${-p * H * OFF.u}px`;
        return `background:linear-gradient(#b07a3c,#7a4a1c);border:${2 * OFF.u}px solid #3d2410;border-radius:${4 * OFF.u}px`;
      };
      const pieceW = p => uniq ? W : 80 + (W - 80) * (p + 1) / n;
      const draw = () => {
        box.innerHTML = COLX.map((x, i) => `<div class="abs towerPost" data-c="${i}" style="${OFF.at(x, BASE + 175, 14, 380)}"></div><div class="abs towerBase" data-c="${i}" style="${OFF.at(x, BASE - 10, 236, 16)}"></div>`).join('') + st.cols.map((c, ci) => c.map((p, h) => {
          const lift = sel === ci && h === c.length - 1 ? 26 : 0;
          return `<div class="abs towerPiece ${lift ? 'lift' : ''}" data-c="${ci}" style="${OFF.at(COLX[ci], BASE + H / 2 + h * H + lift, pieceW(p), H - 2)};${pieceStyle(p)}"></div>`;
        }).join('')).join('');
        L.querySelector('#mv').textContent = moves; L.querySelector('#tm').textContent = st.total;
        view.querySelectorAll('[data-c]').forEach(el => el.onclick = () => click(+el.dataset.c));
      };
      const done = () => st.cols.some(c => c.length === n && c.every((v, i) => v === n - 1 - i));
      const click = async ci => {
        if (finished) return;
        if (sel == null) { if (st.cols[ci].length) { sel = ci; draw(); } return; }
        if (sel === ci) { sel = null; draw(); return; }
        st.cols[ci].push(st.cols[sel].pop()); sel = null; moves++; st.total++;
        draw();
        if (done()) {
          finished = true; PZ.clear(f);
          await sleep(500); await PZ.finish(view, true); res(true);
        }
      };
      L.querySelector('#pzClose').onclick = async () => { if (finished) return; await PZ.finish(view, false); res(false); };
      draw();
    });
  };
  Actions.DisplayTowerPuzzle = async function (a, f) { const r = await queueDialog(() => Puzzles.tower(a, f)); return { event: r ? a.CompletedEvent : a.FailEvent }; };
})();

// ============================================================
//  水管謎題（DisplayPipePuzzle）、旋轉謎題（DisplayRotatePuzzle）
//  ※ 找不到官方規則說明，以下是「自訂規則」，依官方參數（難度、符號數、隱藏數）設計，之後可依實際 APP 再調整
//  水管：點一格水管就順時針轉 90 度；把左邊進水口接到右邊出水口就完成。難度 = 被轉亂的格數
//  旋轉：四圈轉盤，每圈 8 個符號。轉某一圈時，它外面那一圈也會一起轉；
//        讓「上、下」兩條線上的符號和右邊答案一樣就完成。部分符號蓋住（顯示 ?）
// ============================================================
(function () {
  const rot1 = m => ((m << 1) | (m >> 3)) & 15;          // 1上 2右 4下 8左，順時針轉一次
  const DR = { 1: [-1, 0, 4], 2: [0, 1, 8], 4: [1, 0, 1], 8: [0, -1, 2] };
  Puzzles.pipeMake = function (lo, hi) {
    const want = lo + rnd(hi - lo + 1);
    const [R, C] = want <= 5 ? [4, 4] : want <= 7 ? [4, 5] : [5, 5];
    for (let tries = 0; tries < 200; tries++) {
      const r0 = rnd(R), seen = new Set([r0 + ',0']), path = [[r0, 0]];
      const dfs = () => {
        const [r, c] = path[path.length - 1];
        if (c === C - 1 && path.length > want && rnd(2)) return true;
        const ds = [1, 2, 4, 8].sort(() => Math.random() - .5);
        for (const d of ds) { const [dr, dc] = DR[d], nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= R || nc >= C || seen.has(nr + ',' + nc)) continue;
          seen.add(nr + ',' + nc); path.push([nr, nc]); if (dfs()) return true; path.pop(); }
        return false;
      };
      if (!dfs()) continue;
      const g = [...Array(R)].map(() => Array(C).fill(0));
      const dirTo = (a, b) => b[0] < a[0] ? 1 : b[1] > a[1] ? 2 : b[0] > a[0] ? 4 : 8;
      path.forEach((p, i) => { g[p[0]][p[1]] = (i ? dirTo(p, path[i - 1]) : 8) | (i < path.length - 1 ? dirTo(p, path[i + 1]) : 2); });
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (!g[r][c]) { let m = [5, 3, 7][rnd(3)]; for (let k = rnd(4); k > 0; k--) m = rot1(m); g[r][c] = m; }
      const ans = path.map(([r, c]) => [r, c, g[r][c]]);
      const k = Math.min(path.length, want), idx = path.map((_, i) => i).sort(() => Math.random() - .5).slice(0, k);
      for (const i of idx) { const [r, c] = path[i], m0 = g[r][c]; let m = m0; do { m = rot1(m); } while (m === m0); for (let t = rnd(3); t > 0; t--) { const n = rot1(m); if (n !== m0) m = n; } g[r][c] = m; }
      const st = { R, C, r0, r1: path[path.length - 1][0], g, ans, total: 0 };
      if (!Puzzles.pipeFlow(st).done) return st;
    }
    return null;
  };
  Puzzles.pipeFlow = function (st) {
    const wet = new Set(); const q = [];
    if (st.g[st.r0][0] & 8) { wet.add(st.r0 + ',0'); q.push([st.r0, 0]); }
    while (q.length) { const [r, c] = q.shift(), m = st.g[r][c];
      for (const d of [1, 2, 4, 8]) if (m & d) { const [dr, dc, back] = DR[d], nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= st.R || nc >= st.C) continue;
        if (!(st.g[nr][nc] & back) || wet.has(nr + ',' + nc)) continue; wet.add(nr + ',' + nc); q.push([nr, nc]); } }
    return { wet, done: wet.has(st.r1 + ',' + (st.C - 1)) && !!(st.g[st.r1][st.C - 1] & 2) };
  };
  Puzzles.pipe = function (a, f) {
    return new Promise(res => {
      let st = PZ.saved(f);
      if (!st) { st = Puzzles.pipeMake(a.DifficultyMin || 4, a.DifficultyMax || a.DifficultyMin || 4); if (!st) return res(true); PZ.save(f, st); }
      const brass = a.PuzzleSkin === 1, S = 92, W = st.C * S, H = st.R * S;
      let moves = 0, finished = false;
      const L = OFF.open(`<div class="pzView" id="pzv">
        <div class="abs" style="${OFF.at(0, 0, 844, 638)};background:url(img/misc/PuzzleBG.png) center/100% 100%;filter:sepia(.5) brightness(.45)"></div>
        <div class="abs" id="pipeBox" style="${OFF.at(0, 25, W + 120, H)}"></div>
        ${PZ.bottomBar(a, st, [{ x: -80 - 42, y: -264, key: 'UI_PUZZLE_SKILL', img: PZ.skillIcon(a.AbilityType) }, { x: 60 - 45, y: -264, key: 'UI_PUZZLE_MOVES', id: 'mv', val: 0 }, { x: 254 - 72, y: -264, key: 'UI_PUZZLE_TOTAL_MOVES', id: 'tm', val: st.total }])}
        ${PZ.closeBtn(-282, -263)}
        <div class="pzLbl" style="left:${-330 * OFF.u}px;top:${-285 * OFF.u}px;font-size:${16 * OFF.u}px">點水管會順時針轉 90 度，把左邊的進水口接到右邊的出水口</div>
      </div>`);
      const view = L.querySelector('#pzv'), box = L.querySelector('#pipeBox');
      const pipeCol = brass ? '#b8893c' : '#8b8f94', water = '#3fa7e0';
      const draw = () => {
        const { wet } = Puzzles.pipeFlow(st); let s = '';
        for (let r = 0; r < st.R; r++) for (let c = 0; c < st.C; c++) {
          const x = 60 + c * S, y = r * S, cx = x + S / 2, cy = y + S / 2, m = st.g[r][c], col = wet.has(r + ',' + c) ? water : pipeCol;
          s += `<g class="pipeCell" data-r="${r}" data-c="${c}" style="cursor:pointer"><rect x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}" rx="6" fill="rgba(20,16,12,.85)" stroke="#5a4a32"/>`;
          for (const d of [1, 2, 4, 8]) if (m & d) { const [dr, dc] = DR[d]; s += `<line x1="${cx}" y1="${cy}" x2="${cx + dc * S / 2}" y2="${cy + dr * S / 2}" stroke="${col}" stroke-width="20" stroke-linecap="${'butt'}"/>`; }
          s += `<circle cx="${cx}" cy="${cy}" r="12" fill="${col}"/></g>`;
        }
        const arrow = (x, y, wetIn) => `<line x1="${x}" y1="${y}" x2="${x + 60}" y2="${y}" stroke="${wetIn ? water : pipeCol}" stroke-width="20"/>`;
        s += arrow(0, st.r0 * S + S / 2, true) + arrow(60 + W, st.r1 * S + S / 2, Puzzles.pipeFlow(st).done);
        s += `<text x="4" y="${st.r0 * S + S / 2 - 16}" fill="#ddd" font-size="16">進水</text><text x="${68 + W}" y="${st.r1 * S + S / 2 - 16}" fill="#ddd" font-size="16">出水</text>`;
        box.innerHTML = `<svg viewBox="0 0 ${W + 120} ${H}" width="100%" height="100%">${s}</svg>`;
        L.querySelector('#mv').textContent = moves; L.querySelector('#tm').textContent = st.total;
        box.querySelectorAll('.pipeCell').forEach(el => el.onclick = () => click(+el.dataset.r, +el.dataset.c));
      };
      const click = async (r, c) => {
        if (finished) return;
        st.g[r][c] = rot1(st.g[r][c]); moves++; st.total++; draw();
        if (Puzzles.pipeFlow(st).done) { finished = true; PZ.clear(f); await sleep(500); await PZ.finish(view, true); res(true); }
      };
      L.querySelector('#pzClose').onclick = async () => { if (finished) return; await PZ.finish(view, false); res(false); };
      draw();
    });
  };

  // ---------------- 旋轉謎題 ----------------
  const RN = 4, SN = 8;
  const SYM = [['●', '#d9534f'], ['▲', '#5cb85c'], ['■', '#5bc0de'], ['✚', '#f0ad4e'], ['★', '#c58be0'], ['◆', '#e0e0e0']];
  const spin = (st, i, d) => { for (let j = i; j <= Math.min(i + 1, RN - 1); j++) st.off[j] = (st.off[j] + d + SN) % SN; };
  const at = (st, i, pos) => (pos - st.off[i] + SN * 2) % SN;     // 位置 pos（0=上、4=下）現在是第幾個符號
  Puzzles.rotateSolved = st => st.ring.every((ring, i) => ring[at(st, i, 0)] === st.sol[i][0] && ring[at(st, i, SN / 2)] === st.sol[i][1]);
  Puzzles.rotateMake = function (a) {
    const K = Math.min(SYM.length, Math.max(2, a.SymbolsUsed || 4)), diff = Math.max(1, a.Difficulty || 4);
    for (let tries = 0; tries < 100; tries++) {
      const ring = [...Array(RN)].map(() => [...Array(SN)].map(() => rnd(K)));
      const st = { ring, off: Array(RN).fill(0), sol: ring.map(r => [r[0], r[SN / 2]]), total: 0 };
      const cells = []; for (let i = 0; i < RN; i++) for (let j = 0; j < SN; j++) cells.push(i + ',' + j);
      st.hideDial = cells.sort(() => Math.random() - .5).slice(0, Math.min(cells.length, a.DialSymbolsHidden || 0));
      // 答案蓋住的符號：每圈最多蓋一個（兩個都蓋住就只能用猜的）
      st.hideSol = [...Array(RN).keys()].sort(() => Math.random() - .5).slice(0, Math.min(RN, a.SolutionSymbolsHidden || 0)).map(i => i + ',' + rnd(2));
      let last = null;
      for (let k = 0; k < diff; k++) { let i, d; do { i = rnd(RN); d = rnd(2) ? 1 : -1; } while (last && last[0] === i && last[1] === -d); spin(st, i, d); last = [i, d]; }
      if (!Puzzles.rotateSolved(st)) return st;
    }
    return null;
  };
  Puzzles.rotate = function (a, f) {
    return new Promise(res => {
      let st = PZ.saved(f);
      if (!st) { st = Puzzles.rotateMake(a); if (!st) return res(true); PZ.save(f, st); }
      const brass = a.PuzzleSkin === 1;
      let moves = 0, finished = false;
      const L = OFF.open(`<div class="pzView" id="pzv">
        <div class="abs" style="${OFF.at(0, 0, 844, 638)};background:url(img/misc/PuzzleBG.png) center/100% 100%;filter:sepia(.4) brightness(.45)"></div>
        <div class="abs" id="rotBox" style="${OFF.at(0, 25, 760, 470)}"></div>
        ${PZ.bottomBar(a, st, [{ x: -80 - 42, y: -264, key: 'UI_PUZZLE_SKILL', img: PZ.skillIcon(a.AbilityType) }, { x: 60 - 45, y: -264, key: 'UI_PUZZLE_MOVES', id: 'mv', val: 0 }, { x: 254 - 72, y: -264, key: 'UI_PUZZLE_TOTAL_MOVES', id: 'tm', val: st.total }])}
        ${PZ.closeBtn(-282, -263)}
        <div class="pzLbl" style="left:${-330 * OFF.u}px;top:${-285 * OFF.u}px;font-size:${16 * OFF.u}px">轉某一圈時，外面那一圈也會跟著轉；讓上下兩條線的符號和右邊答案一樣</div>
      </div>`);
      const view = L.querySelector('#pzv'), box = L.querySelector('#rotBox');
      const sym = (k, x, y, sz, hid) => hid ? `<text x="${x}" y="${y}" font-size="${sz}" fill="#999" text-anchor="middle" dominant-baseline="central">?</text>` : `<text x="${x}" y="${y}" font-size="${sz}" fill="${SYM[k][1]}" text-anchor="middle" dominant-baseline="central">${SYM[k][0]}</text>`;
      const draw = () => {
        const cx = 330, cy = 235; let s = '';
        for (let i = RN - 1; i >= 0; i--) {
          const rr = 62 + i * 46;
          s += `<circle cx="${cx}" cy="${cy}" r="${rr + 22}" fill="${brass ? (i % 2 ? '#5a4524' : '#6e5530') : (i % 2 ? '#2e2a26' : '#3b3631')}" stroke="#111" stroke-width="2"/>`;
        }
        s += `<circle cx="${cx}" cy="${cy}" r="38" fill="#1a1714"/><line x1="${cx}" y1="${cy - 240}" x2="${cx}" y2="${cy - 40}" stroke="#e6c35c" stroke-width="3" stroke-dasharray="6 5" opacity=".8"/><line x1="${cx}" y1="${cy + 40}" x2="${cx}" y2="${cy + 240}" stroke="#e6c35c" stroke-width="3" stroke-dasharray="6 5" opacity=".8"/>`;
        for (let i = 0; i < RN; i++) { const rr = 62 + i * 46;
          for (let j = 0; j < SN; j++) { const pos = (j + st.off[i]) % SN, ang = pos * 2 * Math.PI / SN;
            s += sym(st.ring[i][j], cx + rr * Math.sin(ang), cy - rr * Math.cos(ang), 26, st.hideDial.includes(i + ',' + j)); } }
        // 左邊：每圈的轉動按鈕（裡→外）
        for (let i = 0; i < RN; i++) { const y = 70 + i * 95;
          s += `<text x="10" y="${y - 22}" fill="#ccc" font-size="15">第${i + 1}圈（${i ? '往外' : '最裡面'}）</text>`;
          s += `<g class="rotBtn" data-i="${i}" data-d="-1" style="cursor:pointer"><rect x="10" y="${y - 12}" width="48" height="40" rx="6" fill="#4a3b28" stroke="#b7954f"/><text x="34" y="${y + 9}" fill="#fff" font-size="24" text-anchor="middle" dominant-baseline="central">⟲</text></g>`;
          s += `<g class="rotBtn" data-i="${i}" data-d="1" style="cursor:pointer"><rect x="66" y="${y - 12}" width="48" height="40" rx="6" fill="#4a3b28" stroke="#b7954f"/><text x="90" y="${y + 9}" fill="#fff" font-size="24" text-anchor="middle" dominant-baseline="central">⟳</text></g>`; }
        // 右邊：答案（上線、下線，各從裡到外）
        s += `<text x="620" y="40" fill="#ddd" font-size="18">答案</text><text x="600" y="78" fill="#bbb" font-size="14">上</text><text x="680" y="78" fill="#bbb" font-size="14">下</text>`;
        for (let i = 0; i < RN; i++) { const y = 115 + i * 70;
          s += `<text x="575" y="${y}" fill="#999" font-size="13" dominant-baseline="central">${i + 1}</text>`;
          s += `<rect x="588" y="${y - 25}" width="50" height="50" rx="6" fill="#1a1714" stroke="#776"/>` + sym(st.sol[i][0], 613, y, 28, st.hideSol.includes(i + ',0'));
          s += `<rect x="668" y="${y - 25}" width="50" height="50" rx="6" fill="#1a1714" stroke="#776"/>` + sym(st.sol[i][1], 693, y, 28, st.hideSol.includes(i + ',1')); }
        box.innerHTML = `<svg viewBox="0 0 760 470" width="100%" height="100%">${s}</svg>`;
        L.querySelector('#mv').textContent = moves; L.querySelector('#tm').textContent = st.total;
        box.querySelectorAll('.rotBtn').forEach(el => el.onclick = () => click(+el.dataset.i, +el.dataset.d));
      };
      const click = async (i, d) => {
        if (finished) return;
        spin(st, i, d); moves++; st.total++; draw();
        if (Puzzles.rotateSolved(st)) { finished = true; PZ.clear(f); await sleep(500); await PZ.finish(view, true); res(true); }
      };
      L.querySelector('#pzClose').onclick = async () => { if (finished) return; await PZ.finish(view, false); res(false); };
      draw();
    });
  };
  Actions.DisplayPipePuzzle = async function (a, f) { const r = await queueDialog(() => Puzzles.pipe(a, f)); return { event: r ? a.CompletedEvent : a.FailEvent }; };
  Actions.DisplayRotatePuzzle = async function (a, f) { const r = await queueDialog(() => Puzzles.rotate(a, f)); return { event: r ? a.CompletedEvent : a.FailEvent }; };
})();
