// ============================================================
//  謎題：滑塊拼圖、密碼謎題、鎖謎題
//  每次嘗試可用步數 = 解謎調查員的對應能力值（與官方 App 相同）
// ============================================================
const Puzzles = {
  // 選擇解謎的調查員 → 回傳步數
  async chooseSolver(abilityIdx) {
    const sk = SKILLS[abilityIdx || 0];
    const alive = G.inv.filter(i => !i.removed);
    if (alive.length === 1) return { inv: alive[0], moves: alive[0].skills[sk.k] || 3, sk };
    return new Promise(res => {
      UI.openDialog(`<h3 class="dlgTitle">誰來解謎？</h3>
        <div class="msg">此謎題使用 <img class="ico" src="${sk.icon}"> <b>${sk.zh}</b>：可用步數等於該調查員的${sk.zh}值。</div>
        <div class="grid">${alive.map((iv, i) => `<div class="pick" data-i="${i}"><img src="${iv.img}"><div>${esc(iv.name)}</div><div class="small">${sk.zh} ${iv.skills[sk.k] || 0}</div></div>`).join('')}</div>`);
      UI.$('#dialog').querySelectorAll('.pick').forEach(el => el.onclick = () => { const iv = alive[+el.dataset.i]; res({ inv: iv, moves: iv.skills[sk.k] || 3, sk }); });
    });
  },
  stateKey(f) { return '__pz_' + f.state; },

  // ---------------- 滑塊拼圖 ----------------
  async slide(a, f) {
    const solver = await this.chooseSolver(a.AbilityType);
    const key = this.stateKey(f);
    const N = 3;
    let st = f.vars[key];
    if (!st) {
      const diff = (a.DifficultyMin || 3) + rnd((a.DifficultyMax || 5) - (a.DifficultyMin || 3) + 1);
      let b = [...Array(N * N).keys()]; // 0..8，8 = 空格
      let e = N * N - 1, prev = -1;
      for (let i = 0; i < diff * 4; i++) {
        const nb = this.nbrs(e, N).filter(x => x !== prev); const m = pick(nb);
        [b[e], b[m]] = [b[m], b[e]]; prev = e; e = m;
      }
      if (b.every((v, i) => v === i)) { const m = this.nbrs(e, N)[0];[b[e], b[m]] = [b[m], b[e]]; }
      st = f.vars[key] = { b, total: 0 };
    }
    const imgName = (a.Image && a.Image.ref) || 'artRitualRunes_3x3';
    const img = 'img/misc/' + imgName + '.png';
    let moves = solver.moves;
    const S = 120;
    return new Promise(res => {
      const draw = () => {
        const solved = st.b.every((v, i) => v === i);
        UI.openDialog(`<h3 class="dlgTitle">滑塊謎題</h3>
          <div class="pz">
            <div class="movesLbl">${esc(solver.inv.name)} 剩餘步數：<b>${moves}</b>　　總步數：${st.total}</div>
            <div class="slide" style="grid-template-columns:repeat(${N},${S}px);grid-template-rows:repeat(${N},${S}px)">
              ${st.b.map((v, i) => v === N * N - 1 && !solved ? `<div class="empty"></div>` :
          `<div data-i="${i}" style="background-image:url(${img});background-size:${S * N}px ${S * N}px;background-position:${-(v % N) * S}px ${-Math.floor(v / N) * S}px"></div>`).join('')}
            </div>
            <div class="small">點擊與空格相鄰的拼圖塊來移動。完成圖案即成功。</div>
            <div class="btns"><button class="btn" id="pzQuit">${solved ? '完成' : '停止解謎（保留進度）'}</button></div>
          </div>`);
        if (solved) { UI.$('#pzQuit').onclick = () => { delete f.vars[key]; res(true); }; return; }
        UI.$('#pzQuit').onclick = () => res(false);
        UI.$('#dialog').querySelectorAll('.slide div[data-i]').forEach(el => el.onclick = () => {
          if (moves <= 0) return;
          const i = +el.dataset.i, e = st.b.indexOf(N * N - 1);
          if (!this.nbrs(e, N).includes(i)) return;
          [st.b[e], st.b[i]] = [st.b[i], st.b[e]]; moves--; st.total++;
          draw();
          if (moves <= 0 && !st.b.every((v, k) => v === k)) setTimeout(() => { UI.toast('步數用完了'); res(false); }, 600);
        });
      };
      draw();
    });
  },
  nbrs(i, N) { const r = Math.floor(i / N), c = i % N, o = []; if (r > 0) o.push(i - N); if (r < N - 1) o.push(i + N); if (c > 0) o.push(i - 1); if (c < N - 1) o.push(i + 1); return o; },

  // ---------------- 密碼謎題（類似珠璣妙算）----------------
  async code(a, f) {
    const solver = await this.chooseSolver(a.AbilityType);
    const key = this.stateKey(f);
    const len = a.SolutionSize || 3, nsym = a.SymbolSize || 5;
    const SYMS = a.PuzzleSkin === 1 ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['☽', '✦', '☥', '◈', '♆', '⚶', '☿', '♄'];
    let st = f.vars[key];
    if (!st) st = f.vars[key] = { sol: Array.from({ length: len }, () => rnd(nsym)), hist: [] };
    let moves = solver.moves; let cur = [];
    return new Promise(res => {
      const draw = (done) => {
        UI.openDialog(`<h3 class="dlgTitle">密碼謎題</h3>
          <div class="pz">
            <div class="movesLbl">${esc(solver.inv.name)} 剩餘猜測次數：<b>${moves}</b></div>
            <div class="code">${Array.from({ length: len }, (_, i) => `<div class="slot" data-i="${i}">${cur[i] != null ? SYMS[cur[i]] : ''}</div>`).join('')}</div>
            <div class="symbols">${Array.from({ length: nsym }, (_, i) => `<button data-s="${i}">${SYMS[i]}</button>`).join('')}</div>
            <div class="small">依序點選符號填入，再按「送出猜測」。✔＝符號與位置都對　○＝符號對但位置錯。點格子可清除。</div>
            <div class="hist">${st.hist.length ? st.hist.map(h => `<div>${h.g.map(x => SYMS[x]).join(' ')}　→　✔×${h.a}　○×${h.b}</div>`).join('') : '尚無紀錄'}</div>
            <div class="btns">${done ? `<button class="btn primary" id="pzOk">完成</button>` : `<button class="btn" id="pzQuit">停止解謎（保留進度）</button><button class="btn primary" id="pzGo">送出猜測</button>`}</div>
          </div>`);
        if (done) { UI.$('#pzOk').onclick = () => { delete f.vars[key]; res(true); }; return; }
        UI.$('#dialog').querySelectorAll('.symbols button').forEach(b => b.onclick = () => { if (cur.length < len) { cur.push(+b.dataset.s); draw(); } });
        UI.$('#dialog').querySelectorAll('.slot').forEach(s => s.onclick = () => { cur.splice(+s.dataset.i, 1); draw(); });
        UI.$('#pzQuit').onclick = () => res(false);
        UI.$('#pzGo').onclick = () => {
          if (cur.length < len) { UI.toast('請先填滿所有格子'); return; }
          let A = 0, B = 0; const cs = {}, cg = {};
          cur.forEach((g, i) => { if (g === st.sol[i]) A++; else { cs[st.sol[i]] = (cs[st.sol[i]] || 0) + 1; cg[g] = (cg[g] || 0) + 1; } });
          for (const k in cg) B += Math.min(cg[k], cs[k] || 0);
          st.hist.push({ g: cur, a: A, b: B }); cur = []; moves--;
          if (A === len) { draw(true); return; }
          draw();
          if (moves <= 0) setTimeout(() => { UI.toast('次數用完了'); res(false); }, 700);
        };
      };
      draw();
    });
  },

  // ---------------- 鎖謎題（滑動方塊，把鑰匙推出右邊出口）----------------
  LOCKS: {"4":[[[2,1,2,"h"],[4,1,2,"h"],[1,4,3,"v"],[4,4,2,"h"],[0,4,2,"h"]],[[2,0,2,"h"],[4,3,3,"h"],[0,1,2,"h"],[1,5,3,"v"],[1,4,3,"v"],[1,2,2,"h"]],[[2,0,2,"h"],[0,1,2,"h"],[1,4,2,"v"],[2,2,2,"v"],[1,5,2,"v"],[5,4,2,"h"]],[[2,0,2,"h"],[2,4,3,"v"],[4,3,2,"v"],[2,3,2,"v"],[0,2,2,"h"],[4,5,2,"v"]],[[2,1,2,"h"],[2,5,2,"v"],[1,3,3,"v"],[4,3,2,"h"],[4,5,2,"v"],[0,1,2,"h"]],[[2,0,2,"h"],[1,3,2,"v"],[1,2,2,"v"],[2,4,2,"v"],[4,2,2,"h"]]],"3":[[[2,0,2,"h"],[2,2,2,"v"],[3,4,2,"h"],[1,5,2,"v"],[3,3,3,"v"]],[[2,1,2,"h"],[2,3,3,"v"],[2,4,2,"v"],[4,4,2,"v"],[0,1,2,"v"]],[[2,1,2,"h"],[2,5,3,"v"],[0,2,2,"v"],[3,1,2,"h"],[1,3,2,"v"]],[[2,2,2,"h"],[2,4,3,"v"],[3,0,2,"v"],[1,5,2,"v"],[3,3,2,"v"],[5,2,2,"h"]],[[2,0,2,"h"],[5,4,2,"h"],[1,0,3,"h"],[2,2,2,"v"],[0,4,2,"h"],[3,4,2,"v"],[1,5,2,"v"]],[[2,0,2,"h"],[2,3,2,"v"],[0,2,2,"h"],[0,5,2,"v"],[3,4,3,"v"],[1,4,2,"v"],[3,1,3,"v"]]],"5":[[[2,1,2,"h"],[2,3,2,"v"],[0,4,2,"h"],[5,4,2,"h"],[1,4,2,"v"],[2,5,3,"v"]],[[2,0,2,"h"],[3,0,2,"v"],[0,2,2,"v"],[4,2,2,"h"],[2,4,2,"v"],[1,0,2,"h"],[1,3,3,"v"],[5,2,2,"h"]],[[2,1,2,"h"],[1,4,2,"v"],[4,2,2,"v"],[4,0,2,"h"],[5,4,2,"h"],[0,4,2,"h"],[2,5,3,"v"],[3,3,2,"h"]],[[2,0,2,"h"],[0,3,3,"v"],[1,2,3,"v"],[5,3,2,"h"],[4,0,2,"v"],[2,4,2,"v"]],[[2,0,2,"h"],[4,0,2,"v"],[2,3,2,"v"],[1,2,2,"v"],[4,2,2,"v"],[0,2,2,"h"],[1,5,2,"v"]],[[2,0,2,"h"],[5,2,2,"h"],[1,2,2,"v"],[1,5,2,"v"],[1,0,2,"h"],[0,3,3,"v"],[4,0,2,"h"]]],"6":[[[2,2,2,"h"],[0,4,2,"v"],[2,5,2,"v"],[1,0,2,"h"],[4,3,2,"v"],[2,4,2,"v"],[4,4,2,"h"]],[[2,0,2,"h"],[4,2,2,"h"],[5,2,2,"h"],[0,4,3,"v"],[2,5,3,"v"],[0,2,3,"v"]],[[2,2,2,"h"],[3,3,3,"v"],[1,5,3,"v"],[3,1,2,"h"],[4,4,2,"h"],[5,0,2,"h"]],[[2,2,2,"h"],[3,1,2,"v"],[0,4,3,"v"],[3,2,2,"h"],[1,1,3,"h"],[3,4,2,"h"],[5,3,2,"h"]],[[2,2,2,"h"],[5,1,2,"h"],[0,4,3,"v"],[5,4,2,"h"],[1,5,2,"v"],[4,4,2,"h"]],[[2,2,2,"h"],[0,1,2,"v"],[0,3,3,"h"],[5,4,2,"h"],[1,3,2,"h"],[3,3,3,"v"],[2,4,3,"v"]]],"7":[[[2,1,2,"h"],[3,0,2,"v"],[1,1,2,"h"],[4,3,2,"h"],[0,3,2,"v"],[3,2,2,"v"],[5,4,2,"h"],[0,4,3,"v"],[4,1,2,"v"]],[[2,1,2,"h"],[5,3,3,"h"],[2,3,2,"v"],[3,1,3,"v"],[4,3,2,"h"],[1,4,3,"v"]],[[2,0,2,"h"],[2,3,2,"v"],[1,1,2,"h"],[2,4,2,"v"],[4,3,2,"h"],[3,2,3,"v"],[1,3,2,"h"],[2,5,2,"v"]],[[2,1,2,"h"],[0,0,2,"v"],[1,4,3,"v"],[3,1,2,"h"],[4,3,2,"v"],[4,4,2,"h"],[4,0,2,"v"],[4,2,2,"v"]],[[2,0,2,"h"],[1,4,2,"h"],[1,3,3,"v"],[4,0,3,"h"],[0,4,2,"h"],[3,5,2,"v"],[4,3,2,"h"]],[[2,1,2,"h"],[4,2,2,"h"],[0,4,3,"v"],[5,3,2,"h"],[3,0,2,"v"],[1,1,3,"h"],[0,2,2,"h"],[2,5,2,"v"],[4,4,2,"h"]]],"11":[[[2,0,2,"h"],[2,4,3,"v"],[4,5,2,"v"],[0,2,3,"v"],[4,1,2,"v"],[4,2,2,"h"]],[[2,2,2,"h"],[0,3,2,"v"],[3,0,3,"h"],[4,4,2,"h"],[1,5,3,"v"],[4,2,2,"v"],[1,1,2,"h"],[4,3,2,"v"]]],"13":[[[2,0,2,"h"],[1,2,3,"v"],[1,4,3,"v"],[4,1,2,"v"],[4,4,2,"h"],[3,0,2,"h"]]],"8":[[[2,0,2,"h"],[5,2,3,"h"],[3,3,3,"h"],[1,2,3,"v"],[0,4,2,"h"],[4,1,2,"v"],[4,5,2,"v"]],[[2,2,2,"h"],[4,2,2,"v"],[2,4,3,"v"],[3,2,2,"h"],[5,4,2,"h"],[0,1,2,"v"],[3,0,2,"h"]],[[2,0,2,"h"],[0,4,2,"v"],[0,3,2,"v"],[2,5,3,"v"],[0,2,3,"v"],[4,0,3,"h"]],[[2,0,2,"h"],[0,5,2,"v"],[5,3,2,"h"],[4,2,2,"v"],[1,2,2,"h"],[1,4,3,"v"],[0,0,2,"h"],[3,0,3,"h"]]],"9":[[[2,0,2,"h"],[3,0,3,"h"],[1,3,3,"v"],[4,2,2,"v"],[0,2,2,"h"],[0,5,3,"v"],[4,4,2,"h"]]],"10":[[[2,0,2,"h"],[0,0,2,"v"],[4,1,3,"h"],[0,2,3,"v"],[2,5,3,"v"],[3,0,3,"v"],[5,2,3,"h"]],[[2,0,2,"h"],[0,4,3,"v"],[3,4,2,"h"],[4,0,2,"v"],[4,4,2,"h"],[0,2,3,"v"]]]},
  async lock(a, f) {
    const solver = await this.chooseSolver(a.AbilityType);
    const key = this.stateKey(f);
    let st = f.vars[key];
    if (!st) {
      const want = (a.DifficultyMin || 3) + rnd((a.DifficultyMax || 5) - (a.DifficultyMin || 3) + 1);
      const ks = Object.keys(this.LOCKS).map(Number).sort((x, y) => Math.abs(x - want) - Math.abs(y - want));
      st = f.vars[key] = { blocks: pick(this.LOCKS[ks[0]]).map(b => b.slice()) };
    }
    let moves = solver.moves; const C = 64, N = 6;
    let sel = null, lastMoved = null;
    return new Promise(res => {
      const occ = (skip) => { const g = Array.from({ length: N }, () => Array(N).fill(-1)); st.blocks.forEach((b, i) => { if (i === skip) return; for (let k = 0; k < b[2]; k++) { const r = b[0] + (b[3] === 'v' ? k : 0), c = b[1] + (b[3] === 'h' ? k : 0); if (r < N && c < N) g[r][c] = i; } }); return g; };
      const draw = () => {
        const key0 = st.blocks[0]; const solved = key0[1] + key0[2] >= N;
        UI.openDialog(`<h3 class="dlgTitle">鎖謎題</h3>
          <div class="pz">
            <div class="movesLbl">${esc(solver.inv.name)} 剩餘步數：<b>${moves}</b></div>
            <div class="lock" style="width:${C * N + 8}px;height:${C * N + 8}px">
              <div class="exit" style="left:${C * N + 2}px;top:${2 * C + 4}px;width:10px;height:${C}px"></div>
              ${st.blocks.map((b, i) => `<div class="blk ${i === 0 ? 'key' : ''}" data-i="${i}" style="left:${b[1] * C + 4}px;top:${b[0] * C + 4}px;width:${(b[3] === 'h' ? b[2] : 1) * C - 4}px;height:${(b[3] === 'v' ? b[2] : 1) * C - 4}px;${sel === i ? 'outline:3px solid #fff' : ''}"></div>`).join('')}
            </div>
            <div class="small">先點一個木塊選取，再用下方箭頭移動（同一塊連續移動只算 1 步）。把金色鑰匙推出右側出口即解開。</div>
            <div class="btns">
              <button class="btn small" data-d="-1">◀ 左／上</button><button class="btn small" data-d="1">右／下 ▶</button>
            </div>
            <div class="btns"><button class="btn" id="pzQuit">${solved ? '完成' : '停止解謎（保留進度）'}</button></div>
          </div>`);
        if (solved) { UI.$('#pzQuit').onclick = () => { delete f.vars[key]; res(true); }; return; }
        UI.$('#pzQuit').onclick = () => res(false);
        UI.$('#dialog').querySelectorAll('.blk').forEach(el => el.onclick = () => {
          const i = +el.dataset.i;
          if (moves <= 0 && i !== lastMoved) { UI.toast('步數用完了，只能繼續移動剛才那一塊'); }
          sel = i; draw();
        });
        UI.$('#dialog').querySelectorAll('[data-d]').forEach(bt => bt.onclick = () => {
          if (sel == null || (moves <= 0 && lastMoved !== sel)) return;
          const b = st.blocks[sel], d = +bt.dataset.d, g = occ(sel);
          const nb = b.slice(); if (b[3] === 'h') nb[1] += d; else nb[0] += d;
          const cells = []; for (let k = 0; k < nb[2]; k++) cells.push([nb[0] + (nb[3] === 'v' ? k : 0), nb[1] + (nb[3] === 'h' ? k : 0)]);
          const exitOk = sel === 0 && nb[1] + nb[2] > N;
          if (!exitOk && cells.some(([r, c]) => r < 0 || c < 0 || r >= N || c >= N || g[r][c] >= 0)) { UI.toast('擋住了'); return; }
          if (exitOk && cells.some(([r, c]) => c < N && g[r][c] >= 0)) { UI.toast('擋住了'); return; }
          st.blocks[sel] = nb; if (lastMoved !== sel) { moves--; lastMoved = sel; }
          draw();
        });
      };
      draw();
    });
  }
};
