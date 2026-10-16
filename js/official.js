// ============================================================
//  官方介面還原：訊息視窗、檢定、三種謎題
//  座標與尺寸取自官方 App 的 NGUI 版面（基準高度 720，中心為原點，y 向上）
// ============================================================
const OFF = {
  u: 1,
  layer: null,
  setScale() {
    OFF.u = Math.max(0.6, Math.min(window.innerHeight / 720, window.innerWidth / 1280 * 1.15));
    document.documentElement.style.setProperty('--u', OFF.u + 'px');
  },
  open(html) {
    if (!OFF.layer) { OFF.layer = document.createElement('div'); OFF.layer.id = 'offLayer'; OFF.layer.className = 'offi hidden'; document.body.appendChild(OFF.layer); }
    OFF.layer.innerHTML = html; OFF.layer.classList.remove('hidden');
    return OFF.layer;
  },
  close() { if (OFF.layer) { OFF.layer.classList.add('hidden'); OFF.layer.innerHTML = ''; } },
  // UI 座標 → CSS（相對於中心容器）
  at(x, y, w, h) { const u = OFF.u; return `left:${(x - (w || 0) / 2) * u}px;top:${(-y - (h || 0) / 2) * u}px;${w ? `width:${w * u}px;` : ''}${h ? `height:${h * u}px;` : ''}`; },
  icon(o) {
    if (o.monster) return { src: `img/monsters/${o.monster.img}.png`, round: true };
    if (o.items && o.items.length === 1) return { src: `img/items/${o.items[0].img}.png` };
    const si = Engine.sourceInfo(o.source);
    if (si && si.img) return { src: si.img };
    return null;
  },
  label(s) { return esc((s || '').replace(/[-]/g, c => c === '\uf208' ? '\u0001' : '').trim()).replace(/\u0001\s*/g, '<span class="actIco" title="要花 1 個行動">\uf208</span>'); }
};
window.addEventListener('resize', OFF.setScale);
OFF.setScale();

// ---------------- 訊息視窗 ----------------
UI.message = function (o) {
  return new Promise(res => {
    const si = Engine.sourceInfo(o.source);
    if (si) { const n = G.nodes[si.id]; if (n) { n.hl = Date.now(); UI.renderBoard(); } }
    if (o.text) Engine.log(o.text);
    const ic = OFF.icon(o);
    const btns = o.buttons && o.buttons.length ? o.buttons : null;
    const L = OFF.open(`<div id="popup">
      ${o.title ? `<div class="title">${esc(o.title)}</div>` : ''}
      <div class="bg frame9"><div class="txt ${ic ? '' : 'noicon'}"><div>${fmt(o.text || '')}</div></div>
        ${ic ? `<img class="icon ${ic.round ? 'round' : ''}" src="${ic.src}">` : ''}</div>
      ${o.items && o.items.length > 1 ? `<div class="items">${o.items.map(it => `<div class="it"><img src="img/items/${it.img}.png"><div>${esc(T(it.name))}</div></div>`).join('')}</div>` : ''}
      ${!btns || btns.length === 1 ? `<div class="tap confbtn" data-ev="${btns ? btns[0].ev : 'NEXT'}">${OFF.label(btns ? btns[0].label : T('UI_TAP_TO_CONTINUE'))}</div>` :
        (btns.length === 2 && !o.vertical) ? `<div class="twobtn">${btns.map((b, i) => `<div class="actbtn" data-i="${i}">${OFF.label(b.label)}</div>`).join('')}</div>` :
          `<div class="col">${btns.map((b, i) => `<div class="actbtn ${i === btns.length - 1 && btns.length > 1 && /CANCEL|取消/.test(b.ev + b.label) ? 'cancel' : ''}" data-i="${i}">${OFF.label(b.label)}</div>`).join('')}</div>`}
    </div>`);
    OFF.layoutPopup(L);
    const done = ev => { OFF.close(); res(ev); setTimeout(() => UI.render(), 0); };
    L.querySelectorAll('[data-i]').forEach(el => el.onclick = () => done(btns[+el.dataset.i].ev));
    const tap = L.querySelector('[data-ev]'); if (tap) tap.onclick = () => done(tap.dataset.ev);
  });
};
// 依文字高度排列：框中心位於畫面中心上方 71 單位，按鈕在框下緣 5 單位
OFF.layoutPopup = function (L) {
  const u = OFF.u, bg = L.querySelector('.bg');
  const H = Math.max(160 * u, bg.offsetHeight);
  bg.style.minHeight = 160 * u + 'px';
  const top = -71 * u - H / 2;
  bg.style.top = top + 'px';
  let y = top + H + 5 * u;
  const t = L.querySelector('.title'); if (t) t.style.top = (top - 40 * u) + 'px';
  const it = L.querySelector('.items'); if (it) { it.style.top = y + 'px'; y += it.offsetHeight + 8 * u; }
  for (const sel of ['.twobtn', '.col', '.tap', '.chal']) { const e = L.querySelector(sel); if (e) e.style.top = y + 'px'; }
  // 太靠下就整體往上移；選項太多、比畫面還高就縮小（測試組 1.2.62：6 個選項時「取消」掉到畫面外，按不到）
  // 量所有元素（按鈕在 .col 裡面，只量 .col 自己的框會量不到）
  const pop = L.querySelector('#popup'); pop.style.top = ''; pop.style.transform = '';
  // 量的時候先關掉彈出動畫（動畫一開始是縮小 85%，會量成「放得下」）
  pop.style.animation = 'none'; void pop.offsetWidth;
  const rs = [...L.querySelectorAll('#popup *')].map(e => e.getBoundingClientRect()).filter(r => r.height > 0 && r.width > 0);
  pop.style.animation = '';
  if (!rs.length) return;
  const top0 = Math.min(...rs.map(r => r.top)), bot = Math.max(...rs.map(r => r.bottom));
  const py = pop.getBoundingClientRect().top, room = window.innerHeight - 20;
  const k = bot - top0 > room ? room / (bot - top0) : 1;
  const nt = py + (top0 - py) * k, nb = py + (bot - py) * k;
  let dy = 0; if (nb > window.innerHeight - 10) dy = window.innerHeight - 10 - nb; if (nt + dy < 10) dy = 10 - nt;
  if (k < 1 || dy) { pop.style.transformOrigin = '0 0'; pop.style.transform = `translate(0px, ${Math.round(dy)}px) scale(${k.toFixed(3)})`; }
};

// ---------------- 檢定（輸入成功數）----------------
UI.challenge = function (o) {
  return new Promise(res => {
    let n = 0;
    if (o.text) Engine.log(o.text);
    const ic = OFF.icon(o);
    const L = OFF.open(`<div id="popup">
      <div class="bg frame9"><div class="txt ${ic ? '' : 'noicon'}"><div>${fmt(o.text || '')}</div></div>${ic ? `<img class="icon" src="${ic.src}">` : ''}</div>
      <div class="chal">
        <div class="pm" style="left:${(126 - 86 - 36) * OFF.u}px" id="chM"><img src="img/ui/minusButton.png"></div>
        <div class="num" id="chN">0</div>
        <div class="pm" style="left:${(126 + 86 - 36) * OFF.u}px" id="chP"><img src="img/ui/plusButton.png"></div>
        <div class="ok confbtn" id="chOk">${OFF.label(T('UI_CONFIRM'))}</div>
        <div class="dice plate oldnews" id="chRoll">擲骰</div>
      </div></div>`);
    OFF.layoutPopup(L);
    const upd = () => L.querySelector('#chN').textContent = n;
    L.querySelector('#chM').onclick = () => { n = Math.max(0, n - 1); upd(); };
    L.querySelector('#chP').onclick = () => { n++; upd(); };
    L.querySelector('#chOk').onclick = () => { OFF.close(); Engine.log(`→ 成功數：${n}`); res(n); };
    L.querySelector('#chRoll').onclick = async () => {
      OFF.layer.classList.add('hidden');
      const ic2 = (o.text.match(/[-]/) || [])[0];
      const sk = ic2 ? SKILLS[ic2.charCodeAt(0) - 0xf200].k : 'obs';
      CE._lastRoll = null;
      n = await UI.diceDialog({ skill: sk, text: o.text, useResult: true });
      OFF.layer.classList.remove('hidden'); upd();
      if (CE._lastRoll) L.querySelector('#chOk').click();
    };
  });
};

// ============================================================
//  謎題（官方規則）
//  ・步數由 App 計數（本次步數／累計步數），玩家依能力值自行停止
//  ・按「關閉」= 這次沒解開（觸發失敗事件），進度保留
// ============================================================
const PZ = {
  skillIcon(t) { return SKILLS[t || 0].icon; },
  bottomBar(a, st, labels) {
    // labels: [{x,y,key,val}]
    return labels.map(l => `<div class="pzLbl oldnews" style="left:${l.x * OFF.u}px;top:${-l.y * OFF.u}px">${OFF.label(T(l.key))}${l.img ? `<img src="${l.img}">` : `<b id="${l.id}">${l.val}</b>`}</div>`).join('');
  },
  closeBtn(x, y) { return `<div class="plate oldnews abs" id="pzClose" style="${OFF.at(x, y, 166, 30)};font-size:${20 * OFF.u}px">${OFF.label(T('UI_PUZZLE_CLOSE'))}</div>`; },
  async finish(view, ok) {
    if (ok) {
      const d = document.createElement('div'); d.className = 'pzDone';
      d.innerHTML = `<div class="kh"><img src="img/ui/Keyhole.png"><img class="ring" src="img/ui/Ring.png"><img src="img/ui/SilverRing.png"></div><div class="lbl">${OFF.label(T('UI_PUZZLE_COMPLETE'))}</div>`;
      view.appendChild(d);
      await sleep(1900);
    }
    view.classList.add('out'); await sleep(330); OFF.close();
  },
  saved(f) { return f.vars['__pz_' + f.state]; },
  save(f, st) { f.vars['__pz_' + f.state] = st; },
  clear(f) { delete f.vars['__pz_' + f.state]; }
};

// ---------------- 滑塊（圖片交換）謎題 ----------------
Puzzles.slide = function (a, f) {
  return new Promise(res => {
    let st = PZ.saved(f);
    if (!st) {
      const lo = a.DifficultyMin || 3, hi = a.DifficultyMax || lo;
      const want = lo + rnd(hi - lo + 1);
      const pool = PUZZLES.slide.filter(p => p.size === 0);
      const near = pool.slice().sort((x, y) => Math.abs(x.d - want) - Math.abs(y.d - want));
      const best = near.filter(p => p.d === near[0].d);
      st = { L: pick(best).L.slice(), total: 0 };
      PZ.save(f, st);
    }
    const img = 'img/misc/' + ((a.Image && a.Image.ref) || 'artRitualRunes_3x3') + '.png';
    const XS = [-136, 5, 146], YS = [142, 0, -141], T_ = 135;
    let moves = 0, sel = null, finished = false;
    const L = OFF.open(`<div class="pzView" id="pzv">
      <div class="abs" style="${OFF.at(0, 0, 776, 582)};background:url(img/misc/PicturePuzzleBG.png) center/100% 100%;filter:brightness(.7)"></div>
      <div id="tiles"></div>
      ${PZ.bottomBar(a, st, [{ x: -80 - 42, y: -261, key: 'UI_PUZZLE_SKILL', img: PZ.skillIcon(a.AbilityType) }, { x: 60 - 45, y: -261, key: 'UI_PUZZLE_MOVES', id: 'mv', val: 0 }, { x: 254 - 72, y: -261, key: 'UI_PUZZLE_TOTAL_MOVES', id: 'tm', val: st.total }])}
      ${PZ.closeBtn(-282, -263)}
    </div>`);
    const view = L.querySelector('#pzv'), box = L.querySelector('#tiles');
    const draw = () => {
      box.innerHTML = st.L.map((piece, pos) => {
        const x = XS[pos % 3], y = YS[Math.floor(pos / 3)];
        const px = (piece % 3) * T_, py = Math.floor(piece / 3) * T_;
        return `<div class="pzTile ${sel === pos ? 'sel' : ''}" data-p="${pos}" style="${OFF.at(x, y, T_, T_)};background-image:url(${img});background-size:${T_ * 3 * OFF.u}px ${T_ * 3 * OFF.u}px;background-position:${-px * OFF.u}px ${-py * OFF.u}px"></div>`;
      }).join('');
      L.querySelector('#mv').textContent = moves; L.querySelector('#tm').textContent = st.total;
      box.querySelectorAll('.pzTile').forEach(el => {
        el.onclick = () => click(+el.dataset.p);
        el.onmouseenter = () => { if (sel != null && adj(sel, +el.dataset.p)) el.classList.add('drop'); };
        el.onmouseleave = () => el.classList.remove('drop');
      });
    };
    const adj = (a1, b1) => { const r1 = Math.floor(a1 / 3), c1 = a1 % 3, r2 = Math.floor(b1 / 3), c2 = b1 % 3; return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; };
    const click = async p => {
      if (finished) return;
      if (sel == null) { sel = p; draw(); return; }
      if (sel === p) { sel = null; draw(); return; }
      if (!adj(sel, p)) { sel = p; draw(); return; }
      [st.L[sel], st.L[p]] = [st.L[p], st.L[sel]]; sel = null; moves++; st.total++;
      draw();
      if (st.L.every((v, i) => v === i)) {
        finished = true; PZ.clear(f);
        box.innerHTML = `<div class="abs" style="${OFF.at(5, 0, T_ * 3 + 6, T_ * 3 + 2)};background:url(${img}) center/100% 100%;box-shadow:0 0 ${20 * OFF.u}px #000"></div>`;
        await PZ.finish(view, true); res(true);
      }
    };
    L.querySelector('#pzClose').onclick = async () => { if (finished) return; await PZ.finish(view, false); res(false); };
    draw();
  });
};

// ---------------- 密碼謎題 ----------------
Puzzles.code = function (a, f) {
  return new Promise(res => {
    const len = a.SolutionSize || 3, nsym = a.SymbolSize || 5, skin = a.PuzzleSkin || 0;
    const sprite = i => skin === 1 ? `img/ui/numberblock${i + 1}.png` : skin === 2 ? `img/ui/Element_${i + 1}.png` : `img/ui/RunicBlock${i + 1}.png`;
    let st = PZ.saved(f);
    if (!st) { st = { sol: Array.from({ length: len }, () => rnd(nsym)), hist: [], total: 0 }; PZ.save(f, st); }
    let guesses = 0, cur = Array(len).fill(null), finished = false;
    const u = OFF.u;
    const L = OFF.open(`<div class="pzView" id="pzv">
      <div class="abs" style="${OFF.at(0, 0, 844, 638)};background:url(img/misc/PuzzleBG.png) center/100% 100%;filter:sepia(.3) brightness(.62)"></div>
      <div class="abs" style="${OFF.at(0, -25, 764, 384)};background:url(img/misc/Code_BG.png) center/100% 100%"></div>
      <div class="abs" id="hist" style="${OFF.at(20, -25, 700, 340)};overflow-y:auto;overflow-x:hidden"></div>
      <div id="pieces"></div><div id="socks"></div>
      <div class="abs" id="pzGuess" style="${OFF.at(264, 216, 146, 133)};background:url(img/ui/guessbutton.png) center/100% 100%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:${23 * u}px" class="oldnews"><span class="oldnews">${OFF.label(T('UI_PUZZLE_GUESS'))}</span></div>
      <img class="abs" src="img/ui/correctSocket.png" style="${OFF.at(-167, -225, 50, 50)}">
      <div class="pzLbl oldnews" style="left:${-142 * u}px;top:${227 * u}px">${OFF.label(T('UI_PUZZLE_CORRECT_SOCKET'))}</div>
      <img class="abs" src="img/ui/correctSymbol.png" style="${OFF.at(-167, -265, 50, 50)}">
      <div class="pzLbl oldnews" style="left:${-142 * u}px;top:${267 * u}px">${OFF.label(T('UI_PUZZLE_CORRECT_SYMBOL'))}</div>
      ${PZ.bottomBar(a, st, [{ x: 152 - 60, y: -227, key: 'UI_PUZZLE_SKILL', img: PZ.skillIcon(a.AbilityType) }, { x: 334 - 72, y: -227, key: 'UI_PUZZLE_GUESSES', id: 'mv', val: 0 }, { x: 334 - 98, y: -267, key: 'UI_PUZZLE_TOTAL_GUESSES', id: 'tm', val: st.total }])}
      ${PZ.closeBtn(-290, -266)}
    </div>`);
    const view = L.querySelector('#pzv');
    L.querySelector('#pieces').innerHTML = Array.from({ length: nsym }, (_, i) => `<div class="codePiece" data-s="${i}" style="${OFF.at(-278 + i * 70, 254, 55, 55)};background-image:url(${sprite(i)})"></div>`).join('');
    const drawSocks = () => {
      L.querySelector('#socks').innerHTML = cur.map((v, i) => `<div class="sock" data-k="${i}" style="${OFF.at(-278 + i * 75, 189, 66, 66)}">${v != null ? `<div class="codePiece" style="background-image:url(${sprite(v)})"></div>` : ''}</div>`).join('');
      L.querySelectorAll('.sock').forEach(s => s.onclick = () => { cur[+s.dataset.k] = null; drawSocks(); });
    };
    const drawHist = () => {
      const H = L.querySelector('#hist');
      H.innerHTML = `<div style="position:relative;height:${st.hist.length * 90 * u}px">` + st.hist.map((h, r) =>
        `<div class="guessRow" style="top:${r * 90 * u}px;left:${17 * u}px">${h.g.map((v, i) => `<div class="gp" style="left:${(30 + i * 62) * u}px;background-image:url(${sprite(v)})"></div>`).join('')}
         <div class="div"></div>${[...Array(h.a).fill('correctSocket'), ...Array(h.b).fill('correctSymbol')].map((s, i) => `<img class="rs" src="img/ui/${s}.png" style="left:${(430 + i * 52) * u}px">`).join('')}</div>`).join('') + '</div>';
      H.scrollTop = H.scrollHeight;
      L.querySelector('#mv').textContent = guesses; L.querySelector('#tm').textContent = st.total;
    };
    // 點選符號：放進第一個空格（官方為拖曳，兩種都支援）
    L.querySelectorAll('#pieces .codePiece').forEach(p => {
      p.onclick = () => { const k = cur.indexOf(null); if (k >= 0) { cur[k] = +p.dataset.s; drawSocks(); } };
      p.draggable = true; p.ondragstart = e => e.dataTransfer.setData('s', p.dataset.s);
    });
    L.querySelector('#socks').ondragover = e => e.preventDefault();
    L.querySelector('#socks').ondrop = e => { const t = e.target.closest('.sock'); if (t) { cur[+t.dataset.k] = +e.dataTransfer.getData('s'); drawSocks(); } };
    L.querySelector('#pzGuess').onclick = async () => {
      if (finished || cur.includes(null)) { UI.toast('請先把每個格子都放上符號'); return; }
      let A = 0, B = 0; const us = Array(len).fill(false), ug = Array(len).fill(false);
      cur.forEach((g, i) => { if (g === st.sol[i]) { A++; us[i] = ug[i] = true; } });
      cur.forEach((g, i) => { if (ug[i]) return; for (let j = 0; j < len; j++) if (!us[j] && st.sol[j] === g) { B++; us[j] = true; break; } });
      st.hist.push({ g: cur.slice(), a: A, b: B }); guesses++; st.total++;
      cur = Array(len).fill(null); drawSocks(); drawHist();
      if (A === len) { finished = true; PZ.clear(f); await PZ.finish(view, true); res(true); }
    };
    L.querySelector('#pzClose').onclick = async () => { if (finished) return; await PZ.finish(view, false); res(false); };
    drawSocks(); drawHist();
  });
};

// ---------------- 鎖謎題（滑動木塊）----------------
Puzzles.lock = function (a, f) {
  return new Promise(res => {
    let st = PZ.saved(f);
    if (!st) {
      const lo = a.DifficultyMin || 3, hi = a.DifficultyMax || lo, want = lo + rnd(hi - lo + 1);
      const near = PUZZLES.lock.slice().sort((x, y) => Math.abs(x.d - want) - Math.abs(y.d - want));
      st = { p: pick(near.filter(p => p.d === near[0].d)).p.map(x => x.slice()), total: 0 };
      PZ.save(f, st);
    }
    const mech = a.PuzzleSkin === 1;
    const pieceImg = (p) => `img/ui/Piece_${mech ? 'Mechanical' : 'Wooden'}_${p[4] ? 'Key' : p[0]}.png`;
    const u = OFF.u, CELL = 81, GX = -297, GY = -178;
    let moves = 0, finished = false;
    const L = OFF.open(`<div class="pzView" id="pzv">
      <div class="abs" style="${OFF.at(0, 0, 844, 638)};background:url(img/misc/PuzzleBG.png) center/100% 100%;filter:sepia(.5) brightness(.35)"></div>
      <div class="abs" style="${OFF.at(-12, 23, 675, 514)};background:url(img/misc/${mech ? 'Mechanical_BG' : 'Wooden_BG'}.png) center/100% 100%"></div>
      <div id="pcs"></div>
      ${PZ.bottomBar(a, st, [{ x: -43 - 42, y: -264, key: 'UI_PUZZLE_SKILL', img: PZ.skillIcon(a.AbilityType) }, { x: 97 - 45, y: -264, key: 'UI_PUZZLE_MOVES', id: 'mv', val: 0 }, { x: 291 - 72, y: -264, key: 'UI_PUZZLE_TOTAL_MOVES', id: 'tm', val: st.total }])}
      ${PZ.closeBtn(-282, -263)}
    </div>`);
    const view = L.querySelector('#pzv'), box = L.querySelector('#pcs');
    const cells = (p) => { const [l, x, y, o] = p; return Array.from({ length: l }, (_, k) => o === 0 ? [x + k, y] : [x, y - k]); };
    const geom = (p) => {
      const cs = cells(p); const cx = cs.reduce((s, c) => s + c[0], 0) / cs.length, cy = cs.reduce((s, c) => s + c[1], 0) / cs.length;
      return { x: GX + cx * CELL, y: GY + cy * CELL, len: (p[0] - 1) * CELL + CELL * 0.94 };
    };
    const occ = (skip) => { const s = new Set(); st.p.forEach((p, i) => { if (i !== skip) cells(p).forEach(c => s.add(c + '')); }); return s; };
    const draw = () => {
      box.innerHTML = st.p.map((p, i) => {
        const g = geom(p), w = 76, h = g.len;
        return `<div class="lockPiece" data-i="${i}" style="${OFF.at(g.x, g.y, w, h)};background-image:url(${pieceImg(p)});${p[3] === 0 ? 'transform:rotate(90deg)' : ''}"></div>`;
      }).join('');
      L.querySelector('#mv').textContent = moves; L.querySelector('#tm').textContent = st.total;
      box.querySelectorAll('.lockPiece').forEach(el => bind(el, +el.dataset.i));
    };
    const bind = (el, i) => {
      el.onpointerdown = e => {
        if (finished) return;
        el.setPointerCapture(e.pointerId); el.classList.add('drag');
        const p = st.p[i], horiz = p[3] === 0, o = occ(i);
        // 可移動範圍
        let minD = 0, maxD = 0;
        const free = d => cells(horiz ? [p[0], p[1] + d, p[2], p[3]] : [p[0], p[1], p[2] + d, p[3]]).every(([x, y]) => x >= 0 && y >= 0 && x < 6 && y < 6 && !o.has(x + ',' + y));
        while (free(minD - 1)) minD--; while (free(maxD + 1)) maxD++;
        const sx = e.clientX, sy = e.clientY, base = el.style.cssText;
        let d = 0;
        el.onpointermove = ev => {
          const dpx = horiz ? (ev.clientX - sx) : -(ev.clientY - sy);
          d = Math.max(minD, Math.min(maxD, Math.round(dpx / (CELL * u))));
          const g = geom(horiz ? [p[0], p[1] + d, p[2], p[3]] : [p[0], p[1], p[2] + d, p[3]]);
          el.style.left = (g.x - 38) * u + 'px'; el.style.top = (-g.y - g.len / 2) * u + 'px';
        };
        el.onpointerup = async () => {
          el.onpointermove = el.onpointerup = null; el.classList.remove('drag');
          if (d) { if (horiz) p[1] += d; else p[2] += d; moves++; st.total++; }
          draw();
          if (p[4] && p[1] + p[0] === 6) {
            finished = true; PZ.clear(f);
            const k = box.querySelector(`[data-i="${i}"]`); k.style.transition = 'left .6s ease-in'; await sleep(20); k.style.left = (parseFloat(k.style.left) + 230 * u) + 'px';
            await sleep(600); await PZ.finish(view, true); res(true);
          }
        };
      };
    };
    L.querySelector('#pzClose').onclick = async () => { if (finished) return; await PZ.finish(view, false); res(false); };
    draw();
  });
};
